from pathlib import Path

path = Path(r"D:\FitPlanNZ\backend\server.py")
text = path.read_text(encoding="utf-8")

old = '''@api_router.post("/projects/{project_id}/tasks")
async def create_task(project_id: str, req: TaskCreate):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
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
        "order": req.order,
        "dependencies": req.dependencies,
        "assigned_to": req.assigned_to,
        "status": "not_started",
        "notes": req.notes,
        "created_at": now,
    }
    await db.tasks.insert_one(task)
    await recalculate_task_dates(project_id)
    updated_task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return await build_task_response(updated_task, project)
'''

new = '''@api_router.post("/projects/{project_id}/tasks")
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
'''

if old not in text:
    raise SystemExit("create_task block not found")

text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("step9 create_task ordering patch applied")
