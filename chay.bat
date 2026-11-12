@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Dang cai dat lan dau, vui long cho...
  call npm install
)
call npm start
