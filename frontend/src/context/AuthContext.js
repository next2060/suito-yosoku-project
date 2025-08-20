import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';

// 1. Contextオブジェクトを作成
const AuthContext = createContext();

// 2. Contextの内容にアクセスするためのカスタムフック
export const useAuth = () => {
  return useContext(AuthContext);
};

// 3. Contextを提供するプロバイダーコンポーネント
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    // Firebaseの認証状態の変更を監視する
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setLoading(false);
    });

    // コンポーネントが破棄されるときに監視を解除
    return unsubscribe;
  }, [auth]);

  const logout = () => {
    return signOut(auth);
  }

  // 共有したい値をvalueとして渡す
  const value = {
    currentUser,
    logout
  };

  // ローディング中は何も表示せず、認証状態が確定してから子コンポーネントを表示
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
