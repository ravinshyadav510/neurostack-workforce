from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.database import get_db
from app.dependencies import get_current_user, require_manager_or_admin
from app.models.models import Task, TaskStatus, User, UserRole, DailyUpdate, Notification, Project

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task_query = db.query(Task)

    if current_user.role == UserRole.employee:
        task_query = task_query.filter(Task.assigned_to_id == current_user.id)

    return {
        "total_tasks": task_query.count(),
        "completed": task_query.filter(Task.status == TaskStatus.completed).count(),
        "pending": task_query.filter(Task.status == TaskStatus.pending).count(),
        "in_progress": task_query.filter(Task.status == TaskStatus.in_progress).count(),
        "blocked": task_query.filter(Task.status == TaskStatus.blocked).count(),
        "unread_notifications": db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.is_read == 0
        ).count(),
        "total_projects": db.query(Project).count() if current_user.role != UserRole.employee else None,
        "total_employees": db.query(User).filter(User.role == UserRole.employee).count() if current_user.role != UserRole.employee else None,
    }

@router.get("/manager-report")
def manager_report(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    rows = (
        db.query(
            User.id,
            User.full_name,
            User.email,
            User.role,
            func.count(Task.id).label("total_tasks"),
            func.sum(case((Task.status == TaskStatus.completed, 1), else_=0)).label("completed_tasks"),
            func.sum(case((Task.status == TaskStatus.pending, 1), else_=0)).label("pending_tasks"),
            func.sum(case((Task.status == TaskStatus.in_progress, 1), else_=0)).label("in_progress_tasks"),
            func.sum(case((Task.status == TaskStatus.blocked, 1), else_=0)).label("blocked_tasks"),
        )
        .filter(User.role == UserRole.employee)
        .outerjoin(Task, Task.assigned_to_id == User.id)
        .group_by(User.id)
        .all()
    )

    return [
        {
            "user_id": row.id,
            "employee": row.full_name,
            "email": row.email,
            "role": row.role.value if row.role else "employee",
            "total_tasks": row.total_tasks or 0,
            "completed_tasks": row.completed_tasks or 0,
            "pending_tasks": row.pending_tasks or 0,
            "in_progress_tasks": row.in_progress_tasks or 0,
            "blocked_tasks": row.blocked_tasks or 0,
        }
        for row in rows
    ]

@router.get("/evening-followup")
def evening_followup(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    updates = db.query(DailyUpdate).order_by(DailyUpdate.created_at.desc()).limit(20).all()
    return [
        {
            "employee": update.user.full_name,
            "completed_work": update.completed_work,
            "pending_work": update.pending_work,
            "blockers": update.blockers,
            "created_at": update.created_at
        }
        for update in updates
    ]
