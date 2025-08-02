import { type RouteConfig, index, route, prefix } from '@react-router/dev/routes';

export default [
  // 公開ルート
  index('routes/home.tsx'),
  route('/worker/login', 'routes/worker/login.tsx'),

  // 患者向けルート
  route('/patient', 'routes/patient.tsx'), // /patient → /patient/dashboard へリダイレクト
  ...prefix('/patient', [
    route('login', 'routes/patient/login.tsx'),
    route('dashboard', 'routes/patient/dashboard.tsx'),
    route('appointments', 'routes/patient/appointments.tsx'),
    route('appointments/new', 'routes/patient/appointments/new.tsx'),
    route('appointments/:id/questionnaire', 'routes/patient/appointments/$id.questionnaire.tsx'),
    route('consultation/:id', 'routes/patient/consultation/$id.tsx'),
    route('messages', 'routes/patient/messages.tsx'),
    route('prescriptions', 'routes/patient.prescriptions.tsx'),
  ]),

  // 医療従事者向けルート
  ...prefix('/worker', [
    // 医師向け
    ...prefix('doctor', [
      route('dashboard', 'routes/worker/doctor/dashboard.tsx'),
      route('schedule', 'routes/worker.doctor.schedule.tsx'),
      route('consultation/:id', 'routes/worker/doctor/consultation/$id.tsx'),
      route('patients', 'routes/worker/doctor/patients.tsx'),
      route('medical-records/:id/edit', 'routes/worker/doctor/medical-records/$id.edit.tsx'),
    ]),

    // オペレータ向け
    ...prefix('operator', [
      route('dashboard', 'routes/worker/operator/dashboard.tsx'),
      route('assignment-board', 'routes/worker/operator/assignment-board.tsx'),
      route('appointments', 'routes/worker/operator/appointments.tsx'),
    ]),

    // 管理者向け
    ...prefix('admin', [
      route('doctors', 'routes/worker/admin/doctors.tsx'),
      route('doctors/:id/schedule/edit', 'routes/worker/admin/doctors/$id.schedule.edit.tsx'),
    ]),

    // 互換性のため旧パスも残す
    route('dashboard', 'routes/worker/dashboard.tsx'),
    route('consultation/:id', 'routes/worker/consultation/$id.tsx'),
  ]),
] satisfies RouteConfig;
