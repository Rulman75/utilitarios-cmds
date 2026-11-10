import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAppVersion } from '../version';

export default function Login() {
  const { display: versionDisplay, tooltip: versionTooltip } = useAppVersion();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingrese usuario y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password
      });

      if (response.data.status === 'ok') {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/inicio');
      } else {
        setError(response.data.message || 'Error al iniciar sesión');
      }
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Error de conexión con el servidor. Intente más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] flex flex-col justify-center items-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
        {/* Lado Izquierdo: Corporativo CMDS */}
        <div className="md:w-1/2 bg-[#016098] text-white p-10 flex flex-col justify-between items-center text-center relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white opacity-5"></div>
          <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-[#39BABD] opacity-20"></div>

          <div className="z-10 mt-6">
            <img
              src="/logo.png"
              alt="Logo CMDS"
              className="w-36 h-auto mx-auto mb-6 bg-white p-3 rounded-xl shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-yellow-400">CMDS</h1>
            <h2 className="text-lg font-medium text-blue-100">Corporación Municipal de Desarrollo Social</h2>
          </div>

          <div className="z-10 my-8">
            <p className="text-xl text-blue-50 leading-relaxed font-extrabold tracking-wide">
              Utilitarios TI CMDS
            </p>
            <p className="text-xs text-blue-200 mt-2">
              Plataforma Centralizada de Herramientas, Automatización de Procesos y Gestión Corporativa
            </p>
            <div className="mt-4">
              <span
                title={versionTooltip}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-blue-50 border border-white/20 shadow-sm tracking-wide"
              >
                Versión {versionDisplay}
              </span>
            </div>
          </div>

          <div className="z-10 text-xs text-blue-200 space-y-1">
            <div>&copy; {new Date().getFullYear()} CMDS Antofagasta — Unidad de Tecnologías de la Información (TI).</div>
          </div>
        </div>

        {/* Lado Derecho: Formulario */}
        <div className="md:w-1/2 p-10 md:p-12 flex flex-col justify-center bg-white">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl font-bold text-[#1e293b] mb-2">Bienvenido a Utilitarios TI CMDS</h2>
            <p className="text-sm text-[#64748b]">
              Ingrese sus credenciales corporativas para acceder a los utilitarios y módulos del sistema
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-[#EB567F]/10 border-l-4 border-[#EB567F] p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-[#EB567F]" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-[#EB567F] font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-2" htmlFor="username">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 w-full px-4 py-3 bg-[#f8fafc] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#016098] focus:bg-white transition-colors text-[#1e293b]"
                  placeholder="Ej: admin o usuario CMDS"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-2" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full px-4 py-3 bg-[#f8fafc] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#016098] focus:bg-white transition-colors text-[#1e293b]"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 bg-[#016098] hover:bg-[#024a8d] text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition duration-200 flex justify-center items-center cursor-pointer ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>

          <div className="mt-8 border-t border-gray-100 pt-6 text-center">
            <p className="text-xs text-gray-400">
              Dirección de Administración y Finanzas (DAF) — CMDS Antofagasta
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
