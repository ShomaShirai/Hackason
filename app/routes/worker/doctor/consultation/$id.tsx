import { useParams, useNavigate } from 'react-router';
import { MedicalVideoCall } from '../../../../components/MedicalVideoCall';

export default function DoctorConsultation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleSessionEnd = () => {
    // セッション終了後、ダッシュボードへ遷移
    navigate('/worker/doctor/dashboard');
  };

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">エラー</h2>
          <p className="text-gray-600">診察IDが無効です</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <MedicalVideoCall
        appointmentId={id}
        userType="worker"
        workerRole="doctor"
        onSessionEnd={handleSessionEnd}
      />
    </div>
  );
}
