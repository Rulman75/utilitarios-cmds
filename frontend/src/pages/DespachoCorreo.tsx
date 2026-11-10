import React, { useEffect, useState } from 'react';
import {
  Mail,
  Send,
  Settings,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Save,
  Building2,
  HeartPulse,
  ExternalLink
} from 'lucide-react';
import { formatCurrencyCLP } from '../utils/exportUtils';

const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const DespachoCorreo: React.FC = () => {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [periodoActual, setPeriodoActual] = useState<any>(null);

  const [destinatarios, setDestinatarios] = useState('contabilidad@cmds.cl');
  const [cc, setCc] = useState('daf@cmds.cl');
  const [asunto, setAsunto] = useState('');
  const [mensajeAdicional, setMensajeAdicional] = useState(
    'Se adjuntan las planillas oficiales de distribución de haberes por centro de costo correspondientes al cierre mensual.'
  );
  const [incluirEducacion, setIncluirEducacion] = useState(true);
  const [incluirSalud, setIncluirSalud] = useState(true);

  // Configuración SMTP
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtp.office365.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

  const [sending, setSending] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [perRes, cfgRes] = await Promise.all([
          fetch('/api/periodos'),
          fetch('/api/correo/config')
        ]);
        const perJson = await perRes.json();
        const cfgJson = await cfgRes.json();
        const perData = perJson.periodos || [];
        const cfgData = cfgJson.config || cfgJson;

        if (cfgData) {
          if (cfgData.destinatarios) setDestinatarios(cfgData.destinatarios);
          if (cfgData.cc !== undefined) setCc(cfgData.cc);
          if (cfgData.smtp_host) setSmtpHost(cfgData.smtp_host);
          if (cfgData.smtp_port) setSmtpPort(cfgData.smtp_port);
          if (cfgData.smtp_user) setSmtpUser(cfgData.smtp_user);
        }

        setPeriodos(perData);
        if (perData.length > 0) {
          const p = perData[0];
          setSelectedKey(`${p.anio}-${p.mes}`);
          setPeriodoActual(p);
          setAsunto(`Distribución de Rentas Educación y Salud - ${MESES_NOMBRES[p.mes]} ${p.anio} - DAF CMDS`);
        }
      } catch (e) {
        console.error('Error cargando configuración de correo:', e);
      }
    };
    init();
  }, []);

  const handleSelectPeriod = (val: string) => {
    setSelectedKey(val);
    const [a, m] = val.split('-').map(Number);
    const found = periodos.find((p) => Number(p.anio) === a && Number(p.mes) === m);
    if (found) {
      setPeriodoActual(found);
      setAsunto(`Distribución de Rentas Educación y Salud - ${MESES_NOMBRES[found.mes]} ${found.anio} - DAF CMDS`);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/correo/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinatarios,
          cc,
          asunto_plantilla: 'Distribución de Rentas Educación y Salud - {MES} {ANIO} - DAF CMDS',
          cuerpo_plantilla: mensajeAdicional,
          smtp_host: smtpHost,
          smtp_port: Number(smtpPort),
          smtp_user: smtpUser,
          smtp_pass: smtpPass
        })
      });
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: 'Configuración de destinatarios y servidor SMTP guardada correctamente.'
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: 'Error al guardar la configuración.',
        details: e.message
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodoActual) return;

    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/correo/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anio: periodoActual.anio,
          mes: periodoActual.mes,
          destinatarios,
          cc,
          asunto,
          mensajeAdicional,
          incluirEducacion,
          incluirSalud
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error enviando correo');
      }

      setFeedback({
        type: data.status === 'simulated' ? 'warning' : 'success',
        message: data.message,
        details: data.resumenEnvio?.adjuntos
          ? `Adjuntos generados: ${data.resumenEnvio.adjuntos.join(', ')}`
          : undefined
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'No se pudo completar el despacho por correo.',
        details: err.message
      });
    } finally {
      setSending(false);
    }
  };

  const openMailtoClient = () => {
    if (!periodoActual) return;
    const mesNombre = MESES_NOMBRES[periodoActual.mes];
    const totalEdu = Number(periodoActual.monto_educacion || 0);
    const totalSal = Number(periodoActual.monto_salud || 0);
    const body = [
      `Estimado equipo de Contabilidad CMDS,`,
      ``,
      `Junto con saludar, se remite el resumen oficial de Distribución de Rentas correspondiente a ${mesNombre} ${periodoActual.anio}:`,
      ``,
      `- Total Sector Educación (< 600): ${formatCurrencyCLP(totalEdu)} (${Number(periodoActual.filas_educacion || 0).toLocaleString('es-CL')} registros)`,
      `- Total Sector Salud (>= 600): ${formatCurrencyCLP(totalSal)} (${Number(periodoActual.filas_salud || 0).toLocaleString('es-CL')} registros)`,
      `- Total General Corporación: ${formatCurrencyCLP(totalEdu + totalSal)}`,
      ``,
      mensajeAdicional,
      ``,
      `Atentamente,`,
      `Dirección de Administración y Finanzas (DAF) — CMDS`
    ].join('\r\n');

    const mailtoUrl = `mailto:${encodeURIComponent(destinatarios)}?cc=${encodeURIComponent(
      cc
    )}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const totalEdu = Number(periodoActual?.monto_educacion || 0);
  const totalSal = Number(periodoActual?.monto_salud || 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-[#016098] text-white shadow-md">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">
                Despacho Oficial a Contabilidad CMDS
              </h2>
              <p className="text-xs text-slate-500">
                Envío directo de planillas <code className="text-[#016098] font-bold">distribución_educacion.xls</code> y{' '}
                <code className="text-[#016098] font-bold">distribucion_salud.xls</code> a la unidad requirente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSmtpConfig(!showSmtpConfig)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition"
          >
            <Settings className="w-4 h-4 text-[#016098]" />
            {showSmtpConfig ? 'Ocultar Parámetros SMTP' : 'Configurar Servidor SMTP'}
          </button>
        </div>

        {feedback && (
          <div
            className={`mt-5 p-4 rounded-xl border flex items-start gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : feedback.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <p className="font-bold text-sm">{feedback.message}</p>
              {feedback.details && <p className="mt-1 opacity-90">{feedback.details}</p>}
            </div>
          </div>
        )}

        {/* Panel SMTP colapsable */}
        {showSmtpConfig && (
          <div className="mt-5 p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Parámetros de Conexión SMTP Institucional
              </h3>
              <span className="text-[11px] text-slate-500">
                Compatible con Microsoft 365 / Google Workspace / Relay Interno CMDS
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Servidor SMTP</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.office365.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Puerto</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Cuenta Remitente
                </label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="usuario@cmds.cl"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Contraseña / App Password
                </label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition"
              >
                <Save className="w-3.5 h-3.5" />
                {savingConfig ? 'Guardando...' : 'Guardar Configuración Predeterminada'}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSendEmail} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Formulario de envío */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Período Procesado a Despachar
                </label>
                <select
                  value={selectedKey}
                  onChange={(e) => handleSelectPeriod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#016098] outline-none"
                >
                  {periodos.map((p) => (
                    <option key={`${p.anio}-${p.mes}`} value={`${p.anio}-${p.mes}`}>
                      {MESES_NOMBRES[p.mes]} {p.anio} — Total:{' '}
                      {formatCurrencyCLP(Number(p.monto_educacion || 0) + Number(p.monto_salud || 0))}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destinatarios Contabilidad (Para)
                </label>
                <input
                  type="text"
                  required
                  value={destinatarios}
                  onChange={(e) => setDestinatarios(e.target.value)}
                  placeholder="contabilidad@cmds.cl, jefecontabilidad@cmds.cl"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#016098] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Con Copia (CC)
                </label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="daf@cmds.cl"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#016098] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Asunto del Correo
                </label>
                <input
                  type="text"
                  required
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#016098] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mensaje / Glosa para Contabilidad
              </label>
              <textarea
                rows={4}
                value={mensajeAdicional}
                onChange={(e) => setMensajeAdicional(e.target.value)}
                className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#016098] outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={incluirEducacion}
                  onChange={(e) => setIncluirEducacion(e.target.checked)}
                  className="w-4 h-4 rounded text-[#016098]"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Adjuntar <code>distribución_educacion.xls</code>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={incluirSalud}
                  onChange={(e) => setIncluirSalud(e.target.checked)}
                  className="w-4 h-4 rounded text-[#016098]"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Adjuntar <code>distribucion_salud.xls</code>
                </span>
              </label>
            </div>

            <div className="pt-3 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={sending || !periodoActual}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#016098] hover:bg-[#014d7a] text-white text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Despachando Archivos...' : 'Enviar Distribución a Contabilidad'}
              </button>

              <button
                type="button"
                onClick={openMailtoClient}
                disabled={!periodoActual}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition"
              >
                <ExternalLink className="w-4 h-4 text-[#016098]" />
                Abrir Resumen en Outlook / Cliente Local
              </button>
            </div>
          </div>

          {/* Columna Derecha: Resumen de archivos adjuntos */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/90 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Paperclip className="w-4 h-4 text-[#016098]" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  Archivos Adjuntos Automáticos
                </h3>
              </div>

              {periodoActual ? (
                <div className="space-y-3">
                  {incluirEducacion && (
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 text-[#016098]">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          distribución_educacion.xls
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Sector Educación (&lt; 600) •{' '}
                          {Number(periodoActual.filas_educacion || 0).toLocaleString('es-CL')} reg.
                        </p>
                        <p className="text-xs font-extrabold text-[#016098] font-mono mt-1">
                          {formatCurrencyCLP(totalEdu)}
                        </p>
                      </div>
                    </div>
                  )}

                  {incluirSalud && (
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-cyan-50 text-[#39BABD]">
                        <HeartPulse className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          distribucion_salud.xls
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Sector Salud (&gt;= 600) •{' '}
                          {Number(periodoActual.filas_salud || 0).toLocaleString('es-CL')} reg.
                        </p>
                        <p className="text-xs font-extrabold text-[#39BABD] font-mono mt-1">
                          {formatCurrencyCLP(totalSal)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Seleccione un período válido.</p>
              )}
            </div>

            {periodoActual && (
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">TOTAL GENERAL PERÍODO:</span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    {formatCurrencyCLP(totalEdu + totalSal)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
