---
description: accept risk for the accessibility operations record
---

Read CLAUDE.md. Use accept-risk --ref=<finding> --reason="<supplied reason>" --evidence="<decision reference>" --expires-on=YYYY-MM-DD. This records an internal risk decision, never a legal exemption.

Use npm run accessibility -- accept-risk with the required arguments above. Add --json for analysis. Resolve ambiguous names using the listed codes. Every mutation requires --actor="<operator-supplied name>" and supports --dry-run. Do not invent evidence, test results or decisions.
