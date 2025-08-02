import { useState } from 'react';
import { MedicalRecordModal } from '~/components/MedicalRecordModal';

export default function TestMedicalRecord() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Medical Record Test Page</h1>
      
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Open Medical Record Modal
      </button>

      {showModal && (
        <MedicalRecordModal
          appointmentId="5"
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}