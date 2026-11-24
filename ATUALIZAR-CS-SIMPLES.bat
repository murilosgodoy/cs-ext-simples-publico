@echo off
chcp 65001 >nul
rem CS Simples - instala ou atualiza a extensao em C:\CS-Simples
rem Baixa o .zip do repositorio publico murilosgodoy/cs-ext-simples-publico
rem com o curl e o tar que ja vem no Windows 10/11 (sem PowerShell).
set "DESTINO=C:\CS-Simples"
set "ZIP_URL=https://github.com/murilosgodoy/cs-ext-simples-publico/archive/refs/heads/main.zip"
set "ZIP=%TEMP%\cs-simples.zip"
set "PASTA=%TEMP%\cs-simples"

echo =========================================================
echo   CS Simples - baixando a ultima versao
echo =========================================================
curl.exe -L -f -s -o "%ZIP%" "%ZIP_URL%"
if errorlevel 1 goto erro_download

if exist "%PASTA%" rmdir /s /q "%PASTA%"
mkdir "%PASTA%"
tar.exe -xf "%ZIP%" -C "%PASTA%"
if errorlevel 1 goto erro_download

if not exist "%DESTINO%" mkdir "%DESTINO%"
rem O proprio .bat fica de fora da copia: ele esta rodando agora.
robocopy "%PASTA%\cs-ext-simples-publico-main" "%DESTINO%" /MIR /XF ATUALIZAR-CS-SIMPLES.bat /NFL /NDL /NJH /NJS /R:2 /W:1
if %ERRORLEVEL% GEQ 8 goto erro_copia

echo.
echo [OK] CS Simples atualizado em %DESTINO%
echo.
echo  - Ja usa a extensao? Volte ao CS e clique em "Aplicar atualizacao" no aviso.
echo  - Primeira vez? No Chrome, abra chrome://extensions, ligue o "Modo do
echo    desenvolvedor", clique em "Carregar sem compactacao" e escolha %DESTINO%
echo.
pause
rem Atualiza este .bat por ultimo, numa linha so (o cmd le a linha inteira antes).
(copy /y "%PASTA%\cs-ext-simples-publico-main\ATUALIZAR-CS-SIMPLES.bat" "%DESTINO%\" >nul & del "%ZIP%" & rmdir /s /q "%PASTA%" & exit /b 0)

:erro_download
echo.
echo [ERRO] Nao consegui baixar a atualizacao. Confira a internet e tente de novo.
echo Se continuar, baixe manualmente: %ZIP_URL%
pause
exit /b 1

:erro_copia
echo.
echo [ERRO] Nao consegui copiar para %DESTINO%. Codigo do robocopy: %ERRORLEVEL%
pause
exit /b 1
