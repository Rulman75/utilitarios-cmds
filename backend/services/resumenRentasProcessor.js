const XLSX = require('xlsx');
const zlib = require('zlib');

const MESES_NOMBRES = {
  1: 'ENERO',
  2: 'FEBRERO',
  3: 'MARZO',
  4: 'ABRIL',
  5: 'MAYO',
  6: 'JUNIO',
  7: 'JULIO',
  8: 'AGOSTO',
  9: 'SEPTIEMBRE',
  10: 'OCTUBRE',
  11: 'NOVIEMBRE',
  12: 'DICIEMBRE'
};

const CONSULTAS_DEF = [
  {
    key: 'Docentes',
    fileName: 'Docentes.xlsx',
    sheetName: 'Docentes',
    label: 'Docentes (Educación < 600, Planta 1 o 2)',
    sector: 'EDUCACION'
  },
  {
    key: 'NoDocentes',
    fileName: 'NoDocentes.xlsx',
    sheetName: 'NoDocentes',
    label: 'No Docentes (Educación < 600, Planta > 2)',
    sector: 'EDUCACION'
  },
  {
    key: 'Salud_600al607',
    fileName: 'Salud 600al607.xlsx',
    sheetName: 'Salud_600al607',
    label: 'Salud 600 al 607',
    sector: 'SALUD'
  },
  {
    key: 'Salud_608al609',
    fileName: 'Salud 608al609.xlsx',
    sheetName: 'Salud_608al609',
    label: 'Salud 608 al 609',
    sector: 'SALUD'
  },
  {
    key: 'Salud_610',
    fileName: 'Salud 610.xlsx',
    sheetName: 'Salud_610',
    label: 'Salud 610 (610 al 619)',
    sector: 'SALUD'
  },
  {
    key: 'Salud_620',
    fileName: 'Salud 620.xlsx',
    sheetName: 'Salud_620',
    label: 'Salud 620',
    sector: 'SALUD'
  }
];

function normalizeHeader(str) {
  return String(str || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val).replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lee cualquier archivo Excel (.xlsx, .xls) o CSV (separado por ; o ,) y devuelve las filas como objetos
 */
function readAnySpreadsheet(buffer, fileName = '') {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = buffer.toString('latin1');
    const firstLine = text.split(/\r?\n/)[0] || '';
    const sep = firstLine.includes(';') ? ';' : ',';
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(sep);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(sep);
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = vals[c] !== undefined ? vals[c] : null;
      }
      rows.push(obj);
    }
    return rows;
  }

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName =
    wb.SheetNames.find(n => normalizeHeader(n) === 'HOJA1') ||
    wb.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
}

/**
 * Extrae y depura la planilla de Personal dejándola en las 8 columnas requeridas:
 * NOMBRE_SUCURSAL | CODIGO | RUT EMPLEADO | DV | PATERNO | MATERNO | NOMBRE | PLANTA
 */
function extractPersonalDepurado(buffer, fileName = '') {
  const rawRows = readAnySpreadsheet(buffer, fileName);
  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo de Personal está vacío o no contiene registros.');
  }

  const firstRowKeys = Object.keys(rawRows[0]);
  const keyMap = {};
  for (const k of firstRowKeys) {
    const norm = normalizeHeader(k);
    if (norm === 'NOMBRE SUCURSAL' || norm === 'SUCURSAL') keyMap.nombreSucursal = k;
    else if (norm === 'CODIGO' || norm === 'UNIDAD') keyMap.codigo = k;
    else if (norm === 'RUT EMPLEADO' || norm === 'RUT') keyMap.rutEmpleado = k;
    else if (norm === 'DV') keyMap.dv = k;
    else if (norm === 'PATERNO' || norm === 'APELLIDO PATERNO') keyMap.paterno = k;
    else if (norm === 'MATERNO' || norm === 'APELLIDO MATERNO') keyMap.materno = k;
    else if (norm === 'NOMBRE' || norm === 'NOMBRES') keyMap.nombre = k;
    else if (norm === 'PLANTA') keyMap.planta = k;
  }

  if (!keyMap.rutEmpleado || !keyMap.codigo || !keyMap.planta) {
    throw new Error(
      `El archivo de Personal no contiene las columnas obligatorias (CODIGO, RUT EMPLEADO, PLANTA). Columnas detectadas: ${firstRowKeys.join(', ')}`
    );
  }

  const rowsDepuradas = [];
  for (const r of rawRows) {
    const rut = parseNum(r[keyMap.rutEmpleado]);
    const codigo = parseNum(r[keyMap.codigo]);
    if (!rut || !codigo) continue;

    rowsDepuradas.push({
      NOMBRE_SUCURSAL: String(keyMap.nombreSucursal ? r[keyMap.nombreSucursal] ?? '' : '').trim(),
      CODIGO: codigo,
      'RUT EMPLEADO': rut,
      DV: String(keyMap.dv ? r[keyMap.dv] ?? '' : '').trim(),
      PATERNO: String(keyMap.paterno ? r[keyMap.paterno] ?? '' : '').trim(),
      MATERNO: String(keyMap.materno ? r[keyMap.materno] ?? '' : '').trim(),
      NOMBRE: String(keyMap.nombre ? r[keyMap.nombre] ?? '' : '').trim(),
      PLANTA: parseNum(r[keyMap.planta])
    });
  }

  return {
    totalFilasBrutas: rawRows.length,
    totalColumnasOriginales: firstRowKeys.length,
    filasValidas: rowsDepuradas.length,
    rows: rowsDepuradas
  };
}

/**
 * Extrae y depura la planilla de Renta dejándola en las 6 columnas requeridas:
 * UNIDAD | RUT | DV | COD. HABER | NOMBRE HABER | MONTO_HABER
 * (Elimina únicamente registros con COD. HABER == 0 o sin código de haber)
 */
function extractRentaDepurada(buffer, fileName = '') {
  const rawRows = readAnySpreadsheet(buffer, fileName);
  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo de Renta está vacío o no contiene registros.');
  }

  const firstRowKeys = Object.keys(rawRows[0]);
  const keyMap = {};
  for (const k of firstRowKeys) {
    const norm = normalizeHeader(k);
    if (norm === 'UNIDAD' || norm === 'CODIGO') keyMap.unidad = k;
    else if (norm === 'RUT' || norm === 'RUT EMPLEADO') keyMap.rut = k;
    else if (norm === 'DV') keyMap.dv = k;
    else if (norm === 'COD HABER' || norm === 'CODHABER' || norm === 'CODIGO HABER') keyMap.codHaber = k;
    else if (norm === 'NOMBRE HABER' || norm === 'GLOSA HABER') keyMap.nombreHaber = k;
    else if (norm === 'MONTO HABER' || norm === 'MONTO') keyMap.montoHaber = k;
  }

  if (!keyMap.rut || !keyMap.codHaber || !keyMap.montoHaber) {
    throw new Error(
      `El archivo de Renta no contiene las columnas obligatorias (UNIDAD, RUT, COD. HABER, MONTO_HABER). Columnas detectadas: ${firstRowKeys.join(', ')}`
    );
  }

  const rowsDepuradas = [];
  let descartadasCodCero = 0;

  for (const r of rawRows) {
    const codHaber = parseNum(r[keyMap.codHaber]);
    if (!codHaber || codHaber <= 0) {
      descartadasCodCero++;
      continue;
    }
    const nombreHaber = String(keyMap.nombreHaber ? r[keyMap.nombreHaber] ?? '' : '').trim();
    if (!nombreHaber) {
      descartadasCodCero++;
      continue;
    }

    rowsDepuradas.push({
      UNIDAD: parseNum(keyMap.unidad ? r[keyMap.unidad] : 0),
      RUT: parseNum(r[keyMap.rut]),
      DV: String(keyMap.dv ? r[keyMap.dv] ?? '' : '').trim(),
      'COD. HABER': codHaber,
      'NOMBRE HABER': nombreHaber,
      MONTO_HABER: Math.round(parseNum(r[keyMap.montoHaber]))
    });
  }

  return {
    totalFilasBrutas: rawRows.length,
    totalColumnasOriginales: firstRowKeys.length,
    descartadasCodCero,
    filasValidas: rowsDepuradas.length,
    rows: rowsDepuradas
  };
}

/**
 * Procesa Personal + Renta y ejecuta el INNER JOIN exacto de Año 2026.mdb
 * para generar las 6 consultas oficiales.
 */
function processResumenRentas(personalBuffer, rentaBuffer, options = {}) {
  const {
    anio = new Date().getFullYear(),
    mes = 9,
    personalFileName = 'personal.xlsx',
    rentaFileName = 'renta.xlsx'
  } = options;

  const personalInfo = extractPersonalDepurado(personalBuffer, personalFileName);
  const rentaInfo = extractRentaDepurada(rentaBuffer, rentaFileName);

  // Indexar Hoja1 (Personal) por [RUT EMPLEADO]
  const persByRut = new Map();
  for (const p of personalInfo.rows) {
    const rut = p['RUT EMPLEADO'];
    if (!persByRut.has(rut)) persByRut.set(rut, []);
    persByRut.get(rut).push(p);
  }

  // INNER JOIN Hoja1 ON Hoja1.[RUT EMPLEADO] = Hoja2.RUT
  const joinedRows = [];
  let sinCrucePersonal = 0;

  for (const r2 of rentaInfo.rows) {
    const matches = persByRut.get(r2.RUT);
    if (!matches || matches.length === 0) {
      sinCrucePersonal++;
      continue;
    }
    for (const p of matches) {
      joinedRows.push({
        CODIGO: p.CODIGO,
        'RUT EMPLEADO': p['RUT EMPLEADO'],
        PATERNO: p.PATERNO,
        MATERNO: p.MATERNO,
        NOMBRE: p.NOMBRE,
        PLANTA: p.PLANTA,
        CODHABER: r2['COD. HABER'],
        'NOMBRE HABER': r2['NOMBRE HABER'],
        MONTO_HABER: r2.MONTO_HABER
      });
    }
  }

  // Clasificar en las 6 consultas de Año 2026.mdb
  const consultas = {
    Docentes: joinedRows.filter(x => x.CODIGO < 600 && (x.PLANTA === 1 || x.PLANTA === 2)),
    NoDocentes: joinedRows.filter(x => x.CODIGO < 600 && x.PLANTA > 2),
    Salud_600al607: joinedRows.filter(x => x.CODIGO >= 600 && x.CODIGO < 608),
    Salud_608al609: joinedRows.filter(x => x.CODIGO >= 608 && x.CODIGO < 610),
    Salud_610: joinedRows.filter(x => x.CODIGO >= 610 && x.CODIGO < 620),
    Salud_620: joinedRows.filter(x => x.CODIGO >= 620 && x.CODIGO < 621)
  };

  const resumenConsultas = CONSULTAS_DEF.map(def => {
    const rows = consultas[def.key] || [];
    const montoTotal = rows.reduce((acc, r) => acc + r.MONTO_HABER, 0);
    const rutsUnicos = new Set(rows.map(r => r['RUT EMPLEADO'])).size;
    return {
      key: def.key,
      fileName: def.fileName,
      sheetName: def.sheetName,
      label: def.label,
      sector: def.sector,
      filas: rows.length,
      funcionariosUnicos: rutsUnicos,
      montoTotal
    };
  });

  const totalMontoEducacion =
    resumenConsultas.filter(c => c.sector === 'EDUCACION').reduce((a, b) => a + b.montoTotal, 0);
  const totalMontoSalud =
    resumenConsultas.filter(c => c.sector === 'SALUD').reduce((a, b) => a + b.montoTotal, 0);
  const totalFilasConsultas =
    resumenConsultas.reduce((a, b) => a + b.filas, 0);

  const mesNum = Number(mes) || 9;
  const anioNum = Number(anio) || 2026;
  const trimestre = Math.ceil(mesNum / 3);

  return {
    meta: {
      anio: anioNum,
      mes: mesNum,
      mesNombre: MESES_NOMBRES[mesNum] || String(mesNum),
      trimestre,
      zipFileName: `${String(mesNum).padStart(2, '0')}_${anioNum}.zip`,
      personalArchivo: personalFileName,
      rentaArchivo: rentaFileName,
      personalFilasBrutas: personalInfo.totalFilasBrutas,
      personalColumnasOrig: personalInfo.totalColumnasOriginales,
      personalFilasValidas: personalInfo.filasValidas,
      rentaFilasBrutas: rentaInfo.totalFilasBrutas,
      rentaColumnasOrig: rentaInfo.totalColumnasOriginales,
      rentaDescartadasCero: rentaInfo.descartadasCodCero,
      rentaFilasValidas: rentaInfo.filasValidas,
      sinCrucePersonal,
      totalFilasConsultas,
      totalMontoEducacion,
      totalMontoSalud,
      totalMontoGeneral: totalMontoEducacion + totalMontoSalud
    },
    resumenConsultas,
    consultas,
    personalDepurado: personalInfo.rows,
    rentaDepurada: rentaInfo.rows
  };
}

/**
 * Construye un archivo .xlsx para una de las 6 consultas (incluso si tiene 0 filas, incluye los encabezados igual que Access)
 */
function buildConsultaExcelBuffer(rows, sheetName = 'Hoja1') {
  const headers = [
    'CODIGO',
    'RUT EMPLEADO',
    'PATERNO',
    'MATERNO',
    'NOMBRE',
    'PLANTA',
    'CODHABER',
    'NOMBRE HABER',
    'MONTO_HABER'
  ];
  const wb = XLSX.utils.book_new();
  const ws =
    rows && rows.length > 0
      ? XLSX.utils.json_to_sheet(rows, { header: headers })
      : XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = [
    { wch: 10 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 26 },
    { wch: 10 },
    { wch: 12 },
    { wch: 30 },
    { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function buildPersonalDepuradoExcelBuffer(rows) {
  const headers = [
    'NOMBRE_SUCURSAL',
    'CODIGO',
    'RUT EMPLEADO',
    'DV',
    'PATERNO',
    'MATERNO',
    'NOMBRE',
    'PLANTA'
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows || [], { header: headers });
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function buildRentaDepurada6ColExcelBuffer(rows) {
  const headers = [
    'UNIDAD',
    'RUT',
    'DV',
    'COD. HABER',
    'NOMBRE HABER',
    'MONTO_HABER'
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows || [], { header: headers });
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ---------------------------------------------------------------------------
// GENERADOR NATIVO DE ARCHIVOS .ZIP EN MEMORIA (ESTÁNDAR PKZIP + ZLIB)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Empaqueta un arreglo de { name: string, data: Buffer } en un Buffer .zip estándar
 */
function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawData = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const compressed = zlib.deflateRawSync(rawData);
    const crc = crc32(rawData);

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);         // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // UTF-8 flag
    localHeader.writeUInt16LE(8, 8);          // Compression method: Deflate (8)
    localHeader.writeUInt16LE(0, 10);         // Mod time
    localHeader.writeUInt16LE(0x596a, 12);    // Mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    // Central directory header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by
    centralHeader.writeUInt16LE(20, 6);         // Version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // UTF-8 flag
    centralHeader.writeUInt16LE(8, 10);         // Compression method: Deflate
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x596a, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

/**
 * Construye el archivo MM_YYYY.zip oficial con los 6 archivos .xlsx adentro
 */
function buildResumenMensualZipBuffer(processed) {
  const entries = CONSULTAS_DEF.map(def => {
    const rows = processed.consultas[def.key] || [];
    const xlsxBuf = buildConsultaExcelBuffer(rows, def.sheetName);
    return {
      name: def.fileName,
      data: xlsxBuf
    };
  });
  return createZipBuffer(entries);
}

module.exports = {
  CONSULTAS_DEF,
  MESES_NOMBRES,
  processResumenRentas,
  buildConsultaExcelBuffer,
  buildPersonalDepuradoExcelBuffer,
  buildRentaDepurada6ColExcelBuffer,
  buildResumenMensualZipBuffer,
  createZipBuffer
};
