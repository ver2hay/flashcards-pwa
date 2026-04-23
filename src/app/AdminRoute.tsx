import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';

type Props = { children: React.ReactNode };

export function AdminRoute({ children }: Props) {
  const role = useAuthStore((s) => s.role);
  if (role !== 'admin') {
    return <Navigate to="/folders" replace />;
  }
  return <>{children}</>;
}
