# Bring Siteimprove findings across

Start with a small export, reconcile it, then repeat for the agreed scope. The free importer brings page-level finding records across in one command. It does not move the scanner, SEO, analytics, attachments or your whole historical account.

## Export from Siteimprove

1. In the Dashboard add the Cross Site Accessibility Issues widget if needed.
2. Filter to the sites and issues you need. Drill down to the site and page level.
3. Use the CSV download in that view. Keep the original file unchanged in private storage.
4. Inspect its header. Use one row for each page and issue. A summary with issue counts but no page URL is not an importable page-level finding.

The vendor [documents CSV downloads from each widget view](https://help.siteimprove.com/support/solutions/articles/80001064337-widget-cross-site-accessibility-issues). It also [documents configurable accessibility columns](https://help.siteimprove.com/support/solutions/articles/80001037203-2021-updates-to-the-siteimprove-platform). It does not publish one universal CSV contract. fixtures/siteimprove.csv is a synthetic compatibility fixture, not a captured customer export.

## Import

Create an empty local database with a fresh DATA_DIR and npm run migrate, without seed. Add your site:

```bash
npm run accessibility -- add --kind=site --code=WEB --name="Our website" --url=https://www.example.org --actor="Your name"
npm run accessibility -- import siteimprove --site=WEB --file=imports/findings.csv --observed-on=2026-10-28 --actor="Your name" --dry-run
```

Check the preview counts. Remove --dry-run to save. Every row is validated in one transaction; one bad row rolls the whole import back. No network access, login or OAuth is needed. --observed-on is the report's actual observation date, not a date guessed by the importer.

## Mapping

| Destination | Default column aliases | Rule |
| --- | --- | --- |
| Page URL | URL, Page URL | Required http(s) URL without embedded credentials |
| Page title | Page title, Title | Uses URL when absent |
| Finding title | Issue, Issues, Issue title | Required, or supply --issue for a per-issue page list |
| Criterion reference | Success criteria, Success criterion, WCAG criterion | Optional; --criterion supplies one for a per-issue list; missing references are flagged |
| Level | Conformance, Level | A, AA, AAA or Level A/AA/AAA; anything else stays unknown |
| Severity | Severity | blocker, high, medium, low or unknown; absent is unknown |
| Original record | Every input column | Preserved in source_data, including responsibility and CMS links |

For other headers, use --map=path/to/map.json. The mapping is a JSON object with url, title, issue, criterion, level and severity keys pointing to exact source headers. See fixtures/field-map.json. Responsibility is a role label and is not silently turned into a named owner. Assign owners and due dates after reconciliation. Siteimprove severity concepts may differ; leave unmapped severity unknown rather than guessing.

If an export contains one row per occurrence, aggregate to one row per page and issue after review. The importer rejects duplicate identities instead of silently discarding occurrences. No element-level count is claimed.

## Reconciliation and repeat imports

Identity combines destination site, full page URL, issue title and criterion. Identical rows from the same observation date are unchanged. Changed data or a later observation requires --update, increments the finding revision and invalidates old evidence. An older report is rejected. A changed title or URL creates a new identity; reconcile it explicitly. Missing rows never close findings because exports can be filtered.

Run findings, attention and compliance after import. Compare row counts, sample URLs and original source_data against the export. Add the actual fix, retest and audit evidence yourself. Historic Siteimprove dismissals, DCI scores, annotations, attachments, user permissions, scan configuration and test history are not fabricated from the finding list. Enterprise DNA scopes those separately and can build the required connections in your version.

## Keep and leave

Export all records as JSON with export --file=exports/all.json, or one entity as CSV with export --kind=findings --file=exports/findings.csv. Existing files are never overwritten. Spreadsheet formula text is escaped by default; --raw-csv retains exact text for trusted machine use. JSON keeps original values. This is a portable record export, not a database restore tool. Use proper database backups for recovery.
