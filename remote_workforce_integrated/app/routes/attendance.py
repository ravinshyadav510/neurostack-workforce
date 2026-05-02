from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_manager_or_admin
from app.models.models import PunchLog, PunchType, UserRole, User
from app.schemas.schemas import PunchRequest, PunchLogOut
from app.services.activity import log_activity

router = APIRouter(prefix="/attendance", tags=["Attendance"])

WORK_START_HOUR = 9  # 9 AM — late if after this
MIN_WORK_HOURS = 8.0


def _now():
    return datetime.utcnow()


def _get_last_punch(db: Session, user_id: int, day: date):
    return db.query(PunchLog).filter(
        PunchLog.user_id == user_id, PunchLog.date == day
    ).order_by(PunchLog.timestamp.desc()).first()


def _calc_summary(logs):
    """Calculate work hours and break time from a list of punch logs for a day."""
    sorted_logs = sorted(logs, key=lambda x: x.timestamp)
    if not sorted_logs:
        return {"total_hours": 0, "break_minutes": 0, "first_in": None, "last_out": None, "is_late": False, "status": "absent"}

    first_in = None
    last_out = None
    work_seconds = 0
    break_seconds = 0
    current_in = None

    for log in sorted_logs:
        if log.punch_type == PunchType.IN:
            if first_in is None:
                first_in = log.timestamp
            current_in = log.timestamp
        elif log.punch_type == PunchType.OUT:
            last_out = log.timestamp
            if current_in:
                work_seconds += (log.timestamp - current_in).total_seconds()
                current_in = None

    # Calculate break time: gaps between OUT and next IN
    for i in range(len(sorted_logs) - 1):
        if sorted_logs[i].punch_type == PunchType.OUT and sorted_logs[i+1].punch_type == PunchType.IN:
            break_seconds += (sorted_logs[i+1].timestamp - sorted_logs[i].timestamp).total_seconds()

    # If currently checked in (no matching OUT), add time until now
    if current_in and last_out != sorted_logs[-1].timestamp if sorted_logs[-1].punch_type == PunchType.IN else False:
        work_seconds += (_now() - current_in).total_seconds()

    total_hours = round(work_seconds / 3600, 2)
    break_minutes = round(break_seconds / 60)

    is_late = False
    if first_in:
        fi = first_in.replace(tzinfo=None) if first_in.tzinfo else first_in
        is_late = fi.hour > WORK_START_HOUR or (fi.hour == WORK_START_HOUR and fi.minute > 0)

    last_punch = sorted_logs[-1]
    if last_punch.punch_type == PunchType.IN:
        status = "working"
    else:
        status = "checked_out"

    return {
        "total_hours": total_hours,
        "break_minutes": break_minutes,
        "first_in": first_in.isoformat() if first_in else None,
        "last_out": last_out.isoformat() if last_out else None,
        "is_late": is_late,
        "status": status,
        "min_hours_met": total_hours >= MIN_WORK_HOURS
    }


# ---- Punch In ----
@router.post("/punch-in", response_model=PunchLogOut)
def punch_in(data: PunchRequest, request: Request, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    today = date.today()
    last = _get_last_punch(db, current_user.id, today)

    if last and last.punch_type == PunchType.IN:
        raise HTTPException(status_code=400, detail="Already punched in. Please punch out first.")

    ip = request.client.host if request.client else None
    desc = data.description
    if not desc:
        logs_today = db.query(PunchLog).filter(PunchLog.user_id == current_user.id, PunchLog.date == today).count()
        desc = "Day start" if logs_today == 0 else "Back from break"

    log_entry = PunchLog(
        user_id=current_user.id,
        punch_type=PunchType.IN,
        timestamp=_now(),
        date=today,
        description=desc,
        ip_address=ip
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    log_activity(db, current_user.id, "punch_in", desc)
    return log_entry


# ---- Punch Out ----
@router.post("/punch-out", response_model=PunchLogOut)
def punch_out(data: PunchRequest, request: Request, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    today = date.today()
    last = _get_last_punch(db, current_user.id, today)

    if not last or last.punch_type == PunchType.OUT:
        raise HTTPException(status_code=400, detail="Not punched in. Please punch in first.")

    ip = request.client.host if request.client else None
    desc = data.description or "Break"

    log_entry = PunchLog(
        user_id=current_user.id,
        punch_type=PunchType.OUT,
        timestamp=_now(),
        date=today,
        description=desc,
        ip_address=ip
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    log_activity(db, current_user.id, "punch_out", desc)
    return log_entry


# ---- Today's logs + summary ----
@router.get("/today")
def today_status(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    today = date.today()
    logs = db.query(PunchLog).filter(
        PunchLog.user_id == current_user.id, PunchLog.date == today
    ).order_by(PunchLog.timestamp.asc()).all()

    summary = _calc_summary(logs)
    return {
        "date": str(today),
        "logs": [
            {
                "id": l.id, "punch_type": l.punch_type.value,
                "timestamp": l.timestamp.isoformat(), "description": l.description,
                "ip_address": l.ip_address
            } for l in logs
        ],
        "summary": summary
    }


# ---- History (per day summaries) ----
@router.get("/my-history")
def my_history(days: int = 30, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    since = date.today() - timedelta(days=days)
    logs = db.query(PunchLog).filter(
        PunchLog.user_id == current_user.id, PunchLog.date >= since
    ).order_by(PunchLog.timestamp.asc()).all()

    by_date = {}
    for l in logs:
        d = str(l.date)
        if d not in by_date:
            by_date[d] = []
        by_date[d].append(l)

    result = []
    for d in sorted(by_date.keys(), reverse=True):
        day_logs = by_date[d]
        summary = _calc_summary(day_logs)
        result.append({
            "date": d,
            "summary": summary,
            "logs": [
                {"id": l.id, "punch_type": l.punch_type.value, "timestamp": l.timestamp.isoformat(), "description": l.description}
                for l in day_logs
            ]
        })
    return result


STANDARD_HOURS = 8.0
MAX_BREAK_MINUTES = 60


def _detailed_status(summary, logs):
    """Return a rich status string and list of warnings."""
    s = summary
    warnings = []
    status = "pending"

    if not logs:
        status = "pending"
    elif s["status"] == "working":
        status = "working"
    elif s["status"] == "checked_out":
        last_desc = (logs[-1].description or "").lower() if logs else ""
        if any(kw in last_desc for kw in ["day end", "day completed", "end of day", "leaving", "done"]):
            status = "completed"
        else:
            status = "on_break"

    if s.get("is_late"):
        if status == "pending":
            status = "late"
        else:
            warnings.append("Late arrival")

    if s["total_hours"] > STANDARD_HOURS:
        if status == "completed":
            status = "overtime"
        warnings.append("Overtime: " + str(round(s["total_hours"] - STANDARD_HOURS, 1)) + "h extra")

    if s["break_minutes"] > MAX_BREAK_MINUTES:
        warnings.append("Break exceeded: " + str(s["break_minutes"]) + "m (max " + str(MAX_BREAK_MINUTES) + "m)")

    if len(logs) % 2 != 0 and s["status"] != "working":
        warnings.append("Odd punch count — possible missing entry")

    for lg in logs:
        if not lg.description:
            warnings.append("Missing description on punch at " + lg.timestamp.strftime("%H:%M"))
            break

    if s["status"] == "working" and logs:
        last_in = logs[-1].timestamp
        now = _now()
        last_naive = last_in.replace(tzinfo=None) if last_in.tzinfo else last_in
        elapsed = (now - last_naive).total_seconds() / 3600
        if elapsed > 5:
            warnings.append("No checkout for " + str(round(elapsed, 1)) + "h since last punch-in")

    return status, warnings


def _build_user_attendance(db, user, today):
    """Build attendance data for a single user."""
    logs = db.query(PunchLog).filter(
        PunchLog.user_id == user.id, PunchLog.date == today
    ).order_by(PunchLog.timestamp.asc()).all()
    summary = _calc_summary(logs)
    status, warnings = _detailed_status(summary, logs)

    last_activity = ""
    last_desc = ""
    if logs:
        last = logs[-1]
        last_activity = last.punch_type.value + " at " + last.timestamp.strftime("%H:%M")
        last_desc = last.description or ""

    reporting_to = ""
    if user.reporting_to_id:
        mgr = db.query(User).filter(User.id == user.reporting_to_id).first()
        if mgr:
            reporting_to = mgr.full_name

    return {
        "user_id": user.id,
        "name": user.full_name,
        "email": user.email,
        "role": user.role.value,
        "department": user.department or "Unassigned",
        "reporting_to": reporting_to,
        "date": str(today),
        "status": status,
        "summary": summary,
        "punch_count": len(logs),
        "last_activity": last_activity,
        "last_description": last_desc,
        "warnings": warnings,
        "logs": [
            {"id": l.id, "punch_type": l.punch_type.value, "timestamp": l.timestamp.isoformat(), "description": l.description}
            for l in logs
        ]
    }


# ---- All attendance today (role-based) ----
@router.get("/all-today")
def all_today(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    today = date.today()

    # Super Admin / Admin: see everyone (managers + employees)
    if current_user.role in [UserRole.super_admin, UserRole.admin]:
        target_users = db.query(User).filter(User.id != current_user.id, User.is_active == 1).all()
    else:
        # Manager: see only employees who report to them
        target_users = db.query(User).filter(User.reporting_to_id == current_user.id, User.is_active == 1).all()

    total_work_hours = 0
    total_break_mins = 0
    result = []
    for usr in target_users:
        data = _build_user_attendance(db, usr, today)
        total_work_hours += data["summary"]["total_hours"]
        total_break_mins += data["summary"]["break_minutes"]
        result.append(data)

    # Aggregate stats
    present = sum(1 for r in result if r["status"] not in ["pending"])
    pending = sum(1 for r in result if r["status"] == "pending")
    working = sum(1 for r in result if r["status"] == "working")
    on_break = sum(1 for r in result if r["status"] == "on_break")
    completed = sum(1 for r in result if r["status"] in ["completed", "overtime"])
    late = sum(1 for r in result if r["summary"].get("is_late"))
    overtime = sum(1 for r in result if r["status"] == "overtime")

    return {
        "date": str(today),
        "stats": {
            "total_employees": len(target_users),
            "present": present,
            "pending": pending,
            "working": working,
            "on_break": on_break,
            "completed": completed,
            "late": late,
            "overtime": overtime,
            "total_work_hours": round(total_work_hours, 1),
            "total_break_hours": round(total_break_mins / 60, 1)
        },
        "employees": result
    }


# ---- Manager: employee history ----
@router.get("/employee/{user_id}/history")
def employee_history(user_id: int, days: int = 30, db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    since = date.today() - timedelta(days=days)
    logs = db.query(PunchLog).filter(
        PunchLog.user_id == user_id, PunchLog.date >= since
    ).order_by(PunchLog.timestamp.asc()).all()

    by_date = {}
    for l in logs:
        d = str(l.date)
        if d not in by_date:
            by_date[d] = []
        by_date[d].append(l)

    result = []
    for d in sorted(by_date.keys(), reverse=True):
        day_logs = by_date[d]
        summary = _calc_summary(day_logs)
        result.append({
            "date": d,
            "summary": summary,
            "logs": [
                {"id": l.id, "punch_type": l.punch_type.value, "timestamp": l.timestamp.isoformat(), "description": l.description}
                for l in day_logs
            ]
        })
    return result


# ---- Monthly punch summary for all users ----
@router.get("/monthly-summary")
def monthly_summary(month: int = None, year: int = None, db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    today = date.today()
    m = month or today.month
    y = year or today.year
    first_day = date(y, m, 1)
    last_day = date(y + (1 if m == 12 else 0), (m % 12) + 1, 1) - timedelta(days=1)

    if current_user.role in [UserRole.super_admin, UserRole.admin]:
        target_users = db.query(User).filter(User.is_active == 1, User.id != current_user.id).all()
    else:
        target_users = db.query(User).filter(User.reporting_to_id == current_user.id, User.is_active == 1).all()

    results = []
    for usr in target_users:
        logs = db.query(PunchLog).filter(PunchLog.user_id == usr.id, PunchLog.date >= first_day, PunchLog.date <= last_day).order_by(PunchLog.timestamp.asc()).all()
        by_date = {}
        for l in logs:
            d = str(l.date)
            if d not in by_date:
                by_date[d] = []
            by_date[d].append(l)

        total_punches = len(logs)
        days_present = len(by_date)
        total_hours = 0.0
        total_break = 0
        late_days = 0
        daily_records = []
        for d in sorted(by_date.keys()):
            day_logs = by_date[d]
            s = _calc_summary(day_logs)
            total_hours += s["total_hours"]
            total_break += s["break_minutes"]
            if s["is_late"]:
                late_days += 1
            daily_records.append({"date": d, "punches": len(day_logs), "hours": s["total_hours"], "break_min": s["break_minutes"], "first_in": s["first_in"], "last_out": s["last_out"], "is_late": s["is_late"]})

        end_check = min(last_day, today)
        working_days = sum(1 for dd in range((end_check - first_day).days + 1) if (first_day + timedelta(days=dd)).weekday() < 5)

        results.append({
            "user_id": usr.id, "name": usr.full_name, "email": usr.email, "role": usr.role.value,
            "department": usr.department or "Unassigned",
            "total_punches": total_punches, "days_present": days_present,
            "working_days": working_days, "absent_days": max(0, working_days - days_present),
            "total_hours": round(total_hours, 1), "avg_hours": round(total_hours / max(1, days_present), 1),
            "total_break_min": total_break, "late_days": late_days, "daily": daily_records
        })

    return {
        "month": m, "year": y,
        "month_name": ["","January","February","March","April","May","June","July","August","September","October","November","December"][m],
        "employees": results
    }
