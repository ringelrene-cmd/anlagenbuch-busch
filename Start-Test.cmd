@echo off
cd /d "%~dp0"
where node >nul 2>nul
set "TEST_NODE=node"
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "TEST_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo Fuer diesen Test wird Node.js 22 oder neuer benoetigt.
    pause
    exit /b 1
  )
)
echo Testadresse: http://localhost:8788
echo Testpasswort: test-busch
echo Dieses Fenster waehrend des Tests geoeffnet lassen.
"%TEST_NODE%" scripts/dev.mjs
pause
