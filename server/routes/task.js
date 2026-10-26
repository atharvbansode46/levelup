import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "./auth.js";

const router=Router();
router.use(requireAuth);
const optionalDate=z.union([z.string().date(),z.literal("")]).optional();
const createSchema=z.object({
  phaseId:z.string().uuid(),title:z.string().trim().min(2).max(140),description:z.string().trim().max(1000).default(""),
  durationMinutes:z.number().int().min(1).max(600).default(25),difficulty:z.enum(["beginner","intermediate","advanced"]).default("beginner"),
  xpReward:z.number().int().min(0).max(10000).default(25),dueDate:optionalDate,
});
const updateSchema=z.object({
  title:z.string().trim().min(2).max(140).optional(),description:z.string().trim().max(1000).optional(),
  durationMinutes:z.number().int().min(1).max(600).optional(),difficulty:z.enum(["beginner","intermediate","advanced"]).optional(),
  xpReward:z.number().int().min(0).max(10000).optional(),dueDate:z.union([z.string().date(),z.literal(""),z.null()]).optional(),status:z.enum(["todo","in_progress"]).optional(),
});
const completeSchema=z.object({reflection:z.string().trim().max(1000).default(""),timeZone:z.string().max(100).optional()});
function findTask(id,userId){
  return db.prepare("SELECT t.* FROM tasks t JOIN phases p ON p.id=t.phase_id JOIN goals g ON g.id=p.goal_id WHERE t.id=? AND g.user_id=?").get(id,userId);
}
function localDate(iso,timeZone){
  try {
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(iso));
    const values=Object.fromEntries(parts.filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch { return iso.slice(0,10); }
}
router.post("/",(req,res)=>{
  const parsed=createSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Please check the task details",details:parsed.error.flatten().fieldErrors});
  const phase=db.prepare("SELECT p.id FROM phases p JOIN goals g ON g.id=p.goal_id WHERE p.id=? AND g.user_id=? AND g.status='active'").get(parsed.data.phaseId,req.user.id);
  if(!phase)return res.status(404).json({error:"Phase in an active goal not found"});
  const d=parsed.data,t={id:randomUUID(),phaseId:phase.id,title:d.title,description:d.description,durationMinutes:d.durationMinutes,difficulty:d.difficulty,xpReward:d.xpReward,dueDate:d.dueDate||null,createdAt:new Date().toISOString()};
  db.prepare("INSERT INTO tasks (id,phase_id,title,description,duration_minutes,difficulty,xp_reward,due_date,created_at) VALUES (@id,@phaseId,@title,@description,@durationMinutes,@difficulty,@xpReward,@dueDate,@createdAt)").run(t);
  res.status(201).json({task:{...t,status:"todo",reflection:"",completedAt:null}});
});
router.patch("/:taskId",(req,res)=>{
  const parsed=updateSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Please check the task details",details:parsed.error.flatten().fieldErrors});
  const old=findTask(req.params.taskId,req.user.id);
  if(!old)return res.status(404).json({error:"Task not found"});
  if(old.status==="completed")return res.status(409).json({error:"Completed tasks cannot be edited"});
  const d=parsed.data,t={id:old.id,title:d.title??old.title,description:d.description??old.description,durationMinutes:d.durationMinutes??old.duration_minutes,difficulty:d.difficulty??old.difficulty,xpReward:d.xpReward??old.xp_reward,dueDate:d.dueDate===undefined?old.due_date:(d.dueDate||null),status:d.status??old.status};
  db.prepare("UPDATE tasks SET title=@title,description=@description,duration_minutes=@durationMinutes,difficulty=@difficulty,xp_reward=@xpReward,due_date=@dueDate,status=@status WHERE id=@id").run(t);
  res.json({task:t});
});
router.post("/:taskId/complete",(req,res)=>{
  const parsed=completeSchema.safeParse(req.body||{});
  if(!parsed.success)return res.status(400).json({error:"Please check your reflection"});
  const task=findTask(req.params.taskId,req.user.id);
  if(!task)return res.status(404).json({error:"Task not found"});
  const now=new Date().toISOString();
  const result=db.transaction(()=>{
    const existing=db.prepare("SELECT xp_awarded,completed_at FROM task_completions WHERE task_id=?").get(task.id);
    if(existing)return {alreadyCompleted:true,xpAwarded:existing.xp_awarded,dailyBonusXp:0,completedAt:existing.completed_at};
    const zone=parsed.data.timeZone||"UTC";
    const today=localDate(now,zone);
    const completions=db.prepare("SELECT completed_at FROM task_completions WHERE user_id=?").all(req.user.id);
    const alreadyEarnedDailyBonus=completions.some(item=>localDate(item.completed_at,zone)===today);
    const dailyBonusXp=alreadyEarnedDailyBonus?0:15;
    const xpAwarded=task.xp_reward+dailyBonusXp;
    db.prepare("INSERT INTO task_completions (id,task_id,user_id,xp_awarded,completed_at) VALUES (?,?,?,?,?)").run(randomUUID(),task.id,req.user.id,xpAwarded,now);
    db.prepare("UPDATE tasks SET status='completed',reflection=?,completed_at=? WHERE id=?").run(parsed.data.reflection,now,task.id);
    return {alreadyCompleted:false,xpAwarded,taskXp:task.xp_reward,dailyBonusXp,completedAt:now};
  })();
  res.json({taskId:task.id,status:"completed",reflection:parsed.data.reflection,...result});
});
export default router;
