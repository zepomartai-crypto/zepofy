import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

const PermissionGuard = ({ children, permission }) => {
  const { user } = useAuth();

  // Super admins are exempt from permission checks
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'SUPER_ADMIN';
  
  if (isSuperAdmin) {
    return children;
  }

  // Check if permission is explicitly false
  if (!user || user.permissions?.[permission] === false) {
    console.warn(`🚫 Permission Denied: User lacks ${permission} access. Redirecting to dashboard.`);
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PermissionGuard;
