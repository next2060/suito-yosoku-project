import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useAuth } from '../context/AuthContext';
import BaseLayerSwitcher from '../components/BaseLayerSwitcher';

// Firebaseの各機能をインポート
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';

// --- 定数定義 ---
const QGIS_SERVER_URL = 'http://54.252.200.4:8089/';
const PREDICTION_API_URL = 'http://localhost:5001/predict';

const MUNICIPALITY_LAYERS = [
    { value: '2025_082015', label: '水戸市' }, { value: '2025_082023', label: '日立市' },
    { value: '2025_082031', label: '土浦市' }, { value: '2025_082040', label: '古河市' },
    { value: '2025_082058', label: '石岡市' }, { value: '2025_082074', label: '結城市' },
    { value: '2025_082082', label: '龍ケ崎市' }, { value: '2025_082104', label: '下妻市' },
    { value: '2025_082112', label: '常総市' }, { value: '2025_082121', label: '常陸太田市' },
    { value: '2025_082147', label: '高萩市' }, { value: '2025_082155', label: '北茨城市' },
    { value: '2025_082163', label: '笠間市' }, { value: '2025_082171', label: '取手市' },
    { value: '2025_082198', label: '牛久市' }, { value: '2025_082201', label: 'つくば市' },
    { value: '2025_082210', label: 'ひたちなか市' }, { value: '2025_082228', label: '鹿嶋市' },
    { value: '2025_082236', label: '潮来市' }, { value: '2025_082244', label: '守谷市' },
    { value: '2025_082252', label: '常陸大宮市' }, { value: '2025_082261', label: '那珂市' },
    { value: '2025_082279', label: '筑西市' }, { value: '2025_082287', label: '坂東市' },
    { value: '2025_082295', label: '稲敷市' }, { value: '2025_082309', label: 'かすみがうら市' },
    { value: '2025_082317', label: '桜川市' }, { value: '2025_082325', label: '神栖市' },
    { value: '2025_082333', label: '行方市' }, { value: '2025_082341', label: '鉾田市' },
    { value: '2025_082350', label: 'つくばみらい市' }, { value: '2025_082368', label: '小美玉市' },
    { value: '2025_083020', label: '茨城町' }, { value: '2025_083097', label: '大洗町' },
    { value: '2025_083101', label: '城里町' }, { value: '2025_083411', label: '東海村' },
    { value: '2025_083640', label: '大子町' }, { value: '2025_084425', label: '美浦村' },
    { value: '2025_084433', label: '阿見町' }, { value: '2025_084476', label: '河内町' },
    { value: '2025_085219', label: '八千代町' }, { value: '2025_085421', label: '五霞町' },
    { value: '2025_085464', label: '境町' }, { value: '2025_085642', label: '利根町' }
];

const firebaseConfig = {
  apiKey: "AIzaSyAoq8ukrVrZyLqmOcz9IRG6OvzPuba7nck",
  authDomain: "suito-yosoku-app.firebaseapp.com",
  projectId: "suito-yosoku-app",
  storageBucket: "suito-yosoku-app.firebasestorage.app",
  messagingSenderId: "338317944534",
  appId: "1:338317944534:web:32894523961a29398b0b77"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Helper Functions ---
const PREDEFINED_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1', '#FDD835', '#3949AB', '#D81B60', '#7CB342', '#F4511E', '#5E35B1', '#039BE5', '#6D4C41', '#C0CA33'];
const getAutoColorForString = (str) => {
  if (!str) return '#cccccc';
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  return PREDEFINED_COLORS[Math.abs(hash % PREDEFINED_COLORS.length)];
};

const convertToCSV = (data) => {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(fieldName => JSON.stringify(row[fieldName], (key, value) => value === null ? '' : value)).join(',')
    )
  ];
  return csvRows.join('\r\n');
};

const MapPage = () => {
  const { currentUser, logout } = useAuth();
  const mapRef = useRef(null);
  const resizingRef = useRef({ active: false, target: null, startX: 0, startWidth: 0 });

  const [map, setMap] = useState(null);
  const [wfsLayer, setWfsLayer] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(MUNICIPALITY_LAYERS[0].value);
  const [selectedFields, setSelectedFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  const [varietyMap, setVarietyMap] = useState(new Map());
  const [customColorMap, setCustomColorMap] = useState(new Map());
  const [fieldInfo, setFieldInfo] = useState({ id: '', name: '', transplantDate: '', variety: '', lat: null, lon: null });
  const [bulkInfo, setBulkInfo] = useState({ transplantDate: '', variety: '' });
  const [predictionResult, setPredictionResult] = useState(null);
  const [weatherUser, setWeatherUser] = useState('');
  const [weatherPassword, setWeatherPassword] = useState('');
  const [availableVarieties, setAvailableVarieties] = useState([]);
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [rightPanelWidth, setRightPanelWidth] = useState(350);

  // --- Resize Handlers ---
  const startResizing = (e, target) => {
    e.preventDefault();
    resizingRef.current = {
      active: true,
      target,
      startX: e.clientX,
      startWidth: target === 'left' ? leftPanelWidth : rightPanelWidth
    };
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
  };

  const resize = (e) => {
    if (!resizingRef.current.active) return;
    const { target, startX, startWidth } = resizingRef.current;
    const deltaX = e.clientX - startX;
    if (target === 'left') {
      const newWidth = startWidth + deltaX;
      setLeftPanelWidth(Math.max(200, Math.min(newWidth, 600)));
    } else { // right
      const newWidth = startWidth - deltaX;
      setRightPanelWidth(Math.max(250, Math.min(newWidth, 800)));
    }
  };

  const stopResizing = () => {
    resizingRef.current.active = false;
    window.removeEventListener('mousemove', resize);
    window.removeEventListener('mouseup', stopResizing);
    if (map) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, []);


  const getFinalColor = (variety) => {
    return customColorMap.get(variety) || getAutoColorForString(variety);
  };

  // --- Map Initialization ---
  useEffect(() => {
    if (mapRef.current && !map) {
      const leafletMap = L.map(mapRef.current).setView([36.34, 140.45], 9);
      setMap(leafletMap);
    }
  }, [map]);

  // --- User and Variety Data Loading ---
  useEffect(() => {
    if (!currentUser) return;
    const fetchInitialData = async () => {
      // Fetch custom colors
      const colorSnapshot = await getDocs(collection(db, "users", currentUser.uid, "variety_colors"));
      const newCustomColorMap = new Map();
      colorSnapshot.forEach(doc => newCustomColorMap.set(doc.id, doc.data().color));
      setCustomColorMap(newCustomColorMap);

      // Fetch weather API credentials
      const weatherCredsRef = doc(db, "users", currentUser.uid, "private_data", "weather_api");
      const weatherCredsSnap = await getDoc(weatherCredsRef);
      if (weatherCredsSnap.exists()) {
        const data = weatherCredsSnap.data();
        setWeatherUser(data.username || '');
        setWeatherPassword(data.password || '');
      }

      // Fetch available varieties for dropdown
      const baseVarieties = ['あきたこまち', 'コシヒカリ', 'にじのきらめき'];
      const customVarietiesSnapshot = await getDocs(collection(db, "varieties"));
      const customVarieties = customVarietiesSnapshot.docs.map(doc => doc.data().name);
      setAvailableVarieties([...baseVarieties, ...customVarieties].sort());
    };
    fetchInitialData();
  }, [currentUser]);

  // --- Layer Data Fetching ---
  useEffect(() => {
    if (!map || !selectedLayer || !currentUser) return;
    const fetchLayerData = async () => {
      setIsLoading(true);
      setSelectedFields([]);
      if (wfsLayer) map.removeLayer(wfsLayer);
      try {
        const savedDataSnapshot = await getDocs(collection(db, "users", currentUser.uid, "paddy_fields"));
        const newVarietyMap = new Map();
        savedDataSnapshot.forEach(doc => { if (doc.data().variety) newVarietyMap.set(doc.id, doc.data().variety); });
        setVarietyMap(newVarietyMap);

        const wfsResponse = await fetch(`${QGIS_SERVER_URL}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=${selectedLayer}&SRSNAME=EPSG:4326&OUTPUTFORMAT=GeoJSON`);
        if (!wfsResponse.ok) throw new Error(`サーバーからの応答エラー: ${wfsResponse.status}`);
        const wfsData = await wfsResponse.json();
        if (!wfsData.features) throw new Error('GeoJSONのfeaturesが見つかりません。');

        const geoJsonLayer = L.geoJSON(wfsData, {
          style: (feature) => {
            const fieldId = feature.properties.polygon_uuid;
            const variety = newVarietyMap.get(fieldId);
            return { fillColor: getFinalColor(variety), weight: 2, opacity: 1, color: 'white', fillOpacity: 0.7 };
          },
          onEachFeature: (feature, layer) => {
            const fieldId = feature.properties.polygon_uuid;
            if (fieldId) layer.on('click', () => setSelectedFields(prev => prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]));
          }
        }).addTo(map);
        setWfsLayer(geoJsonLayer);
        if (wfsData.features.length > 0) map.fitBounds(geoJsonLayer.getBounds());
        else alert("この市町村には表示できる圃場データがありません。");
      } catch (e) { console.error("レイヤーデータの取得に失敗しました:", e); setError(e.message); }
      setIsLoading(false);
    };
    fetchLayerData();
  }, [map, selectedLayer, currentUser]);

  // --- Layer Styling Logic ---
  useEffect(() => {
    if (!wfsLayer) return;
    wfsLayer.eachLayer(layer => {
      if (layer.feature && layer.feature.properties.polygon_uuid) {
        const fieldId = layer.feature.properties.polygon_uuid;
        const isSelected = selectedFields.includes(fieldId);
        const variety = varietyMap.get(fieldId);
        layer.setStyle({
            fillColor: isSelected ? '#333333' : getFinalColor(variety),
            weight: 2, 
            opacity: 1, 
            color: isSelected ? '#FFFFFF' : 'white', 
            fillOpacity: 0.7 
        });
      }
    });
  }, [selectedFields, varietyMap, customColorMap, wfsLayer]);

  // --- Single Field Data Fetching ---
  useEffect(() => {
    if (!currentUser || selectedFields.length !== 1) {
      setFieldInfo({ id: '', name: '', transplantDate: '', variety: '', lat: null, lon: null });
      setPredictionResult(null);
      return;
    }
    const selectedId = selectedFields[0];
    let lat = null, lon = null;
    if (wfsLayer) {
      wfsLayer.eachLayer(layer => {
        if (layer.feature.properties.polygon_uuid === selectedId) {
          lat = layer.feature.properties.point_lat;
          lon = layer.feature.properties.point_lng;
        }
      });
    }
    const fetchFieldData = async () => {
      const docRef = doc(db, "users", currentUser.uid, "paddy_fields", selectedId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFieldInfo({ id: selectedId, lat, lon, name: data.name || '', transplantDate: data.transplantDate || '', variety: data.variety || '' });
      } else {
        setFieldInfo({ id: selectedId, lat, lon, name: '', transplantDate: '', variety: '' });
      }
    };
    fetchFieldData();
  }, [selectedFields, wfsLayer, currentUser]);

  // --- UI Handlers ---
  const handleInputChange = e => setFieldInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleBulkInputChange = e => setBulkInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleColorChange = async (variety, newColor) => {
    if (!variety || !currentUser) return;
    try {
      await setDoc(doc(db, "users", currentUser.uid, "variety_colors", variety), { color: newColor });
      setCustomColorMap(prev => new Map(prev).set(variety, newColor));
    } catch (e) { console.error("色の保存に失敗しました:", e); alert("色の保存に失敗しました"); }
  };
  const handleSave = async () => {
    if (!fieldInfo.id || !currentUser) { alert("保存する圃場が選択されていないか、ユーザーが不明です。"); return; }
    try {
      const dataToSave = { name: fieldInfo.name, transplantDate: fieldInfo.transplantDate, variety: fieldInfo.variety };
      await setDoc(doc(db, "users", currentUser.uid, "paddy_fields", fieldInfo.id), dataToSave, { merge: true });
      alert("データを保存しました。");
      if (dataToSave.variety) setVarietyMap(prev => new Map(prev).set(fieldInfo.id, dataToSave.variety));
    } catch (e) { console.error("データの保存に失敗しました:", e); alert(`エラーが発生しました: ${e.message}`); }
  };
  const handleBulkSave = async () => {
    if (selectedFields.length === 0 || !currentUser) { alert("保存する圃場が選択されていないか、ユーザーが不明です。"); return; }
    if (!bulkInfo.transplantDate && !bulkInfo.variety) { alert("移植日か品種のどちらかを入力してください。"); return; }
    try {
      const batch = writeBatch(db);
      const dataToSave = {};
      if (bulkInfo.transplantDate) dataToSave.transplantDate = bulkInfo.transplantDate;
      if (bulkInfo.variety) dataToSave.variety = bulkInfo.variety;
      selectedFields.forEach(id => batch.set(doc(db, "users", currentUser.uid, "paddy_fields", id), dataToSave, { merge: true }));
      await batch.commit();
      alert(`${selectedFields.length}件の圃場にデータを一括保存しました。`);
      if (dataToSave.variety) {
        const newVarietyMap = new Map(varietyMap);
        selectedFields.forEach(id => newVarietyMap.set(id, dataToSave.variety));
        setVarietyMap(newVarietyMap);
      }
      setBulkInfo({ transplantDate: '', variety: '' });
    } catch (e) { console.error("データの一括保存に失敗しました:", e); alert(`エラーが発生しました: ${e.message}`); }
  };
  const handleDelete = async () => {
    if (!fieldInfo.id || !currentUser) { alert("削除する圃場が選択されていないか、ユーザーが不明です。"); return; }
    if (window.confirm(`本当にこの圃場（ID: ${fieldInfo.id}）のデータを削除しますか？`)) {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "paddy_fields", fieldInfo.id));
        alert("データを削除しました。");
        const newVarietyMap = new Map(varietyMap);
        newVarietyMap.delete(fieldInfo.id);
        setVarietyMap(newVarietyMap);
        setFieldInfo({ id: '', name: '', transplantDate: '', variety: '', lat: null, lon: null });
        setSelectedFields([]);
      } catch (e) { console.error("データの削除に失敗しました:", e); alert(`エラーが発生しました: ${e.message}`); }
    }
  };
  const handleBulkDelete = async () => {
    if (selectedFields.length === 0 || !currentUser) { alert("削除する圃場が選択されていないか、ユーザーが不明です。"); return; }
    if (window.confirm(`本当に選択中の${selectedFields.length}件の圃場データをすべて削除しますか？この操作は元に戻せません。`)) {
      try {
        const batch = writeBatch(db);
        selectedFields.forEach(id => batch.delete(doc(db, "users", currentUser.uid, "paddy_fields", id)));
        await batch.commit();
        alert(`${selectedFields.length}件のデータを削除しました。`);
        const newVarietyMap = new Map(varietyMap);
        selectedFields.forEach(id => newVarietyMap.delete(id));
        setVarietyMap(newVarietyMap);
        setSelectedFields([]);
      } catch (e) { console.error("データの一括削除に失敗しました:", e); alert(`エラーが発生しました: ${e.message}`); }
    }
  };
  const handlePredict = async () => {
    if (!fieldInfo.id || !fieldInfo.lat || !fieldInfo.transplantDate || !fieldInfo.variety) {
      alert("予測には、緯度経度、移植日、品種の情報が必要です。");
      return;
    }
    setPredictionResult('calculating');
    try {
      const payload = { lat: fieldInfo.lat, lon: fieldInfo.lon, transplantDate: fieldInfo.transplantDate, variety: fieldInfo.variety, weatherUser, weatherPassword };
      const response = await fetch(PREDICTION_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `APIサーバーがエラーを返しました: ${response.status}`);
      }
      const result = await response.json();
      setPredictionResult(result);
    } catch (e) { console.error("予測計算中にエラーが発生しました:", e); setPredictionResult({ error: e.message }); }
  };
  const handleGeoJsonExport = async () => {
    if (selectedFields.length === 0 || !currentUser) { alert("エクスポートする圃場が選択されていないか、ユーザーが不明です。"); return; }
    if (!wfsLayer) { alert("地図データがまだ読み込まれていません。"); return; }
    try {
      setIsLoading(true);
      const allFeatures = wfsLayer.toGeoJSON().features;
      const selectedFeatures = allFeatures.filter(feature => selectedFields.includes(feature.properties.polygon_uuid));
      const enrichedFeatures = [];
      for (const feature of selectedFeatures) {
        const fieldId = feature.properties.polygon_uuid;
        const newProperties = { ...feature.properties };
        const docRef = doc(db, "users", currentUser.uid, "paddy_fields", fieldId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          newProperties.name = data.name || '';
          newProperties.transplantDate = data.transplantDate || '';
          newProperties.variety = data.variety || '';
        }
        if (fieldId === fieldInfo.id && predictionResult && predictionResult.heading_date) {
          newProperties.heading_date_pred = predictionResult.heading_date;
          newProperties.maturity_date_pred = predictionResult.maturity_date;
        }
        enrichedFeatures.push({ ...feature, properties: newProperties });
      }
      const geoJsonData = { type: "FeatureCollection", features: enrichedFeatures };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geoJsonData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "suito_yosoku_export.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      document.body.removeChild(downloadAnchorNode);
      alert(`${selectedFields.length}件の圃場データをGeoJSONファイルとしてエクスポートしました。`);
    } catch (e) {
      console.error("GeoJSONのエクスポートに失敗しました:", e);
      alert(`エクスポート中にエラーが発生しました: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  const handleCsvExport = async () => {
    if (selectedFields.length === 0 || !currentUser) { alert("エクスポートする圃場が選択されていません。"); return; }
    if (!wfsLayer) { alert("地図データがまだ読み込まれていません。"); return; }
    setIsExporting(true);
    setError(null);
    try {
      const exportData = [];
      const allFeatures = wfsLayer.toGeoJSON().features;
      const featureMap = new Map(allFeatures.map(f => [f.properties.polygon_uuid, f]));
      for (const fieldId of selectedFields) {
        const feature = featureMap.get(fieldId);
        if (!feature) continue;
        const properties = feature.properties;
        let rowData = {
          polygon_uuid: fieldId,
          name: '',
          transplantDate: '',
          variety: '',
          latitude: properties.point_lat,
          longitude: properties.point_lng,
          predicted_heading_date: '',
          predicted_maturity_date: '',
          error: ''
        };
        const docRef = doc(db, "users", currentUser.uid, "paddy_fields", fieldId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          rowData.name = data.name || '';
          rowData.transplantDate = data.transplantDate || '';
          rowData.variety = data.variety || '';
        }
        if (rowData.transplantDate && rowData.variety && rowData.latitude) {
          try {
            const payload = { lat: rowData.latitude, lon: rowData.longitude, transplantDate: rowData.transplantDate, variety: rowData.variety, weatherUser, weatherPassword };
            const response = await fetch(PREDICTION_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (response.ok) {
                const result = await response.json();
                if (result.heading_date) {
                    rowData.predicted_heading_date = result.heading_date;
                    rowData.predicted_maturity_date = result.maturity_date;
                } else if (result.error) {
                    rowData.error = result.error;
                }
            } else {
                const errData = await response.json();
                rowData.error = errData.error || `API Error ${response.status}`;
            }
          } catch (e) {
            rowData.error = e.message;
          }
        }
        exportData.push(rowData);
      }
      const csvData = convertToCSV(exportData);
      const blob = new Blob(["\uFEFF" + csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "suito_yosoku_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert(`${selectedFields.length}件の圃場データをCSVファイルとしてエクスポートしました。`);
    } catch (e) {
      console.error("CSVのエクスポートに失敗しました:", e);
      alert(`エクスポート中にエラーが発生しました: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const Resizer = ({ onMouseDown }) => (
    <div 
      onMouseDown={onMouseDown}
      style={{
        width: '10px',
        cursor: 'col-resize',
        background: '#f0f0f0',
        borderLeft: '1px solid #ccc',
        borderRight: '1px solid #ccc',
        zIndex: 10
      }}
    />
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', fontFamily: 'sans-serif' }}>
      {/* Left Panel */}
      <div style={{ width: leftPanelWidth, padding: '10px', overflowY: 'auto', boxSizing: 'border-box', position: 'relative' }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
          <p style={{fontSize: '12px', color: '#555', margin: 0}}>ユーザー: {currentUser?.email}</p>
          <button onClick={logout} style={{padding: '5px 10px', background: '#616161', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>ログアウト</button>
        </div>
        <hr />

        <div>
          <button 
            onClick={() => setIsAuthPanelOpen(!isAuthPanelOpen)} 
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '10px 0', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            気象API認証
            <i className={`fas ${isAuthPanelOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
          </button>
          {isAuthPanelOpen && (
            <div style={{ padding: '0 10px 10px 10px', background: '#f9f9f9', borderRadius: '4px' }}>
              <div style={{ marginBottom: '10px', paddingTop: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>ユーザー名</label>
                <input type="text" value={weatherUser} onChange={(e) => setWeatherUser(e.target.value)} style={{ width: '100%', padding: '5px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>パスワード</label>
                <input type="password" value={weatherPassword} onChange={(e) => setWeatherPassword(e.target.value)} style={{ width: '100%', padding: '5px', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}
        </div>
        <hr />
        
        <div>
          <h3>市町村選択</h3>
          <select value={selectedLayer} onChange={(e) => setSelectedLayer(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px' }}>
            {MUNICIPALITY_LAYERS.map(layer => (
              <option key={layer.value} value={layer.value}>{layer.label}</option>
            ))}
          </select>
        </div>
        <hr />

        <div>
          <h3>品種の凡例</h3>
          <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
            {[...new Set(varietyMap.values())].map(variety => (
              variety && <li key={variety} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                <input type="color" value={getFinalColor(variety)} onChange={(e) => handleColorChange(variety, e.target.value)} style={{ marginRight: '10px', border: 'none', width: '25px', height: '25px', padding: 0, background: 'none' }} />
                {variety}
              </li>
            ))}
          </ul>
        </div>
        <hr />
        {(selectedFields.length > 0) && (
          <div>
            <h3>データ出力</h3>
            <button onClick={handleCsvExport} disabled={isExporting} style={{ width: '100%', padding: '10px', background: '#009688', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: isExporting ? 0.5 : 1 }}>
              {isExporting ? 'エクスポート中...' : `選択した${selectedFields.length}件をCSV出力`}
            </button>
            <button onClick={handleGeoJsonExport} style={{ width: '100%', padding: '10px', background: '#78909C', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}>選択した{selectedFields.length}件をGeoJSON出力</button>
          </div>
        )}
        <hr />
        {error && <div style={{ color: 'red' }}><h4>エラー</h4><p>{error}</p></div>}
      </div>

      <Resizer onMouseDown={(e) => startResizing(e, 'left')} />

      {/* Center Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <BaseLayerSwitcher map={map} />
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {isLoading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255, 255, 255, 0.8)', padding: '20px', borderRadius: '8px', zIndex: 1000 }}>読み込み中...</div>}
      </div>

      <Resizer onMouseDown={(e) => startResizing(e, 'right')} />

      {/* Right Panel */}
      <div style={{ width: rightPanelWidth, padding: '10px', overflowY: 'auto', boxSizing: 'border-box' }}>
        <h2>圃場情報</h2>
        {selectedFields.length === 1 && (
          <div>
            <h4>個別編集</h4>
            <div style={{ marginBottom: '15px' }}><label style={{display: 'block', marginBottom: '5px'}}>圃場ID</label><input type="text" value={fieldInfo.id} readOnly style={{ width: '100%', padding: '5px', boxSizing: 'border-box', background: '#eee' }} /></div>
            <div style={{ marginBottom: '15px' }}><label style={{display: 'block', marginBottom: '5px'}}>圃場名</label><input type="text" name="name" value={fieldInfo.name} onChange={handleInputChange} style={{ width: '100%', padding: '5px', boxSizing: 'border-box' }} /></div>
            <div style={{ marginBottom: '15px' }}><label style={{display: 'block', marginBottom: '5px'}}>品種</label><select name="variety" value={fieldInfo.variety} onChange={handleInputChange} style={{ width: '100%', padding: '8px' }}><option value="">品種を選択</option>{availableVarieties.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
            <div style={{ marginBottom: '15px' }}><label style={{display: 'block', marginBottom: '5px'}}>移植日</label><input type="date" name="transplantDate" value={fieldInfo.transplantDate} onChange={handleInputChange} style={{ width: '100%', padding: '5px', boxSizing: 'border-box' }} /></div>
            <button onClick={handleSave} style={{ width: '100%', padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>この内容で保存</button>
            <button onClick={() => setSelectedFields([])} style={{ marginTop: '10px', padding: '8px', width: '100%', background: '#9E9E9E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>選択をリセット</button>
            <hr style={{ margin: '20px 0' }} />
            <button onClick={handlePredict} disabled={!fieldInfo.transplantDate || !fieldInfo.variety} style={{ width: '100%', padding: '10px', background: '#673AB7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: (!fieldInfo.transplantDate || !fieldInfo.variety) ? 0.5 : 1 }}>生育予測</button>
            {predictionResult === 'calculating' && <p style={{marginTop: '15px'}}>計算中...</p>}
            {predictionResult && predictionResult.heading_date && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#f3e5f5', borderRadius: '4px' }}><p><strong>出穂予測日:</strong> {predictionResult.heading_date}</p><p><strong>成熟予測日:</strong> {predictionResult.maturity_date}</p></div>
            )}
            {predictionResult && predictionResult.error && (
              <div style={{ marginTop: '15px', padding: '10px', background: '#ffcdd2', borderRadius: '4px' }}><p><strong>エラー:</strong> {predictionResult.error}</p></div>
            )}
            <hr style={{ margin: '20px 0' }} />
            <button onClick={handleDelete} style={{ width: '100%', padding: '10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>この圃場の情報を削除</button>
          </div>
        )}
        {selectedFields.length > 1 && (
          <div>
            <h4>一括編集</h4>
            <p>{selectedFields.length}件の圃場を選択中</p>
            <div style={{ marginBottom: '15px' }}><label style={{display: 'block', marginBottom: '5px'}}>品種</label><select name="variety" value={bulkInfo.variety} onChange={handleBulkInputChange} style={{ width: '100%', padding: '8px' }}><option value="">品種を選択</option>{availableVarieties.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
            <div style={{ marginBottom: '15px' }}><label style={{display: 'block', marginBottom: '5px'}}>移植日</label><input type="date" name="transplantDate" value={bulkInfo.transplantDate} onChange={handleBulkInputChange} style={{ width: '100%', padding: '5px', boxSizing: 'border-box' }} /></div>
            <button onClick={handleBulkSave} style={{ width: '100%', padding: '10px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>選択した{selectedFields.length}件に一括保存</button>
            <button onClick={() => setSelectedFields([])} style={{ marginTop: '10px', padding: '8px', width: '100%', background: '#9E9E9E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>選択をリセット</button>
            <hr style={{ margin: '20px 0' }} />
            <button onClick={handleBulkDelete} style={{ width: '100%', padding: '10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>選択した{selectedFields.length}件の情報を削除</button>
          </div>
        )}
        {selectedFields.length === 0 && (
          <p>情報を編集するには、地図上の圃場を選択してください。</p>
        )}
      </div>
    </div>
  );
};

export default MapPage;