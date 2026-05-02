import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import require_manager_or_admin
from app.models.models import Task, User, PunchLog, UserRole

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/tasks-csv")
def export_tasks_csv(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    tasks = db.query(Task).all()
    users = {u.id: u.full_name for u in db.query(User).all()}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Title", "Description", "Status", "Priority", "Assigned To", "Created By", "Deadline", "Created At"])
    for t in tasks:
        writer.writerow([
            t.id, t.title, t.description or "",
            t.status.value, t.priority.value,
            users.get(t.assigned_to_id, ""), users.get(t.created_by_id, ""),
            str(t.deadline or ""), str(t.created_at or "")
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks_report.csv"}
    )


@router.get("/employee-report-csv")
def export_employee_report(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    employees = db.query(User).filter(User.role == UserRole.employee).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee", "Email", "Total Tasks", "Completed", "Pending", "In Progress", "Blocked"])

    for emp in employees:
        tasks = db.query(Task).filter(Task.assigned_to_id == emp.id).all()
        total = len(tasks)
        completed = sum(1 for t in tasks if t.status.value == "completed")
        pending = sum(1 for t in tasks if t.status.value == "pending")
        in_prog = sum(1 for t in tasks if t.status.value == "in_progress")
        blocked = sum(1 for t in tasks if t.status.value == "blocked")
        writer.writerow([emp.full_name, emp.email, total, completed, pending, in_prog, blocked])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=employee_report.csv"}
    )


@router.get("/attendance-csv")
def export_attendance(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    records = db.query(PunchLog).order_by(PunchLog.date.desc(), PunchLog.timestamp.asc()).limit(1000).all()
    users = {u.id: u.full_name for u in db.query(User).all()}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee", "Date", "Type", "Time", "Description"])
    for r in records:
        writer.writerow([
            users.get(r.user_id, ""), str(r.date),
            r.punch_type.value, str(r.timestamp), r.description or ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"}
    )
