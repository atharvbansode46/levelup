import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "./auth.js";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  title: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60).default("Personal growth"),
  description: z.string().trim().max(1000).default(""),
  why: z.string().trim().max(500).default(""),
  targetDate: z.union([z.string().date(), z.literal("")]).optional(),
});
const updateSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(1000).optional(),
  why: z.string().trim().max(500).optional(),
  targetDate: z.union([z.string().date(), z.literal(""), z.null()]).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
});

router.get("/", (req, res) => {
  const rows = db.prepare(`
    SELECT g.*, COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks
    FROM goals g LEFT JOIN phases p ON p.goal_id = g.id
    LEFT JOIN tasks t ON t.phase_id = p.id
    WHERE g.user_id = ? GROUP BY g.id ORDER BY g.created_at DESC
  `).all(req.user.id);
  res.json({ goals: rows.map(g => ({
    id:g.id, title:g.title, category:g.category, description:g.description, why:g.why,
    targetDate:g.target_date, status:g.status, createdAt:g.created_at, updatedAt:g.updated_at,
    totalTasks:g.total_tasks, completedTasks:g.completed_tasks || 0,
    progress:g.total_tasks ? Math.round((g.completed_tasks / g.total_tasks) * 100) : 0,
  })) });
});

router.get("/:goalId", (req, res) => {
  const goal = db.prepare("SELECT * FROM goals WHERE id = ? AND user_id = ?").get(req.params.goalId, req.user.id);
  if (!goal) return res.status(404).json({ error: "Goal not found" });
  const phases = db.prepare(`
    SELECT p.*, COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks
    FROM phases p LEFT JOIN tasks t ON t.phase_id = p.id
    WHERE p.goal_id = ? GROUP BY p.id ORDER BY p.sort_order, p.created_at
  `).all(goal.id);
  const taskQuery = db.prepare("SELECT * FROM tasks WHERE phase_id = ? ORDER BY created_at");
  res.json({ goal: {
    id:goal.id, title:goal.title, category:goal.category, description:goal.description,
    why:goal.why, targetDate:goal.target_date, status:goal.status, createdAt:goal.created_at,
    updatedAt:goal.updated_at,
    phases: phases.map(p => ({
      id:p.id, title:p.title, description:p.description, sortOrder:p.sort_order,
      totalTasks:p.total_tasks, completedTasks:p.completed_tasks || 0,
      tasks:taskQuery.all(p.id).map(t => ({
        id:t.id, title:t.title, description:t.description, durationMinutes:t.duration_minutes,
        difficulty:t.difficulty, xpReward:t.xp_reward, status:t.status, reflection:t.reflection,
        completedAt:t.completed_at, dueDate:t.due_date, createdAt:t.created_at,
      })),
    })),
  } });
});

router.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the goal details", details: parsed.error.flatten().fieldErrors });
  const now = new Date().toISOString();
  const g = { id:randomUUID(), userId:req.user.id, title:parsed.data.title, category:parsed.data.category,
    description:parsed.data.description, why:parsed.data.why, targetDate:parsed.data.targetDate || null, createdAt:now, updatedAt:now };
  db.prepare("INSERT INTO goals (id,user_id,title,category,description,why,target_date,created_at,updated_at) VALUES (@id,@userId,@title,@category,@description,@why,@targetDate,@createdAt,@updatedAt)").run(g);
  return res.status(201).json({ goal: { id:g.id,title:g.title,category:g.category,description:g.description,why:g.why,targetDate:g.targetDate,status:"active",createdAt:now,updatedAt:now,phases:[] } });
});

const createWithRoadmapSchema = z.object({
  goal: createSchema,
  roadmap: z.object({
    phases: z.array(z.object({
      title: z.string().trim().min(2).max(100),
      description: z.string().trim().max(500).default(""),
      tasks: z.array(z.object({
        title: z.string().trim().min(2).max(140),
        description: z.string().trim().max(1000).default(""),
        durationMinutes: z.number().int().min(1).max(600),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]),
        xpReward: z.number().int().min(0).max(10000),
      })).min(1).max(10),
    })).min(1).max(10),
  }),
});

router.post("/with-roadmap", (req, res) => {
  const parsed = createWithRoadmapSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the goal and roadmap details", details: parsed.error.flatten().fieldErrors });
  const now = new Date().toISOString();
  const goal = parsed.data.goal;
  const g = { id: randomUUID(), userId: req.user.id, title: goal.title, category: goal.category,
    description: goal.description, why: goal.why, targetDate: goal.targetDate || null, createdAt: now, updatedAt: now };
  const createAll = db.transaction(() => {
    db.prepare("INSERT INTO goals (id,user_id,title,category,description,why,target_date,created_at,updated_at) VALUES (@id,@userId,@title,@category,@description,@why,@targetDate,@createdAt,@updatedAt)").run(g);
    const insertPhase = db.prepare("INSERT INTO phases (id,goal_id,title,description,sort_order,created_at) VALUES (@id,@goalId,@title,@description,@sortOrder,@createdAt)");
    const insertTask = db.prepare("INSERT INTO tasks (id,phase_id,title,description,duration_minutes,difficulty,xp_reward,created_at) VALUES (@id,@phaseId,@title,@description,@durationMinutes,@difficulty,@xpReward,@createdAt)");
    for (const [sortOrder, phase] of parsed.data.roadmap.phases.entries()) {
      const phaseId = randomUUID();
      insertPhase.run({ id: phaseId, goalId: g.id, title: phase.title, description: phase.description, sortOrder, createdAt: now });
      for (const task of phase.tasks) insertTask.run({ id: randomUUID(), phaseId, ...task, createdAt: now });
    }
  });
  try {
    createAll();
    res.status(201).json({ goal: { id:g.id,title:g.title,category:g.category,description:g.description,why:g.why,targetDate:g.targetDate,status:"active",createdAt:now,updatedAt:now } });
  } catch (error) {
    console.error("Could not save generated roadmap", error.name);
    res.status(500).json({ error: "Could not save the roadmap. Please try again." });
  }
});
router.patch("/:goalId", (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:"Please check the goal details", details:parsed.error.flatten().fieldErrors });
  const old = db.prepare("SELECT * FROM goals WHERE id = ? AND user_id = ?").get(req.params.goalId, req.user.id);
  if (!old) return res.status(404).json({ error:"Goal not found" });
  const d = parsed.data;
  const g = { id:old.id, userId:req.user.id, title:d.title ?? old.title, category:d.category ?? old.category,
    description:d.description ?? old.description, why:d.why ?? old.why,
    targetDate:d.targetDate === undefined ? old.target_date : (d.targetDate || null),
    status:d.status ?? old.status, updatedAt:new Date().toISOString() };
  db.prepare("UPDATE goals SET title=@title,category=@category,description=@description,why=@why,target_date=@targetDate,status=@status,updated_at=@updatedAt WHERE id=@id AND user_id=@userId").run(g);
  res.json({ goal:{ id:g.id,title:g.title,category:g.category,description:g.description,why:g.why,targetDate:g.targetDate,status:g.status,updatedAt:g.updatedAt } });
});

router.delete("/:goalId", (req, res) => {
  const result = db.prepare("DELETE FROM goals WHERE id = ? AND user_id = ?").run(req.params.goalId, req.user.id);
  if (!result.changes) return res.status(404).json({ error:"Goal not found" });
  res.status(204).end();
});

export default router;


