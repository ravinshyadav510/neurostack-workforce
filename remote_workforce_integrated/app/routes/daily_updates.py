from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_manager_or_admin
from app.models.models import DailyUpdate
from app.schemas.schemas import DailyUpdateCreate, DailyUpdateOut
from app.services.activity import log_activity

router = APIRouter(prefix="/daily-updates", tags=["Daily Follow-up"])

@router.post("/", response_model=DailyUpdateOut)
def create_daily_update(data: DailyUpdateCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    update = DailyUpdate(user_id=current_user.id, **data.model_dump())
    db.add(update)
    db.commit()
    db.refresh(update)
    log_activity(db, current_user.id, "daily_update_submitted", "Submitted daily follow-up")
    return update

@router.get("/mine", response_model=list[DailyUpdateOut])
def my_daily_updates(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(DailyUpdate).filter(DailyUpdate.user_id == current_user.id).order_by(DailyUpdate.created_at.desc()).all()

@router.get("/", response_model=list[DailyUpdateOut])
def all_daily_updates(db: Session = Depends(get_db), current_user=Depends(require_manager_or_admin)):
    return db.query(DailyUpdate).order_by(DailyUpdate.created_at.desc()).all()
