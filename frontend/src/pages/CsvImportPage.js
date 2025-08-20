import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Papa from 'papaparse';
import BaseLayerSwitcher from '../components/BaseLayerSwitcher';

// Fix for default marker icon issue with webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const QGIS_SERVER_URL = 'http://54.252.200.4:8089/';

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

const getHeadingDateColor = (dateStr, minDate, maxDate) => {
  if (!dateStr) return '#808080'; // Gray for no data
  const date = new Date(dateStr);
  const max = maxDate.getTime();
  const min = minDate.getTime();
  const time = date.getTime();
  if (time < min || time > max || isNaN(time)) return '#808080';
  const ratio = (max === min) ? 0 : (time - min) / (max - min);
  const r = Math.round(255 * ratio);
  const b = 255 - r;
  return `rgb(${r},0,${b})`; // Blue to Red
};

const getMaturityDateColor = (dateStr, minDate, maxDate) => {
  if (!dateStr) return '#808080'; // Gray for no data
  const date = new Date(dateStr);
  const max = maxDate.getTime();
  const min = minDate.getTime();
  const time = date.getTime();
  if (time < min || time > max || isNaN(time)) return '#808080';
  const ratio = (max === min) ? 0 : (time - min) / (max - min);
  const r = Math.round(255 * ratio);
  const g = 255;
  const b = 0;
  return `rgb(${r},${g},${b})`; // Green to Yellow
};

const CsvImportPage = () => {
  const mapRef = useRef(null);
  const isResizing = useRef(false);
  const [map, setMap] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(350);
  const [combinedData, setCombinedData] = useState([]);
  const [geoJsonLayer, setGeoJsonLayer] = useState(null);
  const [visualizationField, setVisualizationField] = useState('predicted_heading_date');
  const [selectedLayer, setSelectedLayer] = useState(MUNICIPALITY_LAYERS[0].value);
  const [legendControl, setLegendControl] = useState(null);

  // --- Resize Handlers ---
  const startResizing = (e) => {
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
  };

  const resize = (e) => {
    if (isResizing.current) {
      // Set constraints for panel width
      const newWidth = Math.max(250, Math.min(e.clientX, 800));
      setLeftPanelWidth(newWidth);
    }
  };

  const stopResizing = () => {
    isResizing.current = false;
    window.removeEventListener('mousemove', resize);
    window.removeEventListener('mouseup', stopResizing);
    // Trigger map resize after panel adjustment
    if(map) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  };

  // Initialize map & legend
  useEffect(() => {
    if (mapRef.current && !map) {
      const leafletMap = L.map(mapRef.current).setView([36.34, 140.45], 9);
      
      const legend = L.control({ position: 'bottomright' });
      legend.onAdd = function (map) {
          const div = L.DomUtil.create('div', 'info legend');
          div.style.background = 'white';
          div.style.padding = '10px';
          div.style.borderRadius = '5px';
          div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
          return div;
      };
      legend.addTo(leafletMap);
      setLegendControl(legend);

      setMap(leafletMap);
    }
  }, [map]);

  // Re-style layer and update legend when visualization field changes
  useEffect(() => {
    if (!geoJsonLayer || combinedData.length === 0 || !legendControl) return;

    const dateValues = combinedData
        .map(item => new Date(item[visualizationField]))
        .filter(date => !isNaN(date.getTime()));

    const div = legendControl.getContainer();

    if (dateValues.length === 0) {
        geoJsonLayer.eachLayer(layer => {
            layer.setStyle({ fillColor: '#808080', weight: 1, opacity: 1, color: 'white', fillOpacity: 0.8 });
        });
        div.innerHTML = '<h4>凡例</h4>データがありません';
        return;
    }

    const minDate = new Date(Math.min.apply(null, dateValues));
    const maxDate = new Date(Math.max.apply(null, dateValues));

    geoJsonLayer.eachLayer(layer => {
        const uuid = layer.feature.properties.polygon_uuid;
        const data = combinedData.find(d => d.polygon_uuid === uuid);
        let color = '#808080';
        if (data) {
            if (visualizationField === 'predicted_heading_date') {
                color = getHeadingDateColor(data[visualizationField], minDate, maxDate);
            } else {
                color = getMaturityDateColor(data[visualizationField], minDate, maxDate);
            }
        }
        layer.setStyle({ fillColor: color, weight: 1, opacity: 1, color: 'white', fillOpacity: 0.8 });
    });

    let legendHtml = `<h4>凡例 (${visualizationField === 'predicted_heading_date' ? '出穂期' : '成熟期'})</h4>`;
    if (visualizationField === 'predicted_heading_date') {
        legendHtml += '<div style="background: linear-gradient(to right, rgb(0,0,255), rgb(255,0,0)); width: 100%; height: 10px; margin-top: 5px;"></div>';
    } else {
        legendHtml += '<div style="background: linear-gradient(to right, rgb(0,255,0), rgb(255,255,0)); width: 100%; height: 10px; margin-top: 5px;"></div>';
    }
    legendHtml += `<div style="display: flex; justify-content: space-between;"><span style="font-size: 12px;">${minDate.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })}</span><span style="font-size: 12px;">${maxDate.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })}</span></div>`;
    div.innerHTML = legendHtml;

  }, [geoJsonLayer, combinedData, visualizationField, legendControl]);

  const processFile = (file) => {
    if (!file) return;

    setFileName(file.name);
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
    }
    setCombinedData([]);
    setIsLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const csvData = results.data;
        const uuids = csvData.map(row => row.polygon_uuid).filter(uuid => uuid);

        if (uuids.length === 0) {
          alert('CSVファイルにpolygon_uuid列が見つかりません。');
          setIsLoading(false);
          return;
        }

        const filter = `<Filter><Or>${uuids.map(uuid => `<PropertyIsEqualTo><PropertyName>polygon_uuid</PropertyName><Literal>${uuid}</Literal></PropertyIsEqualTo>`).join('')}</Or></Filter>`;
        const wfsUrl = `${QGIS_SERVER_URL}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature&TYPENAME=${selectedLayer}&SRSNAME=EPSG:4326&OUTPUTFORMAT=GeoJSON&FILTER=${encodeURIComponent(filter)}`;

        try {
          const response = await fetch(wfsUrl);
          if (!response.ok) throw new Error(`QGIS Server Error: ${response.status}`);
          const geoJsonData = await response.json();

          if (geoJsonData.features.length === 0) {
            alert('選択された市町村に、CSVと一致する圃場データが見つかりませんでした。');
          } else {
            alert(`${geoJsonData.features.length}件の圃場データを地図に表示しました。`);
          }

          const csvDataMap = new Map(csvData.map(row => [row.polygon_uuid, row]));
          geoJsonData.features.forEach(feature => {
            const csvRow = csvDataMap.get(feature.properties.polygon_uuid);
            if (csvRow) {
              feature.properties = { ...feature.properties, ...csvRow };
            }
          });
          
          const newLayer = L.geoJSON(geoJsonData, {
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const desiredOrder = ['name', 'variety', 'transplantDate', 'predicted_heading_date', 'predicted_maturity_date'];
                let popupContent = '<b>圃場情報</b><br />';
                desiredOrder.forEach(key => {
                    if (props[key]) {
                        popupContent += `<b>${key}:</b> ${props[key]}<br />`;
                    }
                });
                layer.bindPopup(popupContent);
            }
          }).addTo(map);

          setGeoJsonLayer(newLayer);
          setCombinedData(csvData);
          if(geoJsonData.features.length > 0) {
            map.fitBounds(newLayer.getBounds().pad(0.1));
          }

        } catch (error) {
          console.error("Failed to fetch GeoJSON data:", error);
          alert(`ポリゴンデータの取得に失敗しました: ${error.message}`);
        } finally {
          setIsLoading(false);
        }
      },
      error: (error) => {
        console.error("CSVの解析に失敗しました:", error);
        alert('CSVファイルの解析に失敗しました。');
        setIsLoading(false);
      }
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      processFile(file);
    } else {
      alert('CSVファイルのみドロップできます。');
    }
  };


  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', fontFamily: 'sans-serif' }}>
      {/* Left Panel for Controls */}
      <div style={{ width: leftPanelWidth, padding: '10px 20px', borderRight: '1px solid #ccc', overflowY: 'auto', boxSizing: 'border-box', position: 'relative' }}>
        
        <h2>操作パネル</h2>
        
        <div style={{marginTop: '20px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}><strong>1. 市町村を選択</strong></label>
            <select value={selectedLayer} onChange={(e) => setSelectedLayer(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                {MUNICIPALITY_LAYERS.map(layer => (
                <option key={layer.value} value={layer.value}>{layer.label}</option>
                ))}
            </select>
        </div>

        <div style={{marginTop: '20px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}><strong>2. CSVファイルを選択</strong></label>
            <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    border: isDragging ? '2px dashed #2196F3' : '2px dashed #ccc',
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    background: isDragging ? '#e3f2fd' : '#fafafa',
                    transition: 'background-color 0.2s, border-color 0.2s',
                    cursor: 'pointer'
                }}
            >
                <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }}
                    id="csv-upload"
                />
                <label htmlFor="csv-upload" style={{ color: '#2196F3', cursor: 'pointer', textDecoration: 'underline' }}>
                    ファイルを選択
                </label>
                <p style={{color: '#666', margin: '10px 0 0 0'}}>または、ここにファイルをドラッグ＆ドロップ</p>
                {fileName && <p style={{ color: '#555', marginTop: '10px', wordBreak: 'break-all' }}>選択中: {fileName}</p>}
            </div>
        </div>

        {combinedData.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <strong>3. 表示するデータを選択</strong>
            <div style={{marginTop: '10px'}}>
              <label style={{display: 'block', margin: '5px 0'}}><input type="radio" value="predicted_heading_date" checked={visualizationField === 'predicted_heading_date'} onChange={(e) => setVisualizationField(e.target.value)} style={{marginRight: '5px'}}/> 出穂期</label>
              <label style={{display: 'block', margin: '5px 0'}}><input type="radio" value="predicted_maturity_date" checked={visualizationField === 'predicted_maturity_date'} onChange={(e) => setVisualizationField(e.target.value)} style={{marginRight: '5px'}}/> 成熟期</label>
            </div>
          </div>
        )}
      </div>

      {/* Resizer Handle */}
      <div 
        onMouseDown={startResizing}
        style={{
          width: '10px',
          cursor: 'col-resize',
          background: '#f0f0f0',
          borderLeft: '1px solid #ccc',
          borderRight: '1px solid #ccc'
        }}
      />

      {/* Right Map Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <BaseLayerSwitcher map={map} />
        <div ref={mapRef} style={{ height: '100%', width: '100%', background: isLoading ? '#f0f0f0' : '#fff' }} >
          {isLoading && <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', zIndex: 1000}}>読み込み中...</div>}
        </div>
      </div>
    </div>
  );
};

export default CsvImportPage;