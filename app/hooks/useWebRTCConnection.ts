import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeSignalingService } from '../services/realtime-signaling';

interface UseWebRTCConnectionOptions {
  sessionId: string;
  userId: string;
  token: string;
  localStream: MediaStream | null;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onError: (error: Error) => void;
}

interface UseWebRTCConnectionReturn {
  peerConnection: RTCPeerConnection | null;
  connectionState: RTCPeerConnectionState;
  signalingState: RTCSignalingState;
  createOffer: () => Promise<void>;
  createAnswer: (offer: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidate) => Promise<void>;
  disconnect: () => void;
}

export function useWebRTCConnection({
  sessionId,
  userId,
  token,
  localStream,
  onRemoteStream,
  onConnectionStateChange,
  onError
}: UseWebRTCConnectionOptions): UseWebRTCConnectionReturn {
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [signalingState, setSignalingState] = useState<RTCSignalingState>('stable');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalingServiceRef = useRef<RealtimeSignalingService | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidate[]>([]);

  // RTCPeerConnectionを初期化
  const initializePeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
          urls: 'turn:turn.cloudflare.com:3478',
          username: 'cloudflare',
          credential: token
        }
      ],
      iceCandidatePoolSize: 10
    });

    // イベントリスナーを設定
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      onConnectionStateChange(pc.connectionState);
    };

    pc.onsignalingstatechange = () => {
      setSignalingState(pc.signalingState);
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate && signalingServiceRef.current?.isConnected) {
        try {
          await signalingServiceRef.current.sendIceCandidate(event.candidate);
        } catch (error) {
          console.error('Failed to send ICE candidate:', error);
        }
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        onRemoteStream(event.streams[0]);
      }
    };

    // ローカルストリームのトラックを追加
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [token, localStream, onRemoteStream, onConnectionStateChange]);

  // シグナリングサービスを初期化
  const initializeSignaling = useCallback(async () => {
    const signalingService = new RealtimeSignalingService(sessionId, userId, {
      onOffer: async (offer) => {
        try {
          await createAnswer(offer);
        } catch (error) {
          console.error('Failed to handle offer:', error);
          onError(error as Error);
        }
      },
      onAnswer: async (answer) => {
        try {
          const pc = peerConnectionRef.current;
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));

            // キューに溜まったICE候補を追加
            while (iceCandidateQueueRef.current.length > 0) {
              const candidate = iceCandidateQueueRef.current.shift();
              if (candidate) {
                await pc.addIceCandidate(candidate);
              }
            }
          }
        } catch (error) {
          console.error('Failed to handle answer:', error);
          onError(error as Error);
        }
      },
      onIceCandidate: async (candidate) => {
        try {
          await addIceCandidate(candidate);
        } catch (error) {
          console.error('Failed to handle ICE candidate:', error);
        }
      },
      onError: onError
    });

    try {
      await signalingService.connect(token);
      signalingServiceRef.current = signalingService;
    } catch (error) {
      console.error('Failed to connect to signaling server:', error);
      onError(error as Error);
    }
  }, [sessionId, userId, token, onError]); // eslint-disable-line react-hooks/exhaustive-deps

  // オファーを作成
  const createOffer = useCallback(async () => {
    const pc = peerConnectionRef.current;
    const signalingService = signalingServiceRef.current;

    if (!pc || !signalingService?.isConnected) {
      throw new Error('Not ready to create offer');
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await pc.setLocalDescription(offer);
      await signalingService.sendOffer(offer);
    } catch (error) {
      console.error('Failed to create offer:', error);
      throw error;
    }
  }, []);

  // アンサーを作成
  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    const signalingService = signalingServiceRef.current;

    if (!pc || !signalingService?.isConnected) {
      throw new Error('Not ready to create answer');
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await signalingService.sendAnswer(answer);

      // キューに溜まったICE候補を追加
      while (iceCandidateQueueRef.current.length > 0) {
        const candidate = iceCandidateQueueRef.current.shift();
        if (candidate) {
          await pc.addIceCandidate(candidate);
        }
      }
    } catch (error) {
      console.error('Failed to create answer:', error);
      throw error;
    }
  }, []);

  // ICE候補を追加
  const addIceCandidate = useCallback(async (candidate: RTCIceCandidate) => {
    const pc = peerConnectionRef.current;

    if (!pc) {
      return;
    }

    // リモート記述が設定されていない場合はキューに追加
    if (!pc.remoteDescription) {
      iceCandidateQueueRef.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }, []);

  // 切断
  const disconnect = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (signalingServiceRef.current) {
      signalingServiceRef.current.disconnect();
      signalingServiceRef.current = null;
    }

    iceCandidateQueueRef.current = [];
  }, []);

  // 初期化
  useEffect(() => {
    initializePeerConnection();
    initializeSignaling();

    return () => {
      disconnect();
    };
  }, [initializePeerConnection, initializeSignaling, disconnect]);

  return {
    peerConnection: peerConnectionRef.current,
    connectionState,
    signalingState,
    createOffer,
    createAnswer,
    addIceCandidate,
    disconnect
  };
}
