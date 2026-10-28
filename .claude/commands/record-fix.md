---
description: record fix for the accessibility operations record
---

Read CLAUDE.md. Use record-fix --ref=<finding> --note="<what changed>" --evidence="<supplied reference>". A recorded fix needs a new retest before resolution.

Use npm run accessibility -- record-fix with the required arguments above. Add --json for analysis. Resolve ambiguous names using the listed codes. Every mutation requires --actor="<operator-supplied name>" and supports --dry-run. Do not invent evidence, test results or decisions.
