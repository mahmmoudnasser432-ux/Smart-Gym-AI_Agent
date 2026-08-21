@echo off
title MuscleForge AI Agent Starter
cd /d "%~dp0"

echo ==========================================
echo  MuscleForge AI Agent - Starting...
echo ==========================================
echo  AI Server (FastAPI): http://localhost:8000
echo ==========================================
echo.

REM ─── Start FastAPI AI Server ──────────────────────────
echo Starting FastAPI AI Server...

if exist ".venv\Scripts\activate.bat" (
    start "FastAPI AI Server" cmd /k "cd /d %~dp0ai_agent && ..\.venv\Scripts\activate.bat && python main.py"
    echo  ✅ FastAPI AI Server launch initiated on Port 8000.
) else (
    echo  ❌ ERROR: Python .venv not found in root folder!
    echo  Please create it first.
)

echo.
echo ==========================================
echo  MuscleForge AI Agent is RUNNING!
echo  Check the opened terminal window for logs.
echo ==========================================
echo.
echo  Press any key to close this controller window...
pause >nul