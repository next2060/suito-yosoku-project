import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();
  const { currentUser } = useAuth();

  // currentUserの状態を監視し、変更があれば（ログインされたら）ページを移動
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    console.log("ログイン処理を開始します。メールアドレス:", email); // デバッグ用ログ
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // ログイン成功後の遷移はuseEffectに任せる
    } catch (err) {
      setError('ログインに失敗しました。メールアドレスまたはパスワードを確認してください。');
      console.error(err);
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    console.log("新規登録処理を開始します。メールアドレス:", email); // デバッグ用ログ
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // 新規登録成功後の遷移はuseEffectに任せる
    } catch (err) {
      setError('新規登録に失敗しました。このメールアドレスは既に使用されている可能性があります。');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <div style={{ padding: '40px', background: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'center', width: '400px' }}>
        <h2>水稲生育予測システム</h2>
        <h3 style={{ color: '#555', marginTop: 0, marginBottom: '30px' }}>ログイン</h3>
        <form>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            style={{ width: '100%', padding: '12px', marginBottom: '15px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            style={{ width: '100%', padding: '12px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          {error && <p style={{ color: 'red', marginBottom: '20px' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={handleLogin} disabled={loading} style={{ width: '48%', padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {loading ? '...' : 'ログイン'}
            </button>
            <button onClick={handleRegister} disabled={loading} style={{ width: '48%', padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {loading ? '...' : '新規登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
