import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppVersion } from '../version';

export default function Layout() {
  const { display: versionDisplay, tooltip: versionTooltip } = useAppVersion();
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState({ username: 'admin', unidad: 'DAF', tipo: 'A' });
  const [openDistribucion, setOpenDistribucion] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserData({
          username: payload.username || 'admin',
          unidad: payload.unidad || 'DAF',
          tipo: (payload.tipo || 'A').trim().toUpperCase()
        });
      } catch {
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;
  const isDistribucionRoute = ['/inicio', '/procesar', '/informes', '/correo', '/historial', '/mantenedores'].includes(
    location.pathname
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#f4f7f6] font-sans text-[#1e293b] print:bg-white print:h-auto">
      {/* Sidebar Corporativo CMDS */}
      <aside className="w-full md:w-[280px] bg-[#016098] text-white shrink-0 shadow-lg flex flex-col justify-between print:hidden">
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-76px)]">
          {/* Logo / Header del Sidebar */}
          <div className="flex flex-col items-center pb-5 mb-4 border-b border-white/20 text-center">
            <img
              src="/logo.png"
              alt="Logo CMDS"
              className="max-w-[90px] h-auto mb-2.5 bg-white p-2 rounded-lg shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h4 className="text-[1.1rem] font-extrabold tracking-wide m-0 leading-tight">
              Utilitarios TI CMDS
            </h4>
            <p className="text-[0.72rem] text-blue-200 mt-0.5">
              Plataforma de Herramientas Corporativas
            </p>
            <span
              title={versionTooltip}
              className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-blue-100 border border-white/15 tracking-wider"
            >
              Versión {versionDisplay}
            </span>

            {userData.username && (
              <div className="mt-3 bg-[#024a8d] px-3 py-1.5 rounded-full text-xs font-medium text-blue-100 flex items-center gap-1.5 border border-white/10 shadow-inner">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="truncate max-w-[130px]">{userData.username}</span>
                <span className="text-[10px] bg-blue-800 px-1.5 py-0.5 rounded text-blue-200 uppercase">
                  {userData.unidad || userData.tipo}
                </span>
              </div>
            )}
          </div>

          {/* Navegación Principal por Módulos / Utilitarios */}
          <div className="pb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-blue-200/80">
            Módulos Disponibles
          </div>

          <nav className="space-y-2 text-sm">
            {/* UTILITARIO 1: Distribución Remuneraciones */}
            <div className="rounded-xl bg-black/10 border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenDistribucion(!openDistribucion)}
                className={`w-full flex items-center justify-between py-2.5 px-3 text-left font-bold transition-colors cursor-pointer ${
                  isDistribucionRoute
                    ? 'bg-white/15 text-white'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 shrink-0 text-[#39BABD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-[13px] leading-tight">Distribución Remuneraciones</span>
                </div>
                <svg
                  className={`w-4 h-4 shrink-0 text-blue-200 transition-transform duration-200 ${
                    openDistribucion ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {openDistribucion && (
                <div className="p-1.5 space-y-1 border-t border-white/10 bg-[#015282]/60">
                  <Link
                    to="/inicio"
                    className={`flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors text-xs font-semibold ${
                      isActive('/inicio')
                        ? 'bg-[#39BABD] text-white shadow-sm'
                        : 'text-blue-50/90 hover:bg-white/10'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    <span>Dashboard Renta</span>
                  </Link>

                  <Link
                    to="/procesar"
                    className={`flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors text-xs font-semibold ${
                      isActive('/procesar')
                        ? 'bg-[#39BABD] text-white shadow-sm'
                        : 'text-blue-50/90 hover:bg-white/10'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    <span>Procesar Archivo Renta</span>
                  </Link>

                  <Link
                    to="/informes"
                    className={`flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors text-xs font-semibold ${
                      isActive('/informes')
                        ? 'bg-[#39BABD] text-white shadow-sm'
                        : 'text-blue-50/90 hover:bg-white/10'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Informes Contabilidad</span>
                  </Link>

                  <Link
                    to="/correo"
                    className={`flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors text-xs font-semibold ${
                      isActive('/correo')
                        ? 'bg-[#39BABD] text-white shadow-sm'
                        : 'text-blue-50/90 hover:bg-white/10'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Despacho a Contabilidad</span>
                  </Link>

                  <Link
                    to="/historial"
                    className={`flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors text-xs font-semibold ${
                      isActive('/historial')
                        ? 'bg-[#39BABD] text-white shadow-sm'
                        : 'text-blue-50/90 hover:bg-white/10'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Historial de Períodos</span>
                  </Link>

                  <Link
                    to="/mantenedores"
                    className={`flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors text-xs font-semibold ${
                      isActive('/mantenedores')
                        ? 'bg-[#39BABD] text-white shadow-sm'
                        : 'text-blue-50/90 hover:bg-white/10'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Mantenedor Cencos y Reglas</span>
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Botón Cerrar Sesión */}
        <div className="p-4 border-t border-white/15">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#EB567F] hover:bg-[#d6416a] text-white text-xs font-bold shadow transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenedor Principal Derecho */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible">
        <div className="flex-1 overflow-auto p-5 md:p-7 print:p-0 print:overflow-visible">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
