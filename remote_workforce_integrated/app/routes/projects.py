from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_manager_or_admin
from app.models.models import Project
from app.schemas.schemas import ProjectCreate, ProjectOut
from app.services.activity import log_activity

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("/", response_model=ProjectOut)
def create_project(data: ProjectCreate, db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    project = Project(
        name=data.name,
        description=data.description,
        deadline=data.deadline,
        created_by_id=current_user.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    log_activity(db, current_user.id, "project_created", f"Created project: {project.name}")
    return project

@router.get("/", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Project).order_by(Project.created_at.desc()).all()
