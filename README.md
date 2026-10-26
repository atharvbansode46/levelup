# LevelUp

LevelUp is a local-first, gamified learning roadmap and career-proof tracker. It turns a skill goal into a deadline-based plan, tracks completion and evidence, and creates editable profile drafts from work the learner has actually completed.

## Run locally

This app has no build step or API key requirement. Open `index.html` directly in a browser, or use a local static server:

```powershell
python -m http.server 4173
```

Then open <http://localhost:4173>.

## Core flows

- Start in the preloaded demo workspace or create a new learning goal.
- Review the locally generated roadmap and open a task for instructions.
- Mark a task complete, add notes, and optionally attach a project/evidence URL.
- Completion awards XP once; reopening records a transparent XP deduction.
- Generate editable resume, LinkedIn, Naukri, and Fiverr drafts from completed work.
- Export progress as JSON or the career profile as Markdown.
- Data is persisted in `localStorage` under `levelup-v2`. Use Settings → Reset demo data to start over.

## Architecture

The app intentionally uses the repository’s existing dependency-free vanilla JavaScript convention. `app.js` contains:

- A small local persistence service (`loadState` / `saveState`)
- A mock roadmap generator behind `generateGoal`
- Explicit points transactions and idempotent completion checks
- View renderers for each application area
- Export and career-draft helpers

`generateGoal` is the seam for connecting a future AI provider. The current local generator is deterministic and still produces concrete phases, durations, due dates, and deliverables without requiring secrets.

## Integrations

No external platform is updated automatically. LinkedIn, Naukri, Fiverr, and resume content are editable drafts only. The user must review and publish them in the relevant platform. Resource URLs are opened as links; there is no external account connection in this local demo.

## Limitations

- Authentication, multi-device sync, file uploads, and server-side AI generation are not included.
- Evidence is stored as a URL and reflection text rather than uploaded files.
- Notifications are local UI feedback, not email or push notifications.
