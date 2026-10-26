import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "./auth.js";

const router=Router();
router.use(requireAuth);

function dateKey(date,timeZone){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const values=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function shift(day,amount){
  const date=new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate()+amount);
  return date.toISOString().slice(0,10);
}
function longest(days){
  let best=0,current=0,prev=null;
  for(const day of days){current=prev===null||shift(prev,1)===day?current+1:1;best=Math.max(best,current);prev=day;}
  return best;
}
function current(days,today){
  const set=new Set(days);
  let d=set.has(today)?today:set.has(shift(today,-1))?shift(today,-1):null;
  if(!d)return 0;
  let count=0;
  while(set.has(d)){count++;d=shift(d,-1);}
  return count;
}
router.get("/",(req,res)=>{
  let zone=typeof req.query.timeZone==="string"?req.query.timeZone:"UTC";
  try{new Intl.DateTimeFormat("en",{timeZone:zone});}catch{zone="UTC";}
  const rows=db.prepare("SELECT tc.completed_at,tc.xp_awarded,t.duration_minutes FROM task_completions tc JOIN tasks t ON t.id=tc.task_id WHERE tc.user_id=? ORDER BY tc.completed_at").all(req.user.id);
  const activityMap=new Map();
  for(const r of rows){const d=dateKey(new Date(r.completed_at),zone);const v=activityMap.get(d)||{count:0,minutes:0};v.count++;v.minutes+=r.duration_minutes;activityMap.set(d,v);}
  const days=[...activityMap.keys()].sort();
  const today=dateKey(new Date(),zone);
  const activity=Array.from({length:7},(_,i)=>{const date=shift(today,i-6);const v=activityMap.get(date)||{count:0,minutes:0};return{date,completedTasks:v.count,minutes:v.minutes};});
  const totalXp=rows.reduce((sum,r)=>sum+r.xp_awarded,0);
  res.json({totalXp,level:Math.floor(totalXp/100)+1,xpIntoLevel:totalXp%100,xpToNextLevel:100-totalXp%100,completedTasks:rows.length,currentStreak:current(days,today),longestStreak:longest(days),activity});
});
export default router;
