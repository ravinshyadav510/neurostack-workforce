from sqlalchemy.orm import Session
from app.models.models import ActivityLog


def log_activity(db: Session, user_id: int | None, action: str, details: str | None = None):
    entry = ActivityLog(user_id=user_id, action=action, details=details)
    db.add(entry)
    db.commit()
