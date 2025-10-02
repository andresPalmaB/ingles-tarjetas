@echo off
title Ingles Tarjetas - Iniciando...
cls

echo ================================================
echo          INGLES TARJETAS v1.0.10
echo ================================================
echo.
echo Iniciando servidor local...
echo La aplicacion se abrira automaticamente en tu navegador.
echo.
echo IMPORTANTE: NO CIERRES esta ventana mientras uses la aplicacion.
echo Para cerrar la aplicacion, cierra esta ventana.
echo.

:: Crear archivo PORT.txt si no existe
if not exist PORT.txt (
    echo 5173 > PORT.txt
)

:: Abrir navegador después de 2 segundos
timeout /t 2 /nobreak >nul
start http://localhost:5173

:: Iniciar servidor Node.js
echo Servidor iniciado. Presiona Ctrl+C para cerrar.
echo.
node\node.exe server.cjs

pause