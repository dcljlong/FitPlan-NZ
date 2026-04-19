from pathlib import Path
import re

path = Path(r"D:\FitPlanNZ\backend\server.py")
text = path.read_text(encoding="utf-8")

if 'target_end_date: Optional[str] = None' not in text:
    text = text.replace(
        'class ProjectCreate(BaseModel):\n    name: str\n    description: str = ""\n    start_date: str\n',
        'class ProjectCreate(BaseModel):\n    name: str\n    description: str = ""\n    start_date: str\n    target_end_date: Optional[str] = None\n'
    )

if '"target_end_date": req.target_end_date,' not in text:
    text = text.replace(
        '"start_date": req.start_date,\n',
        '"start_date": req.start_date,\n        "target_end_date": req.target_end_date,\n',
        1
    )

path.write_text(text, encoding="utf-8")
print("backend target_end_date patch applied")
