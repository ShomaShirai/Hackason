import { Link } from 'react-router';

export function meta() {
  return [
    { title: 'オンライン診療システム' },
    { name: 'description', content: 'ファストドクター主催ハッカソン用オンライン診療システム' },
  ];
}

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* ヒーローセクション */}
      <div className="relative pt-6 pb-16 sm:pb-24">
        <div className="mt-16 mx-auto max-w-7xl px-4 sm:mt-24 sm:px-6">
          <div className="text-center">
            <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
              <span className="block">オンライン診療システム</span>
              <span className="block text-blue-600">ハッカソン開発基盤</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              ファストドクター主催「オンライン診療AI活用ハッカソン」用の開発基盤システムです。
              患者と医師が安全にビデオ通話できる基本機能を提供しています。
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
              <div className="rounded-md shadow">
                <Link
                  to="/patient/login"
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
                >
                  患者としてログイン
                </Link>
              </div>
              <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                <Link
                  to="/worker/login"
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
                >
                  医療従事者としてログイン
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 機能紹介セクション */}
      <div className="relative bg-white py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-md px-4 text-center sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl">
          <h2 className="text-base font-semibold tracking-wider text-blue-600 uppercase">
            主要機能
          </h2>
          <p className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            ハッカソン参加者向けの開発基盤
          </p>
          <div className="mt-12">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="pt-6">
                <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                  <div className="-mt-6">
                    <div>
                      <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                        <svg
                          className="h-6 w-6 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </span>
                    </div>
                    <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                      ビデオ通話機能
                    </h3>
                    <p className="mt-5 text-base text-gray-500">
                      Cloudflare Realtimeを活用した双方向ビデオ通話機能。
                      音声・映像の品質調整、接続状態監視を実装済み。
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                  <div className="-mt-6">
                    <div>
                      <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                        <svg
                          className="h-6 w-6 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </span>
                    </div>
                    <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                      セキュア認証
                    </h3>
                    <p className="mt-5 text-base text-gray-500">
                      JWT認証による患者・医師・オペレータの役割ベースアクセス制御。
                      医療情報の安全な取り扱いを実現。
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8">
                  <div className="-mt-6">
                    <div>
                      <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                        <svg
                          className="h-6 w-6 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                      </span>
                    </div>
                    <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                      拡張可能な設計
                    </h3>
                    <p className="mt-5 text-base text-gray-500">
                      AI機能統合、カスタムUI、外部API連携のための
                      拡張ポイントを用意。ハッカソンでの機能追加が容易。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 技術スタック */}
      <div className="bg-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base font-semibold text-blue-600 tracking-wide uppercase">
              技術スタック
            </h2>
            <p className="mt-2 text-3xl font-extrabold text-gray-900">
              モダンな技術で構築
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-6">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-800">
                React Router v7
              </span>
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-800">
                Hono
              </span>
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-800">
                Cloudflare Workers
              </span>
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-800">
                Cloudflare D1
              </span>
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-800">
                Cloudflare Realtime
              </span>
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-800">
                TypeScript
              </span>
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-800">
                Tailwind CSS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
