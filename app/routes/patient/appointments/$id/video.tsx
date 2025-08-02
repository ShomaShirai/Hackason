import { useParams } from '@react-router/react';
import CloudflareRealtimeVideo from '~/components/CloudflareRealtimeVideo';

export default function PatientVideoCall() {
  const { id } = useParams();
  
  return (
    <div className="h-screen bg-gray-900">
      <CloudflareRealtimeVideo 
        appointmentId={Number(id)} 
        userRole="patient"
      />
    </div>
  );
}