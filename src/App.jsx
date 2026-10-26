import { useCallback, useEffect, useState } from "react";
import GoalDetail from "./components/GoalDetail.jsx";
import DraftLibrary from "./components/DraftLibrary.jsx";
import ProgressPanel from "./components/ProgressPanel.jsx";
import { createAIPlan, getGoals, getToken, loadCurrentUser, loginAccount, logoutAccount, registerAccount, updateGoal } from "./lib/api.js";

const blankGoal = { title:"", category:"Career", description:"", why:"", targetDate:"" };
const categories = ["Career","Technology","Design","Language","Health","Personal growth"];

export default function App() {
  const [user,setUser]=useState(null);
  const [mode,setMode]=useState("login");
  const [authForm,setAuthForm]=useState({name:"",email:"",password:""});
  const [authError,setAuthError]=useState("");
  const [authBusy,setAuthBusy]=useState(false);
  const [booting,setBooting]=useState(Boolean(getToken()));
  const [goals,setGoals]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [planPrompt,setPlanPrompt]=useState("");
  const [planBusy,setPlanBusy]=useState(false);
  const [aiConsent,setAiConsent]=useState(false);
  const [showDrafts,setShowDrafts]=useState(false);
  const [planNotice,setPlanNotice]=useState("");
  const [selectedGoal,setSelectedGoal]=useState(null);

  const refreshGoals=useCallback(async()=>{const items=await getGoals();setGoals(items);},[]);
  useEffect(()=>{if(!getToken())return;loadCurrentUser().then(setUser).catch(()=>logoutAccount()).finally(()=>setBooting(false));},[]);
  useEffect(()=>{
    if(!user)return;
    let active=true;setLoading(true);setError("");
    getGoals().then(items=>{if(active)setGoals(items);}).catch(err=>{if(active)setError(err.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[user]);

  async function submitAuth(event){
    event.preventDefault();setAuthBusy(true);setAuthError("");
    try{const account=mode==="register"?await registerAccount(authForm):await loginAccount({email:authForm.email,password:authForm.password});setUser(account);setAuthForm({name:"",email:"",password:""});}
    catch(err){setAuthError(err.message);}finally{setAuthBusy(false);}
  }
  async function createAdventure(){
    if(planPrompt.trim().length<8){setError("Apna skill aur deadline likho, jaise: I want to learn Python in 45 days.");return;}
    if(!aiConsent){setError("Plan banane ke liye tumhara prompt Google Gemini ko bhejna hoga.");return;}
    setPlanBusy(true);setError("");setPlanNotice("");
    try{
      const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
      const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
      const dateParts=Object.fromEntries(parts.filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
      const today=`${dateParts.year}-${dateParts.month}-${dateParts.day}`;
      const result=await createAIPlan({prompt:planPrompt,today});
      setGoals(current=>[{...result.goal,totalTasks:result.tasksCreated,completedTasks:0,progress:0},...current]);
      setPlanNotice(`AI ne ${result.phaseCount} milestones aur ${result.tasksCreated} quests ${result.deadlineDays} din mein schedule kiye. Resume aur LinkedIn drafts save hain.`);
      setPlanPrompt("");setAiConsent(false);setShowForm(false);setShowDrafts(false);setSelectedGoal(result.goal.id);
    }catch(err){setError(err.message);}
    finally{setPlanBusy(false);}
  }
  async function archiveGoal(id){
    setError("");
    try{const changed=await updateGoal(id,{status:"archived"});setGoals(items=>items.map(g=>g.id===id?{...g,...changed}:g));}
    catch(err){setError(err.message);}
  }
  function signOut(){logoutAccount();setUser(null);setGoals([]);setSelectedGoal(null);setShowDrafts(false);setMode("login");}

  if(booting)return <main className="loading-screen">LevelUp load ho raha hai…</main>;
  if(!user){
    const registering=mode==="register";
    return <main className="auth-layout">
      <section className="auth-intro"><a className="brand" href="/"><span className="brand-mark">↗</span><span>levelup</span></a><div className="auth-message"><p className="eyebrow">LEARN WITH MOMENTUM</p><h1>Big goals become doable, one quest at a time.</h1><p>Create a learning path, take focused steps, and keep your progress somewhere you can see it.</p></div><div className="auth-note"><span className="auth-note-icon">✦</span>Make progress at your pace. Your journey is yours.</div></section>
      <section className="auth-panel"><div className="auth-card"><p className="eyebrow">{registering?"GET STARTED":"WELCOME BACK"}</p><h2>{registering?"Create your account":"Sign in to LevelUp"}</h2><p className="auth-subtitle">{registering?"Set up your account to start your roadmap.":"Pick up where you left off."}</p>
        <form className="auth-form" onSubmit={submitAuth}>
          {registering&&<label className="field"><span>Your name</span><input autoComplete="name" required maxLength={60} value={authForm.name} onChange={e=>setAuthForm({...authForm,name:e.target.value})} placeholder="Alex Morgan"/></label>}
          <label className="field"><span>Email address</span><input type="email" autoComplete="email" required value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} placeholder="you@example.com"/></label>
          <label className="field"><span>Password</span><input type="password" minLength={8} autoComplete={registering?"new-password":"current-password"} required value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} placeholder="At least 8 characters"/></label>
          {authError&&<p className="form-error" role="alert">{authError}</p>}
          <button className="button button-primary auth-submit" disabled={authBusy}>{authBusy?"Please wait…":registering?"Create account":"Sign in"} {!authBusy&&<span>→</span>}</button>
        </form>
        <p className="auth-switch">{registering?"Already have an account?":"New to LevelUp?"} <button className="text-button" type="button" onClick={()=>{setMode(registering?"login":"register");setAuthError("");}}>{registering?"Sign in":"Create an account"}</button></p>
      </div></section>
    </main>;
  }

  const active=goals.filter(g=>g.status==="active");
  const archived=goals.filter(g=>g.status==="archived");
  const completed=goals.filter(g=>g.status==="completed");
  const totalTasks=active.reduce((n,g)=>n+g.totalTasks,0);
  const doneTasks=active.reduce((n,g)=>n+g.completedTasks,0);

  return <div className="product-layout">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();setSelectedGoal(null);setShowDrafts(false);setPlanNotice("");}}><span className="brand-mark">↗</span><span>levelup</span></a>
      <p className="sidebar-label">WORKSPACE</p>
      <nav className="side-nav" aria-label="Main navigation">
        <button className={`side-link ${!selectedGoal&&!showDrafts?"active":""}`} onClick={()=>{setSelectedGoal(null);setShowDrafts(false);setPlanNotice("");}} type="button">⌂ <span>Dashboard</span></button>
        <button className="side-link" onClick={()=>{setSelectedGoal(null);setShowDrafts(false);setPlanNotice("");document.getElementById("goals")?.scrollIntoView({behavior:"smooth"});}} type="button">↗ <span>My Goals</span></button>
        <button className={`side-link ${showDrafts?"active":""}`} onClick={()=>{setSelectedGoal(null);setShowDrafts(true);setPlanNotice("");}} type="button">✎ <span>Drafts</span></button>
        <a className="side-link" href="#progress" onClick={()=>{setSelectedGoal(null);setShowDrafts(false);}}>✦ <span>Progress</span></a>
      </nav>
      <div className="sidebar-user"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div className="sidebar-user-copy"><strong>{user.name}</strong><span>{user.email}</span></div></div>
    </aside>
    <main className="dashboard-main">
      {selectedGoal ? <>{planNotice&&<p className="success-message plan-created-notice" role="status">{planNotice}</p>}<GoalDetail goalId={selectedGoal} onBack={()=>{setSelectedGoal(null);setPlanNotice("");}} onGoalChange={refreshGoals}/></> : showDrafts ? <DraftLibrary/> : <>
        <header className="dashboard-header"><div><p className="eyebrow">YOUR PERSONAL GROWTH SPACE</p><h1>Welcome back, {user.name.split(" ")[0]}.</h1><p className="dashboard-subtitle">Tell your AI coach what you want to learn. It will build the questline for you.</p></div><button className="button button-dark" onClick={signOut}>Log out</button></header>
        <section className="stats-grid" aria-label="Overview"><article className="stat-card"><span>ACTIVE GOALS</span><strong>{active.length}</strong><small>Goals you’re working on</small></article><article className="stat-card"><span>TASKS COMPLETED</span><strong>{doneTasks}<small className="stat-total"> / {totalTasks}</small></strong><small>Across active goals</small></article><article className="stat-card"><span>FINISHED GOALS</span><strong>{completed.length}</strong><small>Goals marked complete</small></article></section>
        <ProgressPanel/>
        <section className="goals-section" id="goals"><div className="section-heading"><div><h2>Quest log</h2><p>Your active adventures, milestones, and progress.</p></div><button className="button button-primary" onClick={()=>{setShowForm(v=>!v);setError("");}}>{showForm?"Cancel":"+ New adventure"}</button></div>
          {showForm&&<section className="goal-form quest-builder chat-planner">
            <div className="quest-builder-title"><div><p className="eyebrow">LEVELUP AI COACH</p><h3>What do you want to master?</h3><p>Bas skill aur deadline batao. AI plan, quests aur career drafts bana dega.</p></div><span className="builder-emblem">✦</span></div>
            <div className="coach-message"><span className="coach-avatar">✦</span><p>Hey {user.name.split(" ")[0]}! Main tumhare goal ko milestones, daily quests aur XP mein tod dunga. Deadline bhi har quest ke saath set hogi.</p></div>
            <label className="field"><span>Message your AI coach</span><textarea rows={4} maxLength={3000} value={planPrompt} onChange={e=>setPlanPrompt(e.target.value)} placeholder="Example: I want to master Python in 60 days. I can study 45 minutes a day and want to build a portfolio project."/></label>
            <div className="prompt-suggestions"><span>Try:</span><button type="button" onClick={()=>setPlanPrompt("I want to learn Python in 45 days. I can study 30 minutes a day and want to build a small project.")}>Learn Python in 45 days</button><button type="button" onClick={()=>setPlanPrompt("I want to become job-ready in UI/UX design in 90 days. I can study 1 hour a day.")}>Become job-ready in UI/UX in 90 days</button></div>
            <label className="ai-consent"><input type="checkbox" checked={aiConsent} onChange={e=>setAiConsent(e.target.checked)}/><span><strong>Send this request to Google Gemini</strong><small>Your chat prompt goes to Gemini to create the roadmap and career drafts. The generated resume and LinkedIn text is saved here as editable drafts; it is never published.</small></span></label>
            {error&&<p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary generate-roadmap" type="button" disabled={planBusy||!aiConsent} onClick={createAdventure}>{planBusy?<><span className="button-spinner"/> Building your adventure…</>:<>✦ Build my roadmap & save drafts</>}</button>
          </section>}
          {error&&!showForm&&<p className="form-error" role="alert">{error}</p>}
          {loading?<p className="loading-message">Goals load ho rahe hain…</p>:active.length===0?<div className="empty-state"><div className="empty-icon">✦</div><h3>{archived.length?"Create your next goal":"Start with one goal"}</h3><p>Tell your AI coach a skill and a deadline. It will create your roadmap, quests, and career drafts.</p>{!showForm&&<button className="button button-primary" onClick={()=>setShowForm(true)}>Start your first adventure</button>}</div>:
            <div className="goals-grid">{active.map(goal=><article className="goal-card" key={goal.id}><div className="goal-card-top"><span className="category-tag">{goal.category}</span><button className="icon-button" aria-label={`Archive ${goal.title}`} title="Archive goal" onClick={()=>archiveGoal(goal.id)}>⋯</button></div><h3>{goal.title}</h3><p className="goal-description">{goal.description||"No description added yet."}</p>{goal.why&&<p className="goal-why">“{goal.why}”</p>}<div className="goal-progress-label"><span>{goal.completedTasks} of {goal.totalTasks} tasks</span><strong>{goal.progress}%</strong></div><div className="progress-track" role="img" aria-label={`${goal.progress}% complete`}><span style={{width:`${goal.progress}%`}}/></div><div className="goal-card-footer"><span>{goal.targetDate?`Target: ${goal.targetDate}`:"No target date"}</span><button className="text-button" onClick={()=>setSelectedGoal(goal.id)}>Open roadmap →</button></div></article>)}</div>}
        </section>
        {archived.length>0&&<details className="archived-section"><summary>Archived goals ({archived.length})</summary><ul>{archived.map(g=><li key={g.id}>{g.title}</li>)}</ul></details>}
      </>}
    </main>
  </div>;
}







