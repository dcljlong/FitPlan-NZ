const rawBackendUrl = (process.env.EXPO_PUBLIC_BACKEND_URL || '').trim();
const backendUrl = (rawBackendUrl || 'http://127.0.0.1:8010').replace(/\/$/, '');

async function fetchAPI(path: string, options?: RequestInit) {
  const url = `${backendUrl}/api${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API Error ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (name: string) =>
    fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify({ name }) }),

  getRegions: () => fetchAPI('/regions'),

  getHolidays: (region: string, year: number) =>
    fetchAPI(`/holidays?region=${region}&year=${year}`),

  getTemplates: () => fetchAPI('/templates'),

  saveAsTemplate: (data: { name: string; description: string; project_id: string }) =>
    fetchAPI('/templates/save-from-project', { method: 'POST', body: JSON.stringify(data) }),

  getProjects: () => fetchAPI('/projects'),

  createProject: (data: any) =>
    fetchAPI('/projects', { method: 'POST', body: JSON.stringify(data) }),

  getProject: (id: string) => fetchAPI(`/projects/${id}`),

  updateProject: (id: string, data: any) =>
    fetchAPI(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteProject: (id: string) =>
    fetchAPI(`/projects/${id}`, { method: 'DELETE' }),

  getProjectTasks: (projectId: string) =>
    fetchAPI(`/projects/${projectId}/tasks`),

  createTask: (projectId: string, data: any) =>
    fetchAPI(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),

  getTask: (id: string) => fetchAPI(`/tasks/${id}`),

  updateTask: (id: string, data: any) =>
    fetchAPI(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTask: (id: string) =>
    fetchAPI(`/tasks/${id}`, { method: 'DELETE' }),

  logHours: (taskId: string, data: any) =>
    fetchAPI(`/tasks/${taskId}/log-hours`, { method: 'POST', body: JSON.stringify(data) }),

  getTaskHours: (taskId: string) => fetchAPI(`/tasks/${taskId}/hours`),

  deleteHourLog: (logId: string) =>
    fetchAPI(`/hour-logs/${logId}`, { method: 'DELETE' }),

  getTeam: () => fetchAPI('/team'),

  createTeamMember: (data: { name: string; role: string }) =>
    fetchAPI('/team', { method: 'POST', body: JSON.stringify(data) }),

  deleteTeamMember: (id: string) =>
    fetchAPI(`/team/${id}`, { method: 'DELETE' }),

  getProjectSummary: (id: string) => fetchAPI(`/projects/${id}/summary`),

  reorderTasks: (projectId: string, taskIds: string[]) =>
    fetchAPI(`/projects/${projectId}/reorder-tasks`, { method: 'POST', body: JSON.stringify({ task_ids: taskIds }) }),

  sortTasksByDate: (projectId: string) =>
    fetchAPI(`/projects/${projectId}/sort-by-date`, { method: 'POST' }),

  clearDateOverride: (taskId: string) =>
    fetchAPI(`/tasks/${taskId}/clear-date-override`, { method: 'POST' }),
};
