import React from 'react';
import Navbar from './Navbar';

const MainLayout = ({ children }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Navbar />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
