const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "levelup_access_token";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const logoutAccount = () => localStorage.removeItem(TOKEN_KEY);

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Backend se connect nahi ho pa raha. Server chal raha hai?", 0);
  }

  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || "Request complete nahi hui.", response.status, data.details);
  return data;
}

async function authenticate(path, details) {
  const result = await apiRequest(path, { method: "POST", body: details });
  saveToken(result.token);
  return result.user;
}
export const registerAccount = details => authenticate("/auth/register", details);
export const loginAccount = details => authenticate("/auth/login", details);
export async function loadCurrentUser() {
  return (await apiRequest("/auth/me")).user;
}
export async function getGoals() {
  return (await apiRequest("/goals")).goals;
}
export async function getGoal(id) {
  return (await apiRequest(`/goals/${encodeURIComponent(id)}`)).goal;
}
export async function createGoal(details) {
  return (await apiRequest("/goals", { method: "POST", body: details })).goal;
}
export async function generateRoadmap(details) {
  return (await apiRequest("/ai/roadmap", { method: "POST", body: details })).roadmap;
}
export async function createGoalWithRoadmap(goal, roadmap) {
  return (await apiRequest("/goals/with-roadmap", { method: "POST", body: { goal, roadmap } })).goal;
}
export async function updateGoal(id, changes) {
  return (await apiRequest(`/goals/${encodeURIComponent(id)}`, { method: "PATCH", body: changes })).goal;
}
export async function createPhase(details) {
  return (await apiRequest("/phases", { method: "POST", body: details })).phase;
}
export async function createTask(details) {
  return (await apiRequest("/tasks", { method: "POST", body: details })).task;
}
export async function updateTask(id, changes) {
  return (await apiRequest(`/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: changes })).task;
}
export async function completeTask(id, reflection = "") {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return apiRequest(`/tasks/${encodeURIComponent(id)}/complete`, { method: "POST", body: { reflection, timeZone } });
}
export async function createAIPlan(details) {
  return apiRequest("/ai/plan", { method: "POST", body: details });
}
export async function getDrafts() {
  return (await apiRequest("/drafts")).drafts;
}
export async function updateDraft(id, content) {
  return (await apiRequest(`/drafts/${encodeURIComponent(id)}`, { method: "PATCH", body: { content } })).draft;
}
export async function getProgress() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return apiRequest(`/progress?${new URLSearchParams({ timeZone })}`);
}






