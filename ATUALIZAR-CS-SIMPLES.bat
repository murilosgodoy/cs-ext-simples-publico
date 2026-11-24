@echo off
chcp 65001 >nul
rem CS Simples - instala ou atualiza a extensao em C:\CS-Simples
rem Baixa a ultima versao do repositorio publico murilosgodoy/cs-ext-simples-publico.

rem Este .bat tambem vem no pacote e seria sobrescrito enquanto roda:
rem copia para a pasta temporaria e continua de la.
if /i not "%~dp0"=="%TEMP%\" (
  copy /y "%~f0" "%TEMP%\ATUALIZAR-CS-SIMPLES.bat" >nul
  "%TEMP%\ATUALIZAR-CS-SIMPLES.bat"
  exit /b
)

set "DESTINO=C:\CS-Simples"
set "ZIP_URL=https://github.com/murilosgodoy/cs-ext-simples-publico/archive/refs/heads/main.zip"
set "TMPDIR=%TEMP%\cs-simples-download"

echo =========================================================
echo   CS Simples - baixando a ultima versao
echo =========================================================
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
mkdir "%TMPDIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -UseBasicParsing -Uri '%ZIP_URL%' -OutFile '%TMPDIR%\cs.zip';" ^
  "Expand-Archive -Path '%TMPDIR%\cs.zip' -DestinationPath '%TMPDIR%' -Force"
if errorlevel 1 (
  echo.
  echo [ERRO] Nao consegui baixar. Confira a internet e tente de novo.
  pause
  exit /b 1
)

if not exist "%DESTINO%" mkdir "%DESTINO%"
robocopy "%TMPDIR%\cs-ext-simples-publico-main" "%DESTINO%" /MIR /NFL /NDL /NJH /NJS /R:2 /W:1
if %ERRORLEVEL% GEQ 8 (
  echo.
  echo [ERRO] Nao consegui copiar para %DESTINO%. Codigo do robocopy: %ERRORLEVEL%
  pause
  exit /b 1
)
rmdir /s /q "%TMPDIR%"

echo.
echo [OK] CS Simples atualizado em %DESTINO%
echo.
echo  - Ja usa a extensao? Volte ao CS e clique em "Aplicar atualizacao" no aviso.
echo  - Primeira vez? No Chrome, abra chrome://extensions, ligue o "Modo do
echo    desenvolvedor", clique em "Carregar sem compactacao" e escolha %DESTINO%
echo.
pause
