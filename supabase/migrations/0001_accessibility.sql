create table sites (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 name text not null check(length(trim(name))>0), base_url text not null check(base_url ~ '^https?://'),
 owner text not null default '', standard text not null default 'WCAG 2.2 AA',
 jurisdiction text not null default 'business-policy', review_on date,
 personal_data boolean not null default false, retention_review_on date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table pages (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 site_id uuid not null references sites(id), url text not null check(url ~ '^https?://'),
 title text not null, critical boolean not null default false, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(site_id,url)
);
create table audits (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 site_id uuid not null references sites(id), name text not null, scope text not null,
 method text not null check(method in ('manual','automated','combined')),
 assessor text not null default '', due_on date not null, completed_on date, evidence text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(completed_on is null or (length(trim(assessor))>0 and length(trim(evidence))>0))
);
create table findings (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 page_id uuid not null references pages(id), title text not null check(length(trim(title))>0),
 criterion text not null default '', level text not null default 'unknown' check(level in ('A','AA','AAA','unknown')),
 severity text not null default 'unknown' check(severity in ('blocker','high','medium','low','unknown')),
 owner text not null default '', due_on date, workflow text not null default 'open' check(workflow in ('open','in-progress')),
 revision integer not null default 1, first_seen date not null, last_seen date not null,
 source_key text unique, source_data jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(last_seen>=first_seen)
);
create table fixes (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 finding_id uuid not null references findings(id), finding_revision integer not null, page_revision integer not null,
 actor text not null check(length(trim(actor))>0), note text not null check(length(trim(note))>0),
 evidence text not null check(length(trim(evidence))>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table retests (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 finding_id uuid not null references findings(id), fix_id uuid not null references fixes(id),
 finding_revision integer not null, page_revision integer not null,
 result text not null check(result in ('pass','fail')), method text not null check(method in ('manual','automated')),
 actor text not null check(length(trim(actor))>0), evidence text not null check(length(trim(evidence))>0),
 tested_on date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table exceptions (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 finding_id uuid not null references findings(id), finding_revision integer not null, page_revision integer not null,
 reason text not null check(length(trim(reason))>0), actor text not null check(length(trim(actor))>0),
 evidence text not null check(length(trim(evidence))>0), expires_on date not null, revoked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table activity (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 entity text not null, record_id uuid, actor text not null, action text not null,
 note text not null default '', before_data jsonb, after_data jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), site_id uuid not null references sites(id),
 file_hash text not null, observed_on date not null, actor text not null,
 inserted integer not null, refreshed integer not null, unchanged integer not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index pages_site on pages(site_id);
create index audits_site on audits(site_id);
create index findings_page on findings(page_id);
create index findings_due on findings(due_on);
create index fixes_finding on fixes(finding_id,sequence desc);
create index retests_finding on retests(finding_id,sequence desc);
create index retests_fix on retests(fix_id);
create index exceptions_finding on exceptions(finding_id,sequence desc);
create index activity_record on activity(record_id,sequence desc);
create index imports_site on imports(site_id);
create function touch_updated() returns trigger language plpgsql as $$
begin new.updated_at=clock_timestamp(); return new; end $$;
create function revise_finding() returns trigger language plpgsql as $$
begin
 if (new.title,new.criterion,new.level,new.severity,new.page_id,new.last_seen,new.source_data)
 is distinct from (old.title,old.criterion,old.level,old.severity,old.page_id,old.last_seen,old.source_data)
 then new.revision=old.revision+1; end if;
 return new;
end $$;
create trigger finding_revision before update on findings for each row execute function revise_finding();
do $$ declare t text; begin
 foreach t in array array['sites','pages','audits','findings','fixes','retests','exceptions','activity','imports'] loop
  execute format('create trigger touch before update on %I for each row execute function touch_updated()',t);
  execute format('alter table %I enable row level security',t);
  execute format('revoke all on %I from public',t);
 end loop;
end $$;
revoke all on all sequences in schema public from public;
revoke execute on function touch_updated(),revise_finding() from public;

create view v_findings with (security_invoker=true) as
select f.*, p.code as page_code,p.url,p.critical,p.revision as page_revision,s.code as site,s.id as site_id,
 x.id as fix_id,x.actor as fixed_by,x.evidence as fix_evidence,
 r.actor as tested_by,r.result as latest_result,r.method as test_method,r.evidence as test_evidence,r.tested_on,
 e.id as exception_id,e.expires_on,e.reason as exception_reason,
 case
  when r.result='pass' and r.fix_id=x.id and r.finding_revision=f.revision and r.page_revision=p.revision
   and x.finding_revision=f.revision and x.page_revision=p.revision then 'resolved'
  when e.revoked_at is null and e.expires_on>=current_date and e.finding_revision=f.revision and e.page_revision=p.revision then 'accepted'
  when x.id is not null then 'awaiting-retest'
  else f.workflow end as state,
 coalesce(r.finding_revision<>f.revision or r.page_revision<>p.revision or r.fix_id<>x.id,false) as stale_test
from findings f join pages p on p.id=f.page_id join sites s on s.id=p.site_id
left join lateral (select * from fixes where finding_id=f.id order by sequence desc limit 1) x on true
left join lateral (select * from retests where finding_id=f.id order by sequence desc limit 1) r on true
left join lateral (select * from exceptions where finding_id=f.id order by sequence desc limit 1) e on true;

create view v_attention with (security_invoker=true) as
select code,site,title,owner,'overdue_fix'::text as reason from v_findings where state not in ('resolved','accepted') and due_on<current_date
union all select code,site,title,owner,'missing_owner' from v_findings where state<>'resolved' and trim(owner)=''
union all select code,site,title,owner,'missing_due_date' from v_findings where state not in ('resolved','accepted') and due_on is null
union all select code,site,title,owner,'stale_retest' from v_findings where stale_test
union all select code,site,title,owner,'critical_journey' from v_findings where critical and state not in ('resolved','accepted')
union all select code,site,title,owner,'expired_exception' from v_findings where expires_on<current_date and state<>'resolved';

create view v_site_review with (security_invoker=true) as
select s.id,s.code,s.name,s.owner,s.standard,s.jurisdiction,s.review_on,
 (select count(*)::integer from pages where site_id=s.id) as pages,
 (select count(*)::integer from v_findings where site_id=s.id and state not in ('resolved','accepted')) as open_findings,
 (select count(*)::integer from v_findings where site_id=s.id and state='accepted') as accepted_findings,
 (select count(*)::integer from v_findings where site_id=s.id and state='resolved') as resolved_findings,
 (select max(completed_on) from audits where site_id=s.id and method in ('manual','combined')) as last_manual_audit
from sites s;

create view v_compliance with (security_invoker=true) as
select code,site,'CRITERION'::text as rule,'Missing criterion reference; review the original finding'::text as finding
from v_findings where trim(criterion)=''
union all select code,site,'OWNERSHIP','Missing owner or local due date' from v_findings where state not in ('resolved','accepted') and (trim(owner)='' or due_on is null)
union all select code,site,'EVIDENCE','Fix has no current passing retest' from v_findings where fix_id is not null and state not in ('resolved','accepted')
union all select code,site,'EXCEPTION','Exception has expired or no longer matches the finding or page' from v_findings where exception_id is not null and state not in ('resolved','accepted')
union all select code,code,'MANUAL-SCOPE','No completed manual or combined audit is recorded' from v_site_review where last_manual_audit is null
union all select code,code,'REVIEW','Site review is missing or overdue' from sites where review_on is null or review_on<current_date
union all select code,code,'RETENTION','Personal-information purpose review is missing or overdue' from sites where personal_data and (retention_review_on is null or retention_review_on<current_date)
union all select a.code,s.code,'AUDIT','Planned audit is overdue' from audits a join sites s on s.id=a.site_id where a.completed_on is null and a.due_on<current_date;
revoke all on v_findings,v_attention,v_site_review,v_compliance from public;
