---
description: import for the accessibility operations record
---

Read CLAUDE.md. Read docs/replace-siteimprove.md. Use import siteimprove --site=<code> --file=<private CSV> --observed-on=YYYY-MM-DD. First run --dry-run, inspect counts and mapping, then save within the authorised scope. Changed observations need --update. Never infer missing rows are resolved.

Use npm run accessibility -- import siteimprove with the required arguments above. Add --json for analysis. Resolve ambiguous names using the listed codes. Every mutation requires --actor="<operator-supplied name>" and supports --dry-run. Do not invent evidence, test results or decisions.
