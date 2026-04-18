import { VideoPlayer } from './components/VideoPlayer';

export function App() {
  return (
    <div style={{ maxWidth: 600, margin: '20px auto' }}>
      <h1 style={{ fontSize: 16, marginBottom: 12, color: '#aaa' }}>G2 Video Player</h1>
      <VideoPlayer src="/bad-apple.mp4" />
    </div>
  );
}
