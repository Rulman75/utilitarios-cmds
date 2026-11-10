#!/usr/bin/env bash
# ==============================================================================
# Script de Despliegue y Actualización en Servidor Linux CMDS (srvcmdslm01)
# Proyecto: Utilitarios TI CMDS (Módulo Distribución de Remuneraciones + Futuros)
# Servidor Destino: 192.168.30.45 (/var/www/html/utilitarios-cmds)
# Base de Datos: PostgreSQL Centralizado 192.168.30.47 (bd_licencias)
# Puerto de Aplicación: 3005 | Proceso PM2: utilitarios-cmds
# ==============================================================================

set -e

APP_DIR="/var/www/html/utilitarios-cmds"
REPO_URL="https://github.com/Rulman75/utilitarios-cmds.git"
PM2_NAME="utilitarios-cmds"
PORT="3005"

echo "=================================================================="
echo "  Desplegando Utilitarios TI CMDS en Servidor Linux ($(hostname))"
echo "=================================================================="

# 1. Crear o actualizar directorio de la aplicación
if [ ! -d "$APP_DIR/.git" ]; then
  echo "[1/4] Clonando repositorio desde GitHub en $APP_DIR..."
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER":"$USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  echo "[1/4] Actualizando repositorio existente en $APP_DIR..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/main
fi

# 2. Instalar dependencias del Backend
echo "[2/4] Instalando dependencias de Node.js en backend..."
cd "$APP_DIR/backend"
npm install --omit=dev

# 3. Crear archivo .env de producción si no existe
if [ ! -f "$APP_DIR/backend/.env" ]; then
  echo "[3/4] Generando archivo backend/.env conectado a PostgreSQL (192.168.30.47)..."
  cat <<EOF > "$APP_DIR/backend/.env"
PORT=${PORT}
DB_ENGINE=postgres
PG_HOST=192.168.30.47
PG_PORT=5432
PG_USER=cmds_admin
PG_PASS=CmdsPostgres2026!
PG_DB=bd_licencias
JWT_SECRET=super_secret_jwt_key_cmds
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=remuneraciones@cmds.cl
SMTP_PASS=
SMTP_FROM="DAF Remuneraciones CMDS <remuneraciones@cmds.cl>"
EOF
else
  echo "[3/4] Archivo backend/.env ya existe, conservando configuración actual."
fi

# 4. Iniciar o reiniciar proceso en PM2
echo "[4/4] Configurando proceso '$PM2_NAME' en PM2 (Puerto $PORT)..."
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  cd "$APP_DIR/backend"
  pm2 start server.js --name "$PM2_NAME"
fi
pm2 save

echo "=================================================================="
echo "  Despliegue completado exitosamente."
echo "  URL Interna: http://192.168.30.45:${PORT}"
echo "  Healthcheck: curl http://localhost:${PORT}/api/health"
echo "=================================================================="
