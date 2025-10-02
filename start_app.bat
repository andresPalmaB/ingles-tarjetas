@echo off
setlocal
set PORT=5173
if exist "%~dp0PORT.txt" (
  for /f "usebackq delims=" %%p in ("%~dp0PORT.txt") do set PORT=%%p
)
start "" "http://localhost:%PORT%"
pushd "%~dp0"
"%~dp0node\node.exe" "%~dp0server.cjs" %PORT%
popd
endlocal