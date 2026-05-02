from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import Task, UserRole

router = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.get("/tasks")
def calendar_tasks(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(Task).filter(Task.deadline.isnot(None))
    if current_user.role == UserRole.employee:
        q = q.filter(Task.assigned_to_id == current_user.id)

    tasks = q.all()
    result = []
    for t in tasks:
        if t.deadline:
            dl = t.deadline
            if hasattr(dl, 'year') and dl.year == year and dl.month == month:
                result.append({
                    "id": t.id,
                    "title": t.title,
                    "date": dl.strftime("%Y-%m-%d"),
                    "day": dl.day,
                    "status": t.status.value,
                    "priority": t.priority.value,
                    "assigned_to_id": t.assigned_to_id
                })

    return result
