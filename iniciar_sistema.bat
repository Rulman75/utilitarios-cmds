@echo off
title Utilitarios TI CMDS
echo ============================================================================
echo   CORPORACION MUNICIPAL DE DESARROLLO SOCIAL DE ANTOFAGASTA (CMDS)
echo   Unidad de Tecnologias de la Informacion (TI)
echo   Iniciando Plataforma Utilitarios TI CMDS (Puerto 3005)...
echo ============================================================================
cd /d "%~dp0backend"
start http://localhost:3005
node server.js
pause
