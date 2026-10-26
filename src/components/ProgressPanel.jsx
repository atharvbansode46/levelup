import { useEffect, useState } from "react";
import { getProgress } from "../lib/api.js";

export default function ProgressPanel() {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getProgress()
      .then(data => { if (active) setProgress(data); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!progress) return <p className="loading-message">Progress load ho raha hai…</p>;

  const max = Math.max(1, ...progress.activity.map(day => day.completedTasks));
  const today = progress.activity.at(-1)?.completedTasks || 0;
  const badges = [
    { icon: "⚡", title: "First XP", earned: progress.totalXp > 0 },
    { icon: "🎯", title: "5 quests", earned: progress.completedTasks >= 5 },
    { icon: "🔥", title: "3-day streak", earned: progress.longestStreak >= 3 },
  ];
  return (
    <section className="progress-panel" id="progress" aria-labelledby="progress-title">
      <div className="section-heading progress-heading">
        <div><p className="eyebrow">YOUR ADVENTURE</p><h2 id="progress-title">Player stats</h2></div>
        <span className="level-pill">✦ Level {progress.level}</span>
      </div>
      <div className="xp-hero">
        <div className="xp-emblem"><span>LVL</span><strong>{progress.level}</strong></div>
        <div className="xp-hero-copy"><div className="xp-hero-top"><div><span>EXPERIENCE POINTS</span><strong>{progress.totalXp} <small>XP</small></strong></div><div className="xp-next">{progress.xpToNextLevel} XP<br/><small>to next level</small></div></div>
          <div className="xp-meter" role="img" aria-label={`${progress.xpIntoLevel}% toward next level`}><span style={{ width: `${progress.xpIntoLevel}%` }} /></div>
          <div className="xp-meter-labels"><span>Level {progress.level}</span><span>{progress.xpIntoLevel}/100 XP</span><span>Level {progress.level + 1}</span></div>
        </div>
        <div className="streak-capsule"><span className="streak-flame">🔥</span><div><strong>{progress.currentStreak} days</strong><small>current streak</small></div></div>
      </div>
      <div className="quest-dashboard-row">
        <div className={`daily-quest ${today ? "daily-quest-done" : ""}`}><span className="daily-quest-icon">{today ? "✓" : "⚔"}</span><div><span>DAILY QUEST</span><strong>{today ? "Quest cleared! Keep your streak alive." : "Complete one quest today"}</strong><small>{today ? `${today} quest${today === 1 ? "" : "s"} completed today` : "Complete your first quest to earn a bonus."}</small></div><span className="daily-quest-reward">{today ? "Bonus claimed" : "+15 XP BONUS"}</span></div>
        <div className="badge-shelf" aria-label="Achievement badges">{badges.map(badge => <div className={`badge-chip ${badge.earned ? "badge-earned" : ""}`} key={badge.title} title={badge.earned ? `${badge.title} unlocked` : `${badge.title} locked`}><span>{badge.earned ? badge.icon : "🔒"}</span><small>{badge.title}</small></div>)}</div>
      </div>
      <div className="progress-stats">
        <article className="progress-stat"><span>QUESTS CLEARED</span><strong>{progress.completedTasks}</strong><small>Every completed task counts</small></article>
        <article className="progress-stat"><span>BEST STREAK</span><strong>{progress.longestStreak} days</strong><small>Your personal best</small></article>
      </div>
      <div className="activity-card">
        <div className="activity-heading"><h3>Quest activity</h3><span>Last 7 days · completed quests</span></div>
        <div className="activity-chart" role="img" aria-label="Completed tasks during the last 7 days">
          {progress.activity.map(day => {
            const label = new Date(`${day.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
            const height = day.completedTasks ? Math.max(14, day.completedTasks / max * 100) : 5;
            return <div className="activity-day" key={day.date}>
              <span className="activity-count">{day.completedTasks || ""}</span>
              <div className="activity-bar-track"><span className="activity-bar" style={{ height: `${height}%` }} /></div>
              <span className="activity-label">{label}</span>
            </div>;
          })}
        </div>
      </div>
    </section>
  );
}





