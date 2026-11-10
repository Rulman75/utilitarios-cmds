import React, { useEffect, useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileDown,
  Search,
  Building2,
  HeartPulse,
  Eye,
  X,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Users
} from 'lucide-react';
import {
  formatCurrencyCLP,
  exportDistribucionContabilidadPDF,
  exportToExcel
} from '../utils/exportUtils';

const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const VisorInformes: React.FC = () => {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [detallePeriodo, setDetallePeriodo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState<'EDUCACION' | 'SALUD'>('EDUCACION');
  const [modoVista, setModoVista] = useState<'HABER' | 'UNIDAD'>('HABER');
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<number, boolean>>({});

  // Modal de detalle de funcionarios
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalFilterInfo, setModalFilterInfo] = useState<{
    codHaber?: number;
    glosaHaber?: string;
    unidad?: number;
    nombreUnidad?: string;
  }>({});
  const [funcionariosDetalle, setFuncionariosDetalle] = useState<any[]>([]);
  const [modalSearch, setModalSearch] = useState('');

  const loadPeriodos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/periodos');
      const json = await res.json();
      const list = json.periodos || [];
      setPeriodos(list);
      if (list.length > 0) {
        const first = list[0];
        const key = `${first.anio}-${first.mes}`;
        setSelectedKey(key);
        await loadPeriodDetail(first.anio, first.mes);
      } else {
        await loadPeriodDetail();
      }
    } catch (err) {
      console.error('Error cargando períodos:', err);
      setLoading(false);
    }
  };

  const loadPeriodDetail = async (anio?: number, mes?: number) => {
    setLoading(true);
    try {
      const q = anio && mes ? `?anio=${anio}&mes=${mes}` : '';
      const res = await fetch(`/api/distribucion/activa${q}`);
      if (res.ok) {
        const json = await res.json();
        setDetallePeriodo(json.data || null);
      }
    } catch (err) {
      console.error('Error cargando detalle del período:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriodos();
  }, []);

  const handleSelectChange = (val: string) => {
    setSelectedKey(val);
    const [a, m] = val.split('-').map(Number);
    if (a && m) loadPeriodDetail(a, m);
  };

  const openFuncionariosModal = async (params: {
    codHaber?: number;
    glosaHaber?: string;
    unidad?: number;
    nombreUnidad?: string;
  }) => {
    if (!detallePeriodo) return;
    setModalFilterInfo(params);
    setModalSearch('');
    setModalOpen(true);
    setModalLoading(true);
    try {
      const q = new URLSearchParams({ sector });
      if (params.codHaber !== undefined) q.set('codHaber', String(params.codHaber));
      if (params.unidad !== undefined) q.set('unidad', String(params.unidad));
      const res = await fetch(`/api/distribucion/detalle-funcionarios?${q.toString()}`);
      const data = await res.json();
      setFuncionariosDetalle(data.funcionarios || []);
    } catch (e) {
      console.error('Error cargando detalle de funcionarios:', e);
      setFuncionariosDetalle([]);
    } finally {
      setModalLoading(false);
    }
  };

  const activeGroupsPorHaber = useMemo(() => {
    if (!detallePeriodo) return [];
    const secObj = sector === 'EDUCACION' ? detallePeriodo.educacion : detallePeriodo.salud;
    const list = secObj?.gruposHaberes || [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;

    return list
      .map((g: any) => {
        const matchHeader =
          String(g.codHaber).includes(q) ||
          String(g.glosaHaber).toLowerCase().includes(q);
        if (matchHeader) return g;

        const filteredItems = (g.items || []).filter(
          (u: any) =>
            String(u.unidad).includes(q) ||
            String(u.cenco || '').toLowerCase().includes(q) ||
            String(u.nombreUnidad || '').toLowerCase().includes(q)
        );
        if (filteredItems.length > 0) {
          return {
            ...g,
            items: filteredItems,
            totalHaber: filteredItems.reduce((s: number, u: any) => s + u.montoHaber, 0)
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [detallePeriodo, sector, searchTerm]);

  const activeGroupsPorUnidad = useMemo(() => {
    if (!detallePeriodo) return [];
    const secObj = sector === 'EDUCACION' ? detallePeriodo.educacion : detallePeriodo.salud;
    const list = secObj?.resumenUnidades || [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (u: any) =>
        String(u.unidad).includes(q) ||
        String(u.cenco || '').toLowerCase().includes(q) ||
        String(u.nombreUnidad || '').toLowerCase().includes(q) ||
        (u.haberes || []).some(
          (h: any) =>
            String(h.codHaber).includes(q) ||
            String(h.glosaHaber).toLowerCase().includes(q)
        )
    );
  }, [detallePeriodo, sector, searchTerm]);

  const totalMostrado = useMemo(() => {
    if (modoVista === 'HABER') {
      return activeGroupsPorHaber.reduce((acc: number, g: any) => acc + (g.totalHaber || 0), 0);
    }
    return activeGroupsPorUnidad.reduce((acc: number, u: any) => acc + (u.totalUnidad || 0), 0);
  }, [modoVista, activeGroupsPorHaber, activeGroupsPorUnidad]);

  const toggleGroup = (id: number) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredModalRows = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    if (!q) return funcionariosDetalle;
    return funcionariosDetalle.filter(
      (r) =>
        String(r.rut || '').toLowerCase().includes(q) ||
        String(r.nombreCompleto || '').toLowerCase().includes(q) ||
        String(r.glosaHaber || '').toLowerCase().includes(q) ||
        String(r.unidad || '').includes(q)
    );
  }, [funcionariosDetalle, modalSearch]);

  if (loading && !detallePeriodo) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#016098] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Cargando informes de distribución...</p>
        </div>
      </div>
    );
  }

  if (!detallePeriodo) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
        <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">No hay períodos procesados aún</h3>
        <p className="text-sm text-slate-500 mt-1">
          Procese un archivo mensual de Renta en la sección Procesar Archivo Renta para visualizar informes.
        </p>
      </div>
    );
  }

  const anioActual = detallePeriodo.meta?.anio || 2026;
  const mesActual = detallePeriodo.meta?.mes || 9;
  const periodoTexto = `${MESES_NOMBRES[mesActual] || mesActual} ${anioActual}`;
  const totalEdu = detallePeriodo.educacion?.totalSector || 0;
  const totalSal = detallePeriodo.salud?.totalSector || 0;

  return (
    <div className="space-y-6">
      {/* Barra superior de selección de período y descargas oficiales */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#016098]/10 text-[#016098]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Período Contable Activo
                </label>
                <select
                  value={selectedKey}
                  onChange={(e) => handleSelectChange(e.target.value)}
                  className="mt-0.5 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#016098] outline-none"
                >
                  {periodos.map((p) => (
                    <option key={`${p.anio}-${p.mes}`} value={`${p.anio}-${p.mes}`}>
                      {MESES_NOMBRES[p.mes]} {p.anio} — ({Number(p.filas_validas || 0).toLocaleString('es-CL')} reg.)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selector Sector Educación / Salud */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setSector('EDUCACION')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                  sector === 'EDUCACION'
                    ? 'bg-[#016098] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                EDUCACIÓN (&lt; 600)
                <span className="px-1.5 py-0.5 rounded bg-black/15 text-[10px]">
                  {formatCurrencyCLP(totalEdu)}
                </span>
              </button>
              <button
                onClick={() => setSector('SALUD')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                  sector === 'SALUD'
                    ? 'bg-[#39BABD] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HeartPulse className="w-4 h-4" />
                SALUD (&gt;= 600)
                <span className="px-1.5 py-0.5 rounded bg-black/15 text-[10px]">
                  {formatCurrencyCLP(totalSal)}
                </span>
              </button>
            </div>
          </div>

          {/* Botones de exportación */}
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`/api/distribucion/descargar/${
                sector === 'EDUCACION' ? 'educacion-xls' : 'salud-xls'
              }?anio=${anioActual}&mes=${mesActual}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#016098] hover:bg-[#014f7d] text-white text-xs font-bold shadow-sm transition"
            >
              <FileDown className="w-4 h-4" />
              Descargar {sector === 'EDUCACION' ? 'distribución_educacion.xls' : 'distribucion_salud.xls'}
            </a>
            <a
              href={`/api/distribucion/descargar/${
                sector === 'EDUCACION' ? 'educacion-xlsx' : 'salud-xlsx'
              }?anio=${anioActual}&mes=${mesActual}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Formato .XLSX
            </a>
            <button
              onClick={() =>
                exportDistribucionContabilidadPDF(
                  sector,
                  periodoTexto,
                  activeGroupsPorHaber,
                  totalMostrado
                )
              }
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EB567F] hover:bg-[#d6456d] text-white text-xs font-bold shadow-sm transition"
            >
              <FileDown className="w-4 h-4" />
              Informe PDF Oficial
            </button>
            <a
              href={`/api/distribucion/descargar/base-depurada-xlsx?anio=${anioActual}&mes=${mesActual}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              Excel 3 Hojas Depurado
            </a>
          </div>
        </div>

        {/* Sub-barra de filtros y modo de vista */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
              Agrupación:
            </span>
            <button
              onClick={() => setModoVista('HABER')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                modoVista === 'HABER'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Por Código de Haber (Formato Contabilidad)
            </button>
            <button
              onClick={() => setModoVista('UNIDAD')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                modoVista === 'UNIDAD'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Por Unidad y Centro de Costo (Cenco)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar haber, código, unidad o Cenco..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#016098] outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap">
              Total Vista: {formatCurrencyCLP(totalMostrado)}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal según modoVista */}
      {modoVista === 'HABER' ? (
        <div className="space-y-4">
          {activeGroupsPorHaber.map((grupo: any) => {
            const isCollapsed = !!collapsedGroups[grupo.codHaber];
            const items = grupo.items || [];
            const totalRegGrupo = items.reduce((s: number, it: any) => s + (it.cantidadRegistros || 0), 0);
            return (
              <div
                key={grupo.codHaber}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
              >
                {/* Cabecera del Haber (Idéntica al bloque de Crystal Reports) */}
                <div
                  onClick={() => toggleGroup(grupo.codHaber)}
                  className="px-6 py-3.5 bg-gradient-to-r from-slate-800 to-slate-700 text-white flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:from-slate-700 hover:to-slate-600 transition"
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-cyan-300" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-cyan-300" />
                    )}
                    <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 border border-cyan-400/30 text-cyan-200 font-mono text-xs font-bold">
                      COD. HABER: {grupo.codHaber}
                    </span>
                    <h3 className="text-sm font-bold tracking-wide">{grupo.glosaHaber}</h3>
                    <span className="text-xs text-slate-300">
                      ({items.length} unidades)
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFuncionariosModal({
                          codHaber: grupo.codHaber,
                          glosaHaber: grupo.glosaHaber
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-cyan-100 transition"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Ver Funcionarios ({totalRegGrupo})
                    </button>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-slate-300 block">
                        Subtotal Haber
                      </span>
                      <span className="text-sm font-extrabold text-emerald-300 font-mono">
                        {formatCurrencyCLP(grupo.totalHaber)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabla de Unidades del Haber */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase">
                          <th className="py-2.5 px-5 text-left font-bold w-24">Unidad</th>
                          <th className="py-2.5 px-4 text-left font-bold">Establecimiento / Unidad</th>
                          <th className="py-2.5 px-4 text-left font-bold w-36">Centro Costo (Cenco)</th>
                          <th className="py-2.5 px-4 text-right font-bold w-32">Registros</th>
                          <th className="py-2.5 px-5 text-right font-bold w-44">Monto Haber</th>
                          <th className="py-2.5 px-4 text-center font-bold w-28">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((u: any) => (
                          <tr key={u.unidad} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-2.5 px-5 font-mono font-bold text-slate-800">
                              {u.unidad}
                            </td>
                            <td className="py-2.5 px-4 text-slate-700 font-medium">
                              {u.nombreUnidad || `Unidad ${u.unidad}`}
                            </td>
                            <td className="py-2.5 px-4 font-mono">
                              {u.cenco ? (
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-[#016098] font-bold border border-blue-200">
                                  {u.cenco}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                                  <AlertTriangle className="w-3 h-3" /> Sin Cenco
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-500 font-mono">
                              {(u.cantidadRegistros || 0).toLocaleString('es-CL')}
                            </td>
                            <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                              {formatCurrencyCLP(u.montoHaber)}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                onClick={() =>
                                  openFuncionariosModal({
                                    codHaber: grupo.codHaber,
                                    glosaHaber: grupo.glosaHaber,
                                    unidad: u.unidad,
                                    nombreUnidad: u.nombreUnidad
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[#016098] hover:bg-blue-100/60 font-semibold transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ver RUTs
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista agrupada por Unidad / Centro de Costo */
        <div className="space-y-4">
          {activeGroupsPorUnidad.map((u: any) => {
            const isCollapsed = !!collapsedGroups[u.unidad];
            return (
              <div
                key={u.unidad}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
              >
                <div
                  onClick={() => toggleGroup(u.unidad)}
                  className="px-6 py-3.5 bg-gradient-to-r from-[#016098] to-[#0277bd] text-white flex flex-wrap items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-cyan-200" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-cyan-200" />
                    )}
                    <span className="px-2.5 py-1 rounded-md bg-white/15 font-mono text-xs font-bold">
                      UNIDAD {u.unidad}
                    </span>
                    <h3 className="text-sm font-bold">{u.nombreUnidad}</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-300/40 text-xs font-mono font-bold">
                      CENCO: {u.cenco || 'SIN ASIGNAR'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFuncionariosModal({
                          unidad: u.unidad,
                          nombreUnidad: u.nombreUnidad
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Funcionarios Unidad
                    </button>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-cyan-100 block">
                        Total Unidad
                      </span>
                      <span className="text-sm font-extrabold text-white font-mono">
                        {formatCurrencyCLP(u.totalUnidad)}
                      </span>
                    </div>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase">
                          <th className="py-2.5 px-5 text-left font-bold w-28">Cod. Haber</th>
                          <th className="py-2.5 px-4 text-left font-bold">Glosa Haber</th>
                          <th className="py-2.5 px-5 text-right font-bold w-44">Monto Haber</th>
                          <th className="py-2.5 px-4 text-center font-bold w-28">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(u.haberes || []).map((h: any) => (
                          <tr key={h.codHaber} className="hover:bg-slate-50">
                            <td className="py-2.5 px-5 font-mono font-bold text-[#016098]">
                              {h.codHaber}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-slate-700">
                              {h.glosaHaber}
                            </td>
                            <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                              {formatCurrencyCLP(h.montoHaber)}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                onClick={() =>
                                  openFuncionariosModal({
                                    codHaber: h.codHaber,
                                    glosaHaber: h.glosaHaber,
                                    unidad: u.unidad,
                                    nombreUnidad: u.nombreUnidad
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[#016098] hover:bg-blue-100/60 font-semibold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ver RUTs
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalle de Funcionarios */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-[#016098] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#39BABD]" />
                  Detalle Nominal de Funcionarios — {sector} ({periodoTexto})
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  {modalFilterInfo.codHaber
                    ? `Haber [${modalFilterInfo.codHaber}] ${modalFilterInfo.glosaHaber}`
                    : 'Todos los Haberes'}{' '}
                  {modalFilterInfo.unidad
                    ? `• Unidad ${modalFilterInfo.unidad} (${modalFilterInfo.nombreUnidad || ''})`
                    : ''}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Filtrar por RUT o nombre..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#016098]"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 mr-2">
                  {filteredModalRows.length.toLocaleString('es-CL')} registros • Total:{' '}
                  <span className="text-[#016098]">
                    {formatCurrencyCLP(
                      filteredModalRows.reduce((s, r) => s + (r.monto || 0), 0)
                    )}
                  </span>
                </span>
                <button
                  onClick={() =>
                    exportToExcel(
                      filteredModalRows.map((r) => ({
                        RUT: r.rut,
                        FUNCIONARIO: r.nombreCompleto,
                        MONTO_HABER: r.monto
                      })),
                      `Detalle_Funcionarios_${sector}_${anioActual}_${mesActual}`,
                      'Detalle'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Exportar Excel
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {modalLoading ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  Consultando registros nominales...
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 text-left font-bold">RUT</th>
                      <th className="py-2.5 px-4 text-left font-bold">Nombre Funcionario</th>
                      <th className="py-2.5 px-4 text-right font-bold">Monto Haber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredModalRows.slice(0, 500).map((r, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/40">
                        <td className="py-2 px-4 font-mono whitespace-nowrap font-bold text-slate-700">
                          {r.rut}
                        </td>
                        <td className="py-2 px-4 font-medium text-slate-800">{r.nombreCompleto}</td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyCLP(r.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
