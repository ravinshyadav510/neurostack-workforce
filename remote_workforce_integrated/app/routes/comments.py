from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import Task, TaskComment, UserRole
from app.schemas.schemas import CommentCreate, CommentOut
from app.services.notifications import create_notification

router = APIRouter(prefix="/tasks/{task_id}/comments", tags=["Task Comments"])

@router.post("/", response_model=CommentOut)
def add_comment(task_id: int, data: CommentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == UserRole.employee and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    comment = TaskComment(task_id=task_id, user_id=current_user.id, comment=data.comment)
    db.add(comment)
    db.commit()
    db.refresh(comment)

    notify_user_id = task.created_by_id if current_user.id == task.assigned_to_id else task.assigned_to_id
    create_notification(db, notify_user_id, "New Task Comment", f"New comment on task: {task.title}")
    return comment

@router.get("/", response_model=list[CommentOut])
def list_comments(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(TaskComment).filter(TaskComment.task_id == task_id).order_by(TaskComment.created_at.desc()).all()
