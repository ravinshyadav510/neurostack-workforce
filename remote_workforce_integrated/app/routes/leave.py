from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_manager_or_admin
from app.models.models import LeaveRequest, LeaveBalance, LeaveStatus, UserRole, User
from app.schemas.schemas import LeaveRequestCreate, LeaveRequestAction, LeaveRequestOut
from app.services.notifications import create_notification
from app.services.activity import log_activity

router = APIRouter(prefix="/leave", tags=["Leave"])

LEAVE_TYPES = {
    "Paid Leave": 18,
    "Sick Leave": 12,
    "Casual Leave": 8,
    "Unpaid Leave": 999
}


def _ensure_balance(db: Session, user_id: int):
    """Create leave balance rows for user if missing."""
    for lt, total in LEAVE_TYPES.items():
        existing = db.query(LeaveBalance).filter(LeaveBalance.user_id == user_id, LeaveBalance.leave_type == lt).first()
        if not existing:
            db.add(LeaveBalance(user_id=user_id, leave_type=lt, total=total, used=0))
    db.commit()


def _calc_days(start: date, end: date, half_day: int) -> float:
    if half_day:
        return 0.5
    delta = (end - start).days + 1
    return max(0.5, float(delta))


# ---- Employee: Apply leave ----
@router.post("/", response_model=LeaveRequestOut)
def request_leave(data: LeaveRequestCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    today = date.today()
    if data.start_date < today and not data.is_emergency:
        raise HTTPException(status_code=400, detail="Cannot apply leave for past dates")
    if data.end_date < data.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    _ensure_balance(db, current_user.id)
    total_days = _calc_days(data.start_date, data.end_date, data.half_day)

    # Check balance
    bal = db.query(LeaveBalance).filter(LeaveBalance.user_id == current_user.id, LeaveBalance.leave_type == data.leave_type).first()
    if bal and data.leave_type != "Unpaid Leave":
        remaining = bal.total - bal.used
        if total_days > remaining:
            raise HTTPException(status_code=400, detail=f"Insufficient {data.leave_type} balance. Available: {remaining} days")

    # Check overlapping
    overlap = db.query(LeaveRequest).filter(
        LeaveRequest.user_id == current_user.id,
        LeaveRequest.status.in_([LeaveStatus.pending, LeaveStatus.approved]),
        LeaveRequest.start_date <= data.end_date,
        LeaveRequest.end_date >= data.start_date
    ).first()
    if overlap:
        raise HTTPException(status_code=400, detail="Overlapping leave request exists for these dates")

    leave = LeaveRequest(
        user_id=current_user.id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        half_day=data.half_day or 0,
        is_emergency=data.is_emergency or 0,
        reason=data.reason,
        contact_during_leave=data.contact_during_leave,
        total_days=total_days
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    # Notify managers
    managers = db.query(User).filter(User.role.in_([UserRole.manager, UserRole.admin])).all()
    prefix = "Emergency " if data.is_emergency else ""
    for mgr in managers:
        create_notification(db, mgr.id, f"{prefix}Leave Request", f"{current_user.full_name} requested {data.leave_type}: {data.start_date} to {data.end_date}")

    log_activity(db, current_user.id, "leave_requested", f"{prefix}{data.leave_type} ({total_days} days)")
    return leave


# ---- Employee: My leaves ----
@router.get("/mine", response_model=list[LeaveRequestOut])
def my_leaves(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(LeaveRequest).filter(LeaveRequest.user_id == current_user.id).order_by(LeaveRequest.created_at.desc()).all()


# ---- Employee: My balance ----
@router.get("/balance")
def my_balance(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _ensure_balance(db, current_user.id)
    balances = db.query(LeaveBalance).filter(LeaveBalance.user_id == current_user.id).all()
    leaves = db.query(LeaveRequest).filter(LeaveRequest.user_id == current_user.id).all()
    pending = sum(1 for l in leaves if l.status == LeaveStatus.pending)
    approved = sum(1 for l in leaves if l.status == LeaveStatus.approved)
    rejected = sum(1 for l in leaves if l.status == LeaveStatus.rejected)

    return {
        "balances": [{"leave_type": b.leave_type, "total": b.total, "used": b.used, "remaining": b.total - b.used} for b in balances],
        "summary": {"total_requests": len(leaves), "pending": pending, "approved": approved, "rejected": rejected}
    }


# ---- Employee: Cancel/Withdraw ----
@router.put("/{leave_id}/cancel")
def cancel_leave(leave_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id, LeaveRequest.user_id == current_user.id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.status not in [LeaveStatus.pending, LeaveStatus.approved]:
        raise HTTPException(status_code=400, detail="Cannot cancel this leave")

    old_status = leave.status
    leave.status = LeaveStatus.withdrawn if old_status == LeaveStatus.pending else LeaveStatus.cancelled

    # Refund balance if it was approved
    if old_status == LeaveStatus.approved:
        bal = db.query(LeaveBalance).filter(LeaveBalance.user_id == current_user.id, LeaveBalance.leave_type == leave.leave_type).first()
        if bal:
            bal.used = max(0, bal.used - leave.total_days)

    db.commit()
    log_activity(db, current_user.id, "leave_cancelled", f"Cancelled {leave.leave_type}")
    return {"message": "Leave cancelled"}


# ---- Manager: All leaves ----
@router.get("/all", response_model=list[LeaveRequestOut])
def all_leaves(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    return db.query(LeaveRequest).order_by(LeaveRequest.created_at.desc()).all()


# ---- Manager: Dashboard stats ----
@router.get("/dashboard")
def leave_dashboard(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    today = date.today()
    all_leaves = db.query(LeaveRequest).all()
    pending = [l for l in all_leaves if l.status == LeaveStatus.pending]
    approved_today = [l for l in all_leaves if l.status == LeaveStatus.approved and l.created_at and l.created_at.date() == today]
    rejected_today = [l for l in all_leaves if l.status == LeaveStatus.rejected and l.created_at and l.created_at.date() == today]
    on_leave_now = [l for l in all_leaves if l.status == LeaveStatus.approved and l.start_date <= today <= l.end_date]
    upcoming = [l for l in all_leaves if l.status == LeaveStatus.approved and l.start_date > today and l.start_date <= today + timedelta(days=7)]

    # Conflict detection: same dates by multiple employees
    conflicts = []
    approved_pending = [l for l in all_leaves if l.status in [LeaveStatus.approved, LeaveStatus.pending]]
    for i, a in enumerate(approved_pending):
        for b in approved_pending[i+1:]:
            if a.user_id != b.user_id and a.start_date <= b.end_date and a.end_date >= b.start_date:
                conflicts.append({"emp1_id": a.user_id, "emp2_id": b.user_id, "overlap_start": str(max(a.start_date, b.start_date)), "overlap_end": str(min(a.end_date, b.end_date))})

    employees = db.query(User).filter(User.role == UserRole.employee).all()
    emp_map = {u.id: u.full_name for u in employees}

    return {
        "total_requests": len(all_leaves),
        "pending": len(pending),
        "approved_today": len(approved_today),
        "rejected_today": len(rejected_today),
        "on_leave_today": len(on_leave_now),
        "upcoming_week": len(upcoming),
        "conflicts": len(conflicts),
        "conflict_details": conflicts[:5],
        "on_leave_employees": [{"user_id": l.user_id, "name": emp_map.get(l.user_id, ""), "leave_type": l.leave_type, "end_date": str(l.end_date)} for l in on_leave_now],
        "upcoming_leaves": [{"user_id": l.user_id, "name": emp_map.get(l.user_id, ""), "leave_type": l.leave_type, "start_date": str(l.start_date), "end_date": str(l.end_date)} for l in upcoming[:10]],
        "pending_requests": [{"id": l.id, "user_id": l.user_id, "name": emp_map.get(l.user_id, ""), "leave_type": l.leave_type, "start_date": str(l.start_date), "end_date": str(l.end_date), "total_days": l.total_days, "reason": l.reason, "is_emergency": l.is_emergency, "created_at": l.created_at.isoformat() if l.created_at else ""} for l in pending]
    }


# ---- Manager: Employee balance ----
@router.get("/balance/{user_id}")
def employee_balance(user_id: int, db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    _ensure_balance(db, user_id)
    balances = db.query(LeaveBalance).filter(LeaveBalance.user_id == user_id).all()
    return [{"leave_type": b.leave_type, "total": b.total, "used": b.used, "remaining": b.total - b.used} for b in balances]


# ---- Manager: Approve/Reject ----
@router.put("/{leave_id}", response_model=LeaveRequestOut)
def action_leave(leave_id: int, data: LeaveRequestAction, db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if leave.status != LeaveStatus.pending:
        raise HTTPException(status_code=400, detail="Can only action pending requests")

    leave.status = data.status
    leave.manager_comment = data.manager_comment
    leave.actioned_by_id = current_user.id

    # Update balance if approved
    if data.status == LeaveStatus.approved:
        _ensure_balance(db, leave.user_id)
        bal = db.query(LeaveBalance).filter(LeaveBalance.user_id == leave.user_id, LeaveBalance.leave_type == leave.leave_type).first()
        if bal:
            bal.used += leave.total_days

    db.commit()
    db.refresh(leave)

    action_word = "approved" if data.status == LeaveStatus.approved else "rejected"
    create_notification(db, leave.user_id, f"Leave {action_word.title()}", f"Your {leave.leave_type} request has been {action_word}." + (f" Comment: {data.manager_comment}" if data.manager_comment else ""))
    log_activity(db, current_user.id, f"leave_{action_word}", f"{action_word.title()} {leave.leave_type} for user {leave.user_id}")
    return leave
