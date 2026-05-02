from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_admin, require_manager_or_admin
from app.models.models import User, UserRole
from app.schemas.schemas import UserCreate, UserUpdate, UserOut, ChangePassword
from app.core.security import hash_password, verify_password
from app.services.activity import log_activity

router = APIRouter(prefix="/users", tags=["Users"])

DEPARTMENTS = ["Engineering", "Product", "Design", "QA", "DevOps", "HR", "Marketing", "Sales", "Support", "Finance"]


@router.get("/departments")
def list_departments():
    return DEPARTMENTS


@router.post("/", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    # Admin cannot create super_admin
    if data.role == UserRole.super_admin and admin.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Only super admin can create super admin accounts")

    # Validate reporting_to
    if data.reporting_to_id:
        manager = db.query(User).filter(User.id == data.reporting_to_id).first()
        if not manager:
            raise HTTPException(status_code=400, detail="Reporting manager not found")
        if manager.role not in [UserRole.manager, UserRole.admin, UserRole.super_admin]:
            raise HTTPException(status_code=400, detail="Reporting to must be a manager or admin")

    user = User(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        department=data.department,
        reporting_to_id=data.reporting_to_id,
        must_change_password=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, admin.id, "user_created", f"Created {user.role.value} {user.email} in {user.department or 'N/A'}")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.role == UserRole.super_admin and admin.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Cannot assign super admin role")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    log_activity(db, admin.id, "user_updated", f"Updated user {user.email}")
    return user


@router.delete("/{user_id}")
def deactivate_user(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Cannot deactivate super admin")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user.is_active = 0
    db.commit()
    log_activity(db, admin.id, "user_deactivated", f"Deactivated {user.email}")
    return {"message": "User deactivated"}


@router.put("/{user_id}/activate")
def activate_user(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = 1
    db.commit()
    log_activity(db, admin.id, "user_activated", f"Activated {user.email}")
    return {"message": "User activated"}


@router.put("/{user_id}/reset-password")
def reset_password(user_id: int, db: Session = Depends(get_db), admin=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    temp_pwd = "Welcome@123"
    user.hashed_password = hash_password(temp_pwd)
    user.must_change_password = 1
    db.commit()
    log_activity(db, admin.id, "password_reset", f"Reset password for {user.email}")
    return {"message": f"Password reset to: {temp_pwd}", "temp_password": temp_pwd}


@router.post("/change-password")
def change_password(data: ChangePassword, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    current_user.hashed_password = hash_password(data.new_password)
    current_user.must_change_password = 0
    db.commit()
    return {"message": "Password changed successfully"}


@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/me", response_model=UserOut)
def my_profile(current_user=Depends(get_current_user)):
    return current_user


@router.get("/hierarchy")
def user_hierarchy(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    """Return users grouped by reporting structure."""
    users = db.query(User).filter(User.is_active == 1).all()
    user_map = {u.id: u for u in users}

    result = []
    for u in users:
        mgr_name = ""
        if u.reporting_to_id and u.reporting_to_id in user_map:
            mgr_name = user_map[u.reporting_to_id].full_name

        reports = [x for x in users if x.reporting_to_id == u.id]

        result.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role.value,
            "department": u.department or "Unassigned",
            "reporting_to": mgr_name,
            "reporting_to_id": u.reporting_to_id,
            "direct_reports": len(reports),
            "is_active": u.is_active
        })

    return result
