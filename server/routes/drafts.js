import { Router } from "express";
import { z } from "zod";
import db from "../db.js";
import { requireAuth } from "./auth.js";

const router=Router();
router.use(requireAuth);
const updateSchema=z.object({content:z.string().trim().min(1).max(5000)});
router.get("/",(req,res)=>{
  const drafts=db.prepare(`SELECT d.id,d.goal_id,d.type,d.title,d.content,d.updated_at,g.title AS goal_title
    FROM career_drafts d JOIN goals g ON g.id=d.goal_id WHERE d.user_id=? ORDER BY d.updated_at DESC`).all(req.user.id);
  res.json({drafts:drafts.map(d=>({id:d.id,goalId:d.goal_id,type:d.type,title:d.title,content:d.content,updatedAt:d.updated_at,goalTitle:d.goal_title}))});
});
router.patch("/:draftId",(req,res)=>{
  const parsed=updateSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Draft content 1-5000 characters ke beech hona chahiye."});
  const draft=db.prepare("SELECT id FROM career_drafts WHERE id=? AND user_id=?").get(req.params.draftId,req.user.id);
  if(!draft)return res.status(404).json({error:"Draft not found"});
  const updatedAt=new Date().toISOString();
  db.prepare("UPDATE career_drafts SET content=?,updated_at=? WHERE id=? AND user_id=?").run(parsed.data.content,updatedAt,draft.id,req.user.id);
  res.json({draft:{id:draft.id,content:parsed.data.content,updatedAt}});
});
export default router;
