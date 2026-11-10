import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FileArchive,
  Download,
  Trash2,
  FolderSync,
  Calendar,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Search
} from 'lucide-react';

const MESES_NOMBRES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
};

const formatCLP = (val: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val || 0);

const ResumenRentasHistorial: React.FC = () => {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [anioFiltro, setAnioFiltro] = useState<number>(2026);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPeriodos = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/resumen-rentas/periodos');
      const list = Array.isArray(res.data) ? res.data : res.data?.periodos || [];
      setPeriodos(list);
    } catch (err) {
      console.error('Error cargando historial de Resumen de Rentas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriodos();
  }, []);

  const handleSyncLocalFolder = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await axios.post('/api/resumen-rentas/importar-carpeta-local', { anio: anioFiltro });
      setMsg({
        type: 'success',
        text:
          res.data?.message ||
          `Sincronización completada: ${res.data?.importados?.length || 0} meses procesados e importados a PostgreSQL.`
      });
      await fetchPeriodos();
    } catch (err: any) {
      setMsg({
        type: 'error',
        text: err.response?.data?.error || 'Error al sincronizar la carpeta local'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (anio: number, mes: number) => {
    const label = `${MESES_NOMBRES[mes]} ${anio}`;
    if (!window.confirm(`¿Está seguro de eliminar el periodo ${label} del historial de Resumen de Rentas?`)) {
      return;
    }
    try {
      await axios.delete(`/api/resumen-rentas/periodos/${anio}/${mes}`);
      setMsg({ type: 'success', text: `Periodo ${label} eliminado correctamente.` });
      await fetchPeriodos();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Error eliminando periodo' });
    }
  };

  const filtered = periodos.filter((p) => {
    if (anioFiltro && Number(p.anio) !== Number(anioFiltro)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const mesNombre = (MESES_NOMBRES[p.mes] || '').toLowerCase();
    return (
      mesNombre.includes(q) ||
      String(p.zip_filename || '').toLowerCase().includes(q) ||
      String(p.archivo_personal || '').toLowerCase().includes(q) ||
      String(p.archivo_renta || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#016098]/10 text-[#016098] mb-2">
            <FileArchive className="w-3.5 h-3.5" /> Repositorio Centralizado PostgreSQL
          </span>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Historial de Periodos y Descargas .ZIP
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Descargue los paquetes mensuales (<code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">MM_YYYY.zip</code>) o packs trimestrales almacenados en la base de datos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={anioFiltro}
            onChange={(e) => setAnioFiltro(Number(e.target.value))}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50"
          >
            <option value={2026}>Año 2026</option>
            <option value={2025}>Año 2025</option>
          </select>

          <button
            onClick={handleSyncLocalFolder}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition shadow-sm disabled:opacity-50"
            title="Sincronizar desde carpeta C:\Users\rhormazabal\Desktop\CMDS\DAF\RESUMEN DE RENTAS\2026"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin text-[#016098]" /> : <FolderSync className="w-4 h-4 text-[#016098]" />}
            {syncing ? 'Sincronizando...' : 'Sincronizar Carpeta 2026'}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-semibold">{msg.text}</span>
        </div>
      )}

      {/* Barra de Descarga Rápida por Trimestre */}
      <div className="bg-gradient-to-r from-[#016098] to-[#014770] rounded-2xl p-5 text-white shadow-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#39BABD]" />
            Descarga Directa de Packs Trimestrales ({anioFiltro})
          </h2>
          <p className="text-xs text-sky-100 mt-0.5">
            Cada pack trimestral agrupa automáticamente los 3 archivos <code className="font-mono">MM_{anioFiltro}.zip</code> correspondientes al trimestre.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[1, 2, 3, 4].map((q) => (
            <a
              key={q}
              href={`/api/resumen-rentas/descargar-trimestre/${anioFiltro}/${q}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#39BABD]" />
              Trimestre Q{q} ({q === 1 ? 'Ene-Mar' : q === 2 ? 'Abr-Jun' : q === 3 ? 'Jul-Sep' : 'Oct-Dic'})
            </a>
          ))}
        </div>
      </div>

      {/* Tabla de Periodos Mensuales */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por mes o nombre de archivo..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#016098]/20"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">
            {filtered.length} periodos registrados
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-[#016098] mx-auto mb-2" />
            <p className="text-xs text-slate-500">Cargando periodos desde PostgreSQL...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-3.5 px-4">Periodo</th>
                  <th className="py-3.5 px-4">Paquete .ZIP</th>
                  <th className="py-3.5 px-4 text-right">Personal (8 Col)</th>
                  <th className="py-3.5 px-4 text-right">Renta (6 Col)</th>
                  <th className="py-3.5 px-4 text-right">Docentes</th>
                  <th className="py-3.5 px-4 text-right">NoDocentes</th>
                  <th className="py-3.5 px-4 text-right">Salud (Total)</th>
                  <th className="py-3.5 px-4 text-right">Monto Total Mes</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((p) => {
                  const saludRows =
                    Number(p.filas_salud_600_607 || 0) +
                    Number(p.filas_salud_608_609 || 0) +
                    Number(p.filas_salud_610 || 0) +
                    Number(p.filas_salud_620 || 0);
                  return (
                    <tr key={`${p.anio}-${p.mes}`} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {MESES_NOMBRES[p.mes]} {p.anio}
                        <div className="text-[10px] font-normal text-slate-400 truncate max-w-[180px]">
                          {p.archivo_personal}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 text-[#016098] font-mono font-bold text-[11px] border border-sky-200/60">
                          <FileArchive className="w-3.5 h-3.5" />
                          {p.zipFileName || p.zip_filename || `${String(p.mes).padStart(2, '0')}_${p.anio}.zip`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                        {Number(p.personal_filas || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                        {Number(p.renta_filas_validas || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600">
                        {Number(p.filas_docentes || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600">
                        {Number(p.filas_nodocentes || 0).toLocaleString('es-CL')}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600">
                        {saludRows.toLocaleString('es-CL')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#016098]">
                        {formatCLP(Number(p.total_general || 0))}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={`/api/resumen-rentas/descargar-zip/${p.anio}/${p.mes}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#016098] hover:bg-[#014976] text-white font-bold text-[11px] transition shadow-sm"
                            title="Descargar archivo .ZIP con las 6 consultas Excel"
                          >
                            <Download className="w-3.5 h-3.5" /> .ZIP
                          </a>
                          <button
                            onClick={() => handleDelete(p.anio, p.mes)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Eliminar periodo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      No se encontraron periodos registrados para el criterio seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumenRentasHistorial;
