-- 患者データの挿入
INSERT INTO patients (email, name, phone_number, date_of_birth, gender, password_hash, emergency_contact, insurance_info)
VALUES 
  ('patient@test.com', '山田太郎', '090-1234-5678', 485395200000, 'male', 
   '$2b$10$dpCaTniY.nBng13Go7KANOLe31oKtr0YM/ujye6YH35sRkn.L6oKq', 
   '{"name":"山田花子","phoneNumber":"090-8765-4321","relationship":"配偶者"}',
   '{"provider":"健康保険組合","policyNumber":"INS-123456","groupNumber":"GRP-001"}'),
  ('patient2@test.com', '佐藤花子', '090-2345-6789', 638236800000, 'female', 
   '$2b$10$dpCaTniY.nBng13Go7KANOLe31oKtr0YM/ujye6YH35sRkn.L6oKq',
   '{"name":"佐藤太郎","phoneNumber":"090-9876-5432","relationship":"配偶者"}',
   '{"provider":"国民健康保険","policyNumber":"INS-789012"}');

-- 医療従事者データの挿入
INSERT INTO workers (email, name, role, phone_number, password_hash, license_number, qualifications, specialties)
VALUES 
  ('doctor@test.com', '田中医師', 'doctor', '03-1234-5678', 
   '$2b$10$dpCaTniY.nBng13Go7KANOLe31oKtr0YM/ujye6YH35sRkn.L6oKq', 
   'MD-123456',
   '["内科専門医","循環器専門医"]',
   '["内科","循環器内科"]'),
  ('operator@test.com', '鈴木オペレータ', 'operator', '03-2345-6789', 
   '$2b$10$dpCaTniY.nBng13Go7KANOLe31oKtr0YM/ujye6YH35sRkn.L6oKq',
   NULL,
   NULL,
   NULL);