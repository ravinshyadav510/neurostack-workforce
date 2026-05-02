from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from app.models.models import UserRole, TaskStatus, TaskPriority, LeaveStatus, PunchType


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.employee
    department: Optional[str] = None
    reporting_to_id: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    department: Optional[str] = None
    reporting_to_id: Optional[int] = None
    is_active: Optional[int] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    department: Optional[str] = None
    reporting_to_id: Optional[int] = None
    is_active: int
    must_change_password: int
    created_at: datetime


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str] = None
    status: str
    deadline: Optional[datetime] = None
    created_at: datetime


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.medium
    deadline: Optional[datetime] = None
    project_id: Optional[int] = None
    assigned_to_id: int


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    deadline: Optional[datetime] = None
    project_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    rejection_feedback: Optional[str] = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    deadline: Optional[datetime] = None
    project_id: Optional[int] = None
    assigned_to_id: int
    created_by_id: int
    rejection_feedback: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CommentCreate(BaseModel):
    comment: str


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int
    user_id: int
    comment: str
    created_at: datetime


class DailyUpdateCreate(BaseModel):
    completed_work: str
    pending_work: Optional[str] = None
    blockers: Optional[str] = None
    pending_reason: Optional[str] = None


class DailyUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    completed_work: str
    pending_work: Optional[str] = None
    blockers: Optional[str] = None
    pending_reason: Optional[str] = None
    update_date: datetime
    created_at: datetime


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    title: str
    message: str
    is_read: int
    created_at: datetime


# Punch / Attendance
class PunchRequest(BaseModel):
    description: Optional[str] = None


class PunchLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    punch_type: PunchType
    timestamp: datetime
    date: date
    description: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime


# Leave
class LeaveRequestCreate(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    half_day: Optional[int] = 0
    is_emergency: Optional[int] = 0
    reason: str
    contact_during_leave: Optional[str] = None


class LeaveRequestAction(BaseModel):
    status: LeaveStatus
    manager_comment: Optional[str] = None


class LeaveRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    leave_type: str
    start_date: date
    end_date: date
    half_day: int
    is_emergency: int
    total_days: float
    reason: str
    contact_during_leave: Optional[str] = None
    status: LeaveStatus
    manager_comment: Optional[str] = None
    actioned_by_id: Optional[int] = None
    created_at: datetime


# File
class FileAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: int
    user_id: int
    filename: str
    filepath: str
    file_size: int
    created_at: datetime
