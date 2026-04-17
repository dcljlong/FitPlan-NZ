from pathlib import Path

path = Path(r"D:\FitPlanNZ\backend\server.py")
text = path.read_text(encoding="utf-8")

old = '''async def recalculate_task_dates(project_id: str):
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

        # Check for manual start date override
        manual_start = task.get("start_date_override")
        if manual_start:
            s = date.fromisoformat(manual_start)
        else:
            deps = task.get("dependencies", [])
            if not deps:
                s = proj_start
            else:
                latest_end = proj_start
                for dep_id in deps:
                    if dep_id in task_map:
                        dep_resolved = resolve(task_map[dep_id])
                        dep_end = date.fromisoformat(dep_resolved["end_date"])
                        next_day = dep_end + timedelta(days=1)
                        if next_day > latest_end:
                            latest_end = next_day
                s = latest_end
                years = list(range(s.year, s.year + 2))
                hols = get_nz_holidays_set(region, years)
                while not is_working_day(s, sat, hols):
                    s += timedelta(days=1)

        e = calculate_end_date(s, task["duration_days"], sat, region)
        resolved[tid] = {"start_date": s.isoformat(), "end_date": e.isoformat()}
        return resolved[tid]

    for t in tasks:
        resolve(t)

    for tid, dates in resolved.items():
        await db.tasks.update_one({"id": tid}, {"$set": dates})

    # Update project end date to latest task end
    all_ends = [date.fromisoformat(d["end_date"]) for d in resolved.values()]
    if all_ends:
        proj_end = max(all_ends).isoformat()
        await db.projects.update_one({"id": project_id}, {"$set": {"end_date": proj_end, "updated_at": datetime.now(timezone.utc).isoformat()}})
'''

new = '''async def recalculate_task_dates(project_id: str):
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

    def next_working_day(d: date) -> date:
        years = list(range(d.year, d.year + 2))
        hols = get_nz_holidays_set(region, years)
        while not is_working_day(d, sat, hols):
            d += timedelta(days=1)
        return d

    def get_earliest_from_dependencies(task) -> date:
        deps = task.get("dependencies", [])
        if not deps:
            return next_working_day(proj_start)

        earliest = proj_start
        for dep_id in deps:
            if dep_id in task_map:
                dep_resolved = resolve(task_map[dep_id])
                dep_end = date.fromisoformat(dep_resolved["end_date"])
                candidate = dep_end + timedelta(days=1)
                if candidate > earliest:
                    earliest = candidate
        return next_working_day(earliest)

    def resolve(task):
        tid = task["id"]
        if tid in resolved:
            return resolved[tid]

        earliest_allowed = get_earliest_from_dependencies(task)

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

    # Update project end date to latest task end
    all_ends = [date.fromisoformat(d["end_date"]) for d in resolved.values()]
    if all_ends:
        proj_end = max(all_ends).isoformat()
        await db.projects.update_one({"id": project_id}, {"$set": {"end_date": proj_end, "updated_at": datetime.now(timezone.utc).isoformat()}})
'''

if old not in text:
    raise SystemExit("recalculate_task_dates block not found")

text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("backend schedule polish applied")
