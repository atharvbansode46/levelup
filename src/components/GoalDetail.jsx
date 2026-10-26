import { useCallback, useEffect, useState } from "react";
import { completeTask, createPhase, createTask, getGoal, updateTask } from "../lib/api.js";

const phaseBlank = { title: "", description: "" };
const taskBlank = { title: "", description: "", durationMinutes: 25, difficulty: "beginner", xpReward: 25, dueDate: "" };

export default function GoalDetail({ goalId, onBack, onGoalChange }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [phaseForm, setPhaseForm] = useState(phaseBlank);
  const [taskPhase, setTaskPhase] = useState(null);
  const [taskForm, setTaskForm] = useState(taskBlank);
  const [reflections, setReflections] = useState({});
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await getGoal(goalId);
      setGoal(data);
      await onGoalChange?.();
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [goalId, onGoalChange]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  async function savePhase(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const order = goal.phases.reduce((max, phase) => Math.max(max, phase.sortOrder), -1) + 1;
      await createPhase({ goalId: goal.id, ...phaseForm, sortOrder: order });
      setPhaseForm(phaseBlank); setPhaseOpen(false); await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function saveTask(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await createTask({ ...taskForm, phaseId: taskPhase, durationMinutes: Number(taskForm.durationMinutes), xpReward: Number(taskForm.xpReward) });
      setTaskForm(taskBlank); setTaskPhase(null); await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function startTask(taskId) {
    setBusy(true); setError("");
    try { await updateTask(taskId, { status: "in_progress" }); await refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function finishTask(task) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await completeTask(task.id, reflections[task.id] || "");
      setNotice(result.alreadyCompleted ? "Task pehle complete ho chuka hai." : `Quest complete! +${result.xpAwarded} XP${result.dailyBonusXp ? ` · +${result.dailyBonusXp} daily quest bonus` : ""}`);
      setReflections(current => { const next = { ...current }; delete next[task.id]; return next; });
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="loading-message">Roadmap load ho raha hai…</p>;
  if (!goal) return <div className="detail-error"><button className="text-button" onClick={onBack}>← Back to goals</button><p className="form-error" role="alert">{error || "Goal nahi mila."}</p></div>;

  const total = goal.phases.reduce((sum, p) => sum + p.totalTasks, 0);
  const done = goal.phases.reduce((sum, p) => sum + p.completedTasks, 0);
  const percent = total ? Math.round(done / total * 100) : 0;

  return <section className="goal-detail">
    <button className="text-button back-link" onClick={onBack} type="button">← Back to goals</button>
    <header className="detail-header">
      <div><span className="category-tag">{goal.category}</span><h1>{goal.title}</h1><p>{goal.description || "Apne goal ko chhote roadmap steps mein baantein."}</p></div>
      <button className="button button-primary" onClick={() => setPhaseOpen(v => !v)} type="button">{phaseOpen ? "Cancel" : "+ Add phase"}</button>
    </header>
    {goal.why && <p className="goal-detail-why">“{goal.why}”</p>}
    <div className="detail-progress">
      <div className="detail-progress-copy"><span>{done} of {total} tasks complete</span><strong>{percent}%</strong></div>
      <div className="progress-track" role="img" aria-label={`${percent}% complete`}><span style={{ width: `${percent}%` }} /></div>
      {goal.targetDate && <small>Target date: {goal.targetDate}</small>}
    </div>

    {phaseOpen && <form className="goal-form" onSubmit={savePhase}>
      <div className="form-heading"><h3>Add a roadmap phase</h3><p>Group related tasks into milestones.</p></div>
      <label className="field"><span>Phase name</span><input maxLength={100} required value={phaseForm.title} onChange={e => setPhaseForm({ ...phaseForm, title: e.target.value })} placeholder="HTML fundamentals" /></label>
      <label className="field"><span>Description (optional)</span><textarea rows={2} maxLength={500} value={phaseForm.description} onChange={e => setPhaseForm({ ...phaseForm, description: e.target.value })} /></label>
      <button className="button button-primary" disabled={busy}>Save phase</button>
    </form>}

    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="success-message" role="status">{notice}</p>}

    {goal.phases.length === 0 ? <div className="empty-state"><div className="empty-icon">✦</div><h3>Break this goal into phases</h3><p>For example: foundations, practice, and a final project.</p><button className="button button-primary" onClick={() => setPhaseOpen(true)} type="button">Add your first phase</button></div> :
      <div className="phase-list">{goal.phases.map((phase,index) => <article className="phase-card" key={phase.id}>
        <header className="phase-heading"><div className="phase-number">{String(index+1).padStart(2,"0")}</div><div className="phase-heading-copy"><span className="eyebrow">PHASE {String(index+1).padStart(2,"0")}</span><h2>{phase.title}</h2>{phase.description && <p>{phase.description}</p>}</div><span className="phase-count">{phase.completedTasks}/{phase.totalTasks}</span></header>
        <div className="task-list">{phase.tasks.map(task => <div className="task-row" key={task.id}>
          <div className={`task-status task-status-${task.status}`}>{task.status==="completed"?"✓":"•"}</div>
          <div className="task-content"><h3>{task.title}</h3><p>{task.durationMinutes} min · {task.difficulty}{task.dueDate ? ` · Due ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString()}` : ""}{task.completedAt ? ` · Completed ${new Date(task.completedAt).toLocaleDateString()}` : ""}</p>{task.description && <p className="task-description">{task.description}</p>}
            {task.status!=="completed" && <label className="reflection-field"><span>Reflection (optional)</span><textarea rows={2} maxLength={1000} placeholder="What did you learn?" value={reflections[task.id]||""} onChange={e=>setReflections({...reflections,[task.id]:e.target.value})}/></label>}
          </div>
          <div className="task-actions"><span className="xp-reward">+{task.xpReward} XP</span>{task.status==="completed"?<span className="completed-label">Completed</span>:task.status==="in_progress"?<button className="button button-primary task-button" disabled={busy} onClick={()=>finishTask(task)} type="button">Complete</button>:<button className="button button-secondary task-button" disabled={busy} onClick={()=>startTask(task.id)} type="button">Start</button>}</div>
        </div>)}</div>
        {taskPhase===phase.id ? <form className="task-form" onSubmit={saveTask}>
          <div className="form-heading"><h3>Add a task</h3><p>Make it small enough for one session.</p></div>
          <label className="field"><span>Task title</span><input required maxLength={140} value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="Build a simple profile card"/></label>
          <label className="field"><span>Description (optional)</span><textarea rows={2} maxLength={1000} value={taskForm.description} onChange={e=>setTaskForm({...taskForm,description:e.target.value})}/></label>
          <div className="task-form-row">
            <label className="field"><span>Minutes</span><input type="number" min="1" max="600" value={taskForm.durationMinutes} onChange={e=>setTaskForm({...taskForm,durationMinutes:e.target.value})}/></label>
            <label className="field"><span>Difficulty</span><select value={taskForm.difficulty} onChange={e=>setTaskForm({...taskForm,difficulty:e.target.value})}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
            <label className="field"><span>XP</span><input type="number" min="0" max="10000" value={taskForm.xpReward} onChange={e=>setTaskForm({...taskForm,xpReward:e.target.value})}/></label>
          </div>
          <label className="field"><span>Quest deadline (optional)</span><input type="date" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm,dueDate:e.target.value})}/></label>
          {error && <p className="form-error">{error}</p>}
          <div className="task-form-actions"><button className="button button-primary" disabled={busy}>Save task</button><button className="button button-quiet" type="button" onClick={()=>setTaskPhase(null)}>Cancel</button></div>
        </form> : <button className="add-task-button" onClick={()=>{setTaskPhase(phase.id);setError("");}} type="button">+ Add task to this phase</button>}
      </article>)}</div>}
  </section>;
}

