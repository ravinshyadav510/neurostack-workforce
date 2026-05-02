# Remote Workforce Task Management System - Integrated Version

This is a single integrated FastAPI project.

- FastAPI backend
- SQLite database
- JWT login
- Admin / Manager / Employee roles
- Professional dashboard UI
- Frontend is already integrated inside FastAPI static files
- No separate React/Vite setup required

## Demo Users

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | admin123 |
| Manager | manager@demo.com | manager123 |
| Employee | employee@demo.com | employee123 |
| Employee | aman@demo.com | aman123 |

## Run

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

API docs:

```text
http://127.0.0.1:8000/docs
```

## Project Structure

```text
remote_workforce_integrated/
├── app/
│   ├── core/
│   ├── models/
│   ├── routes/
│   ├── schemas/
│   └── services/
├── static/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── main.py
├── requirements.txt
└── run.bat
```
