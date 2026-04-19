from pathlib import Path

def patch_file(path_str: str, replacements: list[tuple[str, str]]):
    path = Path(path_str)
    text = path.read_text(encoding="utf-8")
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f"Pattern not found in {path.name}: {old[:80]}")
        text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
    print(f"Patched {path.name}")

# -----------------------------
# project/[id].tsx
# -----------------------------
project_path = r"D:\FitPlanNZ\frontend\app\project\[id].tsx"
project_replacements = [
(
"""import { api } from '../../components/api';""",
"""import { api } from '../../components/api';

function formatIsoToNz(value?: string | null) {
  if (!value || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}"""
),
(
"""        <TouchableOpacity testID="back-from-project-btn" onPress={() => router.back()}>""",
"""        <TouchableOpacity testID="back-from-project-btn" onPress={() => router.replace('/projects')}>"""
),
(
"""{project.start_date} → {project.forecast_end_date || project.end_date}""",
"""{formatIsoToNz(project.start_date)} → {formatIsoToNz(project.forecast_end_date || project.end_date)}"""
),
(
"""{project.target_end_date || 'No target finish set'}""",
"""{project.target_end_date ? formatIsoToNz(project.target_end_date) : 'No target finish set'}"""
),
(
"""{task.start_date} → {task.end_date}""",
"""{formatIsoToNz(task.start_date)} → {formatIsoToNz(task.end_date)}"""
),
(
"""{t.start_date} → {t.end_date}""",
"""{formatIsoToNz(t.start_date)} → {formatIsoToNz(t.end_date)}"""
),
]
patch_file(project_path, project_replacements)

# -----------------------------
# task/[id].tsx
# -----------------------------
task_path = r"D:\FitPlanNZ\frontend\app\task\[id].tsx"
task_replacements = [
(
"""import { api } from '../../components/api';
import { useUser } from '../../contexts/UserContext';""",
"""import { api } from '../../components/api';
import { useUser } from '../../contexts/UserContext';

function formatIsoToNz(value?: string | null) {
  if (!value || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}"""
),
(
"""        <TouchableOpacity testID="back-from-task-btn" onPress={() => router.back()}>""",
"""        <TouchableOpacity testID="back-from-task-btn" onPress={() => router.replace('/projects')}>"""
),
(
"""{task.start_date} → {task.end_date}""",
"""{formatIsoToNz(task.start_date)} → {formatIsoToNz(task.end_date)}"""
),
(
"""{log.date}""",
"""{formatIsoToNz(log.date)}"""
),
(
"""{t.start_date} → {t.end_date}""",
"""{formatIsoToNz(t.start_date)} → {formatIsoToNz(t.end_date)}"""
),
]
patch_file(task_path, task_replacements)
