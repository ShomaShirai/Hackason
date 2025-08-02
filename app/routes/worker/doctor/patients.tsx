import { type LoaderFunctionArgs } from 'react-router'
import { useLoaderData, Link } from 'react-router'

interface Patient {
  id: number
  name: string
  email: string
  phoneNumber: string | null
  dateOfBirth: string | null
  gender: 'male' | 'female' | 'other' | null
}

interface LoaderData {
  patients: Patient[]
  user: { name: string; role: string }
  error?: string
}

export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData> {
  // TODO: 認証チェックを実装
  const user = { name: '山田太郎', role: 'doctor' }

  try {
    // APIから担当患者一覧を取得
    const response = await fetch(`${new URL(request.url).origin}/api/worker/doctor/patients`, {
      headers: {
        'Authorization': 'Bearer dummy-token', // TODO: 実際の認証トークンを使用
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch patients')
    }

    const data: { patients: Patient[] } = await response.json()
    return { patients: data.patients, user }
  } catch (error) {
    console.error('Error fetching patients:', error)
    return { patients: [], user, error: 'データの取得に失敗しました' }
  }
}

export default function DoctorPatients() {
  const { patients, user, error } = useLoaderData<LoaderData>()

  const formatDate = (dateString: string | null) => {
    if (!dateString) {return '未設定'}
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  const getGenderLabel = (gender: string | null) => {
    switch (gender) {
      case 'male': return '男性'
      case 'female': return '女性'
      case 'other': return 'その他'
      default: return '未設定'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">担当患者一覧</h1>
          <p className="mt-2 text-sm text-gray-700">
            {user.name}先生が担当している患者の一覧です。
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            {patients.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
                <p className="text-gray-600">担当患者がいません。</p>
              </div>
            ) : (
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        患者名
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        連絡先
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        生年月日
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        性別
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">操作</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {patients.map((patient: Patient) => (
                      <tr key={patient.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {patient.name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          <div>
                            <div>{patient.email}</div>
                            {patient.phoneNumber && (
                              <div className="text-xs text-gray-400">{patient.phoneNumber}</div>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {formatDate(patient.dateOfBirth)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {getGenderLabel(patient.gender)}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Link
                            to={`/worker/doctor/patients/${patient.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            詳細表示
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          患者数: {patients.length}名
        </p>
      </div>
    </div>
  )
}
