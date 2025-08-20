import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MapPage from './pages/MapPage';
import LoginPage from './pages/LoginPage';
import CsvImportPage from './pages/CsvImportPage';
import AddVarietyPage from './pages/AddVarietyPage';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout>
              <MapPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      {/* CSV Import page route */}
      <Route 
        path="/csv-import" 
        element={
          <ProtectedRoute>
            <MainLayout>
              <CsvImportPage />
            </MainLayout>
          </ProtectedRoute>
        } 
      />
      {/* Add Variety page route */}
      <Route 
        path="/add-variety" 
        element={
          <ProtectedRoute>
            <MainLayout>
              <AddVarietyPage />
            </MainLayout>
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default App;
