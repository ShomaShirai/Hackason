// Playwrightテストスクリプト - 患者側を自動化
import { chromium } from 'playwright';

async function testVideoCall() {
  // サーバーを起動
  console.log('Starting servers...');
  
  // バックエンドサーバーを起動（ポート8787）
  const { spawn } = await import('child_process');
  const backend = spawn('npx', ['wrangler', 'dev', '--local', '--port', '8787'], {
    stdio: 'inherit'
  });
  
  // フロントエンドサーバーを起動（ポート5173）
  const frontend = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit'
  });
  
  // サーバーが起動するまで待つ
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('\n=== サーバー起動完了 ===');
  console.log('フロントエンド: http://localhost:5173');
  console.log('バックエンド: http://localhost:8787');
  
  // Playwrightで患者側の動作を自動化
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  
  const context = await browser.newContext({
    permissions: ['camera', 'microphone']
  });
  
  const page = await context.newPage();
  
  try {
    console.log('\n=== 患者側の自動操作開始 ===');
    
    // ログインページへ
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    
    // 患者としてログイン
    console.log('患者としてログイン中...');
    await page.fill('input[name="email"]', 'patient1@test.com');
    await page.fill('input[name="password"]', 'test1234');
    await page.click('button[type="submit"]');
    
    // ダッシュボードに遷移するまで待つ
    await page.waitForURL('**/patient');
    console.log('患者ダッシュボードに到達');
    
    // 診察画面へ遷移（仮のappointmentId）
    const appointmentId = '123e4567-e89b-12d3-a456-426614174000';
    await page.goto(`http://localhost:5173/patient/consultation/${appointmentId}`);
    console.log('診察画面に遷移');
    
    // カメラ・マイクの許可を待つ
    await page.waitForTimeout(3000);
    
    console.log('\n==============================================');
    console.log('患者側の準備が完了しました！');
    console.log('==============================================');
    console.log('\n医師側でアクセスしてください:');
    console.log(`http://localhost:5173/worker/doctor/consultation/${appointmentId}`);
    console.log('\n手順:');
    console.log('1. 上記URLをブラウザで開く');
    console.log('2. 医師としてログイン（worker1@test.com / test1234）');
    console.log('3. カメラ・マイクを許可');
    console.log('4. ビデオ通話が開始されます');
    console.log('\n終了する場合は Ctrl+C を押してください');
    
    // プロセスを維持
    await new Promise(() => {});
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
  
  // クリーンアップ
  process.on('SIGINT', async () => {
    console.log('\n終了中...');
    backend.kill();
    frontend.kill();
    await browser.close();
    process.exit(0);
  });
}

// 実行
testVideoCall().catch(console.error);