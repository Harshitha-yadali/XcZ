# TODOS

Deferred work, with enough context to pick up cold.
Created 2026-08-05 by `/plan-ceo-review` (auto-apply scope reduction).

---

## P2 — Assisted Apply

**What:** One-click "apply pack" on the job details page: tailored resume PDF +
copyable field values (name, email, phone, LinkedIn, GitHub) + deep-link to the
employer's application form. The user pastes and submits themselves.

**Why:** Captures most of what auto-apply promised with none of the risk. The
user's LinkedIn account is their career infrastructure; a server-side bot that
submits on their behalf violates LinkedIn User Agreement 8.2 (unattended
automation) and risks a permanent restriction. Tools that draft and let the user
submit are TOS-compliant. Also works on 100% of ATSs including Workday, which
hides form fields from standard JS queries (~34% parse accuracy for bots).

**Pros:** Zero ban risk. Zero stored credentials. Ships in under an hour.
Honest to users. Works everywhere.

**Cons:** Not literally "auto." A competitor's marketing page will claim more.

**Context:** As of the 2026-08-05 deletion, the hard 90% already exists and is
untouched: `optimizeResume` tailors against a JD, `projectAnalysisService`
picks the best projects, `exportToPDF` renders. What was deleted was only the
robot that submitted. The real JD-tailoring entry point is
`JobDetailsPageNew.handleAIOptimizedApply` -> navigates to `/optimizer` with
`state.jobDescription`. Start there.

**Effort:** S (human ~3 days / CC ~45 min)
**Priority:** P2
**Depends on:** auto-apply deletion landing first (done in this pass).

---

## P2 — Untrack `dist/` from git

**What:** Add `dist/` to `.gitignore`, then `git rm -r --cached dist`.

**Why:** 187 built files are tracked. Stale bundles ship, every build produces
noise in `git status`, and deleted features linger in committed chunks. During
the auto-apply removal, `dist/assets/*.js` still contained the deleted code.

**Pros:** Clean diffs. No stale-bundle class of bug. Smaller repo.

**Cons:** If anything currently deploys straight from the committed `dist/`,
that pipeline must move to building on deploy first. Verify before removing.

**Context:** `npm run build` = `vite build && prerender && sitemap`. Confirm the
host (Netlify/Vercel/etc.) runs the build rather than serving committed output.

**Effort:** S (human ~30 min / CC ~5 min)
**Priority:** P2
**Depends on:** confirming the deploy pipeline builds from source.

---

## P2 — Error monitoring

**What:** Wire client-side and edge-function error reporting (Sentry or
equivalent).

**Why:** There is currently zero visibility into silent failures. Two shipped
bugs ran undetected for months and were only found by reading code:
(1) `auto-apply-submit` returned fake success for every job application;
(2) `logManualApplication(job.id, '', ...)` passed `''` for a `NOT NULL uuid`
FK inside an empty `catch {}`, so `manual_apply_logs` never recorded a single
row and My Applications showed an empty list for every user.

Both are the same disease: a codepath that appears to work and does nothing.
Monitoring is how you find the third one.

**Pros:** Catches silent failures. Makes empty `catch {}` blocks visible.
Alerts on edge-function 500s.

**Cons:** Adds a dependency and a small bundle cost. Free tier may not cover
volume as usage grows.

**Context:** Start with unhandled promise rejections and the `catch` blocks in
`src/services/` that currently only `console.error`. The Supabase edge functions
log to the dashboard but nothing aggregates or alerts.

**Effort:** M (human ~1 day / CC ~1 h)
**Priority:** P2
**Depends on:** nothing.
