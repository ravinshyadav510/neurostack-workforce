from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_manager_or_admin
from app.models.models import Task, User, UserRole
from app.schemas.schemas import TaskCreate, TaskUpdate, TaskOut
from app.services.notifications import create_notification
from app.services.activity import log_activity
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("/", response_model=TaskOut)
def create_task(data: TaskCreate, db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    task = Task(**data.model_dump(), created_by_id=current_user.id)
    db.add(task)
    db.commit()
    db.refresh(task)

    create_notification(
        db,
        data.assigned_to_id,
        "New Task Assigned",
        f"You have been assigned task: {task.title}"
    )
    log_activity(db, current_user.id, "task_created", f"Created task: {task.title}")
    return task

@router.get("/", response_model=list[TaskOut])
def list_tasks(
    assigned_to_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Task)
    if current_user.role == UserRole.employee:
        query = query.filter(Task.assigned_to_id == current_user.id)
    else:
        if assigned_to_id:
            query = query.filter(Task.assigned_to_id == assigned_to_id)
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    return query.order_by(Task.created_at.desc()).all()

@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == UserRole.employee and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    return task

@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == UserRole.employee:
        if task.assigned_to_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed")
        update_data = {}
        if data.status:
            update_data["status"] = data.status
    else:
        update_data = data.model_dump(exclude_unset=True)
        # Approval: manager rejects -> set feedback and move to in_progress
        if data.rejection_feedback and data.status and data.status.value == "in_progress":
            update_data["rejection_feedback"] = data.rejection_feedback

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    # Notify appropriately
    if data.status:
        status_val = data.status.value if hasattr(data.status, 'value') else str(data.status)
        if status_val == "under_review":
            create_notification(db, task.created_by_id, "Task Submitted for Review", f"{current_user.full_name} submitted: {task.title}")
        elif status_val == "completed":
            create_notification(db, task.assigned_to_id, "Task Approved", f"Your task was approved: {task.title}")
        elif status_val == "in_progress" and data.rejection_feedback:
            create_notification(db, task.assigned_to_id, "Task Rejected", f"Task sent back: {task.title}. Feedback: {data.rejection_feedback}")
        else:
            create_notification(db, task.created_by_id, "Task Updated", f"Task updated: {task.title}")
    else:
        create_notification(db, task.created_by_id, "Task Updated", f"Task updated: {task.title}")

    log_activity(db, current_user.id, "task_updated", f"Updated task: {task.title}")
    return task

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    title = task.title
    db.delete(task)
    db.commit()
    log_activity(db, current_user.id, "task_deleted", f"Deleted task: {title}")
    return {"message": "Task deleted successfully"}
