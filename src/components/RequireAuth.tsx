import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';

export const RequireAuth: React.FC<{ children: React.ReactElement, adminOnly?: boolean }> = ({ children, adminOnly = false }) => {
  const { userId, loading, role } = useAuth();
  const location = useLocation();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Wait a bit before redirecting to avoid flickering during auth check
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setShouldRedirect(!userId || (adminOnly && role !== 'admin'));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, userId, role, adminOnly]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (shouldRedirect) {
    if (!userId) {
      return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }
    if (adminOnly && role !== 'admin') {
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default RequireAuth;
