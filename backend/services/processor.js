const XLSX = require('xlsx');

const MESES_NOMBRES = [
  '',
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE'
];

/**
 * Detecta índices de columnas tanto para el archivo bruto de 14 columnas
 * como para el archivo ya depurado de 9 columnas.
 */
function detectColumnMapping(headerRow) {
  const norm = (headerRow || []).map(h => String(h || '').trim().toUpperCase());

  const findIdx = (patterns, fallback) => {
    for (const p of patterns) {
      const i = norm.findIndex(col => col === p || col.includes(p));
      if (i !== -1) return i;
    }
    return fallback;
  };

  // Verificar si es formato de 9 columnas (UNIDAD, COD. HABER, RUT, DV, PATERNO, MATERNO, NOMBRE, NOMBRE HABER, MONTO_HABER)
  const is9Cols =
    norm.length >= 9 &&
    norm.length <= 10 &&
    norm[1] &&
    norm[1].includes('HABER');

  if (is9Cols) {
    return {
      formatoOrigen: '9_COLUMNAS_DEPURADO',
      unidadIdx: 0,
      codHaberIdx: 1,
      rutIdx: 2,
      dvIdx: 3,
      paternoIdx: 4,
      maternoIdx: 5,
      nombreIdx: 6,
      glosaHaberIdx: 7,
      montoHaberIdx: 8,
      mesIdx: -1,
      anhoIdx: -1
    };
  }

  // Formato estándar bruto de 14 columnas:
  // UNIDAD | RUT | DV | PATERNO | MATERNO | NOMBRE | COD. HABER | NOMBRE HABER | MONTO_HABER | COD. DESCUENTO | NOMBRE DESCUENTO | MONTO DESCUENTO | MES | ANHO
  return {
    formatoOrigen: '14_COLUMNAS_BRUTO',
    unidadIdx: findIdx(['UNIDAD', 'CODUNID'], 0),
    rutIdx: findIdx(['RUT'], 1),
    dvIdx: findIdx(['DV'], 2),
    paternoIdx: findIdx(['PATERNO'], 3),
    maternoIdx: findIdx(['MATERNO'], 4),
    nombreIdx: findIdx(['NOMBRE'], 5),
    codHaberIdx: findIdx(['COD. HABER', 'COD HABER', 'CODHABER'], 6),
    glosaHaberIdx: findIdx(['NOMBRE HABER', 'GLOSA HABER', 'GLOSAHABER'], 7),
    montoHaberIdx: findIdx(['MONTO_HABER', 'MONTO HABER', 'MONTOHABER'], 8),
    mesIdx: findIdx(['MES'], 12),
    anhoIdx: findIdx(['ANHO', 'AÑO', 'ANO'], 13)
  };
}

function parseNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = String(val).replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Procesa el buffer Excel de Renta aplicando todas las reglas de negocio:
 * 1. Elimina columnas innecesarias (conserva las 9 requeridas).
 * 2. Filtra COD. HABER = 0, NOMBRE HABER vacío y haberes excluidos (Asignación Familiar, Atrasada, Prenatal).
 * 3. Separa en EDUCACION (UNIDAD < 600) y SALUD (UNIDAD >= 600).
 * 4. Agrupa por (CodHaber, GlosaHaber) y (Unidad) y cruza con catálogo Cencos.
 */
function processRentaWorkbook(buffer, { cencosList = [], haberesExcluidosList = [], anioOverride = null, mesOverride = null, fileName = '' } = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (!rawRows || rawRows.length < 2) {
    throw new Error('El archivo Excel está vacío o no contiene filas de datos válidas.');
  }

  const headerRow = rawRows[0];
  const colMap = detectColumnMapping(headerRow);

  // Preparar mapa de Haberes Excluidos activos (normalizados en mayúsculas y sin espacios extremos)
  const excludedSet = new Set(
    (haberesExcluidosList || [])
      .filter(h => h.activo !== false)
      .map(h => String(h.glosa_haber || '').trim().toUpperCase())
  );

  // Preparar mapa de Cencos (Unidad -> { cenco, nombre, sector })
  const cencosMap = new Map();
  for (const c of cencosList || []) {
    cencosMap.set(Number(c.unidad), {
      cenco: c.cenco !== null && c.cenco !== undefined && c.cenco !== '' ? Number(c.cenco) : null,
      nombre: c.nombre || `UNIDAD ${c.unidad}`,
      sector: c.sector || (Number(c.unidad) < 600 ? 'EDUCACION' : 'SALUD')
    });
  }

  let totalFilasBrutas = 0;
  let descartadasCodCero = 0;
  let descartadasNombreBlanco = 0;
  let descartadasExcluidas = 0;
  const desgloseExcluidas = {};

  let detectedMes = mesOverride ? Number(mesOverride) : null;
  let detectedAnio = anioOverride ? Number(anioOverride) : null;

  const validRows = [];

  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length === 0) continue;
    // Ignorar filas completamente vacías al final del archivo
    if (r[colMap.unidadIdx] === '' && r[colMap.rutIdx] === '' && r[colMap.codHaberIdx] === '') {
      continue;
    }

    totalFilasBrutas++;

    const unidad = parseNumber(r[colMap.unidadIdx]);
    const codHaber = parseNumber(r[colMap.codHaberIdx]);
    const glosaHaberRaw = String(r[colMap.glosaHaberIdx] ?? '');
    const glosaHaberClean = glosaHaberRaw.trim().toUpperCase();
    const montoHaber = Math.round(parseNumber(r[colMap.montoHaberIdx]));

    if (!detectedMes && colMap.mesIdx >= 0 && r[colMap.mesIdx]) {
      const mVal = parseNumber(r[colMap.mesIdx]);
      if (mVal >= 1 && mVal <= 12) detectedMes = mVal;
    }
    if (!detectedAnio && colMap.anhoIdx >= 0 && r[colMap.anhoIdx]) {
      const aVal = parseNumber(r[colMap.anhoIdx]);
      if (aVal >= 2000 && aVal <= 2100) detectedAnio = aVal;
    }

    // Regla 1: Eliminar COD. HABER == 0
    if (!codHaber || codHaber === 0) {
      descartadasCodCero++;
      continue;
    }

    // Regla 2: Eliminar NOMBRE HABER en blanco
    if (!glosaHaberClean) {
      descartadasNombreBlanco++;
      continue;
    }

    // Regla 3: Eliminar ASIGNACION FAMILIAR, ASIGNACION ATRASADA, ASIGNACION PRENATAL (y cualquier otro configurado)
    if (excludedSet.has(glosaHaberClean)) {
      descartadasExcluidas++;
      desgloseExcluidas[glosaHaberClean] = (desgloseExcluidas[glosaHaberClean] || 0) + 1;
      continue;
    }

    const rut = parseNumber(r[colMap.rutIdx]);
    const dv = String(r[colMap.dvIdx] ?? '').trim();
    const paterno = String(r[colMap.paternoIdx] ?? '');
    const materno = String(r[colMap.maternoIdx] ?? '');
    const nombre = String(r[colMap.nombreIdx] ?? '');

    validRows.push({
      idxOriginal: i,
      unidad,
      codHaber,
      rut,
      dv,
      paterno,
      materno,
      nombre,
      glosaHaberRaw,
      glosaHaber: glosaHaberClean,
      montoHaber
    });
  }

  // Ordenar por UNIDAD ASC, COD. HABER ASC (manteniendo orden original en empates, igual que Excel)
  validRows.sort((a, b) => {
    if (a.unidad !== b.unidad) return a.unidad - b.unidad;
    if (a.codHaber !== b.codHaber) return a.codHaber - b.codHaber;
    return a.idxOriginal - b.idxOriginal;
  });

  // Separar en EDUCACION (< 600) y SALUD (>= 600)
  const rowsEducacion = validRows.filter(r => r.unidad < 600);
  const rowsSalud = validRows.filter(r => r.unidad >= 600);

  // Construir distribuciones agrupadas para cada sector
  const distEducacion = buildSectorDistribution(rowsEducacion, 'EDUCACION', cencosMap);
  const distSalud = buildSectorDistribution(rowsSalud, 'SALUD', cencosMap);

  const anioFinal = anioOverride ? Number(anioOverride) : (detectedAnio || new Date().getFullYear());
  const mesFinal = mesOverride ? Number(mesOverride) : (detectedMes || (new Date().getMonth() + 1));

  return {
    meta: {
      archivoNombre: fileName,
      hojaLeida: sheetName,
      formatoOrigen: colMap.formatoOrigen,
      anio: anioFinal,
      mes: mesFinal,
      mesNombre: MESES_NOMBRES[mesFinal] || String(mesFinal),
      totalFilasBrutas,
      descartadasCodCero,
      descartadasNombreBlanco,
      descartadasExcluidas,
      desgloseExcluidas,
      filasValidas: validRows.length,
      filasEducacion: rowsEducacion.length,
      filasSalud: rowsSalud.length,
      montoEducacion: distEducacion.totalSector,
      montoSalud: distSalud.totalSector,
      montoTotalCorporacion: distEducacion.totalSector + distSalud.totalSector,
      haberesEducacion: distEducacion.gruposHaberes.length,
      haberesSalud: distSalud.gruposHaberes.length,
      unidadesEducacion: distEducacion.resumenUnidades.length,
      unidadesSalud: distSalud.resumenUnidades.length,
      unidadesSinCenco: [
        ...distEducacion.unidadesSinCenco,
        ...distSalud.unidadesSinCenco
      ]
    },
    educacion: distEducacion,
    salud: distSalud,
    rowsDepuradas: {
      todas: validRows,
      educacion: rowsEducacion,
      salud: rowsSalud
    }
  };
}

function buildSectorDistribution(sectorRows, sectorName, cencosMap) {
  // Agrupar por CodHaber -> Unidad
  const haberesMap = new Map();
  const unidadesMap = new Map();
  const unidadesSinCencoSet = new Set();

  for (const r of sectorRows) {
    const infoCenco = cencosMap.get(r.unidad);
    const cencoVal = infoCenco ? infoCenco.cenco : null;
    const nombreUnidad = infoCenco ? infoCenco.nombre : `UNIDAD ${r.unidad}`;

    if (!cencoVal) {
      unidadesSinCencoSet.add(r.unidad);
    }

    // 1. Agrupación por Haber -> Unidad (Informe principal de Contabilidad)
    if (!haberesMap.has(r.codHaber)) {
      haberesMap.set(r.codHaber, {
        codHaber: r.codHaber,
        glosaHaber: r.glosaHaber,
        totalHaber: 0,
        cantidadRegistros: 0,
        unidadesMap: new Map()
      });
    }
    const hGroup = haberesMap.get(r.codHaber);
    hGroup.totalHaber += r.montoHaber;
    hGroup.cantidadRegistros += 1;

    if (!hGroup.unidadesMap.has(r.unidad)) {
      hGroup.unidadesMap.set(r.unidad, {
        unidad: r.unidad,
        nombreUnidad,
        cenco: cencoVal,
        codHaber: r.codHaber,
        glosaHaber: r.glosaHaber,
        montoHaber: 0,
        cantidadFuncionarios: 0,
        funcionarios: []
      });
    }
    const uItem = hGroup.unidadesMap.get(r.unidad);
    uItem.montoHaber += r.montoHaber;
    uItem.cantidadFuncionarios += 1;
    uItem.funcionarios.push({
      rut: `${r.rut}-${r.dv}`,
      nombreCompleto: `${r.paterno.trim()} ${r.materno.trim()} ${r.nombre.trim()}`.trim(),
      monto: r.montoHaber
    });

    // 2. Agrupación por Unidad / Cenco (Vista ejecutiva por Establecimiento)
    if (!unidadesMap.has(r.unidad)) {
      unidadesMap.set(r.unidad, {
        unidad: r.unidad,
        nombreUnidad,
        cenco: cencoVal,
        sector: sectorName,
        totalUnidad: 0,
        cantidadRegistros: 0,
        rutsUnicos: new Set(),
        haberes: []
      });
    }
    const uSummary = unidadesMap.get(r.unidad);
    uSummary.totalUnidad += r.montoHaber;
    uSummary.cantidadRegistros += 1;
    uSummary.rutsUnicos.add(r.rut);
  }

  // Convertir haberesMap a arreglo ordenado por CodHaber ASC
  const gruposHaberes = Array.from(haberesMap.values())
    .sort((a, b) => a.codHaber - b.codHaber)
    .map(g => {
      const items = Array.from(g.unidadesMap.values()).sort((a, b) => a.unidad - b.unidad);
      return {
        codHaber: g.codHaber,
        glosaHaber: g.glosaHaber,
        totalHaber: g.totalHaber,
        cantidadRegistros: g.cantidadRegistros,
        cantidadUnidades: items.length,
        items
      };
    });

  // Convertir unidadesMap a arreglo ordenado por Unidad ASC
  const resumenUnidades = Array.from(unidadesMap.values())
    .sort((a, b) => a.unidad - b.unidad)
    .map(u => ({
      unidad: u.unidad,
      nombreUnidad: u.nombreUnidad,
      cenco: u.cenco,
      sector: u.sector,
      totalUnidad: u.totalUnidad,
      cantidadRegistros: u.cantidadRegistros,
      cantidadFuncionarios: u.rutsUnicos.size
    }));

  const totalSector = gruposHaberes.reduce((acc, g) => acc + g.totalHaber, 0);

  return {
    sector: sectorName,
    totalSector,
    totalRegistros: sectorRows.length,
    gruposHaberes,
    resumenUnidades,
    unidadesSinCenco: Array.from(unidadesSinCencoSet).map(u => ({
      unidad: u,
      sector: sectorName,
      nombre: cencosMap.get(u)?.nombre || `UNIDAD ${u}`
    }))
  };
}

/**
 * Construye el archivo Excel de Informe de Distribución para Contabilidad
 * respetando exactamente la estructura de filas y columnas de Crystal Reports
 * (`distribución_educacion.xls` y `distribucion_salud.xls`), además de una segunda
 * hoja tabular (`Resumen_Contabilidad`) para facilitar tablas dinámicas en Contabilidad.
 */
function buildContabilidadExcelBuffer(sectorDist, { anio, mes, bookType = 'xls' } = {}) {
  const aoa = [];
  const emptyRow = () => ['', '', '', '', '', '', '', '', '', '', '', '', '', ''];

  // Filas 0 a 5 en blanco
  for (let i = 0; i < 6; i++) aoa.push(emptyRow());

  // Fila 6: Título
  const r6 = emptyRow();
  r6[5] = 'DISTRIBUCION DE REMUNERACIONES';
  aoa.push(r6);

  // Fila 7 en blanco
  aoa.push(emptyRow());

  // Fila 8: Sector
  const r8 = emptyRow();
  r8[5] = `SECTOR ${sectorDist.sector}`;
  aoa.push(r8);

  // Fila 9: Fecha Impresión
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const r9 = emptyRow();
  r9[8] = 'Fecha Impresión';
  r9[10] = `${dd}/${mm}/${yyyy}`;
  aoa.push(r9);

  // Filas 10, 11, 12 en blanco
  aoa.push(emptyRow());
  aoa.push(emptyRow());
  aoa.push(emptyRow());

  // Fila 13: Encabezados de columnas
  const r13 = emptyRow();
  r13[2] = 'GlosaHaber';
  r13[6] = 'Unidad';
  r13[7] = 'MontoHaber';
  r13[9] = 'Cenco';
  aoa.push(r13);

  // Filas 14, 15 en blanco
  aoa.push(emptyRow());
  aoa.push(emptyRow());

  // Bloques por cada Haber
  for (const grupo of sectorDist.gruposHaberes) {
    // Encabezado del Haber
    const rHeader = emptyRow();
    rHeader[0] = grupo.glosaHaber;
    aoa.push(rHeader);

    // Filas de detalle por Unidad
    for (const item of grupo.items) {
      const rItem = emptyRow();
      rItem[2] = grupo.glosaHaber;
      rItem[6] = item.unidad;
      rItem[8] = item.montoHaber;
      rItem[9] = item.cenco !== null && item.cenco !== undefined ? item.cenco : '';
      aoa.push(rItem);
    }

    // Línea en blanco antes del subtotal
    aoa.push(emptyRow());

    // Fila TOTAL del Haber
    const rTot = emptyRow();
    rTot[3] = 'TOTAL';
    rTot[4] = grupo.glosaHaber;
    rTot[8] = grupo.totalHaber;
    aoa.push(rTot);

    // Dos líneas en blanco entre grupos
    aoa.push(emptyRow());
    aoa.push(emptyRow());
  }

  // Fila Monto Total Remuneraciones
  const rGrand = emptyRow();
  rGrand[4] = 'Monto Total Remuneraciones';
  rGrand[8] = sectorDist.totalSector;
  aoa.push(rGrand);

  aoa.push(emptyRow());
  aoa.push(emptyRow());

  const rPage = emptyRow();
  rPage[9] = 'Página';
  rPage[10] = 1;
  rPage[11] = 'de';
  rPage[12] = 1;
  aoa.push(rPage);

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(aoa);
  ws1['!cols'] = [
    { wch: 28 },
    { wch: 4 },
    { wch: 28 },
    { wch: 10 },
    { wch: 28 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1');

  return XLSX.write(wb, { type: 'buffer', bookType });
}

/**
 * Construye el libro Excel intermedio de 3 hojas (`Hoja1`, `EDUCACION`, `SALUD`)
 * con las 9 columnas exactas (`septiembre 2026 renta 2.xls`).
 */
function buildBaseDepuradaExcelBuffer(rowsDepuradas, { bookType = 'xlsx' } = {}) {
  const header9 = [
    'UNIDAD',
    '  COD. HABER',
    '         RUT',
    'DV',
    'PATERNO        ',
    'MATERNO        ',
    'NOMBRE              ',
    'NOMBRE HABER                  ',
    ' MONTO_HABER'
  ];

  const toAoa = list => {
    const aoa = [header9];
    for (const r of list) {
      aoa.push([
        r.unidad,
        r.codHaber,
        r.rut,
        r.dv,
        r.paterno,
        r.materno,
        r.nombre,
        r.glosaHaberRaw || r.glosaHaber,
        r.montoHaber
      ]);
    }
    return aoa;
  };

  const wb = XLSX.utils.book_new();
  const wsAll = XLSX.utils.aoa_to_sheet(toAoa(rowsDepuradas.todas));
  const wsEdu = XLSX.utils.aoa_to_sheet(toAoa(rowsDepuradas.educacion));
  const wsSal = XLSX.utils.aoa_to_sheet(toAoa(rowsDepuradas.salud));

  XLSX.utils.book_append_sheet(wb, wsAll, 'Hoja1');
  XLSX.utils.book_append_sheet(wb, wsEdu, 'EDUCACION');
  XLSX.utils.book_append_sheet(wb, wsSal, 'SALUD');

  return XLSX.write(wb, { type: 'buffer', bookType });
}

/**
 * Construye una versión liviana del resultado (sin el listado individual de los 44.462 RUTs)
 * para almacenarla en la columna JSONB de historial en PostgreSQL y en el store local.
 */
function stripHeavyDetailsForStorage(processedResult) {
  const stripSector = sec => ({
    sector: sec.sector,
    totalSector: sec.totalSector,
    totalRegistros: sec.totalRegistros,
    unidadesSinCenco: sec.unidadesSinCenco,
    resumenUnidades: sec.resumenUnidades,
    gruposHaberes: sec.gruposHaberes.map(g => ({
      codHaber: g.codHaber,
      glosaHaber: g.glosaHaber,
      totalHaber: g.totalHaber,
      cantidadRegistros: g.cantidadRegistros,
      cantidadUnidades: g.cantidadUnidades,
      items: g.items.map(it => ({
        unidad: it.unidad,
        nombreUnidad: it.nombreUnidad,
        cenco: it.cenco,
        codHaber: it.codHaber,
        glosaHaber: it.glosaHaber,
        montoHaber: it.montoHaber,
        cantidadFuncionarios: it.cantidadFuncionarios
      }))
    }))
  });

  return {
    meta: processedResult.meta,
    educacion: stripSector(processedResult.educacion),
    salud: stripSector(processedResult.salud)
  };
}

module.exports = {
  MESES_NOMBRES,
  processRentaWorkbook,
  buildContabilidadExcelBuffer,
  buildBaseDepuradaExcelBuffer,
  stripHeavyDetailsForStorage
};
