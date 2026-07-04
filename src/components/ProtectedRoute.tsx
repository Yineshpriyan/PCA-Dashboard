import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AdminType } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AdminType[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.admin_type)) {
    return <Navigate to={user.admin_type === 'super_admin' ? '/super-admin' : '/admin'} replace />;
  }

  return <>{children}</>;
}
