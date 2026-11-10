# Ficha Técnica del Proyecto — `utilitarios-cmds` (Utilitarios TI CMDS)

**Fecha de actualización:** Noviembre 2026  
**Versión:** `1.0.0`  
**Ruta Local:** `C:\Users\rhormazabal\.gemini\antigravity\scratch\utilitarios-cmds`  
**Repositorio GitHub:** `https://github.com/Rulman75/utilitarios-cmds.git`

---

## 1. Propósito y Arquitectura Modular

**Utilitarios TI CMDS** es la plataforma web corporativa centralizada donde se alojan múltiples utilitarios y herramientas operativas para las distintas direcciones de la Corporación Municipal de Desarrollo Social de Antofagasta (CMDS).

### Módulos / Utilitarios Integrados en el Menú Lateral
1. **Distribución Remuneraciones (DAF)**:
   - Reemplaza el antiguo aplicativo en Visual Basic 6 + MS Access (`Renta.mdb`) + Crystal Reports (`Distribucion.rpt`).
   - Recibe el archivo mensual de Renta (`14` columnas), recorta automáticamente a las `9` columnas requeridas, elimina `COD. HABER = 0`, blancos y haberes excluidos (`ASIGNACION FAMILIAR`, `ASIGNACION ATRASADA`, `ASIGNACION PRENATAL`), divide entre **Educación (`UNIDAD < 600`)** y **Salud (`UNIDAD >= 600`)**, cruza contra el catálogo de **89 Centros de Costo (`Cencos`)** y genera `distribución_educacion.xls`, `distribucion_salud.xls`, el libro depurado de 3 hojas (`Hoja1`, `EDUCACION`, `SALUD`), informes PDF corporativos y despacho por correo a Contabilidad.

---

## 2. Tecnología de Desarrollo (Stack Técnico)

- **Backend (`backend/`):**
  - **Runtime y Framework:** Node.js (`v22+`) + Express `^5.2.1` (CommonJS).
  - **Base de Datos:** Driver `pg` `^8.23.1` conectado a PostgreSQL `18.6` (`192.168.30.47`, BD `bd_licencias`) con respaldo local JSON sincronizado (`backend/data/store.json`).
  - **Seguridad y Librerías:** `jsonwebtoken` `^9.0.3`, `multer` `^2.2.0`, `nodemailer` `^10.3.1`, `xlsx` `^0.18.5`, `cors` `^2.8.6`, `dotenv` `^17.3.1`.
- **Frontend (`frontend/`):**
  - **Framework y Lenguaje:** React `^19.2.8` + TypeScript `~6.0.2` + Vite `^8.2.0`.
  - **Estilos y Gráficos:** Tailwind CSS `^4.3.3` (`@tailwindcss/vite`), Lucide React, Recharts `^3.10.1`, React Router DOM `^7.18.2`, Axios `^1.19.0`, `xlsx` `^0.18.5`.
  - **Empaquetado:** El build de producción se compila directamente en `backend/public/` y es servido por el mismo proceso Express.

---

## 3. Dónde Reside el Aplicativo

- **Servidor de Producción:** Servidor Linux interno **`srvcmdslm01`**.
- **Dirección IP:** `192.168.30.45`
- **Ruta en Disco Linux:** `/var/www/html/utilitarios-cmds` (punto de entrada: `/var/www/html/utilitarios-cmds/backend/server.js`).
- **Puerto de Escucha:** `3005` (`http://192.168.30.45:3005`)
- **Gestor de Procesos (PM2):**
  - **Nombre del Proceso:** `utilitarios-cmds`
  - **Usuario de Sistema Operativo:** `rhormazabal`

---

## 4. Motor y Residencia de Base de Datos

- **Servidor PostgreSQL Centralizado CMDS:** `192.168.30.47` (`:5432`)
- **Base de Datos:** `bd_licencias`
- **Tablas del Módulo Distribución Remuneraciones:**
  - `dist_cencos` (89 unidades y centros de costo migrados desde `Renta.mdb`)
  - `dist_haberes_excluidos` (reglas de exclusión de haberes)
  - `dist_periodos` (historial mensual procesado con JSON de resúmenes por Haber y Unidad)
  - `dist_config_correo` (plantilla, destinatarios de Contabilidad y parámetros SMTP)
- **Autenticación:** Tabla corporativa `usuarios` (`rhormaza` / `Cmds2026.`, `dcano` / `Cmds2026.`, `adorador` / `david`, `cathi` / `cmds`, etc.).
