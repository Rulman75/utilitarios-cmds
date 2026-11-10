import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  formatCurrencyCLP,
  exportDistribucionContabilidadPDF
} from '../utils/exportUtils';

const MESES_NOMBRES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

export default function ProcesarDistribucion() {
  const now = new Date();
  const [anio, setAnio] = useState<number>(now.getFullYear());
  const [mes, setMes] = useState<number>(9);
  const [archivo, setArchivo] = useState<File | null>(null);

  const [previsualizando, setPrevisualizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [tabActiva, setTabActiva] = useState<'resumen_edu' | 'resumen_sal' | 'hoja_edu' | 'hoja_sal'>('resumen_edu');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'info'; texto: string } | null>(null);

  // Asignación rápida de Cenco si alguna unidad viene sin Cenco
  const [cencoRapido, setCencoRapido] = useState<Record<number, string>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const detectarPeriodoDesdeNombre = (fileName: string): { anioDet: number; mesDet: number } => {
    const upper = fileName.toUpperCase();
    let anioDet = anio;
    let mesDet = mes;

    const yearMatch = upper.match(/\b(202\d|203\d)\b/);
    if (yearMatch) {
      anioDet = parseInt(yearMatch[1], 10);
    }

    const mapaMeses: Record<string, number> = {
      ENERO: 1,
      FEBRERO: 2,
      MARZO: 3,
      ABRIL: 4,
      MAYO: 5,
      JUNIO: 6,
      JULIO: 7,
      AGOSTO: 8,
      SEPTIEMBRE: 9,
      SETIEMBRE: 9,
      OCTUBRE: 10,
      NOVIEMBRE: 11,
      DICIEMBRE: 12
    };

    for (const [nombreMes, numMes] of Object.entries(mapaMeses)) {
      if (upper.includes(nombreMes)) {
        mesDet = numMes;
        break;
      }
    }

    return { anioDet, mesDet };
  };

  const ejecutarPrevisualizacion = async (fileToUse: File, anioToUse: number, mesToUse: number) => {
    setPrevisualizando(true);
    setMensaje(null);
    try {
      const formData = new FormData();
      formData.append('archivo', fileToUse);
      formData.append('anio', String(anioToUse));
      formData.append('mes', String(mesToUse));

      const res = await fetch('/api/distribucion/previsualizar', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setResultado(data);
        setAnio(data.meta.anio);
        setMes(data.meta.mes);
        setMensaje({
          tipo: 'ok',
          texto: `Archivo procesado exitosamente: De ${data.meta.totalFilasBrutas.toLocaleString('es-CL')} registros originales se obtuvieron ${data.meta.filasValidas.toLocaleString('es-CL')} registros válidos (${data.meta.filasEducacion.toLocaleString('es-CL')} en Educación y ${data.meta.filasSalud.toLocaleString('es-CL')} en Salud).`
        });
      } else {
        setResultado(null);
        setMensaje({ tipo: 'error', texto: data.error || 'No se pudo procesar el archivo Excel' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión al procesar el archivo Excel' });
    } finally {
      setPrevisualizando(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);
    const { anioDet, mesDet } = detectarPeriodoDesdeNombre(f.name);
    setAnio(anioDet);
    setMes(mesDet);
    ejecutarPrevisualizacion(f, anioDet, mesDet);
  };

  const guardarEnHistorial = async () => {
    if (!resultado) return;
    setGuardando(true);
    try {
      const formData = new FormData();
      if (archivo) formData.append('archivo', archivo);
      formData.append('anio', String(anio));
      formData.append('mes', String(mes));

      const res = await fetch('/api/distribucion/guardar-periodo', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setMensaje({ tipo: 'ok', texto: data.message });
      } else {
        setMensaje({ tipo: 'error', texto: data.error || 'Error guardando período' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red al guardar el período' });
    } finally {
      setGuardando(false);
    }
  };

  const asignarCencoAlVuelo = async (unidad: number) => {
    const val = cencoRapido[unidad];
    if (!val) return;
    try {
      const res = await fetch('/api/cencos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidad, cenco: Number(val) })
      });
      if (res.ok && archivo) {
        await ejecutarPrevisualizacion(archivo, anio, mes);
      }
    } catch {
      alert('No se pudo actualizar el Cenco');
    }
  };

  const meta = resultado?.meta;

  return (
    <div className="space-y-6 pb-10">
      {/* Encabezado */}
      <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#016098]">
            Procesar Archivo Mensual de Renta y Generar Distribución
          </h1>
          <p className="text-xs text-[#64748b] mt-1">
            Automatiza en un solo paso el recorte de 14 a 9 columnas, el filtrado de haberes, la separación en Educación (`&lt; 600`) y Salud (`&gt;= 600`), el cruce con `Cencos` y la generación de `distribución_educacion.xls` y `distribucion_salud.xls`.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/informes"
            className="px-3.5 py-2 text-xs font-bold bg-[#f1f5f9] text-[#016098] hover:bg-[#e2e8f0] rounded-lg"
          >
            Ir al Visor de Informes →
          </Link>
        </div>
      </div>

      {/* Flujo de 5 Etapas Automatizadas */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {[
          { step: '1', title: 'Recorte Columnas', desc: 'De 14 a las 9 columnas requeridas' },
          { step: '2', title: 'Limpieza Haberes', desc: 'Elimina COD. HABER = 0 y Asig. Familiar/Prenatal/Atrasada' },
          { step: '3', title: 'Separación Sector', desc: 'Educación (< 600) y Salud (>= 600)' },
          { step: '4', title: 'Agrupación y Cencos', desc: 'Suma por Unidad/Haber y asigna Cenco' },
          { step: '5', title: 'Exportación y Envío', desc: 'Excel Contabilidad (.xls/.xlsx), PDF y Correo' }
        ].map((s, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-xl border ${
              resultado
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-white border-[#e2e8f0]'
            } shadow-2xs flex items-start gap-2.5`}
          >
            <span
              className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                resultado ? 'bg-emerald-600 text-white' : 'bg-[#016098] text-white'
              }`}
            >
              {resultado ? '✓' : s.step}
            </span>
            <div>
              <div className="text-xs font-bold text-[#1e293b]">{s.title}</div>
              <div className="text-[11px] text-[#64748b] leading-snug mt-0.5">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {mensaje && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex justify-between items-center ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : mensaje.tipo === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <span>{mensaje.texto}</span>
          <button onClick={() => setMensaje(null)} className="text-xs font-bold ml-4 opacity-70 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* PANEL 1: SELECCIÓN DE ARCHIVO Y PERÍODO */}
      <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-5 space-y-5">
        <h2 className="text-sm font-bold text-[#016098] uppercase tracking-wider border-b border-[#f1f5f9] pb-2">
          1. Seleccionar Archivo Mensual de Renta (.xlsx o .xls)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-6">
            <label className="block text-xs font-semibold text-[#475569] mb-1">
              Archivo Excel Bruto de Renta (14 columnas originales o 9 columnas)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-xs text-[#475569] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#016098] file:text-white hover:file:bg-[#014b78] border border-[#cbd5e1] rounded-lg p-1 bg-[#f8fafc] cursor-pointer"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-[#475569] mb-1">Mes de Remuneración</label>
            <select
              value={mes}
              onChange={(e) => {
                const nuevoMes = parseInt(e.target.value, 10);
                setMes(nuevoMes);
                if (archivo) ejecutarPrevisualizacion(archivo, anio, nuevoMes);
              }}
              className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-lg bg-white font-bold text-[#016098]"
            >
              {MESES_NOMBRES.slice(1).map((nombre, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {String(idx + 1).padStart(2, '0')} - {nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-[#475569] mb-1">Año</label>
            <select
              value={anio}
              onChange={(e) => {
                const nuevoAnio = parseInt(e.target.value, 10);
                setAnio(nuevoAnio);
                if (archivo) ejecutarPrevisualizacion(archivo, nuevoAnio, mes);
              }}
              className="w-full px-2 py-2 text-xs border border-[#cbd5e1] rounded-lg bg-white font-bold text-[#016098]"
            >
              {[2024, 2025, 2026, 2027, 2028].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => archivo && ejecutarPrevisualizacion(archivo, anio, mes)}
              disabled={!archivo || previsualizando}
              className="w-full py-2 px-3 bg-[#016098] text-white text-xs font-bold rounded-lg hover:bg-[#014b78] disabled:opacity-40 cursor-pointer"
            >
              {previsualizando ? 'Procesando...' : '⚡ Procesar Ahora'}
            </button>
          </div>
        </div>
      </div>

      {/* PANEL 2: RESULTADO DE LA AUDITORÍA Y DESCARGAS */}
      {resultado && meta && (
        <div className="bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#f1f5f9] pb-3 gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#016098] uppercase tracking-wider">
                2. Auditoría de Depuración y Resultados — {meta.mesNombre} {meta.anio}
              </h2>
              <p className="text-xs text-[#64748b]">
                Archivo procesado: <strong>{meta.archivoNombre}</strong> · Formato detectado:{' '}
                <span className="font-semibold text-[#016098]">{meta.formatoOrigen}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={guardarEnHistorial}
              disabled={guardando}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : `💾 Guardar ${meta.mesNombre} ${meta.anio} en Historial Oficial`}
            </button>
          </div>

          {/* Alerta si existen unidades sin Cenco asignado */}
          {meta.unidadesSinCenco && meta.unidadesSinCenco.length > 0 && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg space-y-2">
              <div className="text-xs font-bold text-amber-900">
                ⚠️ Atención: Se detectaron {meta.unidadesSinCenco.length} unidad(es) en el archivo que no tienen Centro de Costo (`Cenco`) asignado:
              </div>
              <div className="flex flex-wrap gap-3">
                {meta.unidadesSinCenco.map((u: any) => (
                  <div key={u.unidad} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-amber-300 text-xs">
                    <span className="font-bold text-[#016098]">Unidad {u.unidad} ({u.nombre}):</span>
                    <input
                      type="number"
                      placeholder="Ingrese Cenco"
                      value={cencoRapido[u.unidad] || ''}
                      onChange={(e) => setCencoRapido({ ...cencoRapido, [u.unidad]: e.target.value })}
                      className="w-28 px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                    <button
                      onClick={() => asignarCencoAlVuelo(u.unidad)}
                      className="px-2.5 py-1 bg-[#016098] text-white font-bold rounded text-[11px] cursor-pointer"
                    >
                      Asignar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tarjetas de Auditoría Matemática */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-slate-600 block font-semibold">1. Filas Brutas</span>
              <span className="font-black text-lg text-slate-800 mt-0.5 block">
                {meta.totalFilasBrutas.toLocaleString('es-CL')}
              </span>
              <span className="block text-[10px] text-slate-500">Total leídas del Excel</span>
            </div>

            <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200">
              <span className="text-rose-800 block font-semibold">2. Eliminadas (Cód. 0)</span>
              <span className="font-black text-lg text-rose-700 mt-0.5 block">
                -{(meta.descartadasCodCero + meta.descartadasNombreBlanco).toLocaleString('es-CL')}
              </span>
              <span className="block text-[10px] text-rose-600">COD. HABER = 0 o blanco</span>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
              <span className="text-amber-900 block font-semibold">3. Asig. Excluidas</span>
              <span className="font-black text-lg text-amber-800 mt-0.5 block">
                -{meta.descartadasExcluidas.toLocaleString('es-CL')}
              </span>
              <span className="block text-[10px] text-amber-700">
                {Object.entries(meta.desgloseExcluidas || {})
                  .map(([k, v]) => `${k.replace('ASIGNACION ', 'ASIG. ')}: ${v}`)
                  .join(' · ') || 'Familiar / Atrasada / Prenatal'}
              </span>
            </div>

            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-emerald-900 block font-semibold">4. Registros Válidos</span>
              <span className="font-black text-lg text-emerald-700 mt-0.5 block">
                {meta.filasValidas.toLocaleString('es-CL')}
              </span>
              <span className="block text-[10px] text-emerald-700">
                Educ: {meta.filasEducacion.toLocaleString('es-CL')} · Salud: {meta.filasSalud.toLocaleString('es-CL')}
              </span>
            </div>

            <div className="bg-sky-50 p-3.5 rounded-xl border border-sky-200">
              <span className="text-sky-900 block font-semibold">5. Total Educación (&lt;600)</span>
              <span className="font-black text-base text-[#016098] mt-0.5 block">
                {formatCurrencyCLP(meta.montoEducacion)}
              </span>
              <span className="block text-[10px] text-sky-700">
                {meta.haberesEducacion} haberes · {meta.unidadesEducacion} unidades
              </span>
            </div>

            <div className="bg-teal-50 p-3.5 rounded-xl border border-teal-200">
              <span className="text-teal-900 block font-semibold">6. Total Salud (&gt;=600)</span>
              <span className="font-black text-base text-teal-800 mt-0.5 block">
                {formatCurrencyCLP(meta.montoSalud)}
              </span>
              <span className="block text-[10px] text-teal-700">
                {meta.haberesSalud} haberes · {meta.unidadesSalud} unidades
              </span>
            </div>
          </div>

          {/* Botonera Principal de Descargas de Informes */}
          <div className="bg-[#f8fafc] p-4 rounded-xl border border-[#cbd5e1] space-y-3">
            <div className="text-xs font-bold text-[#016098] uppercase">
              3. Descargar Informes de Salida para Contabilidad y Base Depurada
            </div>
            <div className="flex flex-wrap gap-2.5">
              <a
                href="/api/distribucion/descargar/educacion-xls"
                className="px-4 py-2.5 bg-[#016098] hover:bg-[#014b78] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2"
              >
                📥 Descargar distribución_educacion.xls
              </a>
              <a
                href="/api/distribucion/descargar/salud-xls"
                className="px-4 py-2.5 bg-[#39BABD] hover:bg-[#2da1a4] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2"
              >
                📥 Descargar distribucion_salud.xls
              </a>
              <a
                href="/api/distribucion/descargar/base-depurada-xls"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2"
                title="Excel de 3 hojas (Hoja1, EDUCACION, SALUD) con las 9 columnas depuradas y ordenadas"
              >
                📊 Descargar Base 3 Hojas (.xls)
              </a>
              <a
                href="/api/distribucion/descargar/base-depurada-xlsx"
                className="px-3.5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                📊 Base 3 Hojas (.xlsx)
              </a>
              <button
                type="button"
                onClick={() => exportDistribucionContabilidadPDF(resultado.educacion, meta)}
                className="px-3.5 py-2.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                📄 PDF Educación
              </button>
              <button
                type="button"
                onClick={() => exportDistribucionContabilidadPDF(resultado.salud, meta)}
                className="px-3.5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                📄 PDF Salud
              </button>
              <Link
                to="/correo"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                ✉️ Enviar por Correo a Contabilidad
              </Link>
            </div>
          </div>

          {/* Pestañas de Previsualización */}
          <div className="flex flex-wrap gap-2 pt-2 border-b border-[#e2e8f0] pb-2">
            {[
              { id: 'resumen_edu', label: `Informe Distribución EDUCACIÓN (${meta.haberesEducacion} haberes — ${formatCurrencyCLP(meta.montoEducacion)})` },
              { id: 'resumen_sal', label: `Informe Distribución SALUD (${meta.haberesSalud} haberes — ${formatCurrencyCLP(meta.montoSalud)})` },
              { id: 'hoja_edu', label: `Muestra Hoja EDUCACION (9 cols — ${meta.filasEducacion.toLocaleString('es-CL')} filas)` },
              { id: 'hoja_sal', label: `Muestra Hoja SALUD (9 cols — ${meta.filasSalud.toLocaleString('es-CL')} filas)` }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTabActiva(t.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  tabActiva === t.id
                    ? 'bg-[#016098] text-white'
                    : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tabla de Vista Previa */}
          <div className="overflow-x-auto border border-[#e2e8f0] rounded-xl max-h-[420px]">
            {(tabActiva === 'resumen_edu' || tabActiva === 'resumen_sal') && (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#016098] text-white sticky top-0">
                  <tr>
                    <th className="p-2.5">Cód. Haber</th>
                    <th className="p-2.5">Glosa Haber</th>
                    <th className="p-2.5 text-center">Unidad</th>
                    <th className="p-2.5">Nombre Unidad / Establecimiento</th>
                    <th className="p-2.5 text-right">Monto Haber ($)</th>
                    <th className="p-2.5 text-center">Cenco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {(tabActiva === 'resumen_edu' ? resultado.educacion.gruposHaberes : resultado.salud.gruposHaberes).map(
                    (g: any) => (
                      <React.Fragment key={g.codHaber}>
                        <tr className="bg-sky-50 font-bold text-[#016098]">
                          <td colSpan={6} className="py-2 px-3">
                            ({g.codHaber}) {g.glosaHaber} — {g.items.length} unidades
                          </td>
                        </tr>
                        {g.items.map((it: any) => (
                          <tr key={`${g.codHaber}-${it.unidad}`} className="hover:bg-[#f8fafc]">
                            <td className="p-2 text-slate-500">#{g.codHaber}</td>
                            <td className="p-2 font-medium">{g.glosaHaber}</td>
                            <td className="p-2 text-center font-bold text-[#016098]">{it.unidad}</td>
                            <td className="p-2 text-slate-600">{it.nombreUnidad}</td>
                            <td className="p-2 text-right font-semibold">{formatCurrencyCLP(it.montoHaber)}</td>
                            <td className="p-2 text-center font-bold text-emerald-700">
                              {it.cenco || <span className="text-rose-600">SIN CENCO</span>}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-extrabold text-slate-900">
                          <td colSpan={4} className="p-2 text-right">
                            TOTAL {g.glosaHaber}:
                          </td>
                          <td className="p-2 text-right text-[#016098]">{formatCurrencyCLP(g.totalHaber)}</td>
                          <td></td>
                        </tr>
                      </React.Fragment>
                    )
                  )}
                </tbody>
              </table>
            )}

            {(tabActiva === 'hoja_edu' || tabActiva === 'hoja_sal') && (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f1f5f9] text-[#475569] sticky top-0">
                  <tr>
                    <th className="p-2">UNIDAD</th>
                    <th className="p-2">COD. HABER</th>
                    <th className="p-2">RUT</th>
                    <th className="p-2">DV</th>
                    <th className="p-2">PATERNO</th>
                    <th className="p-2">MATERNO</th>
                    <th className="p-2">NOMBRE</th>
                    <th className="p-2">NOMBRE HABER</th>
                    <th className="p-2 text-right">MONTO_HABER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {(tabActiva === 'hoja_edu' ? resultado.muestraDepurada.educacion : resultado.muestraDepurada.salud).map(
                    (r: any, i: number) => (
                      <tr key={i} className="hover:bg-[#f8fafc]">
                        <td className="p-2 font-bold text-[#016098]">{r.unidad}</td>
                        <td className="p-2 font-semibold">{r.codHaber}</td>
                        <td className="p-2">{r.rut}</td>
                        <td className="p-2">{r.dv}</td>
                        <td className="p-2">{r.paterno}</td>
                        <td className="p-2">{r.materno}</td>
                        <td className="p-2">{r.nombre}</td>
                        <td className="p-2 font-medium">{r.glosaHaber}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">{formatCurrencyCLP(r.montoHaber)}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
