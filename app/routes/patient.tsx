import { redirect } from 'react-router';

export async function loader() {
  // /patient にアクセスしたら /patient/dashboard にリダイレクト
  return redirect('/patient/dashboard');
}

// このコンポーネントは実際には表示されない（リダイレクトされるため）
export default function PatientIndex() {
  return null;
}