const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const db = require('./db');
const {
  MESES_NOMBRES,
  processRentaWorkbook,
  buildContabilidadExcelBuffer,
  buildBaseDepuradaExcelBuffer,
  stripHeavyDetailsForStorage
} = require('./services/processor');
const {
  CONSULTAS_DEF,
  processResumenRentas,
  buildConsultaExcelBuffer,
  buildPersonalDepuradoExcelBuffer,
  buildRentaDepurada6ColExcelBuffer,
  buildResumenMensualZipBuffer,
  createZipBuffer
} = require('./services/resumenRentasProcessor');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 }
});

// Caché en memoria de la última sesión procesada (incluye los 44.462 registros detallados para drill-down y descarga de 3 hojas)
let lastProcessedSession = null;
let lastResumenRentasSession = null;

// Servir frontend compilado
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { dotfiles: 'allow' }));

const PORT = process.env.PORT || 3005;

// ---------------------------------------------------------------------------
// 1. VERSIÓN Y ESTADO DE SALUD
// ---------------------------------------------------------------------------
app.get('/api/version', (req, res) => {
  try {
    delete require.cache[require.resolve('./package.json')];
    const pkg = require('./package.json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      status: 'ok',
      version: pkg.version || '1.0.0',
      system: 'Utilitarios TI CMDS — Corporación Municipal de Desarrollo Social'
    });
  } catch (e) {
    res.json({ status: 'ok', version: '1.0.0' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const pgPool = await db.getPgPool();
    res.json({
      status: 'ok',
      dbEngine: pgPool ? 'PostgreSQL Centralizado (192.168.30.47) + Respaldo Local' : 'Modo Local Autónomo',
      pgConnected: Boolean(pgPool)
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ---------------------------------------------------------------------------
// 2. AUTENTICACIÓN CORPORATIVA CMDS
// ---------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'Usuario y contraseña requeridos' });
  }
  try {
    const user = await db.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Credenciales inválidas' });
    }
    const token = jwt.sign(
      { username: user.Usuario, tipo: user.Tipo || 'A', unidad: user.Unidad || 'DAF' },
      process.env.JWT_SECRET || 'super_secret_jwt_key_cmds',
      { expiresIn: '12h' }
    );
    res.json({ status: 'ok', token, user });
  } catch (e) {
    console.error('[Auth] Error:', e);
    res.status(500).json({ status: 'error', message: 'Error interno al autenticar' });
  }
});

// ---------------------------------------------------------------------------
// 3. DASHBOARD Y ESTADÍSTICAS EJECUTIVAS
// ---------------------------------------------------------------------------
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const yearFilter = req.query.year ? Number(req.query.year) : null;
    const allPeriodos = await db.getPeriodos();
    const cencos = await db.getCencos();
    const haberesExcluidos = await db.getHaberesExcluidos();

    const filteredPeriodos = yearFilter
      ? allPeriodos.filter(p => Number(p.anio) === yearFilter)
      : allPeriodos;

    const totalMontoEducacion = filteredPeriodos.reduce((acc, p) => acc + Number(p.monto_educacion || 0), 0);
    const totalMontoSalud = filteredPeriodos.reduce((acc, p) => acc + Number(p.monto_salud || 0), 0);
    const totalMontoCorporacion = totalMontoEducacion + totalMontoSalud;
    const totalFilasValidas = filteredPeriodos.reduce((acc, p) => acc + Number(p.filas_validas || 0), 0);
    const totalFilasBrutas = filteredPeriodos.reduce((acc, p) => acc + Number(p.total_filas_brutas || 0), 0);
    const totalFilasDescartadas = filteredPeriodos.reduce(
      (acc, p) => acc + Number(p.filas_descartadas_cero || 0) + Number(p.filas_descartadas_excluidas || 0),
      0
    );

    // Último período disponible para rankings detallados
    const ultimoPeriodoHeader = filteredPeriodos[0] || allPeriodos[0] || null;
    let ultimoDetalle = null;
    if (ultimoPeriodoHeader) {
      ultimoDetalle = await db.getPeriodoDetalle(ultimoPeriodoHeader.anio, ultimoPeriodoHeader.mes);
    }

    const resumenUltimo = ultimoDetalle?.resumen_json || (lastProcessedSession ? stripHeavyDetailsForStorage(lastProcessedSession) : null);

    // Top Haberes y Top Unidades del último período
    let topHaberesEducacion = [];
    let topHaberesSalud = [];
    let topUnidadesEducacion = [];
    let topUnidadesSalud = [];

    if (resumenUltimo) {
      topHaberesEducacion = [...(resumenUltimo.educacion?.gruposHaberes || [])]
        .sort((a, b) => b.totalHaber - a.totalHaber)
        .slice(0, 10);
      topHaberesSalud = [...(resumenUltimo.salud?.gruposHaberes || [])]
        .sort((a, b) => b.totalHaber - a.totalHaber)
        .slice(0, 10);
      topUnidadesEducacion = [...(resumenUltimo.educacion?.resumenUnidades || [])]
        .sort((a, b) => b.totalUnidad - a.totalUnidad)
        .slice(0, 10);
      topUnidadesSalud = [...(resumenUltimo.salud?.resumenUnidades || [])]
        .sort((a, b) => b.totalUnidad - a.totalUnidad)
        .slice(0, 10);
    }

    // Evolución mensual ordenada cronológicamente
    const evolucion = [...filteredPeriodos]
      .sort((a, b) => (a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes))
      .map(p => ({
        periodo: `${(MESES_NOMBRES[p.mes] || String(p.mes)).slice(0, 3)} ${p.anio}`,
        anio: p.anio,
        mes: p.mes,
        mesNombre: MESES_NOMBRES[p.mes] || String(p.mes),
        Educacion: Number(p.monto_educacion || 0),
        Salud: Number(p.monto_salud || 0),
        Total: Number(p.monto_educacion || 0) + Number(p.monto_salud || 0),
        RegistrosEducacion: Number(p.filas_educacion || 0),
        RegistrosSalud: Number(p.filas_salud || 0),
        RegistrosValidas: Number(p.filas_validas || 0)
      }));

    const cencosSinAsignar = cencos.filter(c => !c.cenco);

    res.json({
      status: 'ok',
      data: {
        totalPeriodos: filteredPeriodos.length,
        totalMontoEducacion,
        totalMontoSalud,
        totalMontoCorporacion,
        totalFilasValidas,
        totalFilasBrutas,
        totalFilasDescartadas,
        totalCencos: cencos.length,
        cencosEducacion: cencos.filter(c => c.unidad < 600).length,
        cencosSalud: cencos.filter(c => c.unidad >= 600).length,
        cencosSinAsignar: cencosSinAsignar.length,
        haberesExcluidosActivos: haberesExcluidos.filter(h => h.activo !== false).length,
        ultimoPeriodo: ultimoPeriodoHeader
          ? {
              ...ultimoPeriodoHeader,
              mesNombre: MESES_NOMBRES[ultimoPeriodoHeader.mes] || String(ultimoPeriodoHeader.mes)
            }
          : null,
        evolucion,
        topHaberesEducacion,
        topHaberesSalud,
        topUnidadesEducacion,
        topUnidadesSalud,
        periodosRecientes: allPeriodos.slice(0, 12).map(p => ({
          ...p,
          mesNombre: MESES_NOMBRES[p.mes] || String(p.mes)
        }))
      }
    });
  } catch (e) {
    console.error('[Dashboard] Error:', e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ---------------------------------------------------------------------------
// 4. PREVISUALIZACIÓN, PROCESAMIENTO Y GUARDADO DE DISTRIBUCIÓN MENSUAL
// ---------------------------------------------------------------------------
app.post('/api/distribucion/previsualizar', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', error: 'Debe adjuntar un archivo Excel (.xlsx o .xls) de Renta.' });
    }
    const anio = req.body.anio ? Number(req.body.anio) : null;
    const mes = req.body.mes ? Number(req.body.mes) : null;

    const cencosList = await db.getCencos();
    const haberesExcluidosList = await db.getHaberesExcluidos();

    const processed = processRentaWorkbook(req.file.buffer, {
      cencosList,
      haberesExcluidosList,
      anioOverride: anio,
      mesOverride: mes,
      fileName: req.file.originalname
    });

    // Guardar en caché de sesión activa
    lastProcessedSession = processed;

    // Verificar si el período ya existe en historial
    const existente = await db.getPeriodoDetalle(processed.meta.anio, processed.meta.mes);

    res.json({
      status: 'ok',
      periodoYaExiste: Boolean(existente),
      meta: processed.meta,
      educacion: stripHeavyDetailsForStorage(processed).educacion,
      salud: stripHeavyDetailsForStorage(processed).salud,
      muestraDepurada: {
        todas: processed.rowsDepuradas.todas.slice(0, 60),
        educacion: processed.rowsDepuradas.educacion.slice(0, 60),
        salud: processed.rowsDepuradas.salud.slice(0, 60)
      }
    });
  } catch (e) {
    console.error('[Previsualizar] Error:', e);
    res.status(400).json({ status: 'error', error: e.message || 'Error al procesar el archivo Excel' });
  }
});

app.post('/api/distribucion/guardar-periodo', upload.single('archivo'), async (req, res) => {
  try {
    let processed = lastProcessedSession;

    // Si envían el archivo nuevamente o no hay sesión activa, procesarlo
    if (req.file) {
      const anio = req.body.anio ? Number(req.body.anio) : null;
      const mes = req.body.mes ? Number(req.body.mes) : null;
      const cencosList = await db.getCencos();
      const haberesExcluidosList = await db.getHaberesExcluidos();
      processed = processRentaWorkbook(req.file.buffer, {
        cencosList,
        haberesExcluidosList,
        anioOverride: anio,
        mesOverride: mes,
        fileName: req.file.originalname
      });
      lastProcessedSession = processed;
    } else if (processed && (req.body.anio || req.body.mes)) {
      if (req.body.anio) processed.meta.anio = Number(req.body.anio);
      if (req.body.mes) {
        processed.meta.mes = Number(req.body.mes);
        processed.meta.mesNombre = MESES_NOMBRES[processed.meta.mes] || String(processed.meta.mes);
      }
    }

    if (!processed) {
      return res.status(400).json({ status: 'error', error: 'No hay una distribución activa para guardar. Suba y valide primero el archivo.' });
    }

    const stripped = stripHeavyDetailsForStorage(processed);
    const saved = await db.savePeriodo({
      anio: processed.meta.anio,
      mes: processed.meta.mes,
      archivo_nombre: processed.meta.archivoNombre,
      total_filas_brutas: processed.meta.totalFilasBrutas,
      filas_descartadas_cero: processed.meta.descartadasCodCero + processed.meta.descartadasNombreBlanco,
      filas_descartadas_excluidas: processed.meta.descartadasExcluidas,
      filas_validas: processed.meta.filasValidas,
      filas_educacion: processed.meta.filasEducacion,
      filas_salud: processed.meta.filasSalud,
      monto_educacion: processed.meta.montoEducacion,
      monto_salud: processed.meta.montoSalud,
      haberes_educacion: processed.meta.haberesEducacion,
      haberes_salud: processed.meta.haberesSalud,
      resumen_json: stripped,
      usuario: req.body.usuario || 'admin'
    });

    res.json({
      status: 'ok',
      message: `Distribución de ${MESES_NOMBRES[saved.mes]} ${saved.anio} guardada exitosamente en Base de Datos.`,
      periodo: saved
    });
  } catch (e) {
    console.error('[GuardarPeriodo] Error:', e);
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Obtener la sesión activa o el último período guardado para el Visor de Informes
app.get('/api/distribucion/activa', async (req, res) => {
  try {
    const anio = req.query.anio ? Number(req.query.anio) : null;
    const mes = req.query.mes ? Number(req.query.mes) : null;

    if (anio && mes) {
      // Si coincide con la sesión activa en memoria
      if (
        lastProcessedSession &&
        Number(lastProcessedSession.meta.anio) === anio &&
        Number(lastProcessedSession.meta.mes) === mes
      ) {
        const stripped = stripHeavyDetailsForStorage(lastProcessedSession);
        return res.json({ status: 'ok', source: 'memory', data: stripped });
      }
      const detalle = await db.getPeriodoDetalle(anio, mes);
      if (detalle && detalle.resumen_json) {
        return res.json({ status: 'ok', source: 'database', data: detalle.resumen_json });
      }
      return res.status(404).json({ status: 'error', error: 'Período no encontrado' });
    }

    if (lastProcessedSession) {
      const stripped = stripHeavyDetailsForStorage(lastProcessedSession);
      return res.json({ status: 'ok', source: 'memory', data: stripped });
    }

    const periodos = await db.getPeriodos();
    if (periodos.length > 0) {
      const latest = await db.getPeriodoDetalle(periodos[0].anio, periodos[0].mes);
      if (latest && latest.resumen_json) {
        return res.json({ status: 'ok', source: 'database', data: latest.resumen_json });
      }
    }

    res.json({ status: 'ok', source: 'empty', data: null });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Detalle de funcionarios (RUT, Nombre, Monto) para un Haber y/o Unidad específicos
app.get('/api/distribucion/detalle-funcionarios', async (req, res) => {
  try {
    const sector = String(req.query.sector || 'EDUCACION').toUpperCase();
    const codHaber = req.query.codHaber !== undefined ? Number(req.query.codHaber) : null;
    const unidad = req.query.unidad !== undefined ? Number(req.query.unidad) : null;

    if (!lastProcessedSession) {
      return res.json({
        status: 'ok',
        disponibleEnMemoria: false,
        funcionarios: [],
        message: 'El desglose nominal por RUT está disponible para el archivo cargado en la sesión activa.'
      });
    }

    const secObj = sector === 'SALUD' ? lastProcessedSession.salud : lastProcessedSession.educacion;
    let funcionarios = [];

    if (codHaber !== null && unidad !== null) {
      const grupo = secObj.gruposHaberes.find(g => Number(g.codHaber) === codHaber);
      const item = grupo ? grupo.items.find(it => Number(it.unidad) === unidad) : null;
      funcionarios = item ? item.funcionarios || [] : [];
    } else if (codHaber !== null) {
      const grupo = secObj.gruposHaberes.find(g => Number(g.codHaber) === codHaber);
      if (grupo && grupo.items) {
        for (const it of grupo.items) {
          if (it.funcionarios) {
            funcionarios.push(...it.funcionarios.map(f => ({ ...f, unidad: it.unidad, cenco: it.cenco, codHaber: grupo.codHaber, glosaHaber: grupo.glosaHaber })));
          }
        }
      }
    } else if (unidad !== null) {
      for (const g of secObj.gruposHaberes) {
        const it = (g.items || []).find(i => Number(i.unidad) === unidad);
        if (it && it.funcionarios) {
          funcionarios.push(...it.funcionarios.map(f => ({ ...f, unidad: it.unidad, cenco: it.cenco, codHaber: g.codHaber, glosaHaber: g.glosaHaber })));
        }
      }
    }

    res.json({
      status: 'ok',
      disponibleEnMemoria: true,
      funcionarios
    });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 5. DESCARGAS DE INFORMES EXCEL (.xls / .xlsx)
// ---------------------------------------------------------------------------
app.get('/api/distribucion/descargar/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const anio = req.query.anio ? Number(req.query.anio) : null;
    const mes = req.query.mes ? Number(req.query.mes) : null;

    let targetData = null;
    if (
      lastProcessedSession &&
      (!anio || Number(lastProcessedSession.meta.anio) === anio) &&
      (!mes || Number(lastProcessedSession.meta.mes) === mes)
    ) {
      targetData = lastProcessedSession;
    } else if (anio && mes) {
      const detalle = await db.getPeriodoDetalle(anio, mes);
      if (detalle && detalle.resumen_json) {
        targetData = detalle.resumen_json;
      }
    } else if (lastProcessedSession) {
      targetData = lastProcessedSession;
    }

    if (!targetData) {
      return res.status(404).json({ status: 'error', error: 'No se encontraron datos para generar el archivo solicitado.' });
    }

    const mesNom = (targetData.meta?.mesNombre || 'MES').toLowerCase();
    const anioNum = targetData.meta?.anio || new Date().getFullYear();

    if (tipo === 'educacion-xls' || tipo === 'educacion-xlsx') {
      const isXlsx = tipo.endsWith('xlsx');
      const bookType = isXlsx ? 'xlsx' : 'xls';
      const buf = buildContabilidadExcelBuffer(targetData.educacion, {
        anio: anioNum,
        mes: targetData.meta?.mes,
        bookType
      });
      const filename = isXlsx ? `distribucion_educacion_${mesNom}_${anioNum}.xlsx` : `distribución_educacion.xls`;
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Type', isXlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel');
      return res.send(buf);
    }

    if (tipo === 'salud-xls' || tipo === 'salud-xlsx') {
      const isXlsx = tipo.endsWith('xlsx');
      const bookType = isXlsx ? 'xlsx' : 'xls';
      const buf = buildContabilidadExcelBuffer(targetData.salud, {
        anio: anioNum,
        mes: targetData.meta?.mes,
        bookType
      });
      const filename = isXlsx ? `distribucion_salud_${mesNom}_${anioNum}.xlsx` : `distribucion_salud.xls`;
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Type', isXlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel');
      return res.send(buf);
    }

    if (tipo === 'base-depurada-xls' || tipo === 'base-depurada-xlsx') {
      if (!targetData.rowsDepuradas) {
        return res.status(400).json({
          status: 'error',
          error: 'La base depurada nominal de 3 hojas (44.000+ filas) se genera directamente al subir el archivo en Procesar Distribución.'
        });
      }
      const isXlsx = tipo.endsWith('xlsx');
      const bookType = isXlsx ? 'xlsx' : 'xls';
      const buf = buildBaseDepuradaExcelBuffer(targetData.rowsDepuradas, { bookType });
      const ext = isXlsx ? 'xlsx' : 'xls';
      const filename = `${mesNom} ${anioNum} renta 2.${ext}`;
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Type', isXlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel');
      return res.send(buf);
    }

    res.status(400).json({ status: 'error', error: 'Tipo de descarga no válido' });
  } catch (e) {
    console.error('[Descargar] Error:', e);
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 6. HISTORIAL DE PERÍODOS Y CARGA DESDE CARPETA HISTÓRICA
// ---------------------------------------------------------------------------
app.get('/api/periodos', async (req, res) => {
  try {
    const list = await db.getPeriodos();
    res.json({
      status: 'ok',
      periodos: list.map(p => ({
        ...p,
        mesNombre: MESES_NOMBRES[p.mes] || String(p.mes)
      }))
    });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.delete('/api/periodos/:anio/:mes', async (req, res) => {
  try {
    await db.deletePeriodo(req.params.anio, req.params.mes);
    res.json({ status: 'ok', message: 'Período eliminado del historial' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Importar automáticamente períodos desde la carpeta histórica C:\Users\rhormazabal\Desktop\CMDS\DAF\DISTRIBUCIONES\Distribuciones
app.post('/api/periodos/importar-carpeta-local', async (req, res) => {
  try {
    const baseFolder = 'C:/Users/rhormazabal/Desktop/CMDS/DAF/DISTRIBUCIONES/Distribuciones';
    const yearToScan = Number(req.body?.anio || 2026);
    const yearFolder = path.join(baseFolder, `AÑO ${yearToScan}`);

    if (!fs.existsSync(yearFolder)) {
      return res.status(404).json({ status: 'error', error: `No se encontró la carpeta ${yearFolder}` });
    }

    const cencosList = await db.getCencos();
    const haberesExcluidosList = await db.getHaberesExcluidos();
    const subdirs = fs.readdirSync(yearFolder);
    const importados = [];

    for (const sub of subdirs) {
      const fullSub = path.join(yearFolder, sub);
      if (!fs.statSync(fullSub).isDirectory()) continue;

      const mesMatch = sub.match(/^(\d{1,2})_/);
      const mesNum = mesMatch ? parseInt(mesMatch[1], 10) : null;

      const files = fs.readdirSync(fullSub).filter(f => !f.startsWith('~$'));
      // Priorizar el archivo .xlsx bruto de renta o .xls de renta (no los distribucion_*.xls)
      const rentaFile =
        files.find(f => /renta/i.test(f) && f.toLowerCase().endsWith('.xlsx')) ||
        files.find(f => /renta/i.test(f) && f.toLowerCase().endsWith('.xls'));

      if (!rentaFile) continue;

      const buf = fs.readFileSync(path.join(fullSub, rentaFile));
      const processed = processRentaWorkbook(buf, {
        cencosList,
        haberesExcluidosList,
        anioOverride: yearToScan,
        mesOverride: mesNum,
        fileName: rentaFile
      });

      const stripped = stripHeavyDetailsForStorage(processed);
      await db.savePeriodo({
        anio: processed.meta.anio,
        mes: processed.meta.mes,
        archivo_nombre: rentaFile,
        total_filas_brutas: processed.meta.totalFilasBrutas,
        filas_descartadas_cero: processed.meta.descartadasCodCero + processed.meta.descartadasNombreBlanco,
        filas_descartadas_excluidas: processed.meta.descartadasExcluidas,
        filas_validas: processed.meta.filasValidas,
        filas_educacion: processed.meta.filasEducacion,
        filas_salud: processed.meta.filasSalud,
        monto_educacion: processed.meta.montoEducacion,
        monto_salud: processed.meta.montoSalud,
        haberes_educacion: processed.meta.haberesEducacion,
        haberes_salud: processed.meta.haberesSalud,
        resumen_json: stripped,
        usuario: 'sincronizacion-automatica'
      });

      lastProcessedSession = processed;
      importados.push({
        anio: processed.meta.anio,
        mes: processed.meta.mes,
        mesNombre: processed.meta.mesNombre,
        archivo: rentaFile,
        montoEducacion: processed.meta.montoEducacion,
        montoSalud: processed.meta.montoSalud
      });
    }

    res.json({
      status: 'ok',
      message: `Se importaron y procesaron ${importados.length} períodos del Año ${yearToScan} exitosamente.`,
      importados
    });
  } catch (e) {
    console.error('[ImportarCarpeta] Error:', e);
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 7. MANTENEDORES: CENCOS Y HABERES EXCLUIDOS
// ---------------------------------------------------------------------------
app.get('/api/cencos', async (req, res) => {
  try {
    const cencos = await db.getCencos();
    res.json({ status: 'ok', cencos });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.post('/api/cencos', async (req, res) => {
  try {
    const { unidad, cenco, nombre, sector } = req.body || {};
    if (unidad === undefined || unidad === null || unidad === '') {
      return res.status(400).json({ status: 'error', error: 'El código de Unidad es obligatorio' });
    }
    const saved = await db.upsertCenco({ unidad, cenco, nombre, sector });
    // Si hay una sesión en memoria, refrescar su cruce de Cencos
    const cencos = await db.getCencos();
    res.json({ status: 'ok', item: saved, cencos });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.delete('/api/cencos/:unidad', async (req, res) => {
  try {
    await db.deleteCenco(req.params.unidad);
    const cencos = await db.getCencos();
    res.json({ status: 'ok', cencos });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.get('/api/haberes-excluidos', async (req, res) => {
  try {
    const haberes = await db.getHaberesExcluidos();
    res.json({ status: 'ok', haberes });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.post('/api/haberes-excluidos', async (req, res) => {
  try {
    const { glosa_haber, cod_haber, motivo, activo } = req.body || {};
    if (!glosa_haber || !String(glosa_haber).trim()) {
      return res.status(400).json({ status: 'error', error: 'El Nombre / Glosa del Haber es obligatorio' });
    }
    const haberes = await db.upsertHaberExcluido({ glosa_haber, cod_haber, motivo, activo });
    res.json({ status: 'ok', haberes });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.delete('/api/haberes-excluidos/:id', async (req, res) => {
  try {
    await db.deleteHaberExcluido(req.params.id);
    const haberes = await db.getHaberesExcluidos();
    res.json({ status: 'ok', haberes });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// ---------------------------------------------------------------------------
// 8. ENVÍO DE INFORMES POR CORREO A CONTABILIDAD
// ---------------------------------------------------------------------------
app.get('/api/correo/config', async (req, res) => {
  try {
    const cfg = await db.getConfigCorreo();
    res.json({ status: 'ok', config: cfg });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.put('/api/correo/config', async (req, res) => {
  try {
    const saved = await db.saveConfigCorreo(req.body || {});
    res.json({ status: 'ok', config: saved, message: 'Configuración de correo actualizada correctamente' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.post('/api/correo/enviar', async (req, res) => {
  try {
    const {
      anio,
      mes,
      destinatarios,
      cc,
      asunto,
      mensajeAdicional,
      incluirEducacion = true,
      incluirSalud = true,
      formatoExcel = 'xls'
    } = req.body || {};

    let targetData = null;
    if (
      lastProcessedSession &&
      (!anio || Number(lastProcessedSession.meta.anio) === Number(anio)) &&
      (!mes || Number(lastProcessedSession.meta.mes) === Number(mes))
    ) {
      targetData = lastProcessedSession;
    } else if (anio && mes) {
      const det = await db.getPeriodoDetalle(anio, mes);
      if (det && det.resumen_json) targetData = det.resumen_json;
    } else if (lastProcessedSession) {
      targetData = lastProcessedSession;
    }

    if (!targetData) {
      return res.status(400).json({ status: 'error', error: 'No se encontró el período para adjuntar los informes.' });
    }

    const cfg = await db.getConfigCorreo();
    const toList = String(destinatarios || cfg.destinatarios || '').trim();
    if (!toList) {
      return res.status(400).json({ status: 'error', error: 'Debe indicar al menos un correo destinatario (Contabilidad).' });
    }

    const mesNom = targetData.meta?.mesNombre || MESES_NOMBRES[targetData.meta?.mes] || '';
    const anioNum = targetData.meta?.anio || '';
    const subjectFinal =
      asunto ||
      (cfg.asunto_plantilla || 'Distribución de Remuneraciones CMDS — {MES} {ANIO}')
        .replace('{MES}', mesNom)
        .replace('{ANIO}', String(anioNum));

    const bookType = formatoExcel === 'xlsx' ? 'xlsx' : 'xls';
    const ext = bookType;
    const attachments = [];

    if (incluirEducacion) {
      const bufEdu = buildContabilidadExcelBuffer(targetData.educacion, { anio: anioNum, mes: targetData.meta?.mes, bookType });
      attachments.push({
        filename: bookType === 'xls' ? 'distribución_educacion.xls' : `distribucion_educacion_${mesNom.toLowerCase()}_${anioNum}.${ext}`,
        content: bufEdu
      });
    }

    if (incluirSalud) {
      const bufSal = buildContabilidadExcelBuffer(targetData.salud, { anio: anioNum, mes: targetData.meta?.mes, bookType });
      attachments.push({
        filename: bookType === 'xls' ? 'distribucion_salud.xls' : `distribucion_salud_${mesNom.toLowerCase()}_${anioNum}.${ext}`,
        content: bufSal
      });
    }

    const fmtCLP = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CL');

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <div style="background: #016098; color: #ffffff; padding: 18px 24px;">
          <h2 style="margin: 0; font-size: 18px;">Corporación Municipal de Desarrollo Social de Antofagasta</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #bae6fd;">Dirección de Administración y Finanzas (DAF) — Distribución de Remuneraciones</p>
        </div>
        <div style="padding: 22px 24px; color: #1e293b; font-size: 13.5px; line-height: 1.5;">
          <p>Estimado equipo de <strong>Contabilidad</strong>,</p>
          <p>Se adjuntan los informes oficiales de <strong>Distribución de Remuneraciones</strong> correspondientes al período <strong>${mesNom} ${anioNum}</strong>:</p>
          ${mensajeAdicional ? `<p style="background: #f8fafc; border-left: 4px solid #39BABD; padding: 10px 14px; border-radius: 4px;">${mensajeAdicional}</p>` : ''}
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left;">
                <th style="padding: 8px 12px; border: 1px solid #cbd5e1;">Sector</th>
                <th style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">Haberes Agrupados</th>
                <th style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">Unidades / Cencos</th>
                <th style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">Monto Total Distribuido</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #016098;">EDUCACIÓN (Unidades &lt; 600)</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">${targetData.educacion.gruposHaberes.length}</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">${targetData.educacion.resumenUnidades.length}</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${fmtCLP(targetData.educacion.totalSector)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #047857;">SALUD (Unidades &gt;= 600)</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">${targetData.salud.gruposHaberes.length}</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">${targetData.salud.resumenUnidades.length}</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">${fmtCLP(targetData.salud.totalSector)}</td>
              </tr>
              <tr style="background: #f8fafc; font-weight: bold;">
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">TOTAL CORPORACIÓN</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">-</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">${targetData.educacion.resumenUnidades.length + targetData.salud.resumenUnidades.length}</td>
                <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; color: #016098;">${fmtCLP(targetData.educacion.totalSector + targetData.salud.totalSector)}</td>
              </tr>
            </tbody>
          </table>
          <p style="font-size: 11.5px; color: #64748b; margin-top: 18px;">
            Documento generado automáticamente por el Sistema de Distribución de Remuneraciones — DAF CMDS Antofagasta.
          </p>
        </div>
      </div>
    `;

    // Si no hay contraseña SMTP configurada aún, informar claramente o usar transporte configurado
    if (!cfg.smtp_pass) {
      return res.json({
        status: 'simulated',
        message: `Pre-envío preparado exitosamente para ${toList} con ${attachments.length} adjuntos (${attachments.map(a => a.filename).join(', ')}). Nota: Para despacho SMTP real en red, ingrese la clave SMTP en Configuración de Correo.`,
        resumenEnvio: {
          to: toList,
          cc: cc || cfg.cc,
          subject: subjectFinal,
          adjuntos: attachments.map(a => a.filename)
        }
      });
    }

    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: Number(cfg.smtp_port || 587),
      secure: Boolean(cfg.smtp_secure),
      auth: {
        user: cfg.smtp_user,
        pass: cfg.smtp_pass
      },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"DAF Remuneraciones CMDS" <${cfg.smtp_user}>`,
      to: toList,
      cc: cc || cfg.cc || undefined,
      subject: subjectFinal,
      html: htmlBody,
      attachments
    });

    res.json({
      status: 'ok',
      message: `Correo enviado exitosamente a ${toList} con los archivos ${attachments.map(a => a.filename).join(' y ')}.`
    });
  } catch (e) {
    console.error('[EnviarCorreo] Error:', e);
    res.status(500).json({ status: 'error', error: `Error al enviar correo: ${e.message}` });
  }
});

// ---------------------------------------------------------------------------
// 9. UTILITARIO 2: RESUMEN DE RENTAS (TRIMESTRAL / MENSUAL)
// ---------------------------------------------------------------------------
function mapProcessedToDbRecord(processed, zipBuffer, usuario = 'admin') {
  const byKey = {};
  for (const c of processed.resumenConsultas) {
    byKey[c.key] = c;
  }
  return {
    anio: processed.meta.anio,
    mes: processed.meta.mes,
    trimestre: processed.meta.trimestre,
    personal_archivo: processed.meta.personalArchivo,
    renta_archivo: processed.meta.rentaArchivo,
    personal_filas: processed.meta.personalFilasValidas,
    renta_filas_validas: processed.meta.rentaFilasValidas,
    filas_docentes: byKey.Docentes?.filas || 0,
    monto_docentes: byKey.Docentes?.montoTotal || 0,
    filas_nodocentes: byKey.NoDocentes?.filas || 0,
    monto_nodocentes: byKey.NoDocentes?.montoTotal || 0,
    filas_salud_600_607: byKey.Salud_600al607?.filas || 0,
    monto_salud_600_607: byKey.Salud_600al607?.montoTotal || 0,
    filas_salud_608_609: byKey.Salud_608al609?.filas || 0,
    monto_salud_608_609: byKey.Salud_608al609?.montoTotal || 0,
    filas_salud_610: byKey.Salud_610?.filas || 0,
    monto_salud_610: byKey.Salud_610?.montoTotal || 0,
    filas_salud_620: byKey.Salud_620?.filas || 0,
    monto_salud_620: byKey.Salud_620?.montoTotal || 0,
    total_educacion: processed.meta.totalMontoEducacion,
    total_salud: processed.meta.totalMontoSalud,
    total_general: processed.meta.totalMontoGeneral,
    resumen_json: {
      meta: processed.meta,
      resumenConsultas: processed.resumenConsultas
    },
    zip_base64: zipBuffer ? zipBuffer.toString('base64') : null,
    usuario
  };
}

app.get('/api/resumen-rentas/stats', async (req, res) => {
  try {
    const yearFilter = req.query.year ? Number(req.query.year) : null;
    const allPeriodos = await db.getResumenRentaPeriodos();
    const filtered = yearFilter
      ? allPeriodos.filter(p => Number(p.anio) === yearFilter)
      : allPeriodos;

    const totalEducacion = filtered.reduce((acc, p) => acc + Number(p.total_educacion || 0), 0);
    const totalSalud = filtered.reduce((acc, p) => acc + Number(p.total_salud || 0), 0);
    const totalGeneral = totalEducacion + totalSalud;
    const totalDocentes = filtered.reduce((acc, p) => acc + Number(p.monto_docentes || 0), 0);
    const totalNoDocentes = filtered.reduce((acc, p) => acc + Number(p.monto_nodocentes || 0), 0);
    const totalSalud600 = filtered.reduce((acc, p) => acc + Number(p.monto_salud_600_607 || 0), 0);
    const totalSalud608 = filtered.reduce((acc, p) => acc + Number(p.monto_salud_608_609 || 0), 0);
    const totalSalud610 = filtered.reduce((acc, p) => acc + Number(p.monto_salud_610 || 0), 0);
    const totalSalud620 = filtered.reduce((acc, p) => acc + Number(p.monto_salud_620 || 0), 0);

    // Agrupar por Trimestre
    const trimestresMap = new Map();
    for (const p of filtered) {
      const key = `${p.anio}-Q${p.trimestre}`;
      if (!trimestresMap.has(key)) {
        trimestresMap.set(key, {
          anio: p.anio,
          trimestre: p.trimestre,
          label: `Trimestre ${p.trimestre} (${p.anio})`,
          mesesProcesados: 0,
          mesesLista: [],
          montoEducacion: 0,
          montoSalud: 0,
          montoTotal: 0
        });
      }
      const t = trimestresMap.get(key);
      t.mesesProcesados++;
      t.mesesLista.push(MESES_NOMBRES[p.mes] || String(p.mes));
      t.montoEducacion += Number(p.total_educacion || 0);
      t.montoSalud += Number(p.total_salud || 0);
      t.montoTotal += Number(p.total_general || 0);
    }

    const evolucion = [...filtered]
      .sort((a, b) => (a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes))
      .map(p => ({
        periodo: `${(MESES_NOMBRES[p.mes] || String(p.mes)).slice(0, 3)} ${p.anio}`,
        anio: p.anio,
        mes: p.mes,
        mesNombre: MESES_NOMBRES[p.mes] || String(p.mes),
        Docentes: Number(p.monto_docentes || 0),
        NoDocentes: Number(p.monto_nodocentes || 0),
        Salud600_607: Number(p.monto_salud_600_607 || 0),
        Salud608_609: Number(p.monto_salud_608_609 || 0),
        Salud610: Number(p.monto_salud_610 || 0),
        Salud620: Number(p.monto_salud_620 || 0),
        Educacion: Number(p.total_educacion || 0),
        Salud: Number(p.total_salud || 0),
        Total: Number(p.total_general || 0)
      }));

    res.json({
      status: 'ok',
      data: {
        totalPeriodos: filtered.length,
        totalEducacion,
        totalSalud,
        totalGeneral,
        desgloseGlobal: {
          Docentes: totalDocentes,
          NoDocentes: totalNoDocentes,
          Salud_600al607: totalSalud600,
          Salud_608al609: totalSalud608,
          Salud_610: totalSalud610,
          Salud_620: totalSalud620
        },
        trimestres: Array.from(trimestresMap.values()).sort(
          (a, b) => (b.anio !== a.anio ? b.anio - a.anio : b.trimestre - a.trimestre)
        ),
        evolucion,
        periodos: filtered.map(p => ({
          ...p,
          mesNombre: MESES_NOMBRES[p.mes] || String(p.mes),
          zipFileName: `${String(p.mes).padStart(2, '0')}_${p.anio}.zip`
        }))
      }
    });
  } catch (e) {
    console.error('[ResumenRentas Stats] Error:', e);
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.get('/api/resumen-rentas/periodos', async (req, res) => {
  try {
    const list = await db.getResumenRentaPeriodos();
    res.json({
      status: 'ok',
      periodos: list.map(p => ({
        ...p,
        mesNombre: MESES_NOMBRES[p.mes] || String(p.mes),
        zipFileName: `${String(p.mes).padStart(2, '0')}_${p.anio}.zip`
      }))
    });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.delete('/api/resumen-rentas/periodos/:anio/:mes', async (req, res) => {
  try {
    await db.deleteResumenRentaPeriodo(req.params.anio, req.params.mes);
    res.json({ status: 'ok', message: 'Período eliminado correctamente' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.post(
  '/api/resumen-rentas/previsualizar',
  upload.fields([
    { name: 'personal', maxCount: 1 },
    { name: 'renta', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const persFile = req.files?.personal?.[0];
      const rentaFile = req.files?.renta?.[0];
      if (!persFile || !rentaFile) {
        return res.status(400).json({
          status: 'error',
          error: 'Debe adjuntar ambos archivos del mes: la planilla de Personal y la planilla de Renta.'
        });
      }

      const anio = req.body.anio ? Number(req.body.anio) : new Date().getFullYear();
      const mes = req.body.mes ? Number(req.body.mes) : 9;

      const processed = processResumenRentas(persFile.buffer, rentaFile.buffer, {
        anio,
        mes,
        personalFileName: persFile.originalname,
        rentaFileName: rentaFile.originalname
      });

      lastResumenRentasSession = processed;
      const existente = await db.getResumenRentaDetalle(anio, mes);

      const muestrasConsultas = {};
      for (const def of CONSULTAS_DEF) {
        muestrasConsultas[def.key] = (processed.consultas[def.key] || []).slice(0, 60);
      }

      res.json({
        status: 'ok',
        periodoYaExiste: Boolean(existente),
        meta: processed.meta,
        resumenConsultas: processed.resumenConsultas,
        muestrasConsultas,
        muestraPersonalDepurado: processed.personalDepurado.slice(0, 50),
        muestraRentaDepurada: processed.rentaDepurada.slice(0, 50)
      });
    } catch (e) {
      console.error('[ResumenRentas Previsualizar] Error:', e);
      res.status(400).json({ status: 'error', error: e.message });
    }
  }
);

app.post(
  '/api/resumen-rentas/guardar',
  upload.fields([
    { name: 'personal', maxCount: 1 },
    { name: 'renta', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      let processed = lastResumenRentasSession;
      const persFile = req.files?.personal?.[0];
      const rentaFile = req.files?.renta?.[0];

      if (persFile && rentaFile) {
        const anio = req.body.anio ? Number(req.body.anio) : new Date().getFullYear();
        const mes = req.body.mes ? Number(req.body.mes) : 9;
        processed = processResumenRentas(persFile.buffer, rentaFile.buffer, {
          anio,
          mes,
          personalFileName: persFile.originalname,
          rentaFileName: rentaFile.originalname
        });
        lastResumenRentasSession = processed;
      }

      if (!processed) {
        return res.status(400).json({
          status: 'error',
          error: 'No hay un Resumen de Rentas activo en memoria. Suba y previsualice los archivos primero.'
        });
      }

      const zipBuf = buildResumenMensualZipBuffer(processed);
      const record = mapProcessedToDbRecord(processed, zipBuf, req.body.usuario || 'admin');
      await db.saveResumenRentaPeriodo(record);

      res.json({
        status: 'ok',
        message: `Resumen de Rentas de ${processed.meta.mesNombre} ${processed.meta.anio} (${processed.meta.zipFileName}) guardado en PostgreSQL.`
      });
    } catch (e) {
      console.error('[ResumenRentas Guardar] Error:', e);
      res.status(500).json({ status: 'error', error: e.message });
    }
  }
);

// Descargar el archivo MM_YYYY.zip de un mes (desde memoria o desde PostgreSQL)
app.get('/api/resumen-rentas/descargar-zip/:anio/:mes', async (req, res) => {
  try {
    const anio = Number(req.params.anio);
    const mes = Number(req.params.mes);
    const zipFileName = `${String(mes).padStart(2, '0')}_${anio}.zip`;

    if (
      lastResumenRentasSession &&
      Number(lastResumenRentasSession.meta.anio) === anio &&
      Number(lastResumenRentasSession.meta.mes) === mes
    ) {
      const zipBuf = buildResumenMensualZipBuffer(lastResumenRentasSession);
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      res.setHeader('Content-Type', 'application/zip');
      return res.send(zipBuf);
    }

    const det = await db.getResumenRentaDetalle(anio, mes);
    if (det && det.zip_base64) {
      const zipBuf = Buffer.from(det.zip_base64, 'base64');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      res.setHeader('Content-Type', 'application/zip');
      return res.send(zipBuf);
    }

    res.status(404).json({ status: 'error', error: `No se encontró el archivo ${zipFileName} en la base de datos.` });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Descargar el Pack Trimestral (contiene los 3 archivos MM_YYYY.zip del trimestre seleccionado)
app.get('/api/resumen-rentas/descargar-trimestre/:anio/:trimestre', async (req, res) => {
  try {
    const anio = Number(req.params.anio);
    const trimestre = Number(req.params.trimestre);
    const mesesTrimestre = [
      (trimestre - 1) * 3 + 1,
      (trimestre - 1) * 3 + 2,
      (trimestre - 1) * 3 + 3
    ];

    const entries = [];
    for (const m of mesesTrimestre) {
      const det = await db.getResumenRentaDetalle(anio, m);
      if (det && det.zip_base64) {
        entries.push({
          name: `${String(m).padStart(2, '0')}_${anio}.zip`,
          data: Buffer.from(det.zip_base64, 'base64')
        });
      }
    }

    if (entries.length === 0) {
      return res.status(404).json({
        status: 'error',
        error: `No hay meses procesados para el Trimestre ${trimestre} del año ${anio}.`
      });
    }

    const packZip = createZipBuffer(entries);
    const packName = `Resumen_Rentas_Trimestre_Q${trimestre}_${anio}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${packName}"`);
    res.setHeader('Content-Type', 'application/zip');
    return res.send(packZip);
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Descargar una consulta individual .xlsx o las planillas recortadas de Personal (8 col) / Renta (6 col)
app.get('/api/resumen-rentas/descargar-consulta/:tipo', async (req, res) => {
  try {
    if (!lastResumenRentasSession) {
      return res.status(400).json({
        status: 'error',
        error: 'Para descargar un archivo individual, previsualice el mes o descargue el paquete .zip completo desde el Historial.'
      });
    }
    const { tipo } = req.params;
    const mesNom = (lastResumenRentasSession.meta.mesNombre || 'mes').toLowerCase();
    const anioNum = lastResumenRentasSession.meta.anio;

    if (tipo === 'personal-depurado') {
      const buf = buildPersonalDepuradoExcelBuffer(lastResumenRentasSession.personalDepurado);
      const fname = `${mesNom} ${anioNum} personal 2.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fname)}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }

    if (tipo === 'renta-depurada') {
      const buf = buildRentaDepurada6ColExcelBuffer(lastResumenRentasSession.rentaDepurada);
      const fname = `${mesNom} ${anioNum} renta 2.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fname)}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }

    const def = CONSULTAS_DEF.find(c => c.key === tipo);
    if (!def) {
      return res.status(400).json({ status: 'error', error: 'Consulta solicitada no válida' });
    }

    const rows = lastResumenRentasSession.consultas[def.key] || [];
    const buf = buildConsultaExcelBuffer(rows, def.sheetName);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(def.fileName)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Importador masivo desde carpeta C:\Users\rhormazabal\Desktop\CMDS\DAF\RESUMEN DE RENTAS\2026
app.post('/api/resumen-rentas/importar-carpeta-local', async (req, res) => {
  try {
    const baseFolder = 'C:/Users/rhormazabal/Desktop/CMDS/DAF/RESUMEN DE RENTAS';
    const yearToScan = Number(req.body?.anio || 2026);
    const yearFolder = path.join(baseFolder, String(yearToScan));

    if (!fs.existsSync(yearFolder)) {
      return res.status(404).json({
        status: 'error',
        error: `No se encontró la carpeta local ${yearFolder} en este equipo.`
      });
    }

    const subdirs = fs.readdirSync(yearFolder);
    const importados = [];

    for (const sub of subdirs) {
      const fullSub = path.join(yearFolder, sub);
      if (!fs.statSync(fullSub).isDirectory()) continue;

      const mesMatch = sub.match(/^(\d{1,2})/);
      if (!mesMatch) continue;
      const mesNum = parseInt(mesMatch[1], 10);

      const files = fs.readdirSync(fullSub).filter(f => !f.startsWith('~$'));
      const persFile = files.find(f => /personal/i.test(f) && /\.(xlsx|xls|csv)$/i.test(f));
      const rentaFile = files.find(f => /renta/i.test(f) && /\.(xlsx|xls|csv)$/i.test(f));
      if (!persFile || !rentaFile) continue;

      const persBuf = fs.readFileSync(path.join(fullSub, persFile));
      const rentaBuf = fs.readFileSync(path.join(fullSub, rentaFile));

      const processed = processResumenRentas(persBuf, rentaBuf, {
        anio: yearToScan,
        mes: mesNum,
        personalFileName: persFile,
        rentaFileName: rentaFile
      });

      const zipBuf = buildResumenMensualZipBuffer(processed);
      const record = mapProcessedToDbRecord(processed, zipBuf, 'sincronizacion-historica');
      await db.saveResumenRentaPeriodo(record);

      lastResumenRentasSession = processed;
      importados.push({
        anio: yearToScan,
        mes: mesNum,
        mesNombre: processed.meta.mesNombre,
        zipFileName: processed.meta.zipFileName,
        totalFilas: processed.meta.totalFilasConsultas,
        totalGeneral: processed.meta.totalMontoGeneral
      });
    }

    res.json({
      status: 'ok',
      message: `Se procesaron e importaron ${importados.length} meses del año ${yearToScan} exitosamente a PostgreSQL.`,
      importados
    });
  } catch (e) {
    console.error('[ImportarResumenRentas] Error:', e);
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Fallback SPA para rutas de React Router
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ status: 'error', error: 'Endpoint no encontrado' });
  }
  const indexHtml = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile('index.html', { root: publicDir, dotfiles: 'allow' });
  }
  res.status(200).send('Sistema de Distribución de Remuneraciones CMDS — Backend Activo');
});

// Inicializar Base de Datos y precargar Septiembre 2026 si el historial está vacío
async function bootstrap() {
  await db.initDatabase();

  try {
    const periodos = await db.getPeriodos();
    const septPath = 'C:/Users/rhormazabal/Desktop/CMDS/DAF/DISTRIBUCIONES/Distribuciones/AÑO 2026/09_SEPTIEMBRE/septiembre 2026 renta 2.xlsx';
    if (fs.existsSync(septPath)) {
      const cencosList = await db.getCencos();
      const haberesExcluidosList = await db.getHaberesExcluidos();
      const buf = fs.readFileSync(septPath);
      const processed = processRentaWorkbook(buf, {
        cencosList,
        haberesExcluidosList,
        anioOverride: 2026,
        mesOverride: 9,
        fileName: 'septiembre 2026 renta 2.xlsx'
      });
      lastProcessedSession = processed;

      if (periodos.length === 0) {
        const stripped = stripHeavyDetailsForStorage(processed);
        await db.savePeriodo({
          anio: 2026,
          mes: 9,
          archivo_nombre: 'septiembre 2026 renta 2.xlsx',
          total_filas_brutas: processed.meta.totalFilasBrutas,
          filas_descartadas_cero: processed.meta.descartadasCodCero + processed.meta.descartadasNombreBlanco,
          filas_descartadas_excluidas: processed.meta.descartadasExcluidas,
          filas_validas: processed.meta.filasValidas,
          filas_educacion: processed.meta.filasEducacion,
          filas_salud: processed.meta.filasSalud,
          monto_educacion: processed.meta.montoEducacion,
          monto_salud: processed.meta.montoSalud,
          haberes_educacion: processed.meta.haberesEducacion,
          haberes_salud: processed.meta.haberesSalud,
          resumen_json: stripped,
          usuario: 'sistema-inicial'
        });
        console.log('[Bootstrap] Período Septiembre 2026 precargado automáticamente desde archivo real.');
      }
    }
  } catch (e) {
    console.warn('[Bootstrap] Aviso precarga inicial:', e.message);
  }

  app.listen(PORT, () => {
    console.log(`[Server] Sistema de Distribución de Remuneraciones CMDS escuchando en http://localhost:${PORT}`);
  });
}

bootstrap();
