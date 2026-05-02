from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from app.database import get_db
from app.dependencies import get_current_user, require_manager_or_admin
from app.models.models import Task, TaskStatus, User, UserRole

router = APIRouter(prefix="/performance", tags=["Performance"])


@router.get("/summary")
def performance_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    q = db.query(Task)
    if current_user.role == UserRole.employee:
        q = q.filter(Task.assigned_to_id == current_user.id)

    total = q.count()
    completed = q.filter(Task.status == TaskStatus.completed).count()
    completed_week = q.filter(Task.status == TaskStatus.completed, Task.updated_at >= week_ago).count()
    completed_month = q.filter(Task.status == TaskStatus.completed, Task.updated_at >= month_ago).count()
    overdue = q.filter(Task.deadline < now, Task.status.notin_([TaskStatus.completed])).count()
    under_review = q.filter(Task.status == TaskStatus.under_review).count()

    score = 0
    if total > 0:
        score = min(100, round((completed / total) * 80 + (completed_week * 5) - (overdue * 10)))
        score = max(0, score)

    return {
        "productivity_score": score,
        "total_tasks": total,
        "completed_total": completed,
        "completed_this_week": completed_week,
        "completed_this_month": completed_month,
        "overdue_tasks": overdue,
        "under_review": under_review,
        "avg_work_hours": 0
    }


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    now_naive = datetime.utcnow()

    employees = db.query(User).filter(User.role == UserRole.employee).all()
    results = []
    for emp in employees:
        tasks = db.query(Task).filter(Task.assigned_to_id == emp.id).all()
        total = len(tasks)
        completed = sum(1 for t in tasks if t.status == TaskStatus.completed)
        overdue = 0
        for t in tasks:
            if t.deadline and t.status != TaskStatus.completed:
                dl = t.deadline.replace(tzinfo=None) if t.deadline.tzinfo else t.deadline
                if dl < now_naive:
                    overdue += 1
        score = 0
        if total > 0:
            score = min(100, max(0, round((completed / total) * 80 - (overdue * 10))))
        results.append({
            "user_id": emp.id,
            "name": emp.full_name,
            "email": emp.email,
            "total_tasks": total,
            "completed": completed,
            "overdue": overdue,
            "score": score
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results
