-- D1ローカル環境用シードデータ

-- 患者データ投入（正しいパスワードハッシュ: test1234）
INSERT INTO patients (email, name, password_hash, phone_number, date_of_birth, gender, address, emergency_contact, medical_history) VALUES
('patient@test.com', '山田太郎', '$2b$10$cXuk.g3RS.0rVcPampiUX.CgjoCYUXOONeZduVb2ZPQwwLjzbEO/e', '090-1234-5678', 1609459200000, 'male', '東京都渋谷区1-1-1', '{"name":"山田花子","phone":"090-8765-4321","relationship":"妻"}', '{"allergies":["ペニシリン"],"chronic_conditions":["高血圧"],"previous_surgeries":[]}');

-- 医療従事者データ投入（正しいパスワードハッシュ: test1234）
INSERT INTO workers (email, name, role, password_hash, phone_number, medical_license_number, is_active) VALUES
('doctor@test.com', '田中医師', 'doctor', '$2b$10$cXuk.g3RS.0rVcPampiUX.CgjoCYUXOONeZduVb2ZPQwwLjzbEO/e', '090-2345-6789', 'DOC-123456', 1),
('operator@test.com', '佐藤オペレータ', 'operator', '$2b$10$cXuk.g3RS.0rVcPampiUX.CgjoCYUXOONeZduVb2ZPQwwLjzbEO/e', '090-3456-7890', null, 1);

-- 診療科マスターデータ
INSERT INTO specialties (name, display_name, description, display_order, is_active) VALUES
('internal_medicine', '内科', '一般的な内科診療', 1, 1),
('pediatrics', '小児科', '小児の診療', 2, 1),
('fever_clinic', '発熱外来', 'COVID-19等の発熱患者対応', 3, 1),
('ent', '耳鼻咽喉科', '耳鼻咽喉の診療', 4, 1),
('allergy', 'アレルギー科・花粉症外来', 'アレルギー疾患の診療', 5, 1);

-- 資格マスターデータ
INSERT INTO qualifications (name, display_name, description, category, certifying_body, is_active) VALUES
('internal_medicine_specialist', '内科専門医', '日本内科学会認定の専門医資格', 'specialist', '日本内科学会', 1),
('pediatric_specialist', '小児科専門医', '日本小児科学会認定の専門医資格', 'specialist', '日本小児科学会', 1),
('ent_specialist', '耳鼻咽喉科専門医', '日本耳鼻咽喉科学会認定の専門医資格', 'specialist', '日本耳鼻咽喉科学会', 1),
('allergy_specialist', 'アレルギー専門医', '日本アレルギー学会認定の専門医資格', 'specialist', '日本アレルギー学会', 1);

-- テスト用予約データ
INSERT INTO appointments (patient_id, assigned_worker_id, scheduled_at, status, chief_complaint, appointment_type, duration_minutes) VALUES
(1, 1, 1736083200000, 'scheduled', '風邪の症状', 'initial', 30);

-- 医師の専門科割り当て
INSERT INTO doctor_specialties (worker_id, specialty_id, is_primary) VALUES
(1, 1, 1); -- 田中医師 → 内科（主専門）

-- 医師の資格割り当て
INSERT INTO doctor_qualifications (worker_id, qualification_id, certificate_number, acquired_date) VALUES
(1, 1, 'CERT-2020-001', 1577836800000); -- 田中医師 → 内科専門医
