import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileArchive,
  UploadCloud,
  Building2,
  HeartPulse,
  Calendar,
  Download,
  FileSpreadsheet,
  FileDown,
  Layers
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatCurrencyCLP, exportToExcel, exportToCorporatePDF } from '../utils/exportUtils';

const COLORS = ['#016098', '#0284c7', '#39BABD', '#0d9488', '#EB567F', '#f59e0b'];

export const ResumenRentasInicio: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('2026');

  const fetchStats = async (selectedYear = year) => {
    setLoading(true);
    try {
      const q = selectedYear ? `?year=${selectedYear}` : '';
      const res = await fetch(`/api/resumen-rentas/stats${q}`);
      const json = await res.json();
      if (json.status === 'ok') {
        setStats(json.data);
      }
    } catch (e) {
      console.error('Error cargando stats de Resumen de Rentas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(year);
  }, [year]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#016098] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">
            Cargando Dashboard de Resumen de Rentas...
          </p>
        </div>
      </div>
    );
  }

  const pieData = stats?.desgloseGlobal
    ? [
        { name: 'Docentes (<600, Pl. 1-2)', value: stats.desgloseGlobal.Docentes || 0 },
        { name: 'No Docentes (<600, Pl. >2)', value: stats.desgloseGlobal.NoDocentes || 0 },
        { name: 'Salud 600 al 607', value: stats.desgloseGlobal.Salud_600al607 || 0 },
        { name: 'Salud 608 al 609', value: stats.desgloseGlobal.Salud_608al609 || 0 },
        { name: 'Salud 610 (610-619)', value: stats.desgloseGlobal.Salud_610 || 0 },
        { name: 'Salud 620', value: stats.desgloseGlobal.Salud_620 || 0 }
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Cabecera Ejecutiva */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-[#016098] text-white shadow-md">
              <FileArchive className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#39BABD]/15 text-[#016098]">
                  Utilitario TI CMDS
                </span>
                <span className="text-xs text-slate-400">• Reemplazo Automatizado de Año {year}.mdb</span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-800 mt-0.5">
                Resumen Trimestral y Mensual de Rentas (Personal + Renta)
              </h1>
              <p className="text-xs text-slate-500">
                Generación automática de las 6 consultas oficiales (<code>Docentes</code>,{' '}
                <code>NoDocentes</code>, <code>Salud 600al607</code>, <code>Salud 608al609</code>,{' '}
                <code>Salud 610</code>, <code>Salud 620</code>) y paquetes <code>.zip</code>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#016098]"
            >
              <option value="2026">Año 2026</option>
              <option value="2025">Año 2025</option>
              <option value="">Todos los Años</option>
            </select>

            <Link
              to="/resumen-rentas/procesar"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#016098] hover:bg-[#014b78] text-white text-xs font-bold shadow-sm transition"
            >
              <UploadCloud className="w-4 h-4" />
              Procesar Nuevo Mes (Personal + Renta)
            </Link>
          </div>
        </div>
      </div>

      {/* Tarjetas de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Meses Procesados ({year || 'Total'})
            </span>
            <Calendar className="w-5 h-5 text-[#016098]" />
          </div>
          <p className="text-2xl font-extrabold text-slate-800 mt-2">
            {stats?.totalPeriodos || 0} <span className="text-xs font-semibold text-slate-400">meses</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats?.trimestres?.length || 0} trimestres disponibles en PostgreSQL
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Educación (Docentes + No Docentes)
            </span>
            <Building2 className="w-5 h-5 text-[#016098]" />
          </div>
          <p className="text-xl font-extrabold text-[#016098] font-mono mt-2">
            {formatCurrencyCLP(stats?.totalEducacion || 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Docentes: {formatCurrencyCLP(stats?.desgloseGlobal?.Docentes || 0)}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Salud (600 al 620)
            </span>
            <HeartPulse className="w-5 h-5 text-[#39BABD]" />
          </div>
          <p className="text-xl font-extrabold text-[#39BABD] font-mono mt-2">
            {formatCurrencyCLP(stats?.totalSalud || 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            600-607: {formatCurrencyCLP(stats?.desgloseGlobal?.Salud_600al607 || 0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#016098] to-[#024a8d] rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">
              Total Acumulado Período
            </span>
            <Layers className="w-5 h-5 text-[#39BABD]" />
          </div>
          <p className="text-xl font-extrabold font-mono mt-2">
            {formatCurrencyCLP(stats?.totalGeneral || 0)}
          </p>
          <p className="text-[11px] text-blue-200 mt-1">
            6 consultas oficiales listas en formato .ZIP
          </p>
        </div>
      </div>

      {/* Tarjetas de Descarga Rápida por Trimestre (Cada 3 Meses) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-800">
              Paquetes Trimestrales para Envío (Cada 3 Meses)
            </h2>
            <p className="text-xs text-slate-500">
              Descargue en un solo clic el archivo <code>.zip</code> trimestral con los 3 meses del período o cada mes individual
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(stats?.trimestres || []).map((t: any) => (
            <div
              key={`${t.anio}-${t.trimestre}`}
              className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-4 hover:border-[#016098]/40 transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-[#016098] text-white text-xs font-extrabold">
                    TRIMESTRE {t.trimestre} — {t.anio}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {t.mesesProcesados} / 3 meses listos
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-600 mt-2.5">
                  Meses incluidos: <span className="text-slate-900 font-bold">{t.mesesLista.join(', ')}</span>
                </p>
                <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Educación:</span>
                    <span className="font-mono font-bold text-[#016098]">
                      {formatCurrencyCLP(t.montoEducacion)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Salud:</span>
                    <span className="font-mono font-bold text-[#39BABD]">
                      {formatCurrencyCLP(t.montoSalud)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200/60">
                    <span className="font-bold text-slate-700">Total Trimestre:</span>
                    <span className="font-mono font-extrabold text-slate-900">
                      {formatCurrencyCLP(t.montoTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <a
                href={`/api/resumen-rentas/descargar-trimestre/${t.anio}/${t.trimestre}`}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#016098] hover:bg-[#014b78] text-white text-xs font-bold shadow-xs transition"
              >
                <Download className="w-4 h-4" />
                Descargar Pack Trimestre Q{t.trimestre} (.ZIP)
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Gráficos de Evolución Mensual y Distribución por Consulta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="text-sm font-extrabold text-slate-800 mb-4">
            Evolución Mensual por Consulta (Docentes, NoDocentes y Salud)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.evolucion || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${(Number(v) / 1e9).toFixed(1)}MM`}
                />
                <RechartsTooltip
                  formatter={(val: any) => formatCurrencyCLP(Number(val))}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Docentes" name="Docentes" stackId="a" fill="#016098" />
                <Bar dataKey="NoDocentes" name="No Docentes" stackId="a" fill="#0284c7" />
                <Bar dataKey="Salud600_607" name="Salud 600-607" stackId="a" fill="#39BABD" />
                <Bar dataKey="Salud610" name="Salud 610" stackId="a" fill="#0d9488" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h3 className="text-sm font-extrabold text-slate-800 mb-4">
            Participación por Consulta Oficial
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={86}
                  paddingAngle={2}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(val: any) => formatCurrencyCLP(Number(val))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabla Resumen de Meses y Descarga Directa de MM_YYYY.zip */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              Detalle Mensual de las 6 Consultas y Descarga Directa de Archivos .ZIP
            </h3>
            <p className="text-xs text-slate-500">
              Cada archivo <code>MM_YYYY.zip</code> contiene los 6 libros Excel oficiales listos para entrega
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                exportToExcel(
                  (stats?.periodos || []).map((p: any) => ({
                    AÑO: p.anio,
                    MES: p.mesNombre,
                    TRIMESTRE: `Q${p.trimestre}`,
                    FUNCIONARIOS_PERSONAL: p.personal_filas,
                    REGISTROS_RENTA: p.renta_filas_validas,
                    MONTO_DOCENTES: p.monto_docentes,
                    MONTO_NODOCENTES: p.monto_nodocentes,
                    MONTO_SALUD_600_607: p.monto_salud_600_607,
                    MONTO_SALUD_608_609: p.monto_salud_608_609,
                    MONTO_SALUD_610: p.monto_salud_610,
                    MONTO_SALUD_620: p.monto_salud_620,
                    TOTAL_MES: p.total_general
                  })),
                  `Resumen_Rentas_${year || 'Historico'}`,
                  'Resumen'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar Tabla Excel
            </button>

            <button
              onClick={() =>
                exportToCorporatePDF(
                  'Resumen Trimestral y Mensual de Rentas — CMDS',
                  'Consolidado de Consultas Docentes, NoDocentes y Salud (600 al 620)',
                  ['Mes', 'Trim.', 'Docentes', 'NoDocentes', 'Salud 600-607', 'Salud 608-620', 'Total Mes'],
                  (stats?.periodos || []).map((p: any) => [
                    `${p.mesNombre} ${p.anio}`,
                    `Q${p.trimestre}`,
                    formatCurrencyCLP(p.monto_docentes),
                    formatCurrencyCLP(p.monto_nodocentes),
                    formatCurrencyCLP(p.monto_salud_600_607),
                    formatCurrencyCLP(
                      Number(p.monto_salud_608_609 || 0) +
                        Number(p.monto_salud_610 || 0) +
                        Number(p.monto_salud_620 || 0)
                    ),
                    formatCurrencyCLP(p.total_general)
                  ]),
                  `Resumen_Rentas_CMDS_${year || 'Total'}`
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EB567F] hover:bg-[#d6456d] text-white text-xs font-bold transition"
            >
              <FileDown className="w-3.5 h-3.5" />
              Exportar PDF Oficial
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-white uppercase text-[11px]">
                <th className="py-3 px-4 text-left font-bold">Mes / Año</th>
                <th className="py-3 px-3 text-center font-bold">Trim.</th>
                <th className="py-3 px-3 text-right font-bold">Docentes</th>
                <th className="py-3 px-3 text-right font-bold">NoDocentes</th>
                <th className="py-3 px-3 text-right font-bold">Salud 600-607</th>
                <th className="py-3 px-3 text-right font-bold">Salud 608-609</th>
                <th className="py-3 px-3 text-right font-bold">Salud 610</th>
                <th className="py-3 px-4 text-right font-bold">Total Mes</th>
                <th className="py-3 px-4 text-center font-bold">Paquete .ZIP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(stats?.periodos || []).map((p: any) => (
                <tr key={`${p.anio}-${p.mes}`} className="hover:bg-blue-50/30 transition">
                  <td className="py-3 px-4 font-extrabold text-slate-800">
                    {p.mesNombre} {p.anio}
                    <span className="block text-[10px] font-normal text-slate-400">
                      Personal: {Number(p.personal_filas || 0).toLocaleString('es-CL')} • Renta:{' '}
                      {Number(p.renta_filas_validas || 0).toLocaleString('es-CL')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[#016098] font-bold">
                      Q{p.trimestre}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                    {formatCurrencyCLP(p.monto_docentes)}
                    <span className="block text-[10px] text-slate-400">
                      {Number(p.filas_docentes || 0).toLocaleString('es-CL')} reg.
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                    {formatCurrencyCLP(p.monto_nodocentes)}
                    <span className="block text-[10px] text-slate-400">
                      {Number(p.filas_nodocentes || 0).toLocaleString('es-CL')} reg.
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                    {formatCurrencyCLP(p.monto_salud_600_607)}
                    <span className="block text-[10px] text-slate-400">
                      {Number(p.filas_salud_600_607 || 0).toLocaleString('es-CL')} reg.
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-600">
                    {formatCurrencyCLP(p.monto_salud_608_609)}
                    <span className="block text-[10px] text-slate-400">
                      {Number(p.filas_salud_608_609 || 0).toLocaleString('es-CL')} reg.
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                    {formatCurrencyCLP(p.monto_salud_610)}
                    <span className="block text-[10px] text-slate-400">
                      {Number(p.filas_salud_610 || 0).toLocaleString('es-CL')} reg.
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-extrabold text-[#016098]">
                    {formatCurrencyCLP(p.total_general)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <a
                      href={`/api/resumen-rentas/descargar-zip/${p.anio}/${p.mes}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#016098] hover:bg-[#014b78] text-white text-xs font-bold shadow-2xs transition"
                    >
                      <FileArchive className="w-3.5 h-3.5" />
                      {p.zipFileName}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
