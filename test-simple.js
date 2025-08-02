// 簡単なテストスクリプト - 患者側を手動で操作

console.log('\n=== オンライン診療ビデオ通話テスト ===\n');

console.log('1. まず、以下のコマンドを別々のターミナルで実行してください:\n');
console.log('   ターミナル1（バックエンド）:');
console.log('   npx wrangler dev --local --port 8787\n');
console.log('   ターミナル2（フロントエンド）:');
console.log('   npm run dev\n');

console.log('2. サーバーが起動したら、以下の手順でテストしてください:\n');

const appointmentId = '123e4567-e89b-12d3-a456-426614174000';

console.log('【患者側】');
console.log(`- URL: http://localhost:5173/login`);
console.log('- ログイン: patient1@test.com / test1234');
console.log(`- 診察画面: http://localhost:5173/patient/consultation/${appointmentId}`);
console.log('- カメラ・マイクを許可してください\n');

console.log('【医師側】');
console.log(`- URL: http://localhost:5173/worker/login`);
console.log('- ログイン: worker1@test.com / test1234');
console.log(`- 診察画面: http://localhost:5173/worker/doctor/consultation/${appointmentId}`);
console.log('- カメラ・マイクを許可してください\n');

console.log('==============================================');
console.log('医師側の診察画面URL:');
console.log(`http://localhost:5173/worker/doctor/consultation/${appointmentId}`);
console.log('==============================================\n');

console.log('注意事項:');
console.log('- 両方のブラウザウィンドウでカメラ・マイクを許可する必要があります');
console.log('- 同じPCで2つのブラウザを開く場合は、別のブラウザ（Chrome/Firefox）または');
console.log('  プライベートウィンドウを使用してください');
console.log('- ビデオ通話が開始されない場合は、ブラウザのコンソールでエラーを確認してください\n');