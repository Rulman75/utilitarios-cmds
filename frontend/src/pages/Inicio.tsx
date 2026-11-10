import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  exportToExcel,
  exportToCorporatePDF,
  formatCurrencyCLP
} from '../utils/exportUtils';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';

export default function Inicio() {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState('2026');
  const [importingFolder, setImportingFolder] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const fetchStats = async (selectedYear = year) => {
    setLoading(true);
    try {
      const url = selectedYear
        ? `/api/dashboard/stats?year=${selectedYear}`
        : '/api/dashboard/stats';
      const res = await axios.get(url);
      if (res.data.status === 'ok') {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Error al obtener estadísticas del dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(year);
  }, [year]);

  const sincronizarCarpetaHistorica = async () => {
    const targetYear = year || '2026';
    if (!window.confirm(`¿Desea importar y procesar automáticamente todos los archivos mensuales de Renta encontrados en la carpeta AÑO ${targetYear}?`)) {
      return;
    }
    setImportingFolder(true);
    setAlertMsg(null);
    try {
      const res = await axios.post('/api/periodos/importar-carpeta-local', { anio: Number(targetYear) });
      if (res.data.status === 'ok') {
        setAlertMsg(res.data.message);
        await fetchStats(year);
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error importando carpeta histórica');
    } finally {
      setImportingFolder(false);
    }
  };

  const ultimo = stats?.ultimoPeriodo;
  const montoEdu = ultimo ? Number(ultimo.monto_educacion || 0) : Number(stats?.totalMontoEducacion || 0);
  const montoSal = ultimo ? Number(ultimo.monto_salud || 0) : Number(stats?.totalMontoSalud || 0);
  const montoTot = montoEdu + montoSal;

  const pctEducacion = montoTot > 0 ? ((montoEdu / montoTot) * 100).toFixed(1) : '0';
  const pctSalud = montoTot > 0 ? ((montoSal / montoTot) * 100).toFixed(1) : '0';

  const pieSector = [
    { name: 'Sector Educación (< 600)', value: montoEdu, color: '#016098' },
    { name: 'Sector Salud (>= 600)', value: montoSal, color: '#39BABD' }
  ];

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {/* Encabezado Principal + Accesos Rápidos */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-xl shadow-sm border border-[#e2e8f0] gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#016098] mb-1">
            Dashboard General de Distribución de Remuneraciones
          </h1>
          <p className="text-sm text-[#64748b]">
            Resumen financiero, control de Centros de Costo (`Cencos`) y distribución contable Educación y Salud — DAF CMDS
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          <Link
            to="/procesar"
            className="px-3.5 py-2 bg-[#016098] hover:bg-[#024a8d] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            + Procesar Archivo Renta
          </Link>
          <Link
            to="/informes"
            className="px-3.5 py-2 bg-[#39BABD] hover:bg-[#2da3a6] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            Ver Informes Contabilidad
          </Link>
          <button
            onClick={sincronizarCarpetaHistorica}
            disabled={importingFolder}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            title="Importa todos los meses desde C:\Users\rhormazabal\Desktop\CMDS\DAF\DISTRIBUCIONES\Distribuciones"
          >
            {importingFolder ? 'Importando Meses...' : `📂 Sincronizar Carpeta ${year || '2026'}`}
          </button>

          <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-1.5">
            <span className="text-xs font-bold text-[#475569] uppercase">Periodo:</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#016098] focus:outline-none cursor-pointer"
            >
              <option value="">Histórico (Todos)</option>
              <option value="2026">Año 2026</option>
              <option value="2025">Año 2025</option>
              <option value="2024">Año 2024</option>
            </select>
          </div>
        </div>
      </div>

      {alertMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-semibold flex justify-between items-center">
          <span>✔ {alertMsg}</span>
          <button onClick={() => setAlertMsg(null)} className="text-emerald-900 font-bold cursor-pointer">✕</button>
        </div>
      )}

      <div className={`transition-opacity duration-300 space-y-6 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {stats && (
          <>
            {/* BLOQUE 1: 6 KPIs Operativos y Financieros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Último Período Procesado */}
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#016098] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
                    Último Mes Procesado
                  </span>
                  <span className="p-2 rounded-lg bg-[#e0f2fe] text-[#016098]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
                <p className="text-xl font-black text-[#1e293b] mt-2">
                  {ultimo ? `${ultimo.mesNombre} ${ultimo.anio}` : 'Sin registros'}
                </p>
                <p className="text-[11px] text-[#016098] font-semibold mt-1">
                  {stats.totalPeriodos} período(s) en historial
                </p>
              </div>

              {/* Total Distribuido último mes */}
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-indigo-600 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
                    Total Remuneraciones
                  </span>
                  <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </div>
                <p className="text-lg font-black text-[#1e293b] mt-2">
                  {formatCurrencyCLP(montoTot)}
                </p>
                <p className="text-[11px] text-indigo-700 font-semibold mt-1">
                  Educación + Salud ({ultimo ? ultimo.mesNombre : 'Periodo'})
                </p>
              </div>

              {/* Sector Educación */}
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#016098] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
                    Sector Educación
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-[#016098]">
                    Unid &lt; 600
                  </span>
                </div>
                <p className="text-lg font-black text-[#016098] mt-2">
                  {formatCurrencyCLP(montoEdu)}
                </p>
                <p className="text-[11px] text-[#64748b] mt-1">
                  {ultimo ? `${Number(ultimo.filas_educacion).toLocaleString('es-CL')} reg. (${ultimo.haberes_educacion} haberes)` : '-'}
                </p>
              </div>

              {/* Sector Salud */}
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#39BABD] flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
                    Sector Salud
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-50 text-[#39BABD]">
                    Unid &gt;= 600
                  </span>
                </div>
                <p className="text-lg font-black text-[#047857] mt-2">
                  {formatCurrencyCLP(montoSal)}
                </p>
                <p className="text-[11px] text-[#64748b] mt-1">
                  {ultimo ? `${Number(ultimo.filas_salud).toLocaleString('es-CL')} reg. (${ultimo.haberes_salud} haberes)` : '-'}
                </p>
              </div>

              {/* Depuración de Registros */}
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
                    Registros Válidos
                  </span>
                  <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </span>
                </div>
                <p className="text-xl font-black text-[#1e293b] mt-2">
                  {ultimo ? Number(ultimo.filas_validas).toLocaleString('es-CL') : '0'}
                </p>
                <p className="text-[11px] text-amber-700 font-semibold mt-1">
                  De {ultimo ? Number(ultimo.total_filas_brutas).toLocaleString('es-CL') : '0'} filas brutas
                </p>
              </div>

              {/* Catálogo Cencos */}
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-emerald-500 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
                    Catálogo Cencos
                  </span>
                  <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </span>
                </div>
                <p className="text-xl font-black text-[#1e293b] mt-2">
                  {stats.totalCencos} Unidades
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                  {stats.cencosEducacion} Educ. · {stats.cencosSalud} Salud
                </p>
              </div>
            </div>

            {/* BLOQUE 2: Descarga Directa Rápida del Último Período */}
            {ultimo && (
              <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase mb-1">
                    Informes Oficiales Listos para Contabilidad
                  </span>
                  <h3 className="text-base font-bold text-[#016098]">
                    Período Activo: {ultimo.mesNombre} {ultimo.anio} ({ultimo.archivo_nombre})
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    Descargue directamente los archivos en formato clásico `.xls` (idéntico a Crystal Reports) o `.xlsx` para Contabilidad.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/distribucion/descargar/educacion-xls?anio=${ultimo.anio}&mes=${ultimo.mes}`}
                    className="px-3.5 py-2 bg-[#016098] hover:bg-[#014b78] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    📥 distribución_educacion.xls
                  </a>
                  <a
                    href={`/api/distribucion/descargar/salud-xls?anio=${ultimo.anio}&mes=${ultimo.mes}`}
                    className="px-3.5 py-2 bg-[#39BABD] hover:bg-[#2da1a4] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    📥 distribucion_salud.xls
                  </a>
                  <Link
                    to="/correo"
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    ✉️ Enviar a Contabilidad
                  </Link>
                </div>
              </div>
            )}

            {/* BLOQUE 3: Gráficos de Evolución y Proporción Sectorial */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-[#e2e8f0]">
                <h3 className="text-sm font-bold text-[#016098] uppercase mb-1">
                  Evolución Mensual de Remuneraciones Distribuidas ({year || 'Histórico'})
                </h3>
                <p className="text-xs text-[#64748b] mb-4">
                  Comparativa mensual de montos distribuidos entre Sector Educación y Sector Salud
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.evolucion} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#475569' }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#475569' }}
                        tickFormatter={(v) => `$${(Number(v) / 1e9).toFixed(1)}MM`}
                      />
                      <RechartsTooltip
                        formatter={(value: any, name: any) => [formatCurrencyCLP(value), name]}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="Educacion" name="Sector Educación (< 600)" stackId="a" fill="#016098" />
                      <Bar dataKey="Salud" name="Sector Salud (>= 600)" stackId="a" fill="#39BABD" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-[#e2e8f0] flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#016098] uppercase mb-1">
                    Proporción por Sector
                  </h3>
                  <p className="text-xs text-[#64748b] mb-2">
                    Distribución Educación vs. Salud ({ultimo ? `${ultimo.mesNombre} ${ultimo.anio}` : 'Total'})
                  </p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieSector}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieSector.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: any) => formatCurrencyCLP(value)} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#e2e8f0]">
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-[#016098]">Educación: {pctEducacion}%</span>
                    <span className="text-[#047857]">Salud: {pctSalud}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="bg-[#016098] h-full" style={{ width: `${pctEducacion}%` }} />
                    <div className="bg-[#39BABD] h-full" style={{ width: `${pctSalud}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* BLOQUE 4: Rankings de Principales Haberes (Educación y Salud) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 10 Haberes Educación */}
              <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] overflow-hidden">
                <div className="p-5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#016098] uppercase">
                      Top 10 Haberes — Sector Educación
                    </h3>
                    <p className="text-xs text-[#64748b]">
                      Principales conceptos de remuneración en Educación ({ultimo ? `${ultimo.mesNombre} ${ultimo.anio}` : ''})
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        const rows = (stats.topHaberesEducacion || []).map((h: any) => ({
                          'Cód. Haber': h.codHaber,
                          'Glosa Haber': h.glosaHaber,
                          'Unidades': h.cantidadUnidades,
                          'Registros': h.cantidadRegistros,
                          'Monto Total ($)': h.totalHaber
                        }));
                        exportToExcel(rows, `Top_Haberes_Educacion_${ultimo?.mesNombre || ''}_${ultimo?.anio || ''}.xlsx`, 'Top_Educacion');
                      }}
                      className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded hover:bg-emerald-700 cursor-pointer"
                    >
                      📊 Excel
                    </button>
                    <button
                      onClick={() =>
                        exportToCorporatePDF({
                          title: `Principales Haberes Sector Educación — ${ultimo?.mesNombre || ''} ${ultimo?.anio || ''}`,
                          columns: [
                            { header: 'Cód. Haber', key: 'codHaber', align: 'center' },
                            { header: 'Glosa Haber', key: 'glosaHaber' },
                            { header: 'Unidades', key: 'cantidadUnidades', align: 'center' },
                            { header: 'Registros', key: 'cantidadRegistros', align: 'right', format: v => Number(v || 0).toLocaleString('es-CL') },
                            { header: 'Monto Total ($)', key: 'totalHaber', align: 'right', format: v => formatCurrencyCLP(v) }
                          ],
                          rows: stats.topHaberesEducacion || []
                        })
                      }
                      className="px-2.5 py-1 bg-[#016098] text-white text-[11px] font-bold rounded hover:bg-[#014b78] cursor-pointer"
                    >
                      📄 PDF
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#f8fafc] text-[#475569] uppercase border-b border-[#e2e8f0]">
                      <tr>
                        <th className="py-2.5 px-4">Cód.</th>
                        <th className="py-2.5 px-3">Glosa Haber</th>
                        <th className="py-2.5 px-3 text-center">Unidades</th>
                        <th className="py-2.5 px-4 text-right">Monto Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      {(stats.topHaberesEducacion || []).map((h: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#f8fafc]">
                          <td className="py-2.5 px-4 font-bold text-[#016098]">#{h.codHaber}</td>
                          <td className="py-2.5 px-3 font-semibold text-[#1e293b]">{h.glosaHaber}</td>
                          <td className="py-2.5 px-3 text-center text-[#64748b]">{h.cantidadUnidades}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-[#016098]">
                            {formatCurrencyCLP(h.totalHaber)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top 10 Haberes Salud */}
              <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] overflow-hidden">
                <div className="p-5 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#016098] uppercase">
                      Top 10 Haberes — Sector Salud
                    </h3>
                    <p className="text-xs text-[#64748b]">
                      Principales conceptos de remuneración en Salud ({ultimo ? `${ultimo.mesNombre} ${ultimo.anio}` : ''})
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        const rows = (stats.topHaberesSalud || []).map((h: any) => ({
                          'Cód. Haber': h.codHaber,
                          'Glosa Haber': h.glosaHaber,
                          'Unidades': h.cantidadUnidades,
                          'Registros': h.cantidadRegistros,
                          'Monto Total ($)': h.totalHaber
                        }));
                        exportToExcel(rows, `Top_Haberes_Salud_${ultimo?.mesNombre || ''}_${ultimo?.anio || ''}.xlsx`, 'Top_Salud');
                      }}
                      className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded hover:bg-emerald-700 cursor-pointer"
                    >
                      📊 Excel
                    </button>
                    <button
                      onClick={() =>
                        exportToCorporatePDF({
                          title: `Principales Haberes Sector Salud — ${ultimo?.mesNombre || ''} ${ultimo?.anio || ''}`,
                          columns: [
                            { header: 'Cód. Haber', key: 'codHaber', align: 'center' },
                            { header: 'Glosa Haber', key: 'glosaHaber' },
                            { header: 'Unidades', key: 'cantidadUnidades', align: 'center' },
                            { header: 'Registros', key: 'cantidadRegistros', align: 'right', format: v => Number(v || 0).toLocaleString('es-CL') },
                            { header: 'Monto Total ($)', key: 'totalHaber', align: 'right', format: v => formatCurrencyCLP(v) }
                          ],
                          rows: stats.topHaberesSalud || []
                        })
                      }
                      className="px-2.5 py-1 bg-[#016098] text-white text-[11px] font-bold rounded hover:bg-[#014b78] cursor-pointer"
                    >
                      📄 PDF
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#f8fafc] text-[#475569] uppercase border-b border-[#e2e8f0]">
                      <tr>
                        <th className="py-2.5 px-4">Cód.</th>
                        <th className="py-2.5 px-3">Glosa Haber</th>
                        <th className="py-2.5 px-3 text-center">Unidades</th>
                        <th className="py-2.5 px-4 text-right">Monto Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      {(stats.topHaberesSalud || []).map((h: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#f8fafc]">
                          <td className="py-2.5 px-4 font-bold text-[#047857]">#{h.codHaber}</td>
                          <td className="py-2.5 px-3 font-semibold text-[#1e293b]">{h.glosaHaber}</td>
                          <td className="py-2.5 px-3 text-center text-[#64748b]">{h.cantidadUnidades}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                            {formatCurrencyCLP(h.totalHaber)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
