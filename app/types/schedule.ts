export interface DoctorSchedule {
  id: number;
  workerId: number;
  scheduleDate: string | Date;
  date?: string; // YYYY-MM-DD (APIレスポンス用)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: 'available' | 'busy' | 'break' | 'off';
  isAvailable?: boolean; // APIレスポンス用
  maxAppointments: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface AvailableSlot {
  id: string;
  doctorId: string;
  doctorName: string;
  speciality: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}