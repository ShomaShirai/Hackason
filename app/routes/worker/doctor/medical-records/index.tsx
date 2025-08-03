import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ErrorMessage } from '~/components/common/ErrorMessage';
import { Loading } from '~/components/common/Loading';
import { useAuth } from '~/contexts/AuthContext';
import { getAuthToken } from '~/utils/auth';

interface MedicalRecord {
    id: number;
    appointmentId: number;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    transcript: string;
    vitalSigns: any;
    prescriptions: any[];
    createdAt: string;
    updatedAt: string;
    appointment: {
        id: number;
        scheduledAt: string;
        status: string;
        patient: {
            id: number;
            name: string;
            email: string;
        };
    };
}

export function meta() {
    return [
        { title: 'カルテ一覧 - 医師ダッシュボード' },
        { name: 'description', content: '医師向けカルテ一覧ページ' },
    ];
}

export default function MedicalRecordsList() {
    const { user } = useAuth();
    const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchMedicalRecords = async () => {
            try {
                const token = getAuthToken();
                if (!token) {
                    setError('認証が必要です');
                    return;
                }

                const response = await fetch('/api/worker/doctor/medical-records', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('カルテの取得に失敗しました');
                }

                const data = await response.json();
                setMedicalRecords(data.records || []);
            } catch (err: any) {
                setError(err.message || 'カルテの取得に失敗しました');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMedicalRecords();
    }, []);

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tokyo',
        });
    };

    const hasContent = (record: MedicalRecord) => {
        return record.subjective || record.objective || record.assessment || record.plan || record.transcript;
    };

    if (isLoading) {
        return <Loading fullScreen message="カルテを読み込み中..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">カルテ一覧</h1>
                    <p className="mt-2 text-gray-600">
                        診察記録と音声認識の内容を確認できます
                    </p>
                    <div className="mt-4 flex gap-3">
                        <a
                            href="/worker/doctor/dashboard"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            ダッシュボードに戻る
                        </a>
                    </div>
                </div>

                {error && <ErrorMessage message={error} />}

                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">
                            診察記録一覧 ({medicalRecords.length}件)
                        </h2>
                    </div>

                    {medicalRecords.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                            {medicalRecords.map((record) => (
                                <div key={record.id} className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-medium text-gray-900">
                                                {record.appointment.patient.name}様
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                診察日時: {formatDateTime(record.appointment.scheduledAt)}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                記録日時: {formatDateTime(record.updatedAt)}
                                            </p>
                                        </div>
                                        <div className="flex space-x-2">
                                            <Link
                                                to={`/worker/doctor/medical-records/${record.id}/edit`}
                                                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
                                            >
                                                編集
                                            </Link>
                                        </div>
                                    </div>

                                    {hasContent(record) ? (
                                        <div className="space-y-4">
                                            {record.transcript && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-2">音声認識内容</h4>
                                                    <div className="bg-gray-50 p-3 rounded-md">
                                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                                            {record.transcript}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {record.subjective && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-2">主観的所見 (S)</h4>
                                                    <p className="text-sm text-gray-700">{record.subjective}</p>
                                                </div>
                                            )}

                                            {record.objective && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-2">客観的所見 (O)</h4>
                                                    <p className="text-sm text-gray-700">{record.objective}</p>
                                                </div>
                                            )}

                                            {record.assessment && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-2">評価 (A)</h4>
                                                    <p className="text-sm text-gray-700">{record.assessment}</p>
                                                </div>
                                            )}

                                            {record.plan && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-2">計画 (P)</h4>
                                                    <p className="text-sm text-gray-700">{record.plan}</p>
                                                </div>
                                            )}

                                            {record.prescriptions && record.prescriptions.length > 0 && (
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-2">処方箋</h4>
                                                    <div className="space-y-2">
                                                        {record.prescriptions.map((prescription, index) => (
                                                            <div key={index} className="bg-gray-50 p-3 rounded-md">
                                                                <p className="text-sm font-medium">{prescription.name}</p>
                                                                <p className="text-sm text-gray-600">
                                                                    {prescription.dosage} - {prescription.frequency} - {prescription.duration}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="mt-2 text-gray-500">カルテの内容がまだ記録されていません</p>
                                            <Link
                                                to={`/worker/doctor/medical-records/${record.id}/edit`}
                                                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                            >
                                                カルテを記録する
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="mt-2 text-gray-500">カルテがありません</p>
                            <p className="text-sm text-gray-400 mt-1">
                                診察を完了するとカルテが表示されます
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 