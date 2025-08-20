import React, { useState, useEffect } from 'react';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

const db = getFirestore();

const AddVarietyPage = () => {
  const [varietyName, setVarietyName] = useState('');
  const [baseVariety, setBaseVariety] = useState('あきたこまち');
  const [adjustmentDays, setAdjustmentDays] = useState(0);
  const [ripeningAccumulatedTemp, setRipeningAccumulatedTemp] = useState(1000);
  const [existingVarieties, setExistingVarieties] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const baseVarieties = ['あきたこまち', 'コシヒカリ', 'にじのきらめき'];

  useEffect(() => {
    const fetchVarieties = async () => {
      const querySnapshot = await getDocs(collection(db, "varieties"));
      const varieties = querySnapshot.docs.map(doc => doc.data().name);
      setExistingVarieties(varieties);
    };
    fetchVarieties();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (!varietyName.trim()) {
      setError('品種名を入力してください。');
      setIsLoading(false);
      return;
    }

    if (baseVarieties.includes(varietyName) || existingVarieties.includes(varietyName)) {
        setError('この品種名は既に存在します。');
        setIsLoading(false);
        return;
    }

    try {
      await addDoc(collection(db, "varieties"), {
        name: varietyName,
        baseVariety: baseVariety,
        adjustmentDays: Number(adjustmentDays),
        ripeningAccumulatedTemp: Number(ripeningAccumulatedTemp),
      });
      setSuccess(`品種「${varietyName}」を正常に追加しました。`);
      setVarietyName('');
      setAdjustmentDays(0);
      setRipeningAccumulatedTemp(1000);
      // Refresh the list of varieties
      const querySnapshot = await getDocs(collection(db, "varieties"));
      const varieties = querySnapshot.docs.map(doc => doc.data().name);
      setExistingVarieties(varieties);

    } catch (err) {
      setError('品種の追加中にエラーが発生しました。コンソールを確認してください。');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>品種追加</h1>
      <p>新しい品種のパラメータを登録します。登録した品種は、地図ページでの生育予測に利用できます。</p>
      
      <form onSubmit={handleSubmit} style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>新品種名:</label>
          <input 
            type="text" 
            value={varietyName} 
            onChange={(e) => setVarietyName(e.target.value)} 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>基準品種:</label>
          <select 
            value={baseVariety} 
            onChange={(e) => setBaseVariety(e.target.value)} 
            style={{ width: '100%', padding: '8px' }}
          >
            {baseVarieties.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>調整日数 (日):</label>
          <input 
            type="number" 
            value={adjustmentDays} 
            onChange={(e) => setAdjustmentDays(e.target.value)} 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
          <small>基準品種の出穂日からの日数の差（プラスまたはマイナス）を入力します。</small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>登熟積算温度 (°C):</label>
          <input 
            type="number" 
            value={ripeningAccumulatedTemp} 
            onChange={(e) => setRipeningAccumulatedTemp(e.target.value)} 
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
          <small>出穂日から成熟期までの積算温度を入力します。</small>
        </div>

        <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {isLoading ? '保存中...' : 'この内容で保存'}
        </button>

        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        {success && <p style={{ color: 'green', marginTop: '10px' }}>{success}</p>}
      </form>
    </div>
  );
};

export default AddVarietyPage;