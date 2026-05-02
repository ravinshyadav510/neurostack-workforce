from datetime import datetime, timedelta, timezone, date
from sqlalchemy.orm import Session
from app.models.models import (
    User, UserRole, Project, Task, TaskPriority, TaskStatus,
    DailyUpdate, Notification, TaskComment, PunchLog, PunchType, LeaveRequest, LeaveBalance, LeaveStatus
)
from app.core.security import hash_password


def seed_demo_data(db: Session):
    if db.query(User).first():
        return

    super_admin = User(full_name="Aman Yadav", email="ravinshyadav510@gmail.com", hashed_password=hash_password("49078"), role=UserRole.super_admin, department="IT")
    admin = User(full_name="Ravinsh Kumar", email="admin@demo.com", hashed_password=hash_password("admin123"), role=UserRole.admin, department="IT")
    manager = User(full_name="Priya Sharma", email="manager@demo.com", hashed_password=hash_password("manager123"), role=UserRole.manager, department="Engineering")
    emp1 = User(full_name="Aman Developer", email="aman@demo.com", hashed_password=hash_password("aman123"), role=UserRole.employee, department="Engineering")
    emp2 = User(full_name="Sneha Gupta", email="sneha@demo.com", hashed_password=hash_password("sneha123"), role=UserRole.employee, department="Design")
    emp3 = User(full_name="Rohit Verma", email="rohit@demo.com", hashed_password=hash_password("rohit123"), role=UserRole.employee, department="DevOps")

    db.add_all([super_admin, admin, manager, emp1, emp2, emp3])
    db.commit()

    # Set reporting hierarchy
    admin.reporting_to_id = super_admin.id
    manager.reporting_to_id = admin.id
    emp1.reporting_to_id = manager.id
    emp2.reporting_to_id = manager.id
    emp3.reporting_to_id = manager.id
    db.commit()

    now = datetime.now(timezone.utc)

    website = Project(name="Company Website Redesign", description="Complete redesign with modern UI.", created_by_id=manager.id, deadline=now + timedelta(days=30))
    mobile = Project(name="Mobile App MVP", description="Build MVP for remote workforce app.", created_by_id=manager.id, deadline=now + timedelta(days=45))
    api_proj = Project(name="API Platform v2", description="Rebuild backend API with security.", created_by_id=manager.id, deadline=now + timedelta(days=60))

    db.add_all([website, mobile, api_proj])
    db.commit()
    db.refresh(website)
    db.refresh(mobile)
    db.refresh(api_proj)

    tasks = [
        Task(title="Build login page UI", description="Professional login screen with validation.", priority=TaskPriority.high, status=TaskStatus.completed, project_id=website.id, assigned_to_id=emp1.id, created_by_id=manager.id, deadline=now - timedelta(days=2)),
        Task(title="Dashboard cards component", description="Stat cards with progress bars and quick actions.", priority=TaskPriority.high, status=TaskStatus.in_progress, project_id=website.id, assigned_to_id=emp1.id, created_by_id=manager.id, deadline=now + timedelta(days=3)),
        Task(title="API error handling", description="Global error handling middleware.", priority=TaskPriority.urgent, status=TaskStatus.blocked, project_id=api_proj.id, assigned_to_id=emp1.id, created_by_id=manager.id, deadline=now - timedelta(days=1)),
        Task(title="User profile page", description="Settings page for profile updates.", priority=TaskPriority.medium, status=TaskStatus.pending, project_id=website.id, assigned_to_id=emp1.id, created_by_id=manager.id, deadline=now + timedelta(days=7)),
        Task(title="Unit tests for auth", description="Cover login and token flows.", priority=TaskPriority.medium, status=TaskStatus.under_review, project_id=api_proj.id, assigned_to_id=emp1.id, created_by_id=manager.id, deadline=now + timedelta(days=0)),
        Task(title="Design mobile wireframes", description="Wireframes for all key screens.", priority=TaskPriority.high, status=TaskStatus.completed, project_id=mobile.id, assigned_to_id=emp2.id, created_by_id=manager.id, deadline=now - timedelta(days=5)),
        Task(title="Push notifications", description="Push notification service setup.", priority=TaskPriority.high, status=TaskStatus.in_progress, project_id=mobile.id, assigned_to_id=emp2.id, created_by_id=manager.id, deadline=now + timedelta(days=5)),
        Task(title="Employee onboarding flow", description="Step-by-step onboarding wizard.", priority=TaskPriority.medium, status=TaskStatus.pending, project_id=website.id, assigned_to_id=emp2.id, created_by_id=manager.id, deadline=now + timedelta(days=12)),
        Task(title="Mobile task list screen", description="Task list with filters and search.", priority=TaskPriority.medium, status=TaskStatus.pending, project_id=mobile.id, assigned_to_id=emp2.id, created_by_id=manager.id, deadline=now + timedelta(days=8)),
        Task(title="Database optimization", description="Analyze slow queries, add indexes.", priority=TaskPriority.urgent, status=TaskStatus.in_progress, project_id=api_proj.id, assigned_to_id=emp3.id, created_by_id=manager.id, deadline=now + timedelta(days=2)),
        Task(title="Setup CI/CD pipeline", description="GitHub Actions for automated testing.", priority=TaskPriority.high, status=TaskStatus.completed, project_id=api_proj.id, assigned_to_id=emp3.id, created_by_id=manager.id, deadline=now - timedelta(days=3)),
        Task(title="File upload API", description="Secure file upload with validation.", priority=TaskPriority.medium, status=TaskStatus.pending, project_id=api_proj.id, assigned_to_id=emp3.id, created_by_id=manager.id, deadline=now + timedelta(days=14)),
        Task(title="Security audit fixes", description="Address XSS, CSRF, SQL injection.", priority=TaskPriority.urgent, status=TaskStatus.blocked, project_id=api_proj.id, assigned_to_id=emp3.id, created_by_id=manager.id, deadline=now + timedelta(days=1)),
        Task(title="API rate limiting", description="Rate limiting middleware.", priority=TaskPriority.low, status=TaskStatus.pending, project_id=api_proj.id, assigned_to_id=emp3.id, created_by_id=manager.id, deadline=now + timedelta(days=20)),
    ]
    db.add_all(tasks)
    db.commit()

    # Daily updates
    db.add(DailyUpdate(user_id=emp1.id, completed_work="Finished login page UI with validation.", pending_work="Dashboard charts.", blockers="No blockers.", pending_reason="Waiting for design approval."))
    db.add(DailyUpdate(user_id=emp2.id, completed_work="Completed mobile wireframes.", pending_work="Push notification integration.", blockers="Waiting for FCM credentials.", pending_reason="DevOps has not shared credentials yet."))
    db.add(DailyUpdate(user_id=emp3.id, completed_work="Set up CI/CD with GitHub Actions.", pending_work="DB query optimization.", blockers="Need production DB metrics.", pending_reason="Metrics access pending approval."))

    # Comments
    db.add(TaskComment(task_id=tasks[1].id, user_id=manager.id, comment="Please prioritize stat cards for Friday demo."))
    db.add(TaskComment(task_id=tasks[1].id, user_id=emp1.id, comment="Cards done, starting chart component now."))
    db.add(TaskComment(task_id=tasks[2].id, user_id=emp1.id, comment="Blocked - need API spec doc for error format."))
    db.add(TaskComment(task_id=tasks[2].id, user_id=manager.id, comment="Shared API spec doc on Slack."))
    db.add(TaskComment(task_id=tasks[6].id, user_id=emp2.id, comment="FCM setup done. Testing on Android."))
    db.add(TaskComment(task_id=tasks[9].id, user_id=emp3.id, comment="Found 3 slow queries. Adding indexes."))

    # Notifications
    db.add(Notification(user_id=emp1.id, title="New Task Assigned", message="Dashboard cards component assigned to you."))
    db.add(Notification(user_id=emp1.id, title="Task Overdue", message="API error handling is past deadline!"))
    db.add(Notification(user_id=emp2.id, title="New Task Assigned", message="Employee onboarding flow assigned to you."))
    db.add(Notification(user_id=emp3.id, title="Deadline Approaching", message="Security audit fixes deadline is tomorrow!"))
    db.add(Notification(user_id=manager.id, title="Task Completed", message="Aman completed: Build login page UI"))
    db.add(Notification(user_id=manager.id, title="Task for Review", message="Aman submitted Unit tests for auth for review"))

    # Punch logs (attendance)
    for emp in [emp1, emp2, emp3]:
        for days_ago in range(1, 5):
            d = date.today() - timedelta(days=days_ago)
            morning_in = datetime(d.year, d.month, d.day, 9, min(days_ago * 3, 15))
            lunch_out = datetime(d.year, d.month, d.day, 13, 0)
            lunch_in = datetime(d.year, d.month, d.day, 13, 45)
            evening_out = datetime(d.year, d.month, d.day, 17, 30 + days_ago * 5)
            db.add(PunchLog(user_id=emp.id, punch_type=PunchType.IN, timestamp=morning_in, date=d, description="Day start"))
            db.add(PunchLog(user_id=emp.id, punch_type=PunchType.OUT, timestamp=lunch_out, date=d, description="Lunch break"))
            db.add(PunchLog(user_id=emp.id, punch_type=PunchType.IN, timestamp=lunch_in, date=d, description="Back from lunch"))
            db.add(PunchLog(user_id=emp.id, punch_type=PunchType.OUT, timestamp=evening_out, date=d, description="Day end"))

    # Leave balances
    for emp in [emp1, emp2, emp3]:
        db.add(LeaveBalance(user_id=emp.id, leave_type="Paid Leave", total=18, used=3))
        db.add(LeaveBalance(user_id=emp.id, leave_type="Sick Leave", total=12, used=1))
        db.add(LeaveBalance(user_id=emp.id, leave_type="Casual Leave", total=8, used=2))
        db.add(LeaveBalance(user_id=emp.id, leave_type="Unpaid Leave", total=999, used=0))

    # Leave requests
    db.add(LeaveRequest(user_id=emp1.id, leave_type="Sick Leave", start_date=date.today()+timedelta(days=5), end_date=date.today()+timedelta(days=6), total_days=2, reason="Feeling unwell, need rest.", status=LeaveStatus.pending, contact_during_leave="9876543210"))
    db.add(LeaveRequest(user_id=emp1.id, leave_type="Casual Leave", start_date=date.today()-timedelta(days=10), end_date=date.today()-timedelta(days=10), total_days=1, half_day=0, reason="Family function.", status=LeaveStatus.approved, manager_comment="Approved.", actioned_by_id=manager.id))
    db.add(LeaveRequest(user_id=emp2.id, leave_type="Paid Leave", start_date=date.today()+timedelta(days=10), end_date=date.today()+timedelta(days=14), total_days=5, reason="Family vacation.", status=LeaveStatus.approved, manager_comment="Enjoy!", actioned_by_id=manager.id))
    db.add(LeaveRequest(user_id=emp2.id, leave_type="Sick Leave", start_date=date.today()+timedelta(days=2), end_date=date.today()+timedelta(days=2), total_days=0.5, half_day=1, is_emergency=1, reason="Doctor appointment.", status=LeaveStatus.pending, contact_during_leave="9988776655"))
    db.add(LeaveRequest(user_id=emp3.id, leave_type="Casual Leave", start_date=date.today()-timedelta(days=2), end_date=date.today()-timedelta(days=1), total_days=2, reason="Personal emergency.", status=LeaveStatus.approved, manager_comment="Approved.", actioned_by_id=manager.id))
    db.add(LeaveRequest(user_id=emp3.id, leave_type="Paid Leave", start_date=date.today()+timedelta(days=3), end_date=date.today()+timedelta(days=4), total_days=2, reason="Short trip.", status=LeaveStatus.pending))

    db.commit()
