export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended';

export interface VideoState {
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  filename: string;
}

export const VIDEO_WIDTH = 576;
export const VIDEO_HEIGHT = 144;

export const HALF_WIDTH = VIDEO_WIDTH / 2; // 288 — left/right split point

export const IMAGE_CONTAINER_IDS = [1, 2] as const;
export const STATUS_CONTAINER_ID = 3;
