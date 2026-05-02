@echo off
echo Starting Remote Workforce Task Management System...
python -m venv .venv
call .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
pause
