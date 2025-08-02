import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { hashPasswordSync } from './auth/password';
import {
  patients,
  workers,
  specialties,
  qualifications,
  doctorSpecialties,
  doctorQualifications
} from './db/schema';

const client = createClient({
  url: 'file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/68ac3c8ac2484ab5dd28be90eb723c4cae2f05469e8abbac31b835ce3ae4af89.sqlite',
});

const db = drizzle(client);

async function seedData() {
  console.log('🌱 テストデータを挿入中...');

  try {
    // 専門科マスターデータの挿入
    console.log('専門科マスターデータを挿入中...');
    const specialtyData = [
      { name: 'internal_medicine', displayName: '内科', displayOrder: 1 },
      { name: 'pediatrics', displayName: '小児科', displayOrder: 2 },
      { name: 'fever_outpatient', displayName: '発熱外来', displayOrder: 3 },
      { name: 'otolaryngology', displayName: '耳鼻咽喉科', displayOrder: 4 },
      { name: 'allergy_rhinitis', displayName: 'アレルギー科・花粉症外来', displayOrder: 5 },
      { name: 'dermatology', displayName: '皮膚科', displayOrder: 6 },
      { name: 'respiratory_medicine', displayName: '呼吸器内科', displayOrder: 7 },
      { name: 'lifestyle_disease', displayName: '生活習慣病外来', displayOrder: 8 },
      { name: 'urology', displayName: '泌尿器科', displayOrder: 9 },
      { name: 'gynecology', displayName: '婦人科', displayOrder: 10 },
    ];

    for (const spec of specialtyData) {
      await db.insert(specialties).values(spec).onConflictDoNothing();
    }

    // 資格マスターデータの挿入
    console.log('資格マスターデータを挿入中...');
    const qualificationData = [
      // 内科系
      {
        name: 'internist_certified',
        displayName: '認定内科医',
        category: 'certified' as const,
        certifyingBody: '日本内科学会',
      },
      {
        name: 'internist_specialist',
        displayName: '内科専門医',
        category: 'specialist' as const,
        certifyingBody: '日本内科学会',
      },
      {
        name: 'general_internist_specialist',
        displayName: '総合内科専門医',
        category: 'specialist' as const,
        certifyingBody: '日本内科学会',
      },
      {
        name: 'internist_instructor',
        displayName: '内科指導医',
        category: 'instructor' as const,
        certifyingBody: '日本内科学会',
      },
      // 小児科系
      {
        name: 'pediatrician_specialist',
        displayName: '小児科専門医',
        category: 'specialist' as const,
        certifyingBody: '日本小児科学会',
      },
      {
        name: 'pediatrician_instructor',
        displayName: '小児科指導医',
        category: 'instructor' as const,
        certifyingBody: '日本小児科学会',
      },
      // 皮膚科系
      {
        name: 'dermatologist_specialist',
        displayName: '皮膚科専門医',
        category: 'specialist' as const,
        certifyingBody: '日本皮膚科学会',
      },
      // サブスペシャリティ
      {
        name: 'diabetes_specialist',
        displayName: '糖尿病専門医',
        category: 'subspecialty' as const,
        certifyingBody: '日本糖尿病学会',
      },
      {
        name: 'allergy_specialist',
        displayName: 'アレルギー専門医',
        category: 'specialist' as const,
        certifyingBody: '日本アレルギー学会',
      },
      {
        name: 'infectious_disease_specialist',
        displayName: '感染症専門医',
        category: 'subspecialty' as const,
        certifyingBody: '日本感染症学会',
      },
    ];

    for (const qual of qualificationData) {
      await db.insert(qualifications).values(qual).onConflictDoNothing();
    }

    // 共通のテストパスワード
    const TEST_PASSWORD = 'test1234';
    const passwordHash = hashPasswordSync(TEST_PASSWORD);
    console.log(`テストパスワード '${TEST_PASSWORD}' のハッシュ値を生成しました`);

    // 患者データの挿入
    console.log('患者データを挿入中...');
    const patientsData = [
      {
        email: 'patient@test.com',
        name: '山田太郎',
        phoneNumber: '090-1234-5678',
        dateOfBirth: new Date('1985-05-15'),
        gender: 'male' as const,
        address: '東京都新宿区1-1-1',
        passwordHash,
        emergencyContact: JSON.stringify({
          name: '山田花子',
          relation: '配偶者',
          phone: '090-8765-4321',
        }),
        medicalHistory: JSON.stringify({
          allergies: ['ペニシリン', '甲殻類'],
          medications: [],
          conditions: ['高血圧'],
        }),
      },
      {
        email: 'patient2@test.com',
        name: '佐藤花子',
        phoneNumber: '090-2345-6789',
        dateOfBirth: new Date('1990-03-20'),
        gender: 'female' as const,
        address: '東京都渋谷区2-2-2',
        passwordHash,
        emergencyContact: JSON.stringify({
          name: '佐藤太郎',
          relation: '配偶者',
          phone: '090-9876-5432',
        }),
        medicalHistory: JSON.stringify({
          allergies: [],
          medications: ['ビタミンD'],
          conditions: [],
        }),
      },
    ];

    for (const patient of patientsData) {
      await db.insert(patients).values(patient).onConflictDoNothing();
    }

    // 医療従事者データの挿入
    console.log('医療従事者データを挿入中...');
    const workersData = [
      {
        email: 'doctor@test.com',
        name: '田中医師',
        role: 'doctor' as const,
        phoneNumber: '03-1234-5678',
        passwordHash,
        medicalLicenseNumber: 'MD-123456',
      },
      {
        email: 'doctor2@test.com',
        name: '鈴木医師',
        role: 'doctor' as const,
        phoneNumber: '03-2345-6789',
        passwordHash,
        medicalLicenseNumber: 'MD-789012',
      },
      {
        email: 'operator@test.com',
        name: '山田オペレータ',
        role: 'operator' as const,
        phoneNumber: '03-3456-7890',
        passwordHash,
      },
      {
        email: 'admin@test.com',
        name: '管理者',
        role: 'admin' as const,
        phoneNumber: '03-4567-8901',
        passwordHash,
      },
    ];

    for (const worker of workersData) {
      await db.insert(workers).values(worker).onConflictDoNothing();
    }

    // 医師に専門科と資格を紐付け
    console.log('医師の専門科・資格を設定中...');

    // 田中医師（内科専門医）
    const [doctorTanaka] = await db.select().from(workers).where(eq(workers.email, 'doctor@test.com'));
    const [internalMedicine] = await db.select().from(specialties).where(eq(specialties.name, 'internal_medicine'));
    const [internistSpecialist] = await db.select().from(qualifications).where(eq(qualifications.name, 'internist_specialist'));
    const [diabetesSpecialist] = await db.select().from(qualifications).where(eq(qualifications.name, 'diabetes_specialist'));

    if (doctorTanaka && internalMedicine && internistSpecialist && diabetesSpecialist) {
      // 内科を主専門科として登録
      await db.insert(doctorSpecialties).values({
        workerId: doctorTanaka.id,
        specialtyId: internalMedicine.id,
        isPrimary: true,
      }).onConflictDoNothing();

      // 内科専門医資格を登録
      await db.insert(doctorQualifications).values({
        workerId: doctorTanaka.id,
        qualificationId: internistSpecialist.id,
        certificateNumber: 'NAIKA-001',
        acquiredDate: new Date('2018-04-01'),
      }).onConflictDoNothing();

      // 糖尿病専門医資格を登録
      await db.insert(doctorQualifications).values({
        workerId: doctorTanaka.id,
        qualificationId: diabetesSpecialist.id,
        certificateNumber: 'DM-001',
        acquiredDate: new Date('2020-04-01'),
      }).onConflictDoNothing();
    }

    // 鈴木医師（皮膚科専門医）
    const [doctorSuzuki] = await db.select().from(workers).where(eq(workers.email, 'doctor2@test.com'));
    const [dermatology] = await db.select().from(specialties).where(eq(specialties.name, 'dermatology'));
    const [dermatologist] = await db.select().from(qualifications).where(eq(qualifications.name, 'dermatologist_specialist'));
    const [allergySpecialist] = await db.select().from(qualifications).where(eq(qualifications.name, 'allergy_specialist'));

    if (doctorSuzuki && dermatology && dermatologist && allergySpecialist) {
      // 皮膚科を主専門科として登録
      await db.insert(doctorSpecialties).values({
        workerId: doctorSuzuki.id,
        specialtyId: dermatology.id,
        isPrimary: true,
      }).onConflictDoNothing();

      // 皮膚科専門医資格を登録
      await db.insert(doctorQualifications).values({
        workerId: doctorSuzuki.id,
        qualificationId: dermatologist.id,
        certificateNumber: 'HIFUKA-001',
        acquiredDate: new Date('2019-04-01'),
      }).onConflictDoNothing();

      // アレルギー専門医資格を登録
      await db.insert(doctorQualifications).values({
        workerId: doctorSuzuki.id,
        qualificationId: allergySpecialist.id,
        certificateNumber: 'ALLERGY-001',
        acquiredDate: new Date('2021-04-01'),
      }).onConflictDoNothing();
    }

    console.log('✅ テストデータの挿入が完了しました！');

    // 挿入されたデータの確認
    const patientCount = await db.select().from(patients);
    const workerCount = await db.select().from(workers);
    const specialtyCount = await db.select().from(specialties);
    const qualificationCount = await db.select().from(qualifications);

    console.log(`📊 患者数: ${patientCount.length}`);
    console.log(`📊 医療従事者数: ${workerCount.length}`);
    console.log(`📊 専門科数: ${specialtyCount.length}`);
    console.log(`📊 資格数: ${qualificationCount.length}`);
  } catch (error) {
    console.error('❌ テストデータの挿入中にエラーが発生しました:', error);
  } finally {
    await client.close();
  }
}

// 直接実行時にシードデータを投入
seedData();

// スクリプトが直接実行された場合（エクスポートされた関数として実行）
export { seedData };
