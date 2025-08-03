import { useState, useEffect } from 'react';

interface ConnectionMetrics {
  connectionState: string;
  iceConnectionState: string;
  packetLossRate: number;
  rtt: number;
  jitter: number;
  bytesSent: number;
  bytesReceived: number;
  candidateType?: string;
  localCandidateProtocol?: string;
  remoteCandidateProtocol?: string;
}

interface ConnectionQualityMonitorProps {
  metrics: ConnectionMetrics | null;
  className?: string;
}

export function ConnectionQualityMonitor({ metrics, className = '' }: ConnectionQualityMonitorProps) {
  const [qualityLevel, setQualityLevel] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!metrics) {return;}

    // 品質レベルの判定
    const { packetLossRate, rtt, jitter } = metrics;
    
    if (packetLossRate < 0.01 && rtt < 100 && jitter < 0.01) {
      setQualityLevel('excellent');
    } else if (packetLossRate < 0.03 && rtt < 200 && jitter < 0.02) {
      setQualityLevel('good');
    } else if (packetLossRate < 0.05 && rtt < 300 && jitter < 0.03) {
      setQualityLevel('fair');
    } else {
      setQualityLevel('poor');
    }
  }, [metrics]);

  if (!metrics) {return null;}

  const getQualityColor = (level: string) => {
    switch (level) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-green-400';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getQualityIcon = (level: string) => {
    switch (level) {
      case 'excellent': return '📶';
      case 'good': return '📶';
      case 'fair': return '📶';
      case 'poor': return '📶';
      default: return '📶';
    }
  };

  const getQualityText = (level: string) => {
    switch (level) {
      case 'excellent': return '優秀';
      case 'good': return '良好';
      case 'fair': return '普通';
      case 'poor': return '不安定';
      default: return '不明';
    }
  };

  return (
    <div className={`bg-black/20 backdrop-blur-sm rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getQualityIcon(qualityLevel)}</span>
          <div>
            <div className={`font-medium ${getQualityColor(qualityLevel)}`}>
              {getQualityText(qualityLevel)}
            </div>
            <div className="text-xs text-gray-300">
              {metrics.connectionState === 'connected' ? '接続済み' : '接続中...'}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-gray-300 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">パケット損失:</span>
              <span className="ml-1 text-white">
                {(metrics.packetLossRate * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-400">遅延時間:</span>
              <span className="ml-1 text-white">
                {metrics.rtt.toFixed(0)}ms
              </span>
            </div>
            <div>
              <span className="text-gray-400">ジッター:</span>
              <span className="ml-1 text-white">
                {(metrics.jitter * 1000).toFixed(1)}ms
              </span>
            </div>
            <div>
              <span className="text-gray-400">送信量:</span>
              <span className="ml-1 text-white">
                {(metrics.bytesSent / 1024).toFixed(0)}KB
              </span>
            </div>
            {metrics.candidateType && (
              <div className="col-span-2">
                <span className="text-gray-400">接続タイプ:</span>
                <span className="ml-1 text-white">
                  {metrics.candidateType} ({metrics.localCandidateProtocol}/{metrics.remoteCandidateProtocol})
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 