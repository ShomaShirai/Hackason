
import { hashPasswordSync } from './auth/password';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 共通のテストパスワード
const TEST_PASSWORD = 'test1234';
const passwordHash = hashPasswordSync(TEST_PASSWORD);

console.log(`テストパスワード '${TEST_PASSWORD}' のハッシュ値を生成しました`);
console.log(`Hash: ${passwordHash}`);

// SQLファイルの内容を生成
const sqlContent = `-- 共通のテストパスワード: ${TEST_PASSWORD}
-- 生成されたハッシュ: ${passwordHash}

-- 専門科マスターデータ
INSERT INTO specialties (name, display_name, display_order) VALUES
('internal_medicine', '内科', 1),
('pediatrics', '小児科', 2),
('fever_outpatient', '発熱外来', 3),
('otolaryngology', '耳鼻咽喉科', 4),
('allergy_rhinitis', 'アレルギー科・花粉症外来', 5),
('dermatology', '皮膚科', 6),
('respiratory_medicine', '呼吸器内科', 7),
('lifestyle_disease', '生活習慣病外来', 8),
('urology', '泌尿器科', 9),
('gynecology', '婦人科', 10)
ON CONFLICT(name) DO NOTHING;

-- 資格マスターデータ
INSERT INTO qualifications (name, display_name, category, certifying_body) VALUES
-- 内科系
('internist_certified', '認定内科医', 'certified', '日本内科学会'),
('internist_specialist', '内科専門医', 'specialist', '日本内科学会'),
('general_internist_specialist', '総合内科専門医', 'specialist', '日本内科学会'),
('internist_instructor', '内科指導医', 'instructor', '日本内科学会'),
-- 小児科系
('pediatrician_specialist', '小児科専門医', 'specialist', '日本小児科学会'),
('pediatrician_instructor', '小児科指導医', 'instructor', '日本小児科学会'),
-- 皮膚科系
('dermatologist_specialist', '皮膚科専門医', 'specialist', '日本皮膚科学会'),
-- サブスペシャリティ
('diabetes_specialist', '糖尿病専門医', 'subspecialty', '日本糖尿病学会'),
('allergy_specialist', 'アレルギー専門医', 'subspecialty', '日本アレルギー学会'),
('infection_specialist', '感染症専門医', 'subspecialty', '日本感染症学会')
ON CONFLICT(name) DO NOTHING;

-- 患者テストデータ（パスワード: ${TEST_PASSWORD}）
INSERT INTO patients (email, name, phone_number, date_of_birth, gender, address, password_hash, emergency_contact, medical_history) VALUES
('patient@test.com', '山田太郎', '090-1234-5678', '1985-05-15', 'male', '東京都新宿区1-1-1', '${passwordHash}', '{"name":"山田花子","relation":"配偶者","phone":"090-8765-4321"}', '{"allergies":["ペニシリン","甲殻類"],"medications":[],"conditions":["高血圧"]}'),
('patient2@test.com', '佐藤花子', '090-2345-6789', '1990-03-20', 'female', '東京都渋谷区2-2-2', '${passwordHash}', '{"name":"佐藤太郎","relation":"配偶者","phone":"090-9876-5432"}', '{"allergies":[],"medications":["ビタミンD"],"conditions":[]}')
ON CONFLICT(email) DO NOTHING;

-- 医療従事者テストデータ（パスワード: ${TEST_PASSWORD}）
INSERT INTO workers (email, name, role, phone_number, password_hash, medical_license_number) VALUES
('doctor@test.com', '田中医師', 'doctor', '03-1234-5678', '${passwordHash}', 'MD-123456'),
('doctor2@test.com', '鈴木医師', 'doctor', '03-2345-6789', '${passwordHash}', 'MD-789012'),
('operator@test.com', '山田オペレータ', 'operator', '03-3456-7890', '${passwordHash}', NULL),
('admin@test.com', '管理者', 'admin', '03-4567-8901', '${passwordHash}', NULL)
ON CONFLICT(email) DO NOTHING;`;

// SQLファイルを出力
const outputPath = path.join(__dirname, 'seed-prod.sql');
fs.writeFileSync(outputPath, sqlContent, 'utf-8');

console.log(`\n✅ SQLファイルを生成しました: ${outputPath}`);
console.log('\n以下のコマンドで本番環境にシードデータを投入できます:');
console.log('npx wrangler d1 execute medical-consultation-db --file=./workers/seed-prod.sql --remote');
