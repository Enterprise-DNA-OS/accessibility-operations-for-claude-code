# Accessibility Operations for Claude Code

Own the record of every accessibility finding, fix, retest and review decision.

A database and a coding agent for website teams, digital agencies and accessibility reviewers. Bring findings from Siteimprove, assign the work, record evidence and prepare the weekly review. The database is the product. Claude Code, Codex, OpenCode or Cursor is the door.

## Three ways to use it

| Do it yourself | We customise it | We run it for you |
| --- | --- | --- |
| Free MIT source. Run the demo, bring an export and own your records. Hosting and agent usage have their own costs. | Enterprise DNA maps your Siteimprove exports, adds your fields, review rules and documents, and builds a web front end or different stack when agreed. | Omni by Enterprise DNA installs, connects and operates your system. One setup fee, then a retainer. |

[Get your version built: 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=siteimprove)

## Start with synthetic records

Node 20 or later. No cloud account required.

```bash
npm ci
npm test
npm run demo
npm run accessibility -- weekly-review
npm run view
npm run docs
```

The demo is fictional. It includes an overdue keyboard barrier, a missing owner, an outdated passing retest, an expired risk decision and an overdue manual audit. Seed is idempotent and refuses a remote database. For your real records, choose a fresh DATA_DIR, run migrate without seed, then import. DATA_DIR defaults to .data/db. DATABASE_URL selects your own PostgreSQL 15+ database. Local files and generated reports stay out of Git.

## The weekly jobs

Start Monday with /weekly-review, combining /attention, /retest-queue and /release-review. During the week use /assign, /record-fix and /retest. Before a release, record /page-changed and review old evidence. A risk decision goes through /accept-risk with an expiry; it is never a legal exemption. Use /audits and /complete-audit to record manual coverage. /draft-remediation and /draft-statement write private drafts and never send or publish.

31 CLI commands and 35 slash-command recipes. Each CLI command supports --json. Run npm run accessibility -- help for the list. Exact codes, partial identifiers and case-insensitive names work. Ambiguous names list candidates and exit with failure. Every mutation requires --actor and supports --dry-run. Unknown flags are rejected.

## Evidence that follows the change

Each retest refers to a specific finding revision, page revision and recorded fix. A newer failed retest supersedes an older pass. A later fix, revised finding or changed page invalidates earlier passing evidence. Re-record a reviewed fix and supply new retest evidence. Names and evidence references are supplied by the operator, not authenticated electronic signatures.

Imports never close findings because a row disappeared from an export. A newer observation requires --update and invalidates earlier evidence. Risk decisions record an owner, reason, evidence and expiry, and stop applying when the page or finding changes. Reports keep accepted risks separate from resolved findings.

/compliance checks record completeness, local review dates and evidence currency. It does not scan a website or certify WCAG or legal compliance. The workflow is a replacement for the operations record, not Siteimprove's proprietary scanner, SEO, analytics or expert testing services. Keep or commission the testing tools and human assessment your scope requires. [Rules and sources](docs/compliance.md).

## Ten questions this build answers

These are tested questions about your own review process. They are not a claim that Siteimprove lacks all ten capabilities. Siteimprove specifically documents that its Accessibility module does not show who corrected an issue; this system records that actor and evidence.

1. Which critical journeys still have an open barrier and who owns the fix? Run attention.
2. Which passing retests belong to an older page or finding revision? Run retest-queue.
3. Who recorded each fix, and what evidence did they attach? Run correction-history.
4. Which owners have the most overdue accessibility work? Run owner-load.
5. Which accepted risks have expired or been invalidated by a change? Run exceptions.
6. Which sites have no recorded completed manual audit? Run release-review.
7. Which criteria recur across several pages and sites? Run criterion-load.
8. Which findings have no owner or agreed completion date? Run compliance.
9. Which sites need a review of why personal information is retained? Run compliance.
10. What changed in the record, who changed it, and what did it say before? Run activity.

## Bring your Siteimprove records

Export page-level findings from the Cross Site Accessibility Issues widget. Use one row per page and issue. A per-issue export can supply its issue name once. Then import in one command:

```bash
npm run accessibility -- import siteimprove --site=SHOP --file=imports/findings.csv --observed-on=2026-10-28 --actor="Your name" --dry-run
```

Remove --dry-run after checking counts. Use --map=fixtures/field-map.json when column names differ. A new report about an existing issue needs --update. All original columns are retained. Siteimprove supports several export views, so check your header and export scope before importing. [Export steps and mapping](docs/replace-siteimprove.md).

## Documents and views

Change brand.json once to put your business name, logo and colours on every output. npm run docs renders a remediation plan, audit evidence pack and exception register for each site. npm run view renders the weekly review, retest queue and owner workload. These are private read-only HTML snapshots. They are not a certification or a published accessibility statement. Draft statement notes need a human to write the actual declaration and verify its scope.

## Your first hour: ten things to ask for

1. Put our business name on every review document.
2. Add our website and its review owner.
3. Import one export without saving changes.
4. Map our existing issue and page columns.
5. Mark checkout and applications as critical journeys.
6. Set the review dates our team agreed.
7. Record who fixed a finding and attach the change reference.
8. Show passing evidence made stale by a release.
9. Draft the weekly remediation plan.
10. Add our supplier ticket field and group work by it.

/customise writes and tests a new migration. /new-view adds a read-only report. [What a screen adds](docs/why-no-front-end.md).

## Verification and operation

npm test uses a temporary database, applies migrations and seeds twice, then exercises all 31 CLI commands. It checks stale evidence, latest failures, exceptions, rollback, repeat imports, mapping, original-column retention, exports, escaped HTML and access denial. Manual CI covers Node 20 and 22 on Linux and Windows, plus PostgreSQL 17. TEST_DATABASE_URL must be an empty disposable database; tests never use DATABASE_URL from your working configuration.

RLS is enabled without anonymous access policies. Shared operation requires a trusted database operator, appropriate roles, backups and an agreed retention policy. This is a single organisation workspace, not a hosted multi-tenant service. CLI history is useful but a database administrator can alter it. Protect original evidence separately. Export JSON contains all records; it is not a substitute for database backups. CSV exports protect spreadsheet formula cells by default; --raw-csv is for trusted machine interchange only.

[Research and selection](docs/research.md). MIT. Not affiliated with Siteimprove, Anthropic or the other agent providers.
