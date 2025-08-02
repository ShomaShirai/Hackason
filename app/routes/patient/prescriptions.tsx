import { json } from '@react-router/node';
import { useLoaderData, Link } from '@react-router/react';
import type { Route } from './+types/prescriptions';

export async function loader({ request }: Route.LoaderArgs) {
  const apiBaseUrl = process.env.API_BASE_URL || '';
  const patientToken = request.headers.get('cookie')?.match(/patientAccessToken=([^;]*)/)?.[1];
  
  if (!patientToken) {
    throw new Response('Unauthorized', { status: 401 });
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/patient/prescriptions`, {
      headers: {
        'Authorization': `Bearer ${patientToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch prescriptions');
    }

    const prescriptions = await response.json();
    return json({ prescriptions });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    return json({ prescriptions: [] });
  }
}

export default function PatientPrescriptions() {
  const { prescriptions } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">処方箋履歴</h1>
        
        {prescriptions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">処方箋の履歴がありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((prescription: any) => (
              <div key={prescription.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      処方日: {new Date(prescription.issuedAt).toLocaleDateString('ja-JP')}
                    </h3>
                    <p className="text-gray-600">医師: {prescription.doctorName}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    prescription.status === 'issued' ? 'bg-green-100 text-green-800' :
                    prescription.status === 'dispensed' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {prescription.status === 'issued' ? '発行済み' :
                     prescription.status === 'dispensed' ? '調剤済み' :
                     prescription.status}
                  </span>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">処方薬</h4>
                  <div className="space-y-2">
                    {prescription.medications.map((med: any, index: number) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between">
                          <span className="font-medium">{med.name}</span>
                          <span className="text-gray-600">{med.quantity}</span>
                        </div>
                        <p className="text-sm text-gray-600">{med.dosage}</p>
                        {med.instructions && (
                          <p className="text-sm text-gray-500 mt-1">{med.instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {prescription.pharmacyNotes && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded">
                    <p className="text-sm">薬局への注意事項: {prescription.pharmacyNotes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-8">
          <Link
            to="/patient"
            className="text-blue-600 hover:text-blue-800"
          >
            ← ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}