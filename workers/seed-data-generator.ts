
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { patients, workers } from './db/schema';
import { hashPasswordSync } from './auth/password';

/**
 * シードデータ生成スクリプト
 *
 * 使い方:
 * 1. デフォルトパスワード: TEST_PASSWORD=test123 node seed-data-generator.js
 * 2. カスタムパスワード: TEST_PASSWORD=mypassword node seed-data-generator.js
 * 3. ランダムパスワード: RANDOM_PASSWORD=true node seed-data-generator.js
 */

const DEFAULT_TEST_PASSWORD = 'test1234';

function  generatePassword(): { password: string; hash: string } {
  let password: string;

  if (process.env.RANDOM_PASSWORD === 'true') {
    // ランダムパスワード生成
    password =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  } else {
    // 環境変数またはデフォルト
    password = process.env.TEST_PASSWORD || DEFAULT_TEST_PASSWORD;
  }

  const hash = hashPasswordSync(password);

  return { password, hash };
}

export async function generateSeedData(dbUrl: string = 'file:local.db') {
  const { password, hash } = generatePassword();

  console.log('🔐 テストアカウント情報:');
  console.log('='.repeat(50));
  console.log(`パスワード: ${password}`);
  console.log(`ハッシュ: ${hash}`);
  console.log('='.repeat(50));

  // .envファイルに書き出すオプション
  if (process.env.SAVE_TO_ENV === 'true') {
    const fs = await import('fs');
    const envContent = `
# テスト用アカウント情報（開発環境のみ）
TEST_PASSWORD=${password}
TEST_PASSWORD_HASH=${hash}
`;
    await fs.promises.writeFile('.env.test', envContent, 'utf-8');
    console.log('📝 .env.test ファイルに保存しました');
  }

  const client = createClient({ url: dbUrl });
  const db = drizzle(client);

  try {
    // 患者データ
    const patientsData = [
      {
        email: 'patient@test.com',
        name: '山田太郎',
        phoneNumber: '090-1234-5678',
        dateOfBirth: new Date('1985-05-15'),
        gender: 'male' as const,
        passwordHash: hash,
        emergencyContact: JSON.stringify({
          name: '山田花子',
          phoneNumber: '090-8765-4321',
          relationship: '配偶者',
        }),
      },
      {
        email: 'patient2@test.com',
        name: '佐藤花子',
        phoneNumber: '090-2345-6789',
        dateOfBirth: new Date('1990-03-20'),
        gender: 'female' as const,
        passwordHash: hash,
        emergencyContact: JSON.stringify({
          name: '佐藤太郎',
          phoneNumber: '090-9876-5432',
          relationship: '配偶者',
        }),
      },
    ];

    // 医療従事者データ
    const workersData = [
      {
        email: 'doctor@test.com',
        name: '田中医師',
        role: 'doctor' as const,
        phoneNumber: '03-1234-5678',
        passwordHash: hash,
        medicalLicenseNumber: 'MD-123456',
      },
      {
        email: 'operator@test.com',
        name: '鈴木オペレータ',
        role: 'operator' as const,
        phoneNumber: '03-2345-6789',
        passwordHash: hash,
      },
      {
        email: 'admin@test.com',
        name: '管理者',
        role: 'admin' as const,
        phoneNumber: '03-3456-7890',
        passwordHash: hash,
      },
    ];

    // データ挿入
    console.log('\n🌱 テストデータを挿入中...');

    for (const patient of patientsData) {
      await db.insert(patients).values(patient).onConflictDoNothing();
    }
    console.log('✅ 患者データ挿入完了');

    for (const worker of workersData) {
      await db.insert(workers).values(worker).onConflictDoNothing();
    }
    console.log('✅ 医療従事者データ挿入完了');

    // README生成
    if (process.env.GENERATE_README === 'true') {
      const readmeContent = `# テストアカウント情報

## 患者アカウント
- patient@test.com / ${password}
- patient2@test.com / ${password}

## 医療従事者アカウント
- doctor@test.com / ${password}
- operator@test.com / ${password}
- admin@test.com / ${password}

⚠️ **注意**: これらは開発環境専用のテストアカウントです。本番環境では使用しないでください。
`;
      const fs = await import('fs');
      await fs.promises.writeFile('TEST_ACCOUNTS.md', readmeContent, 'utf-8');
      console.log('📄 TEST_ACCOUNTS.md を生成しました');
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await client.close();
  }
}

// CLIとして実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSeedData();
}
