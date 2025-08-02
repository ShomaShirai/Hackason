export interface MediaStreams {
    audioStream: MediaStream | null;
    videoStream: MediaStream | null;
    screenStream: MediaStream | null;
}

export interface MediaTracks {
    audioTrack: MediaStreamTrack | null;
    videoTrack: MediaStreamTrack | null;
    screenTrack: MediaStreamTrack | null;
}

export class MediaManager {
    private streams: MediaStreams = {
        audioStream: null,
        videoStream: null,
        screenStream: null
    };

    private tracks: MediaTracks = {
        audioTrack: null,
        videoTrack: null,
        screenTrack: null
    };

    private isInitialized = false;

    async initialize(): Promise<void> {
        try {
            // 初期メディアストリームを取得
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });

            // 音声とビデオのトラックを分離
            const audioTrack = stream.getAudioTracks()[0];
            const videoTrack = stream.getVideoTracks()[0];

            this.tracks.audioTrack = audioTrack;
            this.tracks.videoTrack = videoTrack;
            this.streams.audioStream = new MediaStream([audioTrack]);
            this.streams.videoStream = new MediaStream([videoTrack]);

            this.isInitialized = true;
            console.log('Media Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Media Manager:', error);
            throw error;
        }
    }

    // 音声のオン/オフ切り替え
    toggleAudio(enabled: boolean): void {
        if (!this.tracks.audioTrack) {
            console.warn('Audio track not available');
            return;
        }

        this.tracks.audioTrack.enabled = enabled;
        console.log(`Audio ${enabled ? 'enabled' : 'disabled'}`);
    }

    // ビデオのオン/オフ切り替え
    toggleVideo(enabled: boolean): void {
        if (!this.tracks.videoTrack) {
            console.warn('Video track not available');
            return;
        }

        this.tracks.videoTrack.enabled = enabled;
        console.log(`Video ${enabled ? 'enabled' : 'disabled'}`);
    }

    // 画面共有の開始
    async startScreenShare(): Promise<MediaStream | null> {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            this.tracks.screenTrack = screenTrack;
            this.streams.screenStream = screenStream;

            // 画面共有終了時の処理
            screenTrack.onended = () => {
                console.log('Screen sharing ended');
                this.stopScreenShare();
            };

            console.log('Screen sharing started');
            return screenStream;
        } catch (error) {
            console.error('Failed to start screen sharing:', error);
            return null;
        }
    }

    // 画面共有の停止
    stopScreenShare(): void {
        if (this.tracks.screenTrack) {
            this.tracks.screenTrack.stop();
            this.tracks.screenTrack = null;
            this.streams.screenStream = null;
            console.log('Screen sharing stopped');
        }
    }

    // メディアストリームの取得
    getAudioStream(): MediaStream | null {
        return this.streams.audioStream;
    }

    getVideoStream(): MediaStream | null {
        return this.streams.videoStream;
    }

    getScreenStream(): MediaStream | null {
        return this.streams.screenStream;
    }

    // 全ストリームの停止
    stopAllStreams(): void {
        Object.values(this.tracks).forEach(track => {
            if (track) {
                track.stop();
            }
        });

        this.tracks = {
            audioTrack: null,
            videoTrack: null,
            screenTrack: null
        };

        this.streams = {
            audioStream: null,
            videoStream: null,
            screenStream: null
        };

        this.isInitialized = false;
        console.log('All streams stopped');
    }

    // 初期化状態の確認
    isReady(): boolean {
        return this.isInitialized;
    }

    // 現在のトラック状態を取得
    getTrackStates() {
        return {
            audioEnabled: this.tracks.audioTrack?.enabled ?? false,
            videoEnabled: this.tracks.videoTrack?.enabled ?? false,
            screenSharing: this.tracks.screenTrack !== null
        };
    }
}

// シングルトンインスタンス
export const mediaManager = new MediaManager(); 