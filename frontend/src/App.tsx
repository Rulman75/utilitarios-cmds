import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Inicio from './pages/Inicio';
import ProcesarDistribucion from './pages/ProcesarDistribucion';
import { VisorInformes } from './pages/VisorInformes';
import { DespachoCorreo } from './pages/DespachoCorreo';
import { HistorialPeriodos } from './pages/HistorialPeriodos';
import { MantenedorCencos } from './pages/MantenedorCencos';
import { ResumenRentasInicio } from './pages/ResumenRentasInicio';
import { ResumenRentasProcesar } from './pages/ResumenRentasProcesar';
import ResumenRentasHistorial from './pages/ResumenRentasHistorial';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/inicio" replace />} />
          <Route path="inicio" element={<Inicio />} />
          <Route path="procesar" element={<ProcesarDistribucion />} />
          <Route path="informes" element={<VisorInformes />} />
          <Route path="correo" element={<DespachoCorreo />} />
          <Route path="historial" element={<HistorialPeriodos />} />
          <Route path="mantenedores" element={<MantenedorCencos />} />
          <Route path="resumen-rentas/inicio" element={<ResumenRentasInicio />} />
          <Route path="resumen-rentas/procesar" element={<ResumenRentasProcesar />} />
          <Route path="resumen-rentas/historial" element={<ResumenRentasHistorial />} />
        </Route>
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
