import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(serverDir, "..", "data", "levelup.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    weekly_target_days INTEGER NOT NULL DEFAULT 5 CHECK (weekly_target_days BETWEEN 1 AND 7),
    session_minutes INTEGER NOT NULL DEFAULT 25 CHECK (session_minutes BETWEEN 5 AND 180),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Personal growth',
    description TEXT NOT NULL DEFAULT '',
    why TEXT NOT NULL DEFAULT '',
    target_date TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS phases (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    phase_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    duration_minutes INTEGER NOT NULL DEFAULT 25 CHECK (duration_minutes BETWEEN 1 AND 600),
    difficulty TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
    xp_reward INTEGER NOT NULL DEFAULT 25 CHECK (xp_reward BETWEEN 0 AND 10000),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','completed')),
    reflection TEXT NOT NULL DEFAULT '',
    completed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS task_completions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    xp_awarded INTEGER NOT NULL,
    completed_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS career_drafts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('resume_summary','linkedin_about')),
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_drafts_user_goal ON career_drafts(user_id, goal_id);
  CREATE INDEX IF NOT EXISTS idx_phases_goal_order ON phases(goal_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_tasks_phase_created ON tasks(phase_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_completions_user_date ON task_completions(user_id, completed_at);
`);

const taskColumns = db.pragma("table_info(tasks)");
if (!taskColumns.some(column => column.name === "due_date")) db.exec("ALTER TABLE tasks ADD COLUMN due_date TEXT");

export default db;

