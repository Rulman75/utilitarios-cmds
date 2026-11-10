const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');
require('dotenv').config();

// Convertir BIGINT (20) y NUMERIC (1700) a Number de JS
types.setTypeParser(20, val => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700, val => (val === null ? null : Number(val)));

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Los 89 Centros de Costo (Cencos) originales de Renta.mdb enriquecidos con nombres oficiales CMDS
const INITIAL_CENCOS = [
  { unidad: 12, cenco: 501001, nombre: 'LICEO A-12 COMERCIAL JERARDO MUÑOZ CAMPOS', sector: 'EDUCACION' },
  { unidad: 13, cenco: 501009, nombre: 'LICEO B-13 JOSE SANTOS OSSA', sector: 'EDUCACION' },
  { unidad: 14, cenco: 501002, nombre: 'LICEO A-14 TECNICO', sector: 'EDUCACION' },
  { unidad: 15, cenco: 501003, nombre: 'LICEO A-15 MARIO BAHAMONDES SILVA', sector: 'EDUCACION' },
  { unidad: 16, cenco: 501004, nombre: 'LICEO A-16 INDUSTRIAL EULOGIO GORDO MONEO', sector: 'EDUCACION' },
  { unidad: 17, cenco: 501005, nombre: 'LICEO A-17 MARTA NAREA DIAZ', sector: 'EDUCACION' },
  { unidad: 22, cenco: 501006, nombre: 'LICEO A-22 LA PORTADA', sector: 'EDUCACION' },
  { unidad: 26, cenco: 501007, nombre: 'LICEO A-26 OSCAR BONILLA BRADANOVIC', sector: 'EDUCACION' },
  { unidad: 29, cenco: 501010, nombre: 'LICEO B-29 ANDRES SABELLA', sector: 'EDUCACION' },
  { unidad: 32, cenco: 501011, nombre: 'LICEO B-32 DOMINGO HERRERA RIVERA', sector: 'EDUCACION' },
  { unidad: 33, cenco: 501008, nombre: 'LICEO POLITECNICO A-33 LOS ARENALES', sector: 'EDUCACION' },
  { unidad: 35, cenco: 501012, nombre: 'COLEGIO B-35 ANTONIO RENDIC', sector: 'EDUCACION' },
  { unidad: 36, cenco: 501013, nombre: 'LICEO B-36 EXPERIMENTAL ARTISTICO', sector: 'EDUCACION' },
  { unidad: 56, cenco: 501031, nombre: 'ESCUELA E-56 SANTIAGO AMENGUAL', sector: 'EDUCACION' },
  { unidad: 57, cenco: 501032, nombre: 'ESCUELA E-57 JUAN PABLO II', sector: 'EDUCACION' },
  { unidad: 58, cenco: 501014, nombre: 'ESCUELA D-58 JAPON', sector: 'EDUCACION' },
  { unidad: 59, cenco: 501015, nombre: 'ESCUELA D-59 ESPAÑA', sector: 'EDUCACION' },
  { unidad: 60, cenco: 501042, nombre: 'ESCUELA F-60 ARMANDO CARRERA GONZALEZ', sector: 'EDUCACION' },
  { unidad: 65, cenco: 501016, nombre: 'ESCUELA D-65 PADRE GUSTAVO LE PAIGE', sector: 'EDUCACION' },
  { unidad: 66, cenco: 501017, nombre: 'ESCUELA D-66 REPUBLICA DE ITALIA', sector: 'EDUCACION' },
  { unidad: 67, cenco: 501033, nombre: 'ESCUELA E-67 CLAUDIO MATTE PEREZ', sector: 'EDUCACION' },
  { unidad: 68, cenco: 501018, nombre: 'ESCUELA D-68 JOSE PAPIC RADNIC', sector: 'EDUCACION' },
  { unidad: 72, cenco: 501019, nombre: 'ESCUELA D-72 LJUBICA DOMIC W.', sector: 'EDUCACION' },
  { unidad: 73, cenco: 501020, nombre: 'ESCUELA D-73 REPUBLICA DE LOS EE.UU.', sector: 'EDUCACION' },
  { unidad: 74, cenco: 501021, nombre: 'ESCUELA D-74 ALCALDE MAXIMILIANO POBLETE', sector: 'EDUCACION' },
  { unidad: 75, cenco: 501022, nombre: 'ESCUELA D-75 DARIO SALAS DIAZ', sector: 'EDUCACION' },
  { unidad: 77, cenco: 501034, nombre: 'ESCUELA E-77 JUAN SANDOVAL CARRASCO', sector: 'EDUCACION' },
  { unidad: 78, cenco: 501043, nombre: 'ESCUELA F-78 GENERAL MANUEL BAQUEDANO', sector: 'EDUCACION' },
  { unidad: 79, cenco: 501035, nombre: 'ESCUELA E-79 REPUBLICA DEL ECUADOR', sector: 'EDUCACION' },
  { unidad: 80, cenco: 501036, nombre: 'ESCUELA E-80 ARTURO PRAT CHACON', sector: 'EDUCACION' },
  { unidad: 81, cenco: 501037, nombre: 'ESCUELA E-81 HEROES DE LA CONCEPCION', sector: 'EDUCACION' },
  { unidad: 84, cenco: 501038, nombre: 'ESCUELA E-84 LAS AMERICAS', sector: 'EDUCACION' },
  { unidad: 85, cenco: 501023, nombre: 'ESCUELA D-85 ROMULO PEÑA MATURANA', sector: 'EDUCACION' },
  { unidad: 86, cenco: 501024, nombre: 'ESCUELA D-86 JUAN LOPEZ', sector: 'EDUCACION' },
  { unidad: 87, cenco: 501039, nombre: 'ESCUELA E-87 LAS ROCAS', sector: 'EDUCACION' },
  { unidad: 88, cenco: 501040, nombre: 'ESCUELA E-88', sector: 'EDUCACION' },
  { unidad: 89, cenco: 501044, nombre: 'ESCUELA F-89 FUNDACION MINERA ESCONDIDA', sector: 'EDUCACION' },
  { unidad: 90, cenco: 501025, nombre: 'ESCUELA D-90 REPUBLICA DE ARGENTINA', sector: 'EDUCACION' },
  { unidad: 94, cenco: 501045, nombre: 'ESCUELA F-94 SANTIAGO RIFO', sector: 'EDUCACION' },
  { unidad: 96, cenco: 501046, nombre: 'LICEO F-96', sector: 'EDUCACION' },
  { unidad: 97, cenco: 501041, nombre: 'ESCUELA E-97 LA BANDERA', sector: 'EDUCACION' },
  { unidad: 111, cenco: 501049, nombre: 'ESCUELA G-111 GABRIELA MISTRAL', sector: 'EDUCACION' },
  { unidad: 112, cenco: 501047, nombre: 'ESCUELA F-112', sector: 'EDUCACION' },
  { unidad: 113, cenco: 501050, nombre: 'ESCUELA G-113', sector: 'EDUCACION' },
  { unidad: 121, cenco: 501026, nombre: 'ESCUELA D-121 HUMBERTO GONZALEZ ECHEGOYEN', sector: 'EDUCACION' },
  { unidad: 128, cenco: 501048, nombre: 'ESCUELA F-128', sector: 'EDUCACION' },
  { unidad: 129, cenco: 501027, nombre: 'ESCUELA D-129 JUAN PABLO II', sector: 'EDUCACION' },
  { unidad: 136, cenco: 501028, nombre: 'ESCUELA D-136 REVERENDO PADRE PATRICIO CARIOLA', sector: 'EDUCACION' },
  { unidad: 138, cenco: 501029, nombre: 'ESCUELA D-138 PADRE ALBERTO HURTADO', sector: 'EDUCACION' },
  { unidad: 139, cenco: 501030, nombre: 'ESCUELA D-139 "ELMO FUNES"', sector: 'EDUCACION' },
  { unidad: 301, cenco: 501131, nombre: 'SECRETARIA GENERAL EJECUTIVA', sector: 'EDUCACION' },
  { unidad: 350, cenco: 501137, nombre: 'DIRECCION DE ADMINISTRACION Y FINANZAS (DAF)', sector: 'EDUCACION' },
  { unidad: 355, cenco: 501144, nombre: 'DIRECCION DE RECURSOS HUMANOS', sector: 'EDUCACION' },
  { unidad: 373, cenco: 501133, nombre: 'COMUNICACION Y ASUNTOS PUBLICOS', sector: 'EDUCACION' },
  { unidad: 374, cenco: 501155, nombre: 'CONTROL INTERNO', sector: 'EDUCACION' },
  { unidad: 375, cenco: 501132, nombre: 'DEPARTAMENTO JURIDICO', sector: 'EDUCACION' },
  { unidad: 376, cenco: null, nombre: 'CALIDAD VIDA SANA', sector: 'EDUCACION' },
  { unidad: 377, cenco: 501141, nombre: 'DEPARTAMENTO DE INFORMATICA', sector: 'EDUCACION' },
  { unidad: 378, cenco: 501135, nombre: 'DEPARTAMENTO EXTRAESCOLAR', sector: 'EDUCACION' },
  { unidad: 381, cenco: 501147, nombre: 'DEPARTAMENTO DE OBRAS', sector: 'EDUCACION' },
  { unidad: 384, cenco: 503136, nombre: 'SUBVENCION ESCOLAR PREFERENCIAL (S.E.P.)', sector: 'EDUCACION' },
  { unidad: 386, cenco: 501148, nombre: 'DEPARTAMENTO DE PLANIFICACION', sector: 'EDUCACION' },
  { unidad: 400, cenco: 501134, nombre: 'DIRECCION DE EDUCACION', sector: 'EDUCACION' },
  { unidad: 501, cenco: 505072, nombre: 'JARDIN INFANTIL "ESPERANZA"', sector: 'EDUCACION' },
  { unidad: 502, cenco: 505071, nombre: 'JARDIN INFANTIL "RIQUEZA ESCONDIDA"', sector: 'EDUCACION' },
  { unidad: 503, cenco: 505074, nombre: 'JARDIN INFANTIL "RINCONCITO FELIZ"', sector: 'EDUCACION' },
  { unidad: 504, cenco: 505073, nombre: 'SALA CUNA "PEDACITO DE SOL"', sector: 'EDUCACION' },
  { unidad: 505, cenco: 505076, nombre: 'JARDIN INFANTIL ARBOLIA', sector: 'EDUCACION' },
  { unidad: 506, cenco: 505077, nombre: 'JARDIN INFANTIL CABALLITO DE MAR', sector: 'EDUCACION' },
  { unidad: 507, cenco: 505078, nombre: 'JARDIN INFANTIL PORTAL DE BELEN', sector: 'EDUCACION' },
  { unidad: 508, cenco: 505075, nombre: 'JARDIN INFANTIL PANKARITA', sector: 'EDUCACION' },
  { unidad: 509, cenco: 505079, nombre: 'JARDIN INFANTIL SUEÑO DE COLORES', sector: 'EDUCACION' },
  { unidad: 510, cenco: 505080, nombre: 'JARDIN INFANTIL PERLITAS DEL DESIERTO', sector: 'EDUCACION' },
  { unidad: 511, cenco: 501053, nombre: 'GUARDIAS VTF', sector: 'EDUCACION' },
  { unidad: 530, cenco: 504153, nombre: 'PROYECTO DE INTEGRACION ESCOLAR (PIE)', sector: 'EDUCACION' },
  { unidad: 600, cenco: 801014, nombre: 'DIRECCION DE SALUD ATENCION PRIMARIA', sector: 'SALUD' },
  { unidad: 601, cenco: 801004, nombre: 'CESFAM DR. ANTONIO RENDIC', sector: 'SALUD' },
  { unidad: 602, cenco: 801003, nombre: 'CESFAM CENTRO SUR', sector: 'SALUD' },
  { unidad: 603, cenco: 801006, nombre: 'CESFAM CORVALLIS', sector: 'SALUD' },
  { unidad: 604, cenco: 801002, nombre: 'CESFAM JUAN PABLO II', sector: 'SALUD' },
  { unidad: 605, cenco: 801001, nombre: 'CESFAM NORTE', sector: 'SALUD' },
  { unidad: 606, cenco: 801005, nombre: 'CESFAM ORIENTE', sector: 'SALUD' },
  { unidad: 607, cenco: 801009, nombre: 'CENTRAL DE SERVICIOS SALUD', sector: 'SALUD' },
  { unidad: 608, cenco: 801014, nombre: 'DIRECCION DE SALUD CODIGO DEL TRABAJO', sector: 'SALUD' },
  { unidad: 610, cenco: 501087, nombre: 'UNIDAD SALUD 610', sector: 'SALUD' },
  { unidad: 611, cenco: 801018, nombre: 'CESFAM DRA. MARIA CRISTINA ROJAS', sector: 'SALUD' },
  { unidad: 612, cenco: 801012, nombre: 'DROGUERIA DE SALUD', sector: 'SALUD' },
  { unidad: 613, cenco: 801021, nombre: 'FARMACIA COMUNAL', sector: 'SALUD' },
  { unidad: 614, cenco: 801007, nombre: 'CESFAM VALDIVIESO', sector: 'SALUD' }
];

const INITIAL_HABERES_EXCLUIDOS = [
  { id: 1, glosa_haber: 'ASIGNACION FAMILIAR', cod_haber: 9, motivo: 'Excluido por regla de negocio (Asignación Familiar IPS/Caja)', activo: true },
  { id: 2, glosa_haber: 'ASIGNACION ATRASADA', cod_haber: 11, motivo: 'Excluido por regla de negocio (Asignación Familiar Atrasada)', activo: true },
  { id: 3, glosa_haber: 'ASIGNACION PRENATAL', cod_haber: 10, motivo: 'Excluido por regla de negocio (Asignación Maternal/Prenatal)', activo: true }
];

const INITIAL_CONFIG_CORREO = {
  destinatarios: 'contabilidad@cmds.cl',
  cc: 'daf@cmds.cl',
  asunto_plantilla: 'Distribución de Remuneraciones CMDS — {MES} {ANIO} (Educación y Salud)',
  smtp_host: process.env.SMTP_HOST || 'mail.cmds.cl',
  smtp_port: Number(process.env.SMTP_PORT || 587),
  smtp_user: process.env.SMTP_USER || 'notificaciones.daf@cmds.cl',
  smtp_pass: process.env.SMTP_PASS || '',
  smtp_secure: process.env.SMTP_SECURE === 'true'
};

function readLocalStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[DB] Error leyendo store local:', e.message);
  }
  const initial = {
    cencos: INITIAL_CENCOS,
    haberes_excluidos: INITIAL_HABERES_EXCLUIDOS,
    periodos: [],
    config_correo: INITIAL_CONFIG_CORREO
  };
  writeLocalStore(initial);
  return initial;
}

function writeLocalStore(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[DB] Error escribiendo store local:', e.message);
  }
}

let pgPool = null;
let pgConnected = false;

async function getPgPool() {
  if (pgPool && pgConnected) return pgPool;
  try {
    const pool = new Pool({
      host: process.env.PG_HOST || '192.168.30.47',
      port: Number(process.env.PG_PORT || 5432),
      user: process.env.PG_USER || 'cmds_admin',
      password: process.env.PG_PASS || 'CmdsPostgres2026!',
      database: process.env.PG_DB || 'bd_licencias',
      connectionTimeoutMillis: 3500,
      max: 10
    });
    await pool.query('SELECT 1');
    pgPool = pool;
    pgConnected = true;
    return pgPool;
  } catch (err) {
    pgConnected = false;
    return null;
  }
}

async function initDatabase() {
  const store = readLocalStore();
  const pool = await getPgPool();
  if (!pool) {
    console.log('[DB] Operando en Modo Local Autónomo (backend/data/store.json)');
    return { engine: 'local', connected: true };
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dist_cencos (
        unidad INT PRIMARY KEY,
        cenco INT,
        nombre VARCHAR(180),
        sector VARCHAR(30),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dist_haberes_excluidos (
        id SERIAL PRIMARY KEY,
        glosa_haber VARCHAR(120) UNIQUE NOT NULL,
        cod_haber INT,
        motivo VARCHAR(250),
        activo BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS dist_periodos (
        id SERIAL PRIMARY KEY,
        anio INT NOT NULL,
        mes INT NOT NULL,
        archivo_nombre VARCHAR(255),
        total_filas_brutas INT DEFAULT 0,
        filas_descartadas_cero INT DEFAULT 0,
        filas_descartadas_excluidas INT DEFAULT 0,
        filas_validas INT DEFAULT 0,
        filas_educacion INT DEFAULT 0,
        filas_salud INT DEFAULT 0,
        monto_educacion BIGINT DEFAULT 0,
        monto_salud BIGINT DEFAULT 0,
        haberes_educacion INT DEFAULT 0,
        haberes_salud INT DEFAULT 0,
        resumen_json JSONB,
        usuario VARCHAR(80),
        fecha_proceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(anio, mes)
      );

      CREATE TABLE IF NOT EXISTS dist_config_correo (
        id INT PRIMARY KEY DEFAULT 1,
        destinatarios TEXT,
        cc TEXT,
        asunto_plantilla VARCHAR(255),
        smtp_host VARCHAR(150),
        smtp_port INT,
        smtp_user VARCHAR(150),
        smtp_pass VARCHAR(150),
        smtp_secure BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS resumen_rentas_periodos (
        id SERIAL PRIMARY KEY,
        anio INT NOT NULL,
        mes INT NOT NULL,
        trimestre INT NOT NULL,
        personal_archivo VARCHAR(255),
        renta_archivo VARCHAR(255),
        personal_filas INT DEFAULT 0,
        renta_filas_validas INT DEFAULT 0,
        filas_docentes INT DEFAULT 0,
        monto_docentes BIGINT DEFAULT 0,
        filas_nodocentes INT DEFAULT 0,
        monto_nodocentes BIGINT DEFAULT 0,
        filas_salud_600_607 INT DEFAULT 0,
        monto_salud_600_607 BIGINT DEFAULT 0,
        filas_salud_608_609 INT DEFAULT 0,
        monto_salud_608_609 BIGINT DEFAULT 0,
        filas_salud_610 INT DEFAULT 0,
        monto_salud_610 BIGINT DEFAULT 0,
        filas_salud_620 INT DEFAULT 0,
        monto_salud_620 BIGINT DEFAULT 0,
        total_educacion BIGINT DEFAULT 0,
        total_salud BIGINT DEFAULT 0,
        total_general BIGINT DEFAULT 0,
        resumen_json JSONB,
        zip_base64 TEXT,
        usuario VARCHAR(100) DEFAULT 'admin',
        fecha_proceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(anio, mes)
      );
    `);

    // Sembrar Cencos si la tabla está vacía
    const cencoCount = await pool.query('SELECT COUNT(*)::INT AS cnt FROM dist_cencos');
    if (cencoCount.rows[0].cnt === 0) {
      for (const c of INITIAL_CENCOS) {
        await pool.query(
          `INSERT INTO dist_cencos (unidad, cenco, nombre, sector)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (unidad) DO NOTHING`,
          [c.unidad, c.cenco, c.nombre, c.sector]
        );
      }
      console.log(`[DB] Sembrados ${INITIAL_CENCOS.length} Cencos en PostgreSQL (192.168.30.47).`);
    }

    // Sembrar Haberes Excluidos si la tabla está vacía
    const habCount = await pool.query('SELECT COUNT(*)::INT AS cnt FROM dist_haberes_excluidos');
    if (habCount.rows[0].cnt === 0) {
      for (const h of INITIAL_HABERES_EXCLUIDOS) {
        await pool.query(
          `INSERT INTO dist_haberes_excluidos (glosa_haber, cod_haber, motivo, activo)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (glosa_haber) DO NOTHING`,
          [h.glosa_haber, h.cod_haber, h.motivo, h.activo]
        );
      }
      console.log(`[DB] Sembrados ${INITIAL_HABERES_EXCLUIDOS.length} Haberes Excluidos en PostgreSQL.`);
    }

    // Sembrar Config Correo
    const cfgCount = await pool.query('SELECT COUNT(*)::INT AS cnt FROM dist_config_correo');
    if (cfgCount.rows[0].cnt === 0) {
      await pool.query(
        `INSERT INTO dist_config_correo (id, destinatarios, cc, asunto_plantilla, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          INITIAL_CONFIG_CORREO.destinatarios,
          INITIAL_CONFIG_CORREO.cc,
          INITIAL_CONFIG_CORREO.asunto_plantilla,
          INITIAL_CONFIG_CORREO.smtp_host,
          INITIAL_CONFIG_CORREO.smtp_port,
          INITIAL_CONFIG_CORREO.smtp_user,
          INITIAL_CONFIG_CORREO.smtp_pass,
          INITIAL_CONFIG_CORREO.smtp_secure
        ]
      );
    }

    // Sincronizar hacia store local
    await syncFromPostgresToLocal(pool, store);
    console.log('[DB] Conectado a PostgreSQL Centralizado CMDS (192.168.30.47) + Respaldo Local Sincronizado.');
    return { engine: 'postgres+local', connected: true };
  } catch (err) {
    console.warn('[DB] Error inicializando tablas en PostgreSQL, usando store local:', err.message);
    return { engine: 'local', connected: true };
  }
}

async function syncFromPostgresToLocal(pool, store) {
  try {
    const cRes = await pool.query('SELECT unidad, cenco, nombre, sector FROM dist_cencos ORDER BY unidad ASC');
    const hRes = await pool.query('SELECT id, glosa_haber, cod_haber, motivo, activo FROM dist_haberes_excluidos ORDER BY id ASC');
    const cfgRes = await pool.query('SELECT * FROM dist_config_correo WHERE id = 1');

    store.cencos = cRes.rows;
    store.haberes_excluidos = hRes.rows;
    if (cfgRes.rows[0]) {
      store.config_correo = cfgRes.rows[0];
    }
    writeLocalStore(store);
  } catch (e) {
    console.warn('[DB] No se pudo sincronizar store local:', e.message);
  }
}

async function authenticateUser(username, password) {
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  // 1. Intentar autenticar contra tabla corporativa Usuarios en PostgreSQL (192.168.30.47)
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        `SELECT RTRIM(usuario) AS "Usuario", RTRIM(tipo) AS "Tipo", RTRIM(unidad) AS "Unidad"
         FROM usuarios
         WHERE LOWER(RTRIM(usuario)) = LOWER($1)
           AND (LOWER(RTRIM(clave)) = LOWER($2) OR LOWER(RTRIM(clave, '. ')) = LOWER(RTRIM($2, '. ')))
         LIMIT 1`,
        [cleanUser, cleanPass]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (e) {
      console.warn('[Auth] Fallback a credenciales locales:', e.message);
    }
  }

  // 2. Cuentas corporativas directas / fallback offline
  const localUsers = [
    { user: 'rhormaza', pass: 'Cmds2026.', Usuario: 'rhormaza', Tipo: 'A', Unidad: 'cmds' },
    { user: 'rhormaza', pass: 'Cmds2026', Usuario: 'rhormaza', Tipo: 'A', Unidad: 'cmds' },
    { user: 'dcano', pass: 'Cmds2026.', Usuario: 'dcano', Tipo: 'A', Unidad: 'cmds' },
    { user: 'dcano', pass: 'Cmds2026', Usuario: 'dcano', Tipo: 'A', Unidad: 'cmds' },
    { user: 'adorador', pass: 'david', Usuario: 'adorador', Tipo: 'A', Unidad: 'cmds' },
    { user: 'admin', pass: 'admin123', Usuario: 'admin', Tipo: 'A', Unidad: 'DAF' },
    { user: 'admin', pass: 'cmds2026', Usuario: 'admin', Tipo: 'A', Unidad: 'DAF' },
    { user: 'admin', pass: '1595', Usuario: 'admin', Tipo: 'A', Unidad: 'DAF' },
    { user: 'admin', pass: 'admin', Usuario: 'admin', Tipo: 'A', Unidad: 'DAF' },
    { user: 'admin', pass: '1234', Usuario: 'admin', Tipo: 'A', Unidad: 'DAF' },
    { user: 'rhormazabal', pass: 'admin123', Usuario: 'rhormazabal', Tipo: 'A', Unidad: 'DAF' },
    { user: 'rhormazabal', pass: 'cmds2026', Usuario: 'rhormazabal', Tipo: 'A', Unidad: 'DAF' },
    { user: 'daf', pass: 'cmds2026', Usuario: 'daf', Tipo: 'A', Unidad: 'DAF' },
    { user: 'daf', pass: 'admin123', Usuario: 'daf', Tipo: 'A', Unidad: 'DAF' },
    { user: 'cathi', pass: 'cmds', Usuario: 'cathi', Tipo: 'A', Unidad: 'cmds' },
    { user: 'cmds', pass: 'cor2015', Usuario: 'cmds', Tipo: 'A', Unidad: 'cmds' }
  ];

  const found = localUsers.find(
    u => u.user.toLowerCase() === cleanUser.toLowerCase() && u.pass === cleanPass
  );
  if (found) {
    return { Usuario: found.Usuario, Tipo: found.Tipo, Unidad: found.Unidad };
  }
  return null;
}

async function getCencos() {
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT unidad, cenco, nombre, sector FROM dist_cencos ORDER BY unidad ASC');
      return res.rows;
    } catch (e) {
      console.warn('[DB] getCencos fallback local:', e.message);
    }
  }
  const store = readLocalStore();
  return store.cencos.sort((a, b) => a.unidad - b.unidad);
}

async function upsertCenco({ unidad, cenco, nombre, sector }) {
  const uNum = Number(unidad);
  const cNum = cenco === null || cenco === '' || cenco === undefined ? null : Number(cenco);
  const sec = sector || (uNum < 600 ? 'EDUCACION' : 'SALUD');
  const nom = String(nombre || '').trim() || `UNIDAD ${uNum}`;

  const pool = await getPgPool();
  if (pool) {
    await pool.query(
      `INSERT INTO dist_cencos (unidad, cenco, nombre, sector, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (unidad) DO UPDATE SET
         cenco = EXCLUDED.cenco,
         nombre = EXCLUDED.nombre,
         sector = EXCLUDED.sector,
         updated_at = CURRENT_TIMESTAMP`,
      [uNum, cNum, nom, sec]
    );
  }

  const store = readLocalStore();
  const idx = store.cencos.findIndex(x => Number(x.unidad) === uNum);
  const item = { unidad: uNum, cenco: cNum, nombre: nom, sector: sec };
  if (idx >= 0) store.cencos[idx] = item;
  else store.cencos.push(item);
  store.cencos.sort((a, b) => a.unidad - b.unidad);
  writeLocalStore(store);
  return item;
}

async function deleteCenco(unidad) {
  const uNum = Number(unidad);
  const pool = await getPgPool();
  if (pool) {
    await pool.query('DELETE FROM dist_cencos WHERE unidad = $1', [uNum]);
  }
  const store = readLocalStore();
  store.cencos = store.cencos.filter(x => Number(x.unidad) !== uNum);
  writeLocalStore(store);
}

async function getHaberesExcluidos() {
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT id, glosa_haber, cod_haber, motivo, activo FROM dist_haberes_excluidos ORDER BY id ASC');
      return res.rows;
    } catch (e) {
      console.warn('[DB] getHaberesExcluidos fallback local:', e.message);
    }
  }
  const store = readLocalStore();
  return store.haberes_excluidos;
}

async function upsertHaberExcluido({ glosa_haber, cod_haber, motivo, activo = true }) {
  const glosa = String(glosa_haber || '').trim().toUpperCase();
  const cod = cod_haber ? Number(cod_haber) : null;
  const mot = String(motivo || 'Excluido por regla de negocio').trim();

  const pool = await getPgPool();
  if (pool) {
    await pool.query(
      `INSERT INTO dist_haberes_excluidos (glosa_haber, cod_haber, motivo, activo)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (glosa_haber) DO UPDATE SET
         cod_haber = EXCLUDED.cod_haber,
         motivo = EXCLUDED.motivo,
         activo = EXCLUDED.activo`,
      [glosa, cod, mot, Boolean(activo)]
    );
  }

  const store = readLocalStore();
  const idx = store.haberes_excluidos.findIndex(x => x.glosa_haber.toUpperCase() === glosa);
  if (idx >= 0) {
    store.haberes_excluidos[idx] = { ...store.haberes_excluidos[idx], glosa_haber: glosa, cod_haber: cod, motivo: mot, activo: Boolean(activo) };
  } else {
    const nextId = store.haberes_excluidos.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
    store.haberes_excluidos.push({ id: nextId, glosa_haber: glosa, cod_haber: cod, motivo: mot, activo: Boolean(activo) });
  }
  writeLocalStore(store);
  return getHaberesExcluidos();
}

async function deleteHaberExcluido(id) {
  const idNum = Number(id);
  const pool = await getPgPool();
  if (pool) {
    await pool.query('DELETE FROM dist_haberes_excluidos WHERE id = $1', [idNum]);
  }
  const store = readLocalStore();
  store.haberes_excluidos = store.haberes_excluidos.filter(x => Number(x.id) !== idNum);
  writeLocalStore(store);
}

async function savePeriodo(periodo) {
  const pool = await getPgPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO dist_periodos (
          anio, mes, archivo_nombre, total_filas_brutas, filas_descartadas_cero,
          filas_descartadas_excluidas, filas_validas, filas_educacion, filas_salud,
          monto_educacion, monto_salud, haberes_educacion, haberes_salud,
          resumen_json, usuario, fecha_proceso
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP)
        ON CONFLICT (anio, mes) DO UPDATE SET
          archivo_nombre = EXCLUDED.archivo_nombre,
          total_filas_brutas = EXCLUDED.total_filas_brutas,
          filas_descartadas_cero = EXCLUDED.filas_descartadas_cero,
          filas_descartadas_excluidas = EXCLUDED.filas_descartadas_excluidas,
          filas_validas = EXCLUDED.filas_validas,
          filas_educacion = EXCLUDED.filas_educacion,
          filas_salud = EXCLUDED.filas_salud,
          monto_educacion = EXCLUDED.monto_educacion,
          monto_salud = EXCLUDED.monto_salud,
          haberes_educacion = EXCLUDED.haberes_educacion,
          haberes_salud = EXCLUDED.haberes_salud,
          resumen_json = EXCLUDED.resumen_json,
          usuario = EXCLUDED.usuario,
          fecha_proceso = CURRENT_TIMESTAMP`,
        [
          periodo.anio,
          periodo.mes,
          periodo.archivo_nombre,
          periodo.total_filas_brutas,
          periodo.filas_descartadas_cero,
          periodo.filas_descartadas_excluidas,
          periodo.filas_validas,
          periodo.filas_educacion,
          periodo.filas_salud,
          periodo.monto_educacion,
          periodo.monto_salud,
          periodo.haberes_educacion,
          periodo.haberes_salud,
          JSON.stringify(periodo.resumen_json || {}),
          periodo.usuario || 'admin'
        ]
      );
    } catch (e) {
      console.warn('[DB] savePeriodo PG warning:', e.message);
    }
  }

  const store = readLocalStore();
  if (!Array.isArray(store.periodos)) store.periodos = [];
  const idx = store.periodos.findIndex(p => Number(p.anio) === Number(periodo.anio) && Number(p.mes) === Number(periodo.mes));
  const record = {
    ...periodo,
    fecha_proceso: new Date().toISOString()
  };
  if (idx >= 0) store.periodos[idx] = record;
  else store.periodos.push(record);
  store.periodos.sort((a, b) => (b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes));
  writeLocalStore(store);
  return record;
}

async function getPeriodos() {
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        `SELECT id, anio, mes, archivo_nombre, total_filas_brutas, filas_descartadas_cero,
                filas_descartadas_excluidas, filas_validas, filas_educacion, filas_salud,
                monto_educacion, monto_salud, haberes_educacion, haberes_salud,
                usuario, fecha_proceso
         FROM dist_periodos
         ORDER BY anio DESC, mes DESC`
      );
      return res.rows;
    } catch (e) {
      console.warn('[DB] getPeriodos fallback local:', e.message);
    }
  }
  const store = readLocalStore();
  return (store.periodos || []).map(({ resumen_json, ...rest }) => rest);
}

async function getPeriodoDetalle(anio, mes) {
  const aNum = Number(anio);
  const mNum = Number(mes);
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        'SELECT * FROM dist_periodos WHERE anio = $1 AND mes = $2 LIMIT 1',
        [aNum, mNum]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (e) {
      console.warn('[DB] getPeriodoDetalle fallback local:', e.message);
    }
  }
  const store = readLocalStore();
  return (store.periodos || []).find(p => Number(p.anio) === aNum && Number(p.mes) === mNum) || null;
}

async function deletePeriodo(anio, mes) {
  const aNum = Number(anio);
  const mNum = Number(mes);
  const pool = await getPgPool();
  if (pool) {
    await pool.query('DELETE FROM dist_periodos WHERE anio = $1 AND mes = $2', [aNum, mNum]);
  }
  const store = readLocalStore();
  store.periodos = (store.periodos || []).filter(p => !(Number(p.anio) === aNum && Number(p.mes) === mNum));
  writeLocalStore(store);
}

async function getConfigCorreo() {
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM dist_config_correo WHERE id = 1');
      if (res.rows.length > 0) return res.rows[0];
    } catch (e) {
      console.warn('[DB] getConfigCorreo fallback local:', e.message);
    }
  }
  const store = readLocalStore();
  return store.config_correo || INITIAL_CONFIG_CORREO;
}

async function saveConfigCorreo(cfg) {
  const updated = {
    destinatarios: String(cfg.destinatarios || '').trim(),
    cc: String(cfg.cc || '').trim(),
    asunto_plantilla: String(cfg.asunto_plantilla || INITIAL_CONFIG_CORREO.asunto_plantilla).trim(),
    smtp_host: String(cfg.smtp_host || INITIAL_CONFIG_CORREO.smtp_host).trim(),
    smtp_port: Number(cfg.smtp_port || 587),
    smtp_user: String(cfg.smtp_user || '').trim(),
    smtp_pass: String(cfg.smtp_pass || ''),
    smtp_secure: Boolean(cfg.smtp_secure)
  };
  const pool = await getPgPool();
  if (pool) {
    await pool.query(
      `INSERT INTO dist_config_correo (id, destinatarios, cc, asunto_plantilla, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         destinatarios = EXCLUDED.destinatarios,
         cc = EXCLUDED.cc,
         asunto_plantilla = EXCLUDED.asunto_plantilla,
         smtp_host = EXCLUDED.smtp_host,
         smtp_port = EXCLUDED.smtp_port,
         smtp_user = EXCLUDED.smtp_user,
         smtp_pass = EXCLUDED.smtp_pass,
         smtp_secure = EXCLUDED.smtp_secure,
         updated_at = CURRENT_TIMESTAMP`,
      [
        updated.destinatarios,
        updated.cc,
        updated.asunto_plantilla,
        updated.smtp_host,
        updated.smtp_port,
        updated.smtp_user,
        updated.smtp_pass,
        updated.smtp_secure
      ]
    );
  }
  const store = readLocalStore();
  store.config_correo = updated;
  writeLocalStore(store);
  return updated;
}

// ---------------------------------------------------------------------------
// MÓDULO 2: RESUMEN DE RENTAS (TRIMESTRAL / MENSUAL)
// ---------------------------------------------------------------------------
async function saveResumenRentaPeriodo(item) {
  const pool = await getPgPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO resumen_rentas_periodos (
          anio, mes, trimestre, personal_archivo, renta_archivo,
          personal_filas, renta_filas_validas,
          filas_docentes, monto_docentes,
          filas_nodocentes, monto_nodocentes,
          filas_salud_600_607, monto_salud_600_607,
          filas_salud_608_609, monto_salud_608_609,
          filas_salud_610, monto_salud_610,
          filas_salud_620, monto_salud_620,
          total_educacion, total_salud, total_general,
          resumen_json, zip_base64, usuario, fecha_proceso
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,CURRENT_TIMESTAMP
        )
        ON CONFLICT (anio, mes) DO UPDATE SET
          trimestre = EXCLUDED.trimestre,
          personal_archivo = EXCLUDED.personal_archivo,
          renta_archivo = EXCLUDED.renta_archivo,
          personal_filas = EXCLUDED.personal_filas,
          renta_filas_validas = EXCLUDED.renta_filas_validas,
          filas_docentes = EXCLUDED.filas_docentes,
          monto_docentes = EXCLUDED.monto_docentes,
          filas_nodocentes = EXCLUDED.filas_nodocentes,
          monto_nodocentes = EXCLUDED.monto_nodocentes,
          filas_salud_600_607 = EXCLUDED.filas_salud_600_607,
          monto_salud_600_607 = EXCLUDED.monto_salud_600_607,
          filas_salud_608_609 = EXCLUDED.filas_salud_608_609,
          monto_salud_608_609 = EXCLUDED.monto_salud_608_609,
          filas_salud_610 = EXCLUDED.filas_salud_610,
          monto_salud_610 = EXCLUDED.monto_salud_610,
          filas_salud_620 = EXCLUDED.filas_salud_620,
          monto_salud_620 = EXCLUDED.monto_salud_620,
          total_educacion = EXCLUDED.total_educacion,
          total_salud = EXCLUDED.total_salud,
          total_general = EXCLUDED.total_general,
          resumen_json = EXCLUDED.resumen_json,
          zip_base64 = EXCLUDED.zip_base64,
          usuario = EXCLUDED.usuario,
          fecha_proceso = CURRENT_TIMESTAMP`,
        [
          item.anio,
          item.mes,
          item.trimestre,
          item.personal_archivo,
          item.renta_archivo,
          item.personal_filas,
          item.renta_filas_validas,
          item.filas_docentes,
          item.monto_docentes,
          item.filas_nodocentes,
          item.monto_nodocentes,
          item.filas_salud_600_607,
          item.monto_salud_600_607,
          item.filas_salud_608_609,
          item.monto_salud_608_609,
          item.filas_salud_610,
          item.monto_salud_610,
          item.filas_salud_620,
          item.monto_salud_620,
          item.total_educacion,
          item.total_salud,
          item.total_general,
          JSON.stringify(item.resumen_json || {}),
          item.zip_base64 || null,
          item.usuario || 'admin'
        ]
      );
    } catch (e) {
      console.warn('[DB] saveResumenRentaPeriodo PG warning:', e.message);
    }
  }

  const store = readLocalStore();
  if (!Array.isArray(store.resumen_rentas_periodos)) store.resumen_rentas_periodos = [];
  const idx = store.resumen_rentas_periodos.findIndex(
    p => Number(p.anio) === Number(item.anio) && Number(p.mes) === Number(item.mes)
  );
  const { zip_base64, ...lightItem } = item;
  const record = { ...lightItem, fecha_proceso: new Date().toISOString() };
  if (idx >= 0) store.resumen_rentas_periodos[idx] = record;
  else store.resumen_rentas_periodos.push(record);
  store.resumen_rentas_periodos.sort((a, b) => (b.anio !== a.anio ? b.anio - a.anio : b.mes - a.mes));
  writeLocalStore(store);
  return record;
}

async function getResumenRentaPeriodos() {
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        `SELECT id, anio, mes, trimestre, personal_archivo, renta_archivo,
                personal_filas, renta_filas_validas,
                filas_docentes, monto_docentes,
                filas_nodocentes, monto_nodocentes,
                filas_salud_600_607, monto_salud_600_607,
                filas_salud_608_609, monto_salud_608_609,
                filas_salud_610, monto_salud_610,
                filas_salud_620, monto_salud_620,
                total_educacion, total_salud, total_general,
                resumen_json, usuario, fecha_proceso
         FROM resumen_rentas_periodos
         ORDER BY anio DESC, mes DESC`
      );
      return res.rows;
    } catch (e) {
      console.warn('[DB] getResumenRentaPeriodos fallback local:', e.message);
    }
  }
  const store = readLocalStore();
  return store.resumen_rentas_periodos || [];
}

async function getResumenRentaDetalle(anio, mes) {
  const aNum = Number(anio);
  const mNum = Number(mes);
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query(
        'SELECT * FROM resumen_rentas_periodos WHERE anio = $1 AND mes = $2 LIMIT 1',
        [aNum, mNum]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (e) {
      console.warn('[DB] getResumenRentaDetalle fallback local:', e.message);
    }
  }
  const store = readLocalStore();
  return (store.resumen_rentas_periodos || []).find(
    p => Number(p.anio) === aNum && Number(p.mes) === mNum
  ) || null;
}

async function deleteResumenRentaPeriodo(anio, mes) {
  const aNum = Number(anio);
  const mNum = Number(mes);
  const pool = await getPgPool();
  if (pool) {
    await pool.query('DELETE FROM resumen_rentas_periodos WHERE anio = $1 AND mes = $2', [aNum, mNum]);
  }
  const store = readLocalStore();
  store.resumen_rentas_periodos = (store.resumen_rentas_periodos || []).filter(
    p => !(Number(p.anio) === aNum && Number(p.mes) === mNum)
  );
  writeLocalStore(store);
}

module.exports = {
  initDatabase,
  getPgPool,
  authenticateUser,
  getCencos,
  upsertCenco,
  deleteCenco,
  getHaberesExcluidos,
  upsertHaberExcluido,
  deleteHaberExcluido,
  savePeriodo,
  getPeriodos,
  getPeriodoDetalle,
  deletePeriodo,
  getConfigCorreo,
  saveConfigCorreo,
  saveResumenRentaPeriodo,
  getResumenRentaPeriodos,
  getResumenRentaDetalle,
  deleteResumenRentaPeriodo,
  INITIAL_CENCOS,
  INITIAL_HABERES_EXCLUIDOS
};
