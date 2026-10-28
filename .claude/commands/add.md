---
description: add for the accessibility operations record
---

Read CLAUDE.md. Use add --kind=site|page|finding|audit with the supplied fields. Read scripts/accessibility.mjs for the options for that kind. A finding needs its page and observed date; an audit needs its site, scope, method and due date.

Use npm run accessibility -- add with the required arguments above. Add --json for analysis. Resolve ambiguous names using the listed codes. Every mutation requires --actor="<operator-supplied name>" and supports --dry-run. Do not invent evidence, test results or decisions.
