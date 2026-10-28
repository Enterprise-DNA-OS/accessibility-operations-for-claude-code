---
description: retest for the accessibility operations record
---

Read CLAUDE.md. Use retest --ref=<finding> --result=pass|fail --method=manual|automated --tested-on=YYYY-MM-DD --evidence="<supplied reference>". Require an actual supplied result. The recorded fix must match the current page and finding revision.

Use npm run accessibility -- retest with the required arguments above. Add --json for analysis. Resolve ambiguous names using the listed codes. Every mutation requires --actor="<operator-supplied name>" and supports --dry-run. Do not invent evidence, test results or decisions.
