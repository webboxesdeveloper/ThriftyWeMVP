import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';

export const RequireAuth: React.FC<{ children: React.ReactElement, adminOnly?: boolean }> = ({ children, adminOnly = false }) => {
  const { userId, loading, role } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && role !== 'admin') {
    // If user is not admin, redirect to home
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAuth;
