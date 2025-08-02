import { useParams } from 'react-router';
import { MedicalVideoCall } from '~/components/MedicalVideoCall';

export default function WorkerConsultation() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              診察室 #{id}
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">医療従事者</span>
              <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">ビデオ診察</h2>
            <MedicalVideoCall appointmentId={id || '1'} userType="worker" />
          </div>
        </div>
      </main>
    </div>
  );
}
