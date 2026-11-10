import React, { useEffect, useState, useMemo } from 'react';
import {
  Database,
  Plus,
  Save,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Building2,
  HeartPulse,
  Filter,
  FileSpreadsheet,
  FileDown,
  Edit3
} from 'lucide-react';
import { exportToExcel, exportToCorporatePDF } from '../utils/exportUtils';

export const MantenedorCencos: React.FC = () => {
  const [cencos, setCencos] = useState<any[]>([]);
  const [excluidos, setExcluidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterSector, setFilterSector] = useState<'TODOS' | 'EDUCACION' | 'SALUD' | 'SIN_CENCO'>('TODOS');

  // Formulario nuevo / editar Cenco
  const [unidadInput, setUnidadInput] = useState('');
  const [cencoInput, setCencoInput] = useState('');
  const [nombreInput, setNombreInput] = useState('');
  const [savingCenco, setSavingCenco] = useState(false);

  // Formulario nuevo Haber Excluido
  const [nuevoHaberExcluido, setNuevoHaberExcluido] = useState('');
  const [savingHaber, setSavingHaber] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, hRes] = await Promise.all([
        fetch('/api/cencos'),
        fetch('/api/haberes-excluidos')
      ]);
      const cJson = await cRes.json();
      const hJson = await hRes.json();
      setCencos(cJson.cencos || []);
      setExcluidos(hJson.haberes || []);
    } catch (e) {
      console.error('Error cargando mantenedores:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveCenco = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidadInput) return;
    setSavingCenco(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/cencos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unidad: Number(unidadInput),
          cenco: cencoInput.trim() || null,
          nombre: nombreInput.trim() || `Unidad ${unidadInput}`,
          sector: Number(unidadInput) < 600 ? 'EDUCACION' : 'SALUD'
        })
      });
      if (!res.ok) throw new Error('Error guardando Cenco');
      setUnidadInput('');
      setCencoInput('');
      setNombreInput('');
      setFeedback({
        type: 'success',
        text: `Unidad ${unidadInput} actualizada correctamente en la base de datos maestra.`
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingCenco(false);
    }
  };

  const handleEditClick = (item: any) => {
    setUnidadInput(String(item.unidad));
    setCencoInput(item.cenco || '');
    setNombreInput(item.nombre || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCenco = async (unidad: number) => {
    if (!window.confirm(`¿Eliminar la Unidad ${unidad} del catálogo maestro de Cencos?`)) return;
    try {
      await fetch(`/api/cencos/${unidad}`, { method: 'DELETE' });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddHaberExcluido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoHaberExcluido.trim()) return;
    setSavingHaber(true);
    try {
      await fetch('/api/haberes-excluidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glosa_haber: nuevoHaberExcluido.trim().toUpperCase(), activo: true })
      });
      setNuevoHaberExcluido('');
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingHaber(false);
    }
  };

  const handleDeleteHaberExcluido = async (idOrName: string | number) => {
    if (!window.confirm(`¿Quitar este haber de la lista de haberes excluidos?`)) return;
    try {
      await fetch(`/api/haberes-excluidos/${encodeURIComponent(String(idOrName))}`, { method: 'DELETE' });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredCencos = useMemo(() => {
    return cencos.filter((c) => {
      if (filterSector === 'EDUCACION' && Number(c.unidad) >= 600) return false;
      if (filterSector === 'SALUD' && Number(c.unidad) < 600) return false;
      if (filterSector === 'SIN_CENCO' && c.cenco) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        String(c.unidad).includes(q) ||
        String(c.cenco || '').toLowerCase().includes(q) ||
        String(c.nombre || '').toLowerCase().includes(q)
      );
    });
  }, [cencos, filterSector, search]);

  const sinCencoCount = useMemo(() => cencos.filter((c) => !c.cenco).length, [cencos]);

  if (loading && cencos.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        Cargando catálogo maestro de Cencos y reglas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (2/3): Tabla Maestra de Cencos */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#016098] text-white">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-800">
                  Catálogo Maestro de Centros de Costo (Cencos)
                </h2>
                <p className="text-xs text-slate-500">
                  {cencos.length} unidades migradas desde <code className="font-bold">Renta.mdb</code> y sincronizadas en PostgreSQL CMDS
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  exportToExcel(
                    filteredCencos.map((c) => ({
                      UNIDAD: c.unidad,
                      CENCO: c.cenco || 'SIN ASIGNAR',
                      ESTABLECIMIENTO: c.nombre,
                      SECTOR: Number(c.unidad) < 600 ? 'EDUCACION' : 'SALUD'
                    })),
                    'Maestro_Cencos_CMDS',
                    'Cencos'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={() =>
                  exportToCorporatePDF(
                    'Catálogo Maestro de Unidades y Centros de Costo (Cencos)',
                    'Tabla oficial para Distribución Contable Educación (< 600) y Salud (>= 600)',
                    ['Unidad', 'Centro de Costo (Cenco)', 'Establecimiento / Unidad', 'Sector'],
                    filteredCencos.map((c) => [
                      c.unidad,
                      c.cenco || 'SIN ASIGNAR',
                      c.nombre || '-',
                      Number(c.unidad) < 600 ? 'EDUCACION' : 'SALUD'
                    ]),
                    'Catalogo_Cencos_CMDS'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EB567F] hover:bg-[#d6456d] text-white text-xs font-bold transition"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          </div>

          {/* Formulario rápido para agregar o editar Unidad / Cenco */}
          <form
            onSubmit={handleSaveCenco}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Código Unidad
              </label>
              <input
                type="number"
                required
                value={unidadInput}
                onChange={(e) => setUnidadInput(e.target.value)}
                placeholder="Ej: 376"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Centro de Costo (Cenco)
              </label>
              <input
                type="text"
                value={cencoInput}
                onChange={(e) => setCencoInput(e.target.value)}
                placeholder="Ej: 410025"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-[#016098]"
              />
            </div>
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Nombre Establecimiento / Unidad
              </label>
              <input
                type="text"
                value={nombreInput}
                onChange={(e) => setNombreInput(e.target.value)}
                placeholder="Nombre oficial de la unidad..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={savingCenco}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#016098] hover:bg-[#014b78] text-white text-xs font-bold transition"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar
              </button>
            </div>
          </form>

          {/* Barra de filtro de Cencos */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setFilterSector('TODOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterSector === 'TODOS'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({cencos.length})
              </button>
              <button
                onClick={() => setFilterSector('EDUCACION')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterSector === 'EDUCACION'
                    ? 'bg-[#016098] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Educación &lt; 600
              </button>
              <button
                onClick={() => setFilterSector('SALUD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterSector === 'SALUD'
                    ? 'bg-[#39BABD] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Salud &gt;= 600
              </button>
              {sinCencoCount > 0 && (
                <button
                  onClick={() => setFilterSector('SIN_CENCO')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filterSector === 'SIN_CENCO'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Sin Cenco ({sinCencoCount})
                </button>
              )}
            </div>

            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar unidad, Cenco o nombre..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#016098]"
              />
            </div>
          </div>

          {/* Tabla de Cencos */}
          <div className="overflow-x-auto max-h-[540px] border border-slate-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 text-white sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 text-left font-bold w-24">Unidad</th>
                  <th className="py-2.5 px-4 text-left font-bold w-36">Cenco</th>
                  <th className="py-2.5 px-4 text-left font-bold">Establecimiento / Unidad</th>
                  <th className="py-2.5 px-4 text-center font-bold w-28">Sector</th>
                  <th className="py-2.5 px-4 text-center font-bold w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCencos.map((c) => {
                  const isEdu = Number(c.unidad) < 600;
                  return (
                    <tr key={c.unidad} className="hover:bg-blue-50/40">
                      <td className="py-2.5 px-4 font-mono font-extrabold text-slate-800">
                        {c.unidad}
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        {c.cenco ? (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-[#016098] font-bold border border-blue-200">
                            {c.cenco}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                            <AlertTriangle className="w-3 h-3" /> Sin Cenco
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-700">{c.nombre}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isEdu
                              ? 'bg-blue-100 text-[#016098]'
                              : 'bg-cyan-100 text-cyan-800'
                          }`}
                        >
                          {isEdu ? (
                            <>
                              <Building2 className="w-3 h-3" /> EDU
                            </>
                          ) : (
                            <>
                              <HeartPulse className="w-3 h-3" /> SALUD
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditClick(c)}
                            title="Editar Unidad / Cenco"
                            className="p-1.5 rounded-lg text-[#016098] hover:bg-blue-100 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCenco(c.unidad)}
                            title="Eliminar Unidad"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columna Derecha (1/3): Reglas de Exclusión de Haberes */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5 h-fit">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 rounded-xl bg-[#EB567F] text-white">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">
                Haberes Excluidos del Proceso
              </h2>
              <p className="text-xs text-slate-500">
                Reglas automáticas de depuración del archivo mensual
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <p className="font-bold text-slate-800">Reglas Fijas del Sistema:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Eliminar todo registro con <code className="font-bold">COD. HABER = 0</code>
              </li>
              <li>
                Eliminar todo registro con <code className="font-bold">NOMBRE HABER</code> en blanco
              </li>
              <li>
                Eliminar todo registro cuyo <code className="font-bold">NOMBRE HABER</code> coincida con la lista inferior:
              </li>
            </ul>
          </div>

          <form onSubmit={handleAddHaberExcluido} className="flex gap-2">
            <input
              type="text"
              value={nuevoHaberExcluido}
              onChange={(e) => setNuevoHaberExcluido(e.target.value)}
              placeholder="Ej: ASIGNACION FAMILIAR"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs uppercase font-semibold outline-none focus:ring-2 focus:ring-[#016098]"
            />
            <button
              type="submit"
              disabled={savingHaber}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#016098] hover:bg-[#014b78] text-white text-xs font-bold transition"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </button>
          </form>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {excluidos.map((h) => {
              const label = h.glosa_haber || h.nombre_haber;
              return (
                <div
                  key={h.id || label}
                  className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-mono text-xs font-extrabold text-rose-700 block">
                      {label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {h.motivo || 'Excluido automáticamente al cargar Renta'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteHaberExcluido(h.id || label)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
