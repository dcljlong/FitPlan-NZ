from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date, timedelta, timezone
import holidays

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

cors_origins_env = os.environ.get("CORS_ORIGINS", "")
cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
if not cors_origins:
    cors_origins = [
        "http://localhost:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


# ==================== NZ REGIONS ====================
NZ_REGIONS = {
    "NTL": "Northland",
    "AUK": "Auckland",
    "WKO": "Waikato",
    "BOP": "Bay of Plenty",
    "GIS": "Gisborne",
    "HKB": "Hawke's Bay",
    "TKI": "Taranaki",
    "MWT": "Manawatu-Whanganui",
    "WGN": "Wellington",
    "TAS": "Tasman",
    "NSN": "Nelson",
    "MBH": "Marlborough",
    "WTL": "West Coast",
    "CAN": "Canterbury",
    "STC": "South Canterbury",
    "OTA": "Otago",
    "STL": "Southland",
    "CIT": "Chatham Islands",
}

# ==================== WORK SCHEDULE UTILITIES ====================

def get_hours_for_weekday(weekday: int) -> float:
    """Mon-Thu=9h, Fri=8h, Sat=6h, Sun=0h. weekday: 0=Mon..6=Sun"""
    if weekday <= 3:
        return 9.0
    if weekday == 4:
        return 8.0
    if weekday == 5:
        return 6.0
    return 0.0


def get_nz_holidays_set(region: str, years: list) -> set:
    """Get set of holiday dates for NZ region."""
    try:
        nz = holidays.NZ(years=years, prov=region)
        return set(nz.keys())
    except Exception:
        nz = holidays.NZ(years=years)
        return set(nz.keys())


def is_working_day(d: date, saturday_enabled: bool, holiday_set: set) -> bool:
    wd = d.weekday()
    if wd == 6:
        return False
    if wd == 5 and not saturday_enabled:
        return False
    if d in holiday_set:
        return False
    return True


def calculate_end_date(start: date, duration_days: int, saturday_enabled: bool, region: str) -> date:
    if duration_days <= 0:
        return start
    years = list(range(start.year, start.year + 3))
    hols = get_nz_holidays_set(region, years)
    current = start
    counted = 0
    while counted < duration_days:
        if is_working_day(current, saturday_enabled, hols):
            counted += 1
            if counted < duration_days:
                current += timedelta(days=1)
        else:
            current += timedelta(days=1)
    return current


def count_working_days(start: date, end: date, saturday_enabled: bool, region: str) -> int:
    years = list(range(start.year, end.year + 1))
    hols = get_nz_holidays_set(region, years)
    count = 0
    current = start
    while current <= end:
        if is_working_day(current, saturday_enabled, hols):
            count += 1
        current += timedelta(days=1)
    return count


def calculate_working_hours(start: date, end: date, saturday_enabled: bool, region: str) -> float:
    years = list(range(start.year, end.year + 1))
    hols = get_nz_holidays_set(region, years)
    total = 0.0
    current = start
    while current <= end:
        if is_working_day(current, saturday_enabled, hols):
            total += get_hours_for_weekday(current.weekday())
        current += timedelta(days=1)
    return total


def calculate_required_staff(quoted_hours: float, start: date, end: date, saturday_enabled: bool, region: str) -> float:
    total_hrs = calculate_working_hours(start, end, saturday_enabled, region)
    if total_hrs == 0:
        return 0.0
    return round(quoted_hours / total_hrs, 2)


def get_progress_indicator(quoted_hours: float, logged_hours: float) -> str:
    if quoted_hours <= 0:
        return "neutral"
    ratio = logged_hours / quoted_hours
    if ratio < 0.9:
        return "green"
    if ratio <= 1.0:
        return "yellow"
    return "red"

# ==================== PYDANTIC MODELS ====================

class LoginRequest(BaseModel):
    name: str

class TeamMemberCreate(BaseModel):
    name: str
    role: str = ""

class TeamMemberResponse(BaseModel):
    id: str
    name: str
    role: str
    created_at: str

class TemplateTask(BaseModel):
    name: str
    order: int
    duration_days: int = 5
    dependencies: List[int] = []

class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    is_default: bool
    tasks: List[TemplateTask]
    created_at: str

class SaveAsTemplateRequest(BaseModel):
    name: str
    description: str = ""
    project_id: str

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    start_date: str
    saturday_enabled: bool = False
    location_region: str = "AUK"
    template_id: Optional[str] = None
    created_by: str = ""

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    saturday_enabled: Optional[bool] = None
    location_region: Optional[str] = None
    status: Optional[str] = None

class TaskCreate(BaseModel):
    name: str
    start_date: Optional[str] = None  # manual override, else auto from deps
    end_date: Optional[str] = None  # if set with start_date, duration calculated
    duration_days: int = 5
    quoted_hours: float = 0
    order: int = 0
    dependencies: List[str] = []
    assigned_to: List[str] = []
    notes: str = ""

class TaskUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None  # manual override
    end_date: Optional[str] = None
    duration_days: Optional[int] = None
    quoted_hours: Optional[float] = None
    order: Optional[int] = None
    dependencies: Optional[List[str]] = None
    assigned_to: Optional[List[str]] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class ReorderTasksRequest(BaseModel):
    task_ids: List[str]  # ordered list of task ids

class HourLogCreate(BaseModel):
    team_member_name: str
    hours: float
    date: str
    notes: str = ""

# ==================== DEFAULT TEMPLATES ====================

DEFAULT_TEMPLATES = [
    {
        "id": str(uuid.uuid4()),
        "name": "Full Interior Fitout",
        "description": "Complete interior fitout with all trades - steel partitions through to feature linings",
        "is_default": True,
        "tasks": [
            {"name": "Steel Partitions", "order": 0, "duration_days": 5, "dependencies": []},
            {"name": "Aluminium Joinery", "order": 1, "duration_days": 4, "dependencies": [0]},
            {"name": "Doors", "order": 2, "duration_days": 3, "dependencies": [0]},
            {"name": "Gib & Villa Board Linings", "order": 3, "duration_days": 6, "dependencies": [0, 1, 2]},
            {"name": "Plastering", "order": 4, "duration_days": 4, "dependencies": [3]},
            {"name": "Concealed Grid", "order": 5, "duration_days": 3, "dependencies": [0]},
            {"name": "2-Way Grid & Tiles", "order": 6, "duration_days": 4, "dependencies": [5]},
            {"name": "Feature Linings", "order": 7, "duration_days": 3, "dependencies": [4, 6]},
        ],
        "created_at": datetime.now(timezone.utc).isoformat(),
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Partition & Linings",
        "description": "Partitions, linings and plastering package",
        "is_default": True,
        "tasks": [
            {"name": "Steel Partitions", "order": 0, "duration_days": 5, "dependencies": []},
            {"name": "Gib & Villa Board Linings", "order": 1, "duration_days": 6, "dependencies": [0]},
            {"name": "Plastering", "order": 2, "duration_days": 4, "dependencies": [1]},
            {"name": "Feature Linings", "order": 3, "duration_days": 3, "dependencies": [2]},
        ],
        "created_at": datetime.now(timezone.utc).isoformat(),
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Ceiling Works",
        "description": "Ceiling grid systems, tiles and features",
        "is_default": True,
        "tasks": [
            {"name": "Concealed Grid", "order": 0, "duration_days": 3, "dependencies": []},
            {"name": "2-Way Grid & Tiles", "order": 1, "duration_days": 4, "dependencies": [0]},
            {"name": "Feature Linings", "order": 2, "duration_days": 3, "dependencies": [1]},
        ],
        "created_at": datetime.now(timezone.utc).isoformat(),
    },
]

def get_staffing_status(required_staff: float, allocated_staff_count: int) -> str:
    if required_staff <= 0:
        return "neutral"
    if allocated_staff_count <= 0:
        return "unassigned"
    if allocated_staff_count + 0.01 < required_staff:
        return "under"
    if allocated_staff_count > required_staff + 0.5:
        return "over"
    return "ok"

def get_schedule_conflict_status(task: dict, project: dict) -> str:
    target_end = project.get("target_end_date")
    task_end = task.get("end_date")
    if not target_end or not task_end:
        return "neutral"
    if str(task_end) > str(target_end):
        return "late"
    return "ok"

async def build_task_response(task: dict, project: dict) -> dict:
    start = date.fromisoformat(task["start_date"])
    end = date.fromisoformat(task["end_date"])
    sat = project.get("saturday_enabled", False)
    region = project.get("location_region", "AUK")

    logs = await db.hour_logs.find({"task_id": task["id"]}, {"_id": 0}).to_list(1000)
    logged = sum(entry.get("hours", 0) for entry in logs)
    quoted_hours = task.get("quoted_hours", 0)
    allocated_staff_count = int(task.get("allocated_staff_count", 0) or 0)
    req_staff = calculate_required_staff(quoted_hours, start, end, sat, region)
    indicator = get_progress_indicator(quoted_hours, logged)
    staffing_status = get_staffing_status(req_staff, allocated_staff_count)
    schedule_conflict_status = get_schedule_conflict_status(task, project)

    return {
        "id": task["id"],
        "project_id": task["project_id"],
        "name": task["name"],
        "start_date": task["start_date"],
        "end_date": task["end_date"],
        "duration_days": task["duration_days"],
        "quoted_hours": quoted_hours,
        "logged_hours": logged,
        "required_staff": req_staff,
        "allocated_staff_count": allocated_staff_count,
        "staff_gap": round(req_staff - allocated_staff_count, 2),
        "staffing_status": staffing_status,
        "schedule_conflict_status": schedule_conflict_status,
        "order": task["order"],
        "dependencies": task.get("dependencies", []),
        "assigned_to": task.get("assigned_to", []),
        "status": task.get("status", "not_started"),
        "progress_indicator": indicator,
        "notes": task.get("notes", ""),
    }


async def recalculate_task_dates(project_id: str):
    """Recalculate start/end dates for all tasks in a project based on dependencies."""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        return
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).sort("order", 1).to_list(1000)
    if not tasks:
        return

    sat = project.get("saturday_enabled", False)
    region = project.get("location_region", "AUK")
    proj_start = date.fromisoformat(project["start_date"])

    task_map = {t["id"]: t for t in tasks}
    resolved = {}

    def resolve(task):
        tid = task["id"]
        if tid in resolved:
            return resolved[tid]

        def next_working_day(d):
            years = list(range(d.year, d.year + 2))
            hols = get_nz_holidays_set(region, years)
            while not is_working_day(d, sat, hols):
                d += timedelta(days=1)
            return d

        deps = task.get("dependencies", [])
        if not deps:
            earliest_allowed = next_working_day(proj_start)
        else:
            latest_end = proj_start
            for dep_id in deps:
                if dep_id in task_map:
                    dep_resolved = resolve(task_map[dep_id])
                    dep_end = date.fromisoformat(dep_resolved["end_date"])
                    next_day = dep_end + timedelta(days=1)
                    if next_day > latest_end:
                        latest_end = next_day
            earliest_allowed = next_working_day(latest_end)

        manual_start = task.get("start_date_override")
        if manual_start:
            manual_date = next_working_day(date.fromisoformat(manual_start))
            s = manual_date if manual_date >= earliest_allowed else earliest_allowed
        else:
            s = earliest_allowed

        e = calculate_end_date(s, task["duration_days"], sat, region)
        resolved[tid] = {"start_date": s.isoformat(), "end_date": e.isoformat()}
        return resolved[tid]

    for t in tasks:
        resolve(t)

    for tid, dates in resolved.items():
        await db.tasks.update_one({"id": tid}, {"$set": dates})

    all_ends = [date.fromisoformat(d["end_date"]) for d in resolved.values()]
    if all_ends:
        proj_end = max(all_ends).isoformat()
        await db.projects.update_one({"id": project_id}, {"$set": {"end_date": proj_end, "updated_at": datetime.now(timezone.utc).isoformat()}})


# ==================== API ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "FitPlan NZ API - Construction Project Planner"}

# --- Auth ---
@api_router.post("/auth/login")
async def login(req: LoginRequest):
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    existing = await db.team_members.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}}, {"_id": 0})
    if not existing:
        member = {
            "id": str(uuid.uuid4()),
            "name": name,
            "role": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.team_members.insert_one(member)
    return {"name": name, "message": f"Welcome, {name}!"}

# --- Regions ---
@api_router.get("/regions")
async def get_regions():
    return [{"code": k, "name": v} for k, v in NZ_REGIONS.items()]

# --- Holidays ---
@api_router.get("/holidays")
async def get_holidays(region: str = "AUK", year: int = None):
    if year is None:
        year = date.today().year
    years = [year, year + 1]
    try:
        nz = holidays.NZ(years=years, prov=region)
    except Exception:
        nz = holidays.NZ(years=years)
    result = [{"date": d.isoformat(), "name": n} for d, n in sorted(nz.items())]
    return result

# --- Templates ---
@api_router.get("/templates")
async def get_templates():
    templates = await db.templates.find({}, {"_id": 0}).to_list(100)
    return templates

@api_router.post("/templates/save-from-project")
async def save_template_from_project(req: SaveAsTemplateRequest):
    project = await db.projects.find_one({"id": req.project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = await db.tasks.find({"project_id": req.project_id}, {"_id": 0}).sort("order", 1).to_list(100)

    template_tasks = []
    task_id_to_order = {t["id"]: t["order"] for t in tasks}
    for t in tasks:
        dep_orders = []
        for dep_id in t.get("dependencies", []):
            if dep_id in task_id_to_order:
                dep_orders.append(task_id_to_order[dep_id])
        template_tasks.append({
            "name": t["name"],
            "order": t["order"],
            "duration_days": t["duration_days"],
            "dependencies": dep_orders,
        })

    template = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "description": req.description,
        "is_default": False,
        "tasks": template_tasks,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.templates.insert_one(template)
    template.pop("_id", None)
    return template

# --- Projects ---
@api_router.get("/projects")
async def get_projects():
    projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    result = []
    for p in projects:
        tasks = await db.tasks.find({"project_id": p["id"]}, {"_id": 0}).to_list(200)
        total_quoted = sum(t.get("quoted_hours", 0) for t in tasks)
        total_logged = 0
        for t in tasks:
            logs = await db.hour_logs.find({"task_id": t["id"]}, {"_id": 0}).to_list(1000)
            total_logged += sum(entry.get("hours", 0) for entry in logs)
        completed = sum(1 for t in tasks if t.get("status") == "completed")
        p["task_count"] = len(tasks)
        p["completed_tasks"] = completed
        p["total_quoted_hours"] = total_quoted
        p["total_logged_hours"] = total_logged
        p["overall_indicator"] = get_progress_indicator(total_quoted, total_logged)
        result.append(p)
    return result

@api_router.post("/projects")
async def create_project(req: ProjectCreate):
    proj_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    project = {
        "id": proj_id,
        "name": req.name,
        "description": req.description,
        "start_date": req.start_date,
        "end_date": req.start_date,
        "saturday_enabled": req.saturday_enabled,
        "location_region": req.location_region,
        "created_by": req.created_by,
        "created_at": now,
        "updated_at": now,
        "status": "active",
    }
    await db.projects.insert_one(project)

    if req.template_id:
        template = await db.templates.find_one({"id": req.template_id}, {"_id": 0})
        if template and template.get("tasks"):
            order_to_id = {}
            for tt in sorted(template["tasks"], key=lambda x: x["order"]):
                task_id = str(uuid.uuid4())
                order_to_id[tt["order"]] = task_id
                dep_ids = [order_to_id[o] for o in tt.get("dependencies", []) if o in order_to_id]
                task = {
                    "id": task_id,
                    "project_id": proj_id,
                    "name": tt["name"],
                    "start_date": req.start_date,
                    "end_date": req.start_date,
                    "duration_days": tt["duration_days"],
                    "quoted_hours": 0,
                    "order": tt["order"],
                    "dependencies": dep_ids,
                    "assigned_to": [],
                    "status": "not_started",
                    "notes": "",
                    "created_at": now,
                }
                await db.tasks.insert_one(task)
            await recalculate_task_dates(proj_id)

    project = await db.projects.find_one({"id": proj_id}, {"_id": 0})
    return project

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).sort("order", 1).to_list(200)
    task_responses = []
    for t in tasks:
        task_responses.append(await build_task_response(t, project))
    project["tasks"] = task_responses
    total_quoted = sum(t["quoted_hours"] for t in task_responses)
    total_logged = sum(t["logged_hours"] for t in task_responses)
    project["total_quoted_hours"] = total_quoted
    project["total_logged_hours"] = total_logged
    project["total_required_staff"] = round(sum(t.get("required_staff", 0) for t in task_responses), 2)
    project["total_allocated_staff"] = sum(t.get("allocated_staff_count", 0) for t in task_responses)
    project["understaffed_tasks"] = sum(1 for t in task_responses if t.get("staffing_status") in {"under", "unassigned"})
    project["late_tasks"] = sum(1 for t in task_responses if t.get("schedule_conflict_status") == "late")
    project["forecast_end_date"] = project.get("end_date")
    project["overall_indicator"] = get_progress_indicator(total_quoted, total_logged)
    return project

@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, req: ProjectUpdate):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    updates = {k: v for k, v in req.dict().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.projects.update_one({"id": project_id}, {"$set": updates})
    need_recalc = "start_date" in updates or "saturday_enabled" in updates or "location_region" in updates
    if need_recalc:
        await recalculate_task_dates(project_id)
    return await db.projects.find_one({"id": project_id}, {"_id": 0})

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    await db.projects.delete_one({"id": project_id})
    task_ids = [t["id"] for t in await db.tasks.find({"project_id": project_id}, {"id": 1, "_id": 0}).to_list(500)]
    await db.tasks.delete_many({"project_id": project_id})
    if task_ids:
        await db.hour_logs.delete_many({"task_id": {"$in": task_ids}})
    return {"message": "Project deleted"}

# --- Tasks ---
@api_router.get("/projects/{project_id}/tasks")
async def get_project_tasks(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).sort("order", 1).to_list(200)
    return [await build_task_response(t, project) for t in tasks]

@api_router.post("/projects/{project_id}/tasks")
async def create_task(project_id: str, req: TaskCreate):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing_tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).sort("order", 1).to_list(500)

    insert_order = len(existing_tasks)
    if req.dependencies:
        dep_orders = []
        for dep_id in req.dependencies:
            dep = next((t for t in existing_tasks if t["id"] == dep_id), None)
            if dep:
                dep_orders.append(dep.get("order", 0))
        if dep_orders:
            insert_order = max(dep_orders) + 1

    for t in existing_tasks:
        if t.get("order", 0) >= insert_order:
            await db.tasks.update_one({"id": t["id"]}, {"$set": {"order": t.get("order", 0) + 1}})

    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    task = {
        "id": task_id,
        "project_id": project_id,
        "name": req.name,
        "start_date": req.start_date or project["start_date"],
        "end_date": project["start_date"],
        "start_date_override": req.start_date,  # None if auto, date string if manual
        "duration_days": req.duration_days,
        "quoted_hours": req.quoted_hours,
        "order": insert_order,
        "dependencies": req.dependencies,
        "assigned_to": req.assigned_to,
        "status": "not_started",
        "notes": req.notes,
        "created_at": now,
    }
    await db.tasks.insert_one(task)

    reordered = await db.tasks.find({"project_id": project_id}, {"_id": 0}).sort("order", 1).to_list(500)
    for idx, t in enumerate(reordered):
        await db.tasks.update_one({"id": t["id"]}, {"$set": {"order": idx}})

    await recalculate_task_dates(project_id)
    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return await build_task_response(updated_task, project)

@api_router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    project = await db.projects.find_one({"id": task["project_id"]}, {"_id": 0})
    return await build_task_response(task, project)

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, req: TaskUpdate):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    updates = {k: v for k, v in req.dict().items() if v is not None}

    # Handle start_date as a manual override
    if "start_date" in updates:
        updates["start_date_override"] = updates["start_date"]

    if updates:
        await db.tasks.update_one({"id": task_id}, {"$set": updates})

    if "dependencies" in updates:
        all_tasks = await db.tasks.find({"project_id": task["project_id"]}, {"_id": 0}).sort("order", 1).to_list(500)
        updated_task = next((t for t in all_tasks if t["id"] == task_id), None)
        if updated_task:
            dep_orders = []
            for dep_id in updated_task.get("dependencies", []):
                dep = next((t for t in all_tasks if t["id"] == dep_id), None)
                if dep:
                    dep_orders.append(dep.get("order", 0))

            if dep_orders:
                target_order = max(dep_orders) + 1
                current_order = updated_task.get("order", 0)

                if target_order != current_order:
                    reordered = [t for t in all_tasks if t["id"] != task_id]
                    if target_order > len(reordered):
                        target_order = len(reordered)
                    reordered.insert(target_order, updated_task)

                    for idx, t in enumerate(reordered):
                        await db.tasks.update_one({"id": t["id"]}, {"$set": {"order": idx}})

    need_recalc = any(k in updates for k in ["duration_days", "dependencies", "order", "start_date"])
    if need_recalc:
        await recalculate_task_dates(task["project_id"])

    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    project = await db.projects.find_one({"id": task["project_id"]}, {"_id": 0})
    return await build_task_response(updated_task, project)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.tasks.delete_one({"id": task_id})
    await db.hour_logs.delete_many({"task_id": task_id})
    remaining = await db.tasks.find({"project_id": task["project_id"]}, {"_id": 0}).to_list(200)
    for r in remaining:
        if task_id in r.get("dependencies", []):
            new_deps = [d for d in r["dependencies"] if d != task_id]
            await db.tasks.update_one({"id": r["id"]}, {"$set": {"dependencies": new_deps}})
    await recalculate_task_dates(task["project_id"])
    return {"message": "Task deleted"}

# --- Reorder Tasks ---
@api_router.post("/projects/{project_id}/reorder-tasks")
async def reorder_tasks(project_id: str, req: ReorderTasksRequest):
    """Reorder tasks by providing an ordered list of task IDs."""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for idx, tid in enumerate(req.task_ids):
        await db.tasks.update_one({"id": tid}, {"$set": {"order": idx}})
    await recalculate_task_dates(project_id)
    return {"message": "Tasks reordered"}

@api_router.post("/projects/{project_id}/sort-by-date")
async def sort_tasks_by_date(project_id: str):
    """Sort tasks by their start date, then update order accordingly."""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(200)
    tasks.sort(key=lambda t: t.get("start_date", "9999-12-31"))
    for idx, t in enumerate(tasks):
        await db.tasks.update_one({"id": t["id"]}, {"$set": {"order": idx}})
    return {"message": "Tasks sorted by date"}

@api_router.post("/tasks/{task_id}/clear-date-override")
async def clear_date_override(task_id: str):
    """Clear manual start date override, revert to auto-scheduling from dependencies."""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.tasks.update_one({"id": task_id}, {"$set": {"start_date_override": None}})
    await recalculate_task_dates(task["project_id"])
    return {"message": "Date override cleared"}


# --- Hour Logs ---
@api_router.post("/tasks/{task_id}/log-hours")
async def log_hours(task_id: str, req: HourLogCreate):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    log = {
        "id": str(uuid.uuid4()),
        "task_id": task_id,
        "project_id": task["project_id"],
        "team_member_name": req.team_member_name,
        "hours": req.hours,
        "date": req.date,
        "notes": req.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.hour_logs.insert_one(log)
    log.pop("_id", None)
    if task.get("status") == "not_started":
        await db.tasks.update_one({"id": task_id}, {"$set": {"status": "in_progress"}})
    return log

@api_router.get("/tasks/{task_id}/hours")
async def get_task_hours(task_id: str):
    logs = await db.hour_logs.find({"task_id": task_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    return logs

@api_router.delete("/hour-logs/{log_id}")
async def delete_hour_log(log_id: str):
    await db.hour_logs.delete_one({"id": log_id})
    return {"message": "Hour log deleted"}

# --- Team Members ---
@api_router.get("/team")
async def get_team():
    members = await db.team_members.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return members

@api_router.post("/team")
async def create_team_member(req: TeamMemberCreate):
    existing = await db.team_members.find_one({"name": {"$regex": f"^{req.name.strip()}$", "$options": "i"}}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Team member already exists")
    member = {
        "id": str(uuid.uuid4()),
        "name": req.name.strip(),
        "role": req.role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.team_members.insert_one(member)
    member.pop("_id", None)
    return member

@api_router.delete("/team/{member_id}")
async def delete_team_member(member_id: str):
    await db.team_members.delete_one({"id": member_id})
    return {"message": "Team member deleted"}

# --- Project Summary / Export ---
@api_router.get("/projects/{project_id}/summary")
async def get_project_summary(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).sort("order", 1).to_list(200)
    task_summaries = []
    for t in tasks:
        tr = await build_task_response(t, project)
        task_summaries.append(tr)
    total_quoted = sum(t["quoted_hours"] for t in task_summaries)
    total_logged = sum(t["logged_hours"] for t in task_summaries)
    return {
        "project": project,
        "tasks": task_summaries,
        "total_quoted_hours": total_quoted,
        "total_logged_hours": total_logged,
        "overall_indicator": get_progress_indicator(total_quoted, total_logged),
        "total_tasks": len(tasks),
        "completed_tasks": sum(1 for t in task_summaries if t["status"] == "completed"),
    }

# ==================== STARTUP: Seed Templates ====================

@app.on_event("startup")
async def seed_templates():
    count = await db.templates.count_documents({})
    if count == 0:
        for t in DEFAULT_TEMPLATES:
            await db.templates.insert_one(t.copy())
        logger.info(f"Seeded {len(DEFAULT_TEMPLATES)} default templates")
    else:
        logger.info(f"Templates already exist: {count}")

# ==================== APP CONFIG ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

