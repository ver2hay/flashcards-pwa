import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const userId = useAuthStore((state) => state.userId);

  if (userId === null) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
