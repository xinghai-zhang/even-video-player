import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  TextContainerProperty,
  TextContainerUpgrade,
  ImageRawDataUpdate,
  DeviceConnectType,
  StartUpPageCreateResult,
} from '@evenrealities/even_hub_sdk';
import { bridge, waitForEvenAppBridge } from '../lib/bridge';
import {
  type VideoState,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  HALF_WIDTH,
  IMAGE_CONTAINER_IDS,
  STATUS_CONTAINER_ID,
} from '../types/video';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function buildStatusText(state: VideoState): string {
  const icon = state.status === 'playing' ? '▶' : '▐▐';
  return `${icon} ${formatTime(state.currentTime)}/${formatTime(state.duration)}  ${state.filename}`;
}


export function useVideoPlayer(videoSrc: string) {
  const [state, setState] = useState<VideoState>({
    status: 'idle',
    currentTime: 0,
    duration: 0,
    filename: videoSrc.split('/').pop() ?? videoSrc,
  });
  const [bridgeReady, setBridgeReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [fps, setFps] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const halfCanvasesRef = useRef<HTMLCanvasElement[]>([]);
  const sendingRef = useRef(false);
  const frameTimesRef = useRef<number[]>([]);

  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    videoRef.current = video;

    const main = document.createElement('canvas');
    main.width = VIDEO_WIDTH;
    main.height = VIDEO_HEIGHT;
    mainCanvasRef.current = main;

    halfCanvasesRef.current = Array.from({ length: 2 }, () => {
      const c = document.createElement('canvas');
      c.width = HALF_WIDTH;
      c.height = VIDEO_HEIGHT;
      return c;
    });

    return () => { video.src = ''; };
  }, []);

  // Load video source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setState(prev => ({ ...prev, status: 'loading', currentTime: 0, duration: 0 }));
    video.src = videoSrc;

    const onMeta = () =>
      setState(prev => ({
        ...prev,
        status: 'playing',
        duration: video.duration,
        filename: videoSrc.split('/').pop() ?? videoSrc,
      }));

    video.addEventListener('loadedmetadata', onMeta);
    return () => video.removeEventListener('loadedmetadata', onMeta);
  }, [videoSrc]);

  // Bridge initialization — 2 image containers (left/right) + 1 text container
  useEffect(() => {
    let mounted = true;

    waitForEvenAppBridge().then(async () => {
      if (!mounted) return;

      const page = new CreateStartUpPageContainer({
        containerTotalNum: 3,
        imageObject: [
          new ImageContainerProperty({ xPosition: 0,          yPosition: 0, width: HALF_WIDTH, height: VIDEO_HEIGHT, containerID: IMAGE_CONTAINER_IDS[0], containerName: 'vid-l' }),
          new ImageContainerProperty({ xPosition: HALF_WIDTH, yPosition: 0, width: HALF_WIDTH, height: VIDEO_HEIGHT, containerID: IMAGE_CONTAINER_IDS[1], containerName: 'vid-r' }),
        ],
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: VIDEO_HEIGHT, width: 576, height: 32,
            containerID: STATUS_CONTAINER_ID, containerName: 'status',
            content: 'Loading\u2026',
            isEventCapture: 1,
          }),
        ],
      });

      const result = await bridge.createStartUpPageContainer(page);
      if (!mounted) return;
      if (result !== StartUpPageCreateResult.success) {
        console.error('createStartUpPageContainer failed:', result);
        return;
      }
      setBridgeReady(true);
    });

    const unsubDevice = bridge.onDeviceStatusChanged(s => {
      setConnected(s.connectType === DeviceConnectType.Connected);
    });

    return () => { mounted = false; unsubDevice(); };
  }, []);

  const pushFrame = useCallback(async () => {
    if (sendingRef.current) return;
    const video = videoRef.current;
    const main = mainCanvasRef.current;
    const halves = halfCanvasesRef.current;
    if (!video || !main || halves.length < 2) return;

    const mainCtx = main.getContext('2d');
    if (!mainCtx) return;

    sendingRef.current = true;
    try {
      try {
        mainCtx.filter = 'grayscale(1)';
        mainCtx.drawImage(video, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      } finally {
        mainCtx.filter = 'none';
      }

      halves[0].getContext('2d')!.drawImage(main, 0,          0, HALF_WIDTH, VIDEO_HEIGHT, 0, 0, HALF_WIDTH, VIDEO_HEIGHT);
      halves[1].getContext('2d')!.drawImage(main, HALF_WIDTH, 0, HALF_WIDTH, VIDEO_HEIGHT, 0, 0, HALF_WIDTH, VIDEO_HEIGHT);

      const [leftBlob, rightBlob] = await Promise.all([
        new Promise<Blob | null>(res => halves[0].toBlob(res, 'image/jpeg', 0.5)),
        new Promise<Blob | null>(res => halves[1].toBlob(res, 'image/jpeg', 0.5)),
      ]);
      if (!leftBlob || !rightBlob) return;

      const leftBytes  = new Uint8Array(await leftBlob.arrayBuffer());
      const rightBytes = new Uint8Array(await rightBlob.arrayBuffer());

      await bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: IMAGE_CONTAINER_IDS[0], imageData: leftBytes }));
      await bridge.updateImageRawData(new ImageRawDataUpdate({ containerID: IMAGE_CONTAINER_IDS[1], imageData: rightBytes }));

      const now = performance.now();
      const times = frameTimesRef.current;
      times.push(now);
      frameTimesRef.current = times.filter(t => t >= now - 1000);
      setFps(frameTimesRef.current.length);
    } finally {
      sendingRef.current = false;
    }
  }, []);

  // Update status text (flicker-free)
  const updateStatus = useCallback((s: VideoState) => {
    if (!bridgeReady) return;
    bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: STATUS_CONTAINER_ID, content: buildStatusText(s) })
    ).catch(console.error);
  }, [bridgeReady]);

  // Playback loop — video runs at native speed; requestVideoFrameCallback sends frames when BLE is free
  useEffect(() => {
    if (state.status !== 'playing') return;

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    video.play().catch(console.error);

    const scheduleCapture = () => {
      if (cancelled) return;
      video.requestVideoFrameCallback(async () => {
        if (cancelled) return;

        if (video.currentTime >= video.duration) {
          video.pause();
          setState(prev => ({ ...prev, status: 'ended', currentTime: video.duration }));
          return;
        }

        const currentTime = video.currentTime;
        setState(prev => prev.status === 'playing' ? { ...prev, currentTime } : prev);
        updateStatus({ ...state, currentTime });

        if (bridgeReady) {
          await pushFrame();
        }

        scheduleCapture();
      });
    };

    scheduleCapture();

    return () => {
      cancelled = true;
      video.pause();
    };
  }, [state.status, bridgeReady, pushFrame, updateStatus]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    setState(prev => {
      if (prev.status === 'playing') {
        video?.pause();
        return { ...prev, status: 'paused' };
      }
      if (prev.status === 'paused' || prev.status === 'ended') {
        return { ...prev, status: 'playing' }; // effect handles video.play()
      }
      return prev;
    });
  }, []);

  const seekRelative = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    setState(prev => {
      const t = Math.max(0, Math.min(prev.duration, prev.currentTime + seconds));
      video.currentTime = t;
      return { ...prev, currentTime: t };
    });
  }, []);

  const reset = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setState(prev => ({ ...prev, status: 'paused', currentTime: 0 }));
  }, []);

  // G2 touch event handling
  useEffect(() => {
    const unsub = bridge.onEvenHubEvent((event) => {
      const eventType = (event as { eventType?: number }).eventType;
      if (eventType === 0) togglePlayPause();      // CLICK: play/pause
      else if (eventType === 1) seekRelative(10);  // SCROLL_TOP: +10s
      else if (eventType === 2) seekRelative(-10); // SCROLL_BOTTOM: -10s
      else if (eventType === 3) reset();           // DOUBLE_CLICK: restart
    });
    return unsub;
  }, [togglePlayPause, seekRelative, reset]);

  return { state, connected, bridgeReady, fps, togglePlayPause, seekRelative, reset };
}
