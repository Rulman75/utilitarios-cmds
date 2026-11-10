import React, { useEffect, useState } from 'react';
import {
  History,
  FolderSync,
  FileDown,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  HeartPulse,
  FileSpreadsheet
} from 'lucide-react';
import { formatCurrencyCLP, exportToExcel, exportToCorporatePDF } from '../utils/exportUtils';

const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const HistorialPeriodos: React.FC = () => {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [anioImportar, setAnioImportar] = useState(2026);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPeriodos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/periodos');
      const json = await res.json();
      setPeriodos(json.periodos || []);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriodos();
  }, []);

  const handleImportarCarpeta = async () => {
    setImporting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/periodos/importar-carpeta-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio: Number(anioImportar) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar carpeta');
      setMessage({
        type: 'success',
        text: data.message || `Sincronización completada: ${data.importados?.length || 0} período(s) importado(s).`
      });
      await loadPeriodos();
    } catch (e: any) {
      setMessage({
        type: 'error',
        text: e.message || 'No se pudo importar desde la carpeta histórica.'
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (anio: number, mes: number) => {
    if (!window.confirm(`¿Está seguro de eliminar el período ${MESES_NOMBRES[mes]} ${anio}?`)) {
      return;
    }
    try {
      await fetch(`/api/periodos/${anio}/${mes}`, { method: 'DELETE' });
      await loadPeriodos();
    } catch (e) {
      console.error('Error eliminando período:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tarjeta superior de Sincronización con Carpeta Histórica */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-[#016098] text-white shadow-md">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">
                Historial Mensual de Distribuciones Procesadas
              </h2>
              <p className="text-xs text-slate-500">
                Repositorio centralizado en PostgreSQL CMDS con descarga inmediata de archivos contables
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                exportToExcel(
                  periodos.map((p) => ({
                    AÑO: p.anio,
                    MES: MESES_NOMBRES[p.mes],
                    ARCHIVO_ORIGEN: p.archivo_nombre,
                    FILAS_ORIGINALES: p.total_filas_brutas,
                    FILAS_VALIDAS: p.filas_validas,
                    REGISTROS_EDUCACION: p.filas_educacion,
                    MONTO_EDUCACION: p.monto_educacion,
                    REGISTROS_SALUD: p.filas_salud,
                    MONTO_SALUD: p.monto_salud,
                    TOTAL_GENERAL: Number(p.monto_educacion || 0) + Number(p.monto_salud || 0)
                  })),
                  'Historial_Distribuciones_Renta_CMDS',
                  'Historial'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Resumen Excel
            </button>

            <button
              onClick={() =>
                exportToCorporatePDF(
                  'Historial Mensual de Distribuciones de Renta',
                  'Resumen consolidado de cierres mensuales Educación y Salud — DAF CMDS',
                  ['Período', 'Archivo Origen', 'Filas Válidas', 'Total Educación', 'Total Salud', 'Total General'],
                  periodos.map((p) => [
                    `${MESES_NOMBRES[p.mes]} ${p.anio}`,
                    p.archivo_nombre || '-',
                    Number(p.filas_validas || 0).toLocaleString('es-CL'),
                    formatCurrencyCLP(p.monto_educacion || 0),
                    formatCurrencyCLP(p.monto_salud || 0),
                    formatCurrencyCLP(Number(p.monto_educacion || 0) + Number(p.monto_salud || 0))
                  ]),
                  'Historial_Distribuciones_CMDS'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EB567F] hover:bg-[#d6456d] text-white text-xs font-bold shadow-xs transition"
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF Oficial
            </button>
          </div>
        </div>

        {/* Sincronizador directo con carpeta local DAF */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Año a Sincronizar desde Carpeta Local DAF (C:\Users\rhormazabal\Desktop\CMDS\DAF\DISTRIBUCIONES\Distribuciones)
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={anioImportar}
                  onChange={(e) => setAnioImportar(Number(e.target.value))}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value={2026}>AÑO 2026</option>
                  <option value={2025}>AÑO 2025</option>
                  <option value={2024}>AÑO 2024</option>
                </select>
                <button
                  onClick={handleImportarCarpeta}
                  disabled={importing}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#016098] hover:bg-[#014d7a] text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  <FolderSync className={`w-4 h-4 ${importing ? 'animate-spin' : ''}`} />
                  {importing ? 'Escaneando e Importando...' : 'Importar Meses desde Carpeta'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Tabla de períodos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Cargando períodos...</div>
        ) : periodos.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No se encontraron períodos registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-white uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-5 text-left font-bold">Período</th>
                  <th className="py-3.5 px-4 text-left font-bold">Archivo Fuente</th>
                  <th className="py-3.5 px-4 text-right font-bold">Filas Válidas</th>
                  <th className="py-3.5 px-4 text-right font-bold">Educación (&lt; 600)</th>
                  <th className="py-3.5 px-4 text-right font-bold">Salud (&gt;= 600)</th>
                  <th className="py-3.5 px-4 text-right font-bold">Total General</th>
                  <th className="py-3.5 px-5 text-center font-bold">Descarga Contabilidad (.XLS / .XLSX)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodos.map((p) => {
                  const totalEdu = Number(p.monto_educacion || 0);
                  const totalSal = Number(p.monto_salud || 0);
                  const totalGen = totalEdu + totalSal;
                  return (
                    <tr key={`${p.anio}-${p.mes}`} className="hover:bg-blue-50/30 transition">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-blue-50 text-[#016098]">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 block text-sm">
                              {MESES_NOMBRES[p.mes]} {p.anio}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Procesado por {p.usuario || 'Sistema'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 block truncate max-w-56">
                          {p.archivo_nombre}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Orig: {Number(p.total_filas_brutas || 0).toLocaleString('es-CL')} filas • Excl:{' '}
                          {(
                            Number(p.filas_descartadas_cero || 0) +
                            Number(p.filas_descartadas_excluidas || 0)
                          ).toLocaleString('es-CL')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                        {Number(p.filas_validas || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-extrabold text-[#016098] block">
                          {formatCurrencyCLP(totalEdu)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {Number(p.filas_educacion || 0).toLocaleString('es-CL')} reg. ({p.haberes_educacion || 0} haberes)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-extrabold text-[#39BABD] block">
                          {formatCurrencyCLP(totalSal)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {Number(p.filas_salud || 0).toLocaleString('es-CL')} reg. ({p.haberes_salud || 0} haberes)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-slate-900 text-sm">
                        {formatCurrencyCLP(totalGen)}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-center gap-1.5">
                          <a
                            href={`/api/distribucion/descargar/educacion-xls?anio=${p.anio}&mes=${p.mes}`}
                            title="Descargar distribución_educacion.xls"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#016098] hover:bg-[#014c78] text-white text-[11px] font-bold transition"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            Edu .xls
                          </a>
                          <a
                            href={`/api/distribucion/descargar/salud-xls?anio=${p.anio}&mes=${p.mes}`}
                            title="Descargar distribucion_salud.xls"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#39BABD] hover:bg-[#2da3a6] text-white text-[11px] font-bold transition"
                          >
                            <HeartPulse className="w-3.5 h-3.5" />
                            Salud .xls
                          </a>
                          <a
                            href={`/api/distribucion/descargar/base-depurada-xlsx?anio=${p.anio}&mes=${p.mes}`}
                            title="Descargar Excel 3 hojas depurado"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-bold transition"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            3 Hojas
                          </a>
                          <button
                            onClick={() => handleDelete(p.anio, p.mes)}
                            title="Eliminar período"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
