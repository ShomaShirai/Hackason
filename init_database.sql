-- appointmentsテーブル作成（snake_case）
CREATE TABLE appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  assigned_worker_id INTEGER,
  scheduled_at DATETIME NOT NULL,
  status TEXT DEFAULT 'scheduled',
  chief_complaint TEXT,
  meeting_id TEXT,
  appointment_type TEXT DEFAULT 'initial',
  duration_minutes INTEGER DEFAULT 30,
  started_at DATETIME,
  ended_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- patientsテーブル作成
CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  phone_number TEXT,
  date_of_birth TEXT,
  gender TEXT,
  address TEXT,
  emergency_contact TEXT,
  medical_history TEXT,
  profile_image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- workersテーブル作成
CREATE TABLE workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  specialties TEXT,
  license_number TEXT,
  years_of_experience INTEGER,
  phone_number TEXT,
  profile_image_url TEXT,
  bio TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- questionnairesテーブル作成
CREATE TABLE questionnaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL,
  questions_answers TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- テスト用患者データ
INSERT INTO patients (email, name, password_hash, phone_number, gender) 
VALUES ('patient@test.com', 'テスト患者', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '090-1234-5678', 'male');

-- テスト用医師データ
INSERT INTO workers (email, name, password_hash, role, specialties, license_number, years_of_experience) 
VALUES ('doctor@test.com', 'テスト医師', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'doctor', '内科,皮膚科', 'D12345', 10);
