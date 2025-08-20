import React from 'react';
import { NavLink } from 'react-router-dom';

const Navbar = () => {
  const linkStyle = {
    margin: '0 15px',
    textDecoration: 'none',
    color: '#333',
    padding: '10px',
    borderRadius: '5px',
  };

  const activeLinkStyle = {
    ...linkStyle,
    fontWeight: 'bold',
    color: '#007bff',
    background: '#e7f3ff',
  };

  return (
    <nav style={{ background: '#f8f9fa', padding: '10px 20px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'center' }}>
      <NavLink 
        to="/" 
        style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}
      >
        地図ページ
      </NavLink>
      <NavLink 
        to="/csv-import" 
        style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}
      >
        csvインポート
      </NavLink>
      <NavLink 
        to="/add-variety" 
        style={({ isActive }) => isActive ? activeLinkStyle : linkStyle}
      >
        品種追加
      </NavLink>
    </nav>
  );
};

export default Navbar;
