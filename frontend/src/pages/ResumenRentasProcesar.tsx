import React, { useState } from 'react';
import {
  UploadCloud,
  FileArchive,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Save,
  Users,
  DollarSign,
  Download
} from 'lucide-react';
import { formatCurrencyCLP } from '../utils/exportUtils';

const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const ResumenRentasProcesar: React.FC = () => {
  const [anio, setAnio] = useState(2026);
  const [mes, setMes] = useState(9);
  const [personalFile, setPersonalFile] = useState<File | null>(null);
  const [rentaFile, setRentaFile] = useState<File | null>(null);

  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('Docentes');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const detectarPeriodoDesdeNombre = (fname: string) => {
    const upper = fname.toUpperCase();
    const yMatch = upper.match(/\b(202\d|203\d)\b/);
    if (yMatch) setAnio(Number(yMatch[1]));

    const mapa: Record<string, number> = {
      ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
      JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12
    };
    for (const [nombre, num] of Object.entries(mapa)) {
      if (upper.includes(nombre)) {
        setMes(num);
        break;
      }
    }
  };

  const handleProcesar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalFile || !rentaFile) {
      setFeedback({
        type: 'error',
        text: 'Por favor seleccione ambos archivos del mes: Personal y Renta.'
      });
      return;
    }

    setProcessing(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('personal', personalFile);
      formData.append('renta', rentaFile);
      formData.append('anio', String(anio));
      formData.append('mes', String(mes));

      const res = await fetch('/api/resumen-rentas/previsualizar', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar los archivos');

      setResultado(data);
      setActiveTab('Docentes');
      setFeedback({
        type: 'ok',
        text: `Cruce completado: ${data.meta.personalFilasValidas.toLocaleString('es-CL')} funcionarios cruzados con ${data.meta.rentaFilasValidas.toLocaleString('es-CL')} registros de renta.`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleGuardar = async () => {
    if (!resultado) return;
    setSaving(true);
    setFeedback(null);
    try {
      const userStr = localStorage.getItem('user');
      const userObj = userStr ? JSON.parse(userStr) : null;
      const formData = new FormData();
      formData.append('anio', String(anio));
      formData.append('mes', String(mes));
      formData.append('usuario', userObj?.Usuario || 'admin');

      const res = await fetch('/api/resumen-rentas/guardar', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando en PostgreSQL');

      setFeedback({ type: 'ok', text: data.message });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const rowsActivas =
    activeTab === 'PERSONAL_8COL'
      ? resultado?.muestraPersonalDepurado || []
      : activeTab === 'RENTA_6COL'
      ? resultado?.muestraRentaDepurada || []
      : resultado?.muestrasConsultas?.[activeTab] || [];

  return (
    <div className="space-y-6">
      {/* Formulario de Carga Dual (Personal + Renta) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
          <div className="p-3 rounded-2xl bg-[#016098] text-white shadow-md">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">
              Procesar Mes — Resumen de Rentas (Personal + Renta)
            </h2>
            <p className="text-xs text-slate-500">
              Suba las planillas de Personal y Renta (originales o ya recortadas). El sistema recorta las columnas automáticamente, ejecuta las 6 consultas de Access y arma el archivo <code>MM_YYYY.zip</code>.
            </p>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-5 p-4 rounded-xl border flex items-center gap-3 text-xs font-bold ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleProcesar} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Año del Proceso</label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mes del Proceso</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              >
                {MESES_NOMBRES.slice(1).map((mNom, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {String(idx + 1).padStart(2, '0')} - {mNom}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                1. Planilla Personal (<code>.xlsx</code> / <code>.xls</code>)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setPersonalFile(f);
                  if (f) detectarPeriodoDesdeNombre(f.name);
                }}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#016098] hover:file:bg-blue-100"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Se recortará a: NOMBRE_SUCURSAL, CODIGO, RUT EMPLEADO, DV, PATERNO, MATERNO, NOMBRE, PLANTA
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                2. Planilla Renta (<code>.xlsx</code> / <code>.xls</code> / <code>.csv</code>)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setRentaFile(f);
                  if (f) detectarPeriodoDesdeNombre(f.name);
                }}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-cyan-50 file:text-[#016098] hover:file:bg-cyan-100"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Se recortará a: UNIDAD, RUT, DV, COD. HABER, NOMBRE HABER, MONTO_HABER
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={processing}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#016098] hover:bg-[#014b78] text-white text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              {processing ? 'Ejecutando Cruce y Consultas...' : 'Procesar y Generar las 6 Consultas'}
            </button>

            {resultado && (
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={`/api/resumen-rentas/descargar-zip/${resultado.meta.anio}/${resultado.meta.mes}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md transition"
                >
                  <FileArchive className="w-4 h-4" />
                  Descargar {resultado.meta.zipFileName} (6 Excel incluidos)
                </a>

                <button
                  type="button"
                  onClick={handleGuardar}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-sm transition"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar Mes en PostgreSQL'}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Resultado de las 6 Consultas */}
      {resultado && (
        <div className="space-y-6">
          {/* Tarjetas de las 6 Consultas */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(resultado.resumenConsultas || []).map((c: any) => (
              <div
                key={c.key}
                onClick={() => setActiveTab(c.key)}
                className={`p-4 rounded-2xl border cursor-pointer transition ${
                  activeTab === c.key
                    ? 'bg-[#016098] text-white border-[#016098] shadow-md'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-[#016098]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider truncate">
                    {c.fileName}
                  </span>
                </div>
                <p
                  className={`text-sm font-extrabold font-mono mt-2 ${
                    activeTab === c.key ? 'text-white' : 'text-[#016098]'
                  }`}
                >
                  {formatCurrencyCLP(c.montoTotal)}
                </p>
                <div
                  className={`mt-1 text-[11px] flex items-center justify-between ${
                    activeTab === c.key ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  <span>{c.filas.toLocaleString('es-CL')} filas</span>
                  <a
                    href={`/api/resumen-rentas/descargar-consulta/${c.key}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`underline font-bold ${
                      activeTab === c.key ? 'text-cyan-200' : 'text-[#016098]'
                    }`}
                  >
                    .xlsx
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Visor de la Pestaña Seleccionada + Descarga de Personal (8 col) y Renta (6 col) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(resultado.resumenConsultas || []).map((c: any) => (
                  <button
                    key={c.key}
                    onClick={() => setActiveTab(c.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      activeTab === c.key
                        ? 'bg-[#016098] text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {c.key} ({c.filas.toLocaleString('es-CL')})
                  </button>
                ))}
                <button
                  onClick={() => setActiveTab('PERSONAL_8COL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === 'PERSONAL_8COL'
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Hoja1 Personal (8 col.)
                </button>
                <button
                  onClick={() => setActiveTab('RENTA_6COL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === 'RENTA_6COL'
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Hoja2 Renta (6 col.)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/resumen-rentas/descargar-consulta/personal-depurado"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5 text-[#016098]" />
                  personal 2.xlsx (8 col)
                </a>
                <a
                  href="/api/resumen-rentas/descargar-consulta/renta-depurada"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5 text-[#016098]" />
                  renta 2.xlsx (6 col)
                </a>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[460px]">
              {rowsActivas.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  Esta consulta no registra filas en el período seleccionado (0 registros).
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-white sticky top-0">
                    <tr>
                      {Object.keys(rowsActivas[0]).map((col) => (
                        <th key={col} className="py-2.5 px-4 text-left font-bold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rowsActivas.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-blue-50/30">
                        {Object.entries(r).map(([k, val]: [string, any]) => (
                          <td
                            key={k}
                            className={`py-2 px-4 ${
                              k === 'MONTO_HABER'
                                ? 'text-right font-mono font-bold text-slate-900'
                                : 'text-slate-700'
                            }`}
                          >
                            {k === 'MONTO_HABER' ? formatCurrencyCLP(Number(val)) : String(val ?? '')}
                          </td>
                        ))}
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
