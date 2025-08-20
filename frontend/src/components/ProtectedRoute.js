import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    // ユーザーがログインしていない場合、ログインページにリダイレクト
    return <Navigate to="/login" />;
  }

  // ユーザーがログインしている場合、要求されたページを表示
  return children;
};

export default ProtectedRoute;
