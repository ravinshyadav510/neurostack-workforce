from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import CORS_ORIGINS, SEED_DB
from app.database import Base, engine, SessionLocal
from app.routes import auth, users, projects, tasks, daily_updates, comments, notifications, dashboard
from app.routes import attendance, leave, files, performance, calendar_view, export
from app.seed import seed_demo_data

app = FastAPI(
    title="Remote Workforce Task Management System",
    description="Integrated FastAPI + Professional UI remote team task management system.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

if SEED_DB:
    with SessionLocal() as db:
        seed_demo_data(db)

# API routes
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(daily_updates.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(leave.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(performance.router, prefix="/api")
app.include_router(calendar_view.router, prefix="/api")
app.include_router(export.router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok", "message": "API is running"}

# PWA — serve service-worker.js and manifest.json from root with correct headers
static_dir = Path(__file__).parent / "static"

@app.get("/service-worker.js")
def service_worker():
    return FileResponse(static_dir / "service-worker.js", media_type="application/javascript",
                        headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"})

@app.get("/manifest.json")
def manifest():
    return FileResponse(static_dir / "manifest.json", media_type="application/manifest+json")

# Frontend static app
app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
