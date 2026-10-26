import { useEffect, useState } from "react";
import { getDrafts, updateDraft } from "../lib/api.js";

export default function DraftLibrary() {
  const [drafts,setDrafts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let active=true;
    getDrafts().then(items=>{if(active)setDrafts(items);}).catch(err=>{if(active)setError(err.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  async function save(draft){
    setSaving(draft.id);setError("");setNotice("");
    try{
      const updated=await updateDraft(draft.id,draft.content);
      setDrafts(items=>items.map(item=>item.id===draft.id?{...item,...updated}:item));
      setNotice("Draft saved.");
    }catch(err){setError(err.message);}
    finally{setSaving(null);}
  }
  return <section className="draft-library">
    <header className="draft-library-header"><div><p className="eyebrow">YOUR AI WORKSHOP</p><h1>Saved drafts</h1><p>Roadmap ke saath bane resume aur LinkedIn drafts yahan milenge. Apne real experience ke hisaab se edit karo.</p></div><span className="draft-count">{drafts.length} DRAFTS</span></header>
    {notice&&<p className="success-message" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
    {loading?<p className="loading-message">Drafts load ho rahe hain…</p>:drafts.length===0?<div className="empty-state"><div className="empty-icon">✎</div><h3>Abhi koi draft nahi hai</h3><p>Chat mein apna skill aur deadline batao. AI roadmap ke saath resume aur LinkedIn drafts bhi save karega.</p></div>:
      <div className="draft-grid">{drafts.map(draft=><article className="draft-card" key={draft.id}><header><div><span className="draft-type-tag">{draft.type==="resume_summary"?"RESUME SUMMARY":"LINKEDIN ABOUT"}</span><h2>{draft.title}</h2><p>For goal: {draft.goalTitle}</p></div><span className="draft-saved-mark">✓ Saved</span></header><label className="field"><span>Edit your draft</span><textarea rows={draft.type==="resume_summary"?6:10} maxLength={5000} value={draft.content} onChange={e=>setDrafts(items=>items.map(item=>item.id===draft.id?{...item,content:e.target.value}:item))}/></label><div className="draft-card-footer"><small>Generated as a draft. Replace bracketed notes with your real experience.</small><button className="button button-primary" disabled={saving===draft.id} onClick={()=>save(draft)}>{saving===draft.id?"Saving…":"Save edits"}</button></div></article>)}</div>}
  </section>;
}
