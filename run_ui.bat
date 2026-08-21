@echo off
REM Activate virtual environment (adjust path if venv مكانه غير .\.venv)
if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
) else (
  echo WARNING: .venv not found in this folder. Using system Python...
)

streamlit run ui_mealplan.py --server.port 8501
pause
