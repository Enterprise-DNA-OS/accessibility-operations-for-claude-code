import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv,pick} from './lib/csv.mjs';
import {page,table,writeOut} from './lib/render.mjs';

export const reports={
 sites:'select code,name,owner,standard,review_on from sites order by code',
 pages:'select p.code,s.code as site,p.title,p.url,p.critical,p.revision from pages p join sites s on s.id=p.site_id order by p.code',
 findings:'select code,site,title,criterion,severity,owner,state,due_on from v_findings order by code',
 audits:'select a.code,s.code as site,a.name,a.scope,a.method,a.assessor,a.due_on,a.completed_on from audits a join sites s on s.id=a.site_id order by a.due_on,a.code',
 attention:'select * from v_attention order by reason,code',
 'retest-queue':"select code,site,title,fixed_by,latest_result,stale_test,state from v_findings where fix_id is not null and state<>'resolved' order by code",
 exceptions:"select f.code,f.site,e.reason,e.actor,e.expires_on,e.revoked_at,f.state from exceptions e join v_findings f on f.id=e.finding_id order by e.sequence desc",
 'owner-load':"select coalesce(nullif(owner,''),'Unassigned') as owner,count(*)::int as open_findings,count(*) filter(where due_on<current_date)::int as overdue,count(*) filter(where critical)::int as critical_journey from v_findings where state not in ('resolved','accepted') group by owner order by overdue desc,owner",
 'criterion-load':"select coalesce(nullif(criterion,''),'Unmapped') as criterion,count(*)::int as findings,count(distinct page_id)::int as pages,count(distinct site)::int as sites from v_findings where state<>'resolved' group by criterion order by findings desc,criterion",
 'release-review':'select code,name,open_findings,accepted_findings,resolved_findings,last_manual_audit,review_on from v_site_review order by code',
 'correction-history':"select f.code,x.actor as fixed_by,x.note,x.evidence,x.created_at from fixes x join findings f on f.id=x.finding_id order by x.sequence desc",
 compliance:'select * from v_compliance order by rule,code',
 activity:'select sequence,entity,actor,action,note,created_at from activity order by sequence desc'
};
const mutations=['add','assign','revise','log','record-fix','retest','accept-risk','revoke-exception','page-changed','complete-audit','review-site','import'];
export const commands=['help',...Object.keys(reports),'weekly-review','show',...mutations,'export','draft-remediation','draft-statement'];
const entities=['sites','pages','findings','audits','fixes','retests','exceptions','activity','imports'];
const required=(o,k)=>{const x=o[k];if(typeof x!=='string'||!x.trim())throw Error(`--${k} is required`);return x.trim();};
const today=()=>new Date().toISOString().slice(0,10);
function date(v,label='date'){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error(`Invalid ${label}: use a real YYYY-MM-DD date`);return v;}
function day(o,k){return date(required(o,k),k);}
function notFuture(v){if(v>today())throw Error('Observed, completed or tested date cannot be in the future');return v;}
function url(v){try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error();return u.href;}catch{throw Error('URL must be http(s) without credentials');}}
function choice(v,values){if(!values.includes(v))throw Error(`Expected one of ${values.join(', ')}; got ${v}`);return v;}
function flag(o,k){if(o[k]===undefined)return false;if(o[k]===true||o[k]==='true')return true;if(o[k]==='false')return false;throw Error(`--${k} expects true or false`);}
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function resolve(db,entity,ref){
 if(!['sites','pages','findings','audits'].includes(entity))throw Error('Unknown record kind');
 if(!ref||typeof ref!=='string')throw Error('--ref is required');
 const name=entity==='sites'||entity==='audits'?'name':'title';
 let rows=await db.query(`select * from ${entity} where lower(code)=lower($1) or id::text=$1`,[ref]);
 if(!rows.length)rows=await db.query(`select * from ${entity} where starts_with(id::text,lower($1)) or strpos(lower(${name}),lower($1))>0 order by code`,[ref]);
 if(rows.length!==1)throw Error(rows.length?`Ambiguous ${entity}: ${rows.map(x=>`${x.code} ${x[name]} (${x.id})`).join('; ')}`:`No ${entity} match ${ref}`);
 return rows[0];
}
async function record(db,entity,ref){const row=await resolve(db,entity,ref);await db.query(`select id from ${entity} where id=$1 for update`,[row.id]);return row;}
async function history(db,entity,id,actor,action,before,after,note=''){
 await db.query('insert into activity(entity,record_id,actor,action,before_data,after_data,note) values($1,$2,$3,$4,$5,$6,$7)',[entity,id,actor,action,before?JSON.stringify(before):null,after?JSON.stringify(after):null,note]);
}
async function insert(db,entity,fields){
 const keys=Object.keys(fields);return (await db.query(`insert into ${entity}(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(fields)))[0];
}
async function update(db,entity,id,fields){
 const keys=Object.keys(fields);if(!keys.length)throw Error('No changes supplied');
 return (await db.query(`update ${entity} set ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')} where id=$${keys.length+1} returning *`,[...Object.values(fields),id]))[0];
}

async function importSiteimprove(db,o,actor){
 const site=await record(db,'sites',required(o,'site'));
 const observed=notFuture(day(o,'observed-on'));
 const file=required(o,'file');const input=fs.readFileSync(file,'utf8');const rows=parseCsv(input);
 if(!rows.length)throw Error('Import has no data rows');
 const mapping=o.map?JSON.parse(fs.readFileSync(o.map,'utf8')):{};
 const allowed=['url','title','issue','criterion','level','severity'];
 for(const [k,v] of Object.entries(mapping))if(!allowed.includes(k)||typeof v!=='string')throw Error('Invalid field mapping');
 const val=(r,k,...aliases)=>mapping[k]?(Object.hasOwn(r,mapping[k])?r[mapping[k]]:(()=>{throw Error(`Missing mapped column ${mapping[k]}`)})()):pick(r,...aliases);
 const seen=new Set();let inserted=0,refreshed=0,unchanged=0;
 for(const [i,raw] of rows.entries()){
  const pageUrl=url(val(raw,'url','URL','Page URL','Page url'));
  const issue=String(val(raw,'issue','Issue','Issues','Issue title')||o.issue||'').trim();
  if(!issue)throw Error(`Row ${i+2}: missing issue title; export page-level findings or supply --issue`);
  const criterion=String(val(raw,'criterion','Success criteria','Success criterion','WCAG criterion')||o.criterion||'').trim();
  const levelText=String(val(raw,'level','Conformance','Level')||'unknown').trim();
  const level=/^(?:Level\s+)?(A{1,3})$/i.exec(levelText)?.[1]?.toUpperCase()||'unknown';
  const severity=String(val(raw,'severity','Severity')||'unknown').toLowerCase();
  choice(severity,['blocker','high','medium','low','unknown']);
  const sourceKey=hash(JSON.stringify([site.code,pageUrl,issue,criterion]));
  if(seen.has(sourceKey))throw Error(`Duplicate finding in CSV at row ${i+2}; use a page-level export, not one row per occurrence`);
  seen.add(sourceKey);
  let p=(await db.query('select * from pages where site_id=$1 and url=$2',[site.id,pageUrl]))[0];
  if(!p)p=await insert(db,'pages',{code:'PAGE-'+hash(site.code+pageUrl).slice(0,16),site_id:site.id,url:pageUrl,title:val(raw,'title','Page title','Title')||pageUrl});
  const old=(await db.query('select * from findings where source_key=$1',[sourceKey]))[0];
  const fields={page_id:p.id,title:issue,criterion,level,severity,last_seen:observed,source_data:JSON.stringify(raw)};
  if(old){
   if(observed<old.last_seen)throw Error(`Row ${i+2}: report predates the latest observation for ${old.code}`);
   const same=Object.keys(raw).length===Object.keys(old.source_data).length&&Object.entries(raw).every(([k,v])=>old.source_data[k]===v);
   if(same&&old.last_seen===observed){unchanged++;continue;}
   if(!flag(o,'update'))throw Error(`Changed source row ${old.code}; review and use --update`);
   const next=await update(db,'findings',old.id,fields);refreshed++;
   await history(db,'findings',old.id,actor,'import-refresh',old,next,'New observation invalidates earlier evidence');
  }else{
   const next=await insert(db,'findings',{...fields,code:'SI-'+sourceKey.slice(0,16),source_key:sourceKey,first_seen:observed});inserted++;
   await history(db,'findings',next.id,actor,'import',null,next);
  }
 }
 await insert(db,'imports',{site_id:site.id,file_hash:hash(input),observed_on:observed,actor,inserted,refreshed,unchanged});
 return [{site:site.code,inserted,refreshed,unchanged,dry_run:flag(o,'dry-run')}];
}

async function execute(db,command,o,pos){
 if(command==='help')return commands.map(command=>({command}));
 if(reports[command])return db.query(reports[command]);
 if(command==='weekly-review')return {attention:await db.query(reports.attention),retests:await db.query(reports['retest-queue']),sites:await db.query(reports['release-review'])};
 if(command==='show'){
  const kind=o.kind||'findings';const row=await resolve(db,kind,required(o,'ref'));
  return kind==='findings'?db.query('select * from v_findings where id=$1',[row.id]):[row];
 }
 if(command==='export'){
  const file=required(o,'file');let data;
  if(file.toLowerCase().endsWith('.csv')){
   const kind=choice(required(o,'kind'),entities);const rows=await db.query(`select * from ${kind} order by id`);
   const keys=(await db.query('select column_name from information_schema.columns where table_schema=\'public\' and table_name=$1 order by ordinal_position',[kind])).map(x=>x.column_name);
   const csv=v=>{let s=typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'');if(!flag(o,'raw-csv')&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
   data=[keys.map(csv).join(','),...rows.map(r=>keys.map(k=>csv(r[k])).join(','))].join('\r\n')+'\r\n';
  }else{
   const all={format:'accessibility-operations-v1',exported_at:new Date().toISOString()};
   for(const kind of entities)all[kind]=await db.query(`select * from ${kind} order by id`);data=JSON.stringify(all,null,2)+'\n';
  }
  fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true,mode:0o700});fs.writeFileSync(file,data,{flag:'wx',mode:0o600});return [{file:path.resolve(file)}];
 }
 if(command==='draft-remediation'||command==='draft-statement'){
  const rows=await db.query(command==='draft-remediation'?reports.findings:reports['release-review']);
  const file=writeOut('drafts',`${command}-${randomUUID()}`,page({title:command==='draft-remediation'?'Remediation plan':'Accessibility statement working notes',subtitle:'Draft for human review. Never a conformance declaration.',sections:[{title:'Recorded position',html:table(rows),note:'Check scope, untested journeys, contact details and actual evidence before using this draft.'}]}));return [{file}];
 }
 const actor=required(o,'actor');
 if(command==='import'){if(pos[0]!=='siteimprove')throw Error('Use import siteimprove');return importSiteimprove(db,o,actor);}
 if(command==='add'){
  const kind=choice(required(o,'kind'),['site','page','finding','audit']);const code=required(o,'code');
  if(!/^[A-Za-z0-9_-]+$/.test(code))throw Error('Code needs letters, numbers, underscore or hyphen');
  let fields={code};const entity={site:'sites',page:'pages',finding:'findings',audit:'audits'}[kind];
  if(kind==='site')fields={...fields,name:required(o,'name'),base_url:url(required(o,'url')),owner:o.owner||'',standard:o.standard||'WCAG 2.2 AA',jurisdiction:o.jurisdiction||'business-policy',review_on:o['review-on']?day(o,'review-on'):null,personal_data:flag(o,'personal-data'),retention_review_on:o['retention-review-on']?day(o,'retention-review-on'):null};
  if(kind==='page')fields={...fields,site_id:(await resolve(db,'sites',required(o,'site'))).id,title:required(o,'title'),url:url(required(o,'url')),critical:flag(o,'critical')};
  if(kind==='finding')fields={...fields,page_id:(await resolve(db,'pages',required(o,'page'))).id,title:required(o,'title'),criterion:o.criterion||'',level:choice(o.level||'unknown',['A','AA','AAA','unknown']),severity:choice(o.severity||'unknown',['blocker','high','medium','low','unknown']),owner:o.owner||'',due_on:o['due-on']?day(o,'due-on'):null,first_seen:notFuture(day(o,'observed-on')),last_seen:notFuture(day(o,'observed-on'))};
  if(kind==='audit')fields={...fields,site_id:(await resolve(db,'sites',required(o,'site'))).id,name:required(o,'name'),scope:required(o,'scope'),method:choice(required(o,'method'),['manual','automated','combined']),assessor:o.assessor||'',due_on:day(o,'due-on')};
  const row=await insert(db,entity,fields);await history(db,entity,row.id,actor,'add',null,row);return [row];
 }
 const entity=command==='page-changed'?'pages':command==='complete-audit'?'audits':command==='review-site'?'sites':o.kind||'findings';
 const before=await record(db,entity,required(o,'ref'));let after;
 if(command==='log'){await history(db,entity,before.id,actor,'note',null,null,required(o,'note'));return [{code:before.code,note:o.note}];}
 if(command==='assign'){
  if(entity!=='findings')throw Error('assign expects a finding');const f={};if(o.owner!==undefined)f.owner=required(o,'owner');if(o['due-on'])f.due_on=day(o,'due-on');if(o.workflow)f.workflow=choice(o.workflow,['open','in-progress']);after=await update(db,entity,before.id,f);
 }else if(command==='revise'){
  if(entity!=='findings')throw Error('revise expects a finding');const f={};if(o.title)f.title=required(o,'title');if(o.criterion)f.criterion=required(o,'criterion');if(o.level)f.level=choice(o.level,['A','AA','AAA','unknown']);if(o.severity)f.severity=choice(o.severity,['blocker','high','medium','low','unknown']);after=await update(db,entity,before.id,f);
 }else if(command==='page-changed'){
  required(o,'evidence');after=await update(db,entity,before.id,{revision:before.revision+1});
 }else if(command==='complete-audit'){
  after=await update(db,entity,before.id,{completed_on:notFuture(day(o,'completed-on')),assessor:actor,evidence:required(o,'evidence')});
 }else if(command==='review-site'){
  required(o,'evidence');const f={review_on:day(o,'review-on')};if(o['retention-review-on'])f.retention_review_on=day(o,'retention-review-on');after=await update(db,entity,before.id,f);
 }else{
  if(entity!=='findings')throw Error('Expected a finding');
  const p=(await db.query('select * from pages where id=$1 for update',[before.page_id]))[0];
  const common={finding_id:before.id,finding_revision:before.revision,page_revision:p.revision,actor};
  if(command==='record-fix'){
   after=await insert(db,'fixes',{...common,note:required(o,'note'),evidence:required(o,'evidence')});
  }else if(command==='retest'){
   const x=(await db.query('select * from fixes where finding_id=$1 order by sequence desc limit 1',[before.id]))[0];
   if(!x||x.finding_revision!==before.revision||x.page_revision!==p.revision)throw Error('Record a fix or reviewed unchanged fix for this finding and page revision before retesting');
   const tested=notFuture(day(o,'tested-on'));
   if(tested<String(x.created_at instanceof Date?x.created_at.toISOString():x.created_at).slice(0,10))throw Error('Retest cannot predate the recorded fix');
   after=await insert(db,'retests',{...common,fix_id:x.id,result:choice(required(o,'result'),['pass','fail']),method:choice(required(o,'method'),['manual','automated']),evidence:required(o,'evidence'),tested_on:tested});
  }else if(command==='accept-risk'){
   const expires=day(o,'expires-on');if(expires<today())throw Error('Exception expiry must be today or later');
   after=await insert(db,'exceptions',{...common,reason:required(o,'reason'),evidence:required(o,'evidence'),expires_on:expires});
  }else if(command==='revoke-exception'){
   required(o,'reason');const x=(await db.query('select * from exceptions where finding_id=$1 order by sequence desc limit 1',[before.id]))[0];
   if(!x||x.revoked_at)throw Error('No active exception to revoke');after=await update(db,'exceptions',x.id,{revoked_at:new Date().toISOString()});
  }else throw Error(`Unknown command ${command}`);
 }
 await history(db,entity,before.id,actor,command,before,after,o.evidence||o.reason||'');return [after];
}

export async function run(db,command,o={},pos=[]){
 if(!commands.includes(command))throw Error(`Unknown command ${command}; use help`);
 const mutates=mutations.includes(command);
 await db.exec(mutates?'BEGIN ISOLATION LEVEL SERIALIZABLE':'BEGIN READ ONLY');
 try{const out=await execute(db,command,o,pos);await db.exec(mutates&&!flag(o,'dry-run')?'COMMIT':'ROLLBACK');return out;}
 catch(e){await db.exec('ROLLBACK');throw e;}
}
const globalFlags=['json'];
const options={
 show:['kind','ref'],add:['kind','code','name','url','owner','standard','jurisdiction','review-on','personal-data','retention-review-on','site','page','title','critical','criterion','level','severity','due-on','observed-on','scope','method','assessor'],
 assign:['ref','owner','due-on','workflow'],revise:['ref','title','criterion','level','severity'],log:['kind','ref','note'],
 'record-fix':['ref','note','evidence'],retest:['ref','result','method','evidence','tested-on'],
 'accept-risk':['ref','reason','evidence','expires-on'],'revoke-exception':['ref','reason'],
 'page-changed':['ref','evidence'],'complete-audit':['ref','completed-on','evidence'],'review-site':['ref','review-on','retention-review-on','evidence'],
 import:['site','file','observed-on','map','issue','criterion','update'],export:['file','kind','raw-csv']
};
export function parseArgs(args){
 const [command='help',...rest]=args;const o={},pos=[];
 for(let i=0;i<rest.length;i++){
  const arg=rest[i];if(!arg.startsWith('--')){pos.push(arg);continue;}
  const eq=arg.indexOf('=');const key=arg.slice(2,eq<0?undefined:eq);
  if(Object.hasOwn(o,key))throw Error(`Duplicate --${key}`);
  o[key]=eq>=0?arg.slice(eq+1):rest[i+1]&&!rest[i+1].startsWith('--')?rest[++i]:true;
 }
 const allowed=new Set([...globalFlags,...(options[command]||[]),...(mutations.includes(command)?['actor','dry-run']:[])]);
 for(const k of Object.keys(o))if(!allowed.has(k))throw Error(`Unknown --${k} for ${command}`);
 if((command==='import'&&(pos.length!==1||pos[0]!=='siteimprove'))||(command!=='import'&&pos.length))throw Error('Unexpected positional argument');
 return {command,o,pos};
}
export function format(rows){
 if(!Array.isArray(rows))return Object.entries(rows).map(([k,v])=>`${k.toUpperCase()}\n${format(v)}`).join('\n\n');
 if(!rows.length)return 'No records.';
 const columns=Object.keys(rows[0]);const cell=v=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v).replaceAll('\n',' ');
 const widths=columns.map(k=>Math.min(65,Math.max(k.length,...rows.map(r=>cell(r[k]).length))));
 const line=r=>columns.map((k,i)=>cell(r[k]).slice(0,widths[i]).padEnd(widths[i])).join(' | ').trimEnd();
 return [line(Object.fromEntries(columns.map(k=>[k,k]))),widths.map(w=>'-'.repeat(w)).join('-+-'),...rows.map(line)].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{const {command,o,pos}=parseArgs(process.argv.slice(2));db=await getDb();const out=await run(db,command,o,pos);console.log(o.json?JSON.stringify(out,null,2):format(out));}
 catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
