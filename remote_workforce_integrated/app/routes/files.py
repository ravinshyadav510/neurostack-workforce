import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import FileAttachment, Task, UserRole
from app.schemas.schemas import FileAttachmentOut
from app.services.activity import log_activity

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".txt", ".csv"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/task/{task_id}", response_model=FileAttachmentOut)
async def upload_file(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role == UserRole.employee and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    safe_name = f"{task_id}_{current_user.id}_{int(__import__('time').time())}_{file.filename}"
    filepath = UPLOAD_DIR / safe_name
    with open(filepath, "wb") as f:
        f.write(contents)

    attachment = FileAttachment(
        task_id=task_id,
        user_id=current_user.id,
        filename=file.filename,
        filepath=str(filepath),
        file_size=len(contents)
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    log_activity(db, current_user.id, "file_uploaded", f"Uploaded {file.filename} to task {task_id}")
    return attachment


@router.get("/task/{task_id}", response_model=list[FileAttachmentOut])
def list_files(task_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if current_user.role == UserRole.employee and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return db.query(FileAttachment).filter(FileAttachment.task_id == task_id).order_by(FileAttachment.created_at.desc()).all()


@router.get("/download/{file_id}")
def download_file(file_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    attachment = db.query(FileAttachment).filter(FileAttachment.id == file_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.exists(attachment.filepath):
        raise HTTPException(status_code=404, detail="File missing from storage")
    return FileResponse(attachment.filepath, filename=attachment.filename)


@router.delete("/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    attachment = db.query(FileAttachment).filter(FileAttachment.id == file_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="File not found")
    if current_user.role == UserRole.employee and attachment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if os.path.exists(attachment.filepath):
        os.remove(attachment.filepath)
    db.delete(attachment)
    db.commit()
    return {"message": "File deleted"}
