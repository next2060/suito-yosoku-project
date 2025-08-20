import React from 'react';
import Navbar from '../components/Navbar';

const HeatmapPage = () => {
  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h2>ヒートマップ</h2>
        <p>ここにCSVをアップロードし、ヒートマップを表示する機能を実装します。</p>
        {/* Map container will go here */}
      </div>
    </div>
  );
};

export default HeatmapPage;
