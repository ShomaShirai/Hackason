/**
 * 音声ストリーム抽出サービス
 * WebRTC通話から音声ストリームを抽出し、録音・処理を行う
 */

export interface AudioStreamConfig {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioRecordingOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  timeslice?: number; // チャンクごとの録音時間（ミリ秒）
}

export class AudioStreamExtractor {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  // private _stream: MediaStream | null = null; // 未使用のため削除
  private isRecording = false;
  private onDataCallback?: (chunk: Blob) => void;
  private onVolumeCallback?: (volume: number) => void;

  constructor(private config: AudioStreamConfig = {}) {
    this.config = {
      sampleRate: 44100,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...config
    };
  }

  /**
   * RTCPeerConnectionから音声ストリームを抽出
   */
  async extractFromPeerConnection(peerConnection: RTCPeerConnection): Promise<MediaStream> {
    const receivers = peerConnection.getReceivers();
    const audioReceiver = receivers.find(receiver => receiver.track?.kind === 'audio');
    
    if (!audioReceiver || !audioReceiver.track) {
      throw new Error('No audio track found in peer connection');
    }

    // リモート音声トラックから新しいMediaStreamを作成
    const remoteStream = new MediaStream([audioReceiver.track]);

    // ローカル音声も含める場合
    const senders = peerConnection.getSenders();
    const audioSender = senders.find(sender => sender.track?.kind === 'audio');
    
    if (audioSender && audioSender.track) {
      // ローカルとリモートの音声をミックス
      return this.mixAudioStreams(
        new MediaStream([audioSender.track]),
        remoteStream
      );
    }

    return remoteStream;
  }

  /**
   * MediaStreamから音声トラックを抽出
   */
  extractAudioTrack(stream: MediaStream): MediaStreamTrack | null {
    const audioTracks = stream.getAudioTracks();
    return audioTracks.length > 0 ? audioTracks[0] : null;
  }

  /**
   * 複数の音声ストリームをミックス
   */
  private async mixAudioStreams(
    localStream: MediaStream,
    remoteStream: MediaStream
  ): Promise<MediaStream> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });
    }

    const destination = this.audioContext.createMediaStreamDestination();
    
    // ローカル音声を接続
    const localSource = this.audioContext.createMediaStreamSource(localStream);
    localSource.connect(destination);
    
    // リモート音声を接続
    const remoteSource = this.audioContext.createMediaStreamSource(remoteStream);
    remoteSource.connect(destination);

    return destination.stream;
  }

  /**
   * 録音開始
   */
  async startRecording(
    stream: MediaStream,
    options: AudioRecordingOptions = {},
    onDataAvailable?: (chunk: Blob) => void
  ): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording is already in progress');
    }

    // this._stream = stream; // 未使用のため削除
    this.audioChunks = [];
    this.onDataCallback = onDataAvailable;

    const recordingOptions: AudioRecordingOptions = {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000,
      timeslice: 1000, // 1秒ごとにデータを送信
      ...options
    };

    // MediaRecorderがサポートする形式を確認
    if (!MediaRecorder.isTypeSupported(recordingOptions.mimeType!)) {
      recordingOptions.mimeType = 'audio/webm';
    }

    this.mediaRecorder = new MediaRecorder(stream, recordingOptions);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
        this.onDataCallback?.(event.data);
      }
    };

    this.mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      this.stopRecording();
    };

    // 音声レベル分析を開始
    this.startVolumeAnalysis(stream);

    this.mediaRecorder.start(recordingOptions.timeslice);
    this.isRecording = true;
  }

  /**
   * 録音停止
   */
  async stopRecording(): Promise<Blob> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        this.isRecording = false;
        this.stopVolumeAnalysis();
        resolve(audioBlob);
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * 音声レベル分析を開始
   */
  private startVolumeAnalysis(stream: MediaStream): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    source.connect(this.analyser);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkVolume = () => {
      if (!this.isRecording || !this.analyser) {return;}

      this.analyser.getByteFrequencyData(dataArray);
      
      // 音声レベルを計算（0-100の範囲）
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const volume = Math.min(100, (average / 255) * 100 * 2);
      
      this.onVolumeCallback?.(volume);

      requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }

  /**
   * 音声レベル分析を停止
   */
  private stopVolumeAnalysis(): void {
    this.analyser?.disconnect();
    this.analyser = null;
  }

  /**
   * 音声レベルコールバックを設定
   */
  onVolumeChange(callback: (volume: number) => void): void {
    this.onVolumeCallback = callback;
  }

  /**
   * 録音データをBase64エンコード
   */
  async encodeToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // data:audio/webm;base64, を除去
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 録音データをArrayBufferに変換
   */
  async toArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return blob.arrayBuffer();
  }

  /**
   * リアルタイムストリーミング用のWebSocket接続
   */
  async streamToWebSocket(
    websocketUrl: string,
    stream: MediaStream,
    options: AudioRecordingOptions = {}
  ): Promise<WebSocket> {
    const ws = new WebSocket(websocketUrl);
    
    await new Promise((resolve, reject) => {
      ws.onopen = () => resolve(undefined);
      ws.onerror = reject;
    });

    // ストリーミング録音を開始
    await this.startRecording(stream, options, async (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        // BlobをArrayBufferに変換して送信
        const arrayBuffer = await chunk.arrayBuffer();
        ws.send(arrayBuffer);
      }
    });

    return ws;
  }

  /**
   * 現在の録音状態を取得
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    if (this.isRecording) {
      this.stopRecording().catch(console.error);
    }
    
    this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
    // this._stream = null; // 未使用のため削除
    this.mediaRecorder = null;
  }
}