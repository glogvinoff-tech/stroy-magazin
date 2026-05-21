@echo off
cd %~dp0
REM Run uvicorn from this backend folder on port 8001
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
