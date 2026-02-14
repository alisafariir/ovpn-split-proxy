@echo off
:: Run ovpn-split-proxy with Administrator rights (required for OpenVPN)
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system" || (
  echo Requesting Administrator rights...
  goto UACPrompt
) && goto gotAdmin

:UACPrompt
  echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
  echo UAC.ShellExecute "cmd.exe", "/c ""%~s0""", "", "runas", 1 >> "%temp%\getadmin.vbs"
  "%temp%\getadmin.vbs"
  exit /B

:gotAdmin
  cd /d "%~dp0"
  echo Running from: %CD%
  call npm start
