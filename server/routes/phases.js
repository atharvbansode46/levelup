import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "./auth.js";

const router = Router();
router.use(requireAuth);
const createSchema = z.object({
  goalId:z.string().uuid(), title:z.string().trim().min(2).max(100),
  description:z.string().trim().max(500).default(""), sortOrder:z.number().int().min(0).optional(),
});
const updateSchema = z.object({
  title:z.string().trim().min(2).max(100).optional(),
  description:z.string().trim().max(500).optional(), sortOrder:z.number().int().min(0).optional(),
});
function findPhase(id,userId) {
  return db.prepare("SELECT p.* FROM phases p JOIN goals g ON g.id=p.goal_id WHERE p.id=? AND g.user_id=?").get(id,userId);
}
router.post("/", (req,res) => {
  const parsed=createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:"Please check the phase details",details:parsed.error.flatten().fieldErrors});
  const goal=db.prepare("SELECT id FROM goals WHERE id=? AND user_id=? AND status='active'").get(parsed.data.goalId,req.user.id);
  if (!goal) return res.status(404).json({error:"Active goal not found"});
  const next=db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 AS value FROM phases WHERE goal_id=?").get(goal.id).value;
  const p={id:randomUUID(),goalId:goal.id,title:parsed.data.title,description:parsed.data.description,sortOrder:parsed.data.sortOrder ?? next,createdAt:new Date().toISOString()};
  db.prepare("INSERT INTO phases (id,goal_id,title,description,sort_order,created_at) VALUES (@id,@goalId,@title,@description,@sortOrder,@createdAt)").run(p);
  res.status(201).json({phase:p});
});
router.patch("/:phaseId",(req,res)=>{
  const parsed=updateSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Please check the phase details",details:parsed.error.flatten().fieldErrors});
  const old=findPhase(req.params.phaseId,req.user.id);
  if(!old)return res.status(404).json({error:"Phase not found"});
  const p={id:old.id,title:parsed.data.title??old.title,description:parsed.data.description??old.description,sortOrder:parsed.data.sortOrder??old.sort_order};
  db.prepare("UPDATE phases SET title=@title,description=@description,sort_order=@sortOrder WHERE id=@id").run(p);
  res.json({phase:p});
});
router.delete("/:phaseId",(req,res)=>{
  const p=findPhase(req.params.phaseId,req.user.id);
  if(!p)return res.status(404).json({error:"Phase not found"});
  db.prepare("DELETE FROM phases WHERE id=?").run(p.id);
  res.status(204).end();
});
export default router;
