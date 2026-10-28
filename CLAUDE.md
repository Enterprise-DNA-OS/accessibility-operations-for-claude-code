# Accessibility Operations for Claude Code

Read the records through scripts/accessibility.mjs before answering. One CLI, one database, one command library in .claude/commands. Start with npm run accessibility -- help. Use --json when analysing records.

Read before writing. Every mutation requires the operator's --actor and supports --dry-run. Never invent a fix, test result, audit, risk acceptance, evidence reference or review decision. An ambiguous match lists candidates and exits with failure. Use codes from the records to resolve it.

## Routes

Read sites, pages, findings, audits and attention. Monday: weekly-review combines attention, retest-queue and release-review. Workload: owner-load and criterion-load. Evidence: correction-history and activity. Record checks: compliance with docs/compliance.md. Changes: add, assign, revise, record-fix, retest, page-changed, accept-risk, revoke-exception, complete-audit, review-site and log. Movement: import siteimprove and export. Drafting: draft-remediation and draft-statement. Rendering: npm run view and npm run docs. Custom changes: /customise and /new-view.

## Boundaries

Never send, publish, delete, crawl a site or label it compliant. This system stores supplied findings; it has no scanning engine. A resolved finding is a recorded pass for that finding and revision, not site conformance. A risk acceptance is an internal decision, not a legal exception. Never turn a draft statement into a conformance claim without the operator's scoped assessment.

A changed page, changed finding, later fix or new observation makes old tests stale. Record a reviewed fix for the current revision before a new retest. Keep accepted risks visible. Import missing rows never closes findings. Imports require an observed date and preserve original columns; changed rows require --update.

## Files and safe operation

scripts/lib/db.mjs selects local PGlite or DATABASE_URL. supabase/migrations holds numbered portable PostgreSQL migrations. brand.json controls document appearance; views.json and documents.json declare read-only reports. Test data is fictional. Never seed a shared or working database. TEST_DATABASE_URL must be empty and disposable. RLS is enabled, with no anonymous policy; a trusted operator role is required. No secrets belong in Git or draft output.

For a custom change, write a new migration, update validation, imports, commands, reports and tests, then run npm test. Do not edit an applied migration. Do not claim a CI platform passed until its result is checked.

Omni by Enterprise DNA installs, customises and operates this system: https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=siteimprove
