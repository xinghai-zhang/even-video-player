import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { type PlaybackStatus } from '../types/video';

const STATUS_COLOR: Record<PlaybackStatus, string> = {
  idle: '#555',
  loading: '#888',
  playing: '#4f4',
  paused: '#fa0',
  ended: '#48f',
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export function VideoPlayer({ src }: { src: string }) {
  const { state, connected, bridgeReady, fps, togglePlayPause, seekRelative, reset } = useVideoPlayer(src);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 8, color: '#aaa', fontSize: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 'bold', color: fps > 0 ? '#ff9' : '#555', fontSize: 14 }}>
          {fps} fps
        </span>
        <span>
          G2: <span style={{ color: connected ? '#4f4' : '#555' }}>{connected ? '● connected' : '○ not connected'}</span>
          {' '}| bridge: <span style={{ color: bridgeReady ? '#4f4' : '#555' }}>{bridgeReady ? 'ready' : 'pending'}</span>
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={{ color: STATUS_COLOR[state.status] }}>■ {state.status}</span>
        {' '}
        <span style={{ color: '#ccc' }}>{formatTime(state.currentTime)} / {formatTime(state.duration)}</span>
        {' '}
        <span style={{ color: '#777' }}>{state.filename}</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={togglePlayPause}>{state.status === 'playing' ? 'Pause' : 'Play'}</button>
        <button onClick={() => seekRelative(-10)}>−10s</button>
        <button onClick={() => seekRelative(10)}>+10s</button>
        <button onClick={reset}>Reset</button>
      </div>

      <div style={{ marginTop: 12, color: '#555', fontSize: 11 }}>
        G2 controls: single tap = play/pause · swipe up = +10s · swipe down = −10s · double tap = reset
      </div>
    </div>
  );
}
