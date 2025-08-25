import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useAuth } from '../context/AuthContext';
import BaseLayerSwitcher from '../components/BaseLayerSwitcher';

// Firebaseの各機能をインポート
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';

// --- 定数定義 ---
const QGIS_SERVER_URL = process.env.REACT_APP_QGIS_SERVER_URL;
const PREDICTION_API_URL = process.env.REACT_APP_PREDICTION_API_URL;

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
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PREDEFINED_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1', '#FDD835', '#3949AB', '#D81B60', '#7CB342', '#F4511E', '#5E35B1', '#039BE5', '#6D4C41', '#C0CA33'];
const getAutoColorForString = (str) => {
  if (!str) return '#cccccc';
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  return PREDEFINED_COLORS[Math.abs(hash % PREDEFINED_COLORS.length)];
};

const MapPage = () => {
  const { currentUser, logout } = useAuth();
  const mapRef = useRef(null);
  const dataLayerGroup = useRef(null); // ★ useRef for the data layer group

  const [map, setMap] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(MUNICIPALITY_LAYERS[0].value);
  const [selectedFields, setSelectedFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [varietyMap, setVarietyMap] = useState(new Map());
  const [customColorMap, setCustomColorMap] = useState(new Map());
  // ... other states

  const getFinalColor = useCallback((variety) => {
    return customColorMap.get(variety) || getAutoColorForString(variety);
  }, [customColorMap]);

  // --- Map Initialization ---
  useEffect(() => {
    if (mapRef.current && !map) {
      const leafletMap = L.map(mapRef.current).setView([36.34, 140.45], 9);
      setMap(leafletMap);

      // ★ Initialize the data layer group and add it to the map
      dataLayerGroup.current = L.featureGroup().addTo(leafletMap);
    }
  }, [map]);

  // --- Layer Data Fetching ---
  useEffect(() => {
    if (!map || !selectedLayer || !currentUser) return;
    const fetchLayerData = async () => {
      setIsLoading(true);
      setSelectedFields([]);
      dataLayerGroup.current.clearLayers(); // ★ Clear the container

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
        });
        
        geoJsonLayer.addTo(dataLayerGroup.current); // ★ Add new data to the container

        if (wfsData.features.length > 0) map.fitBounds(dataLayerGroup.current.getBounds());
        else alert("この市町村には表示できる圃場データがありません。");
      } catch (e) {
        console.error("レイヤーデータの取得に失敗しました:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLayerData();
  }, [map, selectedLayer, currentUser, getFinalColor]);

  // --- Layer Styling Logic ---
  useEffect(() => {
    if (!dataLayerGroup.current) return;
    dataLayerGroup.current.eachLayer(layer => {
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
  }, [selectedFields, varietyMap, customColorMap, getFinalColor]);

  // ... (rest of the component remains the same)

  return (
    // ... JSX remains the same
  );
};

export default MapPage;
