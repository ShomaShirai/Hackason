import React from 'react';
import { CloudflareRealtimeVideo } from './CloudflareRealtimeVideo';

interface VideoCallComponentProps {
  appointmentId: string;
  role: 'patient' | 'doctor';
  onEnd?: () => void;
}

// Cloudflare Realtime統合ビデオ通話コンポーネント
const VideoCallComponent: React.FC<VideoCallComponentProps> = ({ appointmentId, role, onEnd }) => {
  // roleをuserTypeに変換
  const userType = role === 'doctor' ? 'worker' : 'patient';

  return (
    <CloudflareRealtimeVideo
      appointmentId={appointmentId}
      userType={userType}
      onSessionEnd={onEnd}
    />
  );
};

export { VideoCallComponent };
export default VideoCallComponent;