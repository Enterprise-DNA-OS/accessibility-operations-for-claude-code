create or replace view v_compliance with (security_invoker=true) as
select code,site,'CRITERION'::text as rule,'Missing criterion reference; review the original finding'::text as finding
from v_findings where trim(criterion)=''
union all select code,site,'OWNERSHIP','Missing owner or local due date' from v_findings where state not in ('resolved','accepted') and (trim(owner)='' or due_on is null)
union all select code,site,'EVIDENCE','Fix has no current passing retest' from v_findings where fix_id is not null and state not in ('resolved','accepted')
union all select code,site,'EXCEPTION','Risk decision is revoked, expired or no longer matches the finding or page' from v_findings where exception_id is not null and state not in ('resolved','accepted')
union all select code,code,'MANUAL-SCOPE','No completed manual or combined audit is recorded' from v_site_review where last_manual_audit is null
union all select code,code,'REVIEW','Site review is missing or overdue' from sites where review_on is null or review_on<current_date
union all select code,code,'RETENTION','Personal-information purpose review is missing or overdue' from sites where personal_data and (retention_review_on is null or retention_review_on<current_date)
union all select a.code,s.code,'AUDIT','Planned audit is overdue' from audits a join sites s on s.id=a.site_id where a.completed_on is null and a.due_on<current_date;
revoke all on v_compliance from public;
