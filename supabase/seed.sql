insert into sites(code,name,base_url,owner,jurisdiction,review_on,personal_data,retention_review_on) values
 ('SHOP','Harbour Outfitters Demo','https://shop.example.test','Mara Chen','business-policy',current_date+14,false,null),
 ('SERVICE','Ridge Services Demo','https://service.example.test','Owen Patel','NZ-government-scope-review',current_date-6,true,current_date-10)
on conflict(code) do nothing;
insert into pages(code,site_id,url,title,critical,revision) values
 ('CHECKOUT',(select id from sites where code='SHOP'),'https://shop.example.test/checkout','Checkout',true,2),
 ('CATALOG',(select id from sites where code='SHOP'),'https://shop.example.test/catalog','Product catalogue',false,1),
 ('APPLY',(select id from sites where code='SERVICE'),'https://service.example.test/apply','Application journey',true,1)
on conflict(code) do nothing;
insert into audits(code,site_id,name,scope,method,assessor,due_on,completed_on,evidence) values
 ('AUD-01',(select id from sites where code='SHOP'),'Checkout keyboard review','Checkout steps and confirmation, desktop keyboard only','manual','Leah Ng',current_date-14,current_date-14,'DEMO evidence: keyboard checklist A'),
 ('AUD-02',(select id from sites where code='SERVICE'),'Application manual audit','Application steps, errors and confirmation','combined','',current_date-3,null,null)
on conflict(code) do nothing;
insert into findings(code,page_id,title,criterion,level,severity,owner,due_on,first_seen,last_seen) values
 ('A11Y-01',(select id from pages where code='CHECKOUT'),'Payment step cannot be reached by keyboard','2.1.1','A','blocker','Mara Chen',current_date-5,current_date-30,current_date-12),
 ('A11Y-02',(select id from pages where code='CATALOG'),'Product images have no text alternative','1.1.1','A','high','',current_date-2,current_date-25,current_date-12),
 ('A11Y-03',(select id from pages where code='APPLY'),'Required fields have no visible instructions','3.3.2','A','high','Owen Patel',current_date+3,current_date-20,current_date-8),
 ('A11Y-04',(select id from pages where code='CHECKOUT'),'Error summary is not announced','4.1.3','AA','high','Mara Chen',current_date+5,current_date-28,current_date-15),
 ('A11Y-05',(select id from pages where code='CATALOG'),'Focus indicator is difficult to see','2.4.7','AA','medium','Leah Ng',current_date+8,current_date-20,current_date-10),
 ('A11Y-06',(select id from pages where code='APPLY'),'Third-party document viewer blocks keyboard users','2.1.1','A','high','Owen Patel',current_date-1,current_date-40,current_date-11)
on conflict(code) do nothing;
insert into fixes(finding_id,finding_revision,page_revision,actor,note,evidence,created_at)
 select f.id,f.revision,case when f.code='A11Y-01' then p.revision-1 else p.revision end,'Mara Chen','DEMO fix: updated keyboard handling','DEMO change record F-01',now()-interval '8 days'
 from findings f join pages p on p.id=f.page_id where f.code in ('A11Y-01','A11Y-04','A11Y-05')
 and not exists(select 1 from fixes x where x.finding_id=f.id);
insert into retests(finding_id,fix_id,finding_revision,page_revision,result,method,actor,evidence,tested_on)
 select f.id,x.id,f.revision,case when f.code='A11Y-01' then p.revision-1 else p.revision end,
 'pass','manual','Leah Ng','DEMO retest record R-01',current_date-7
 from findings f join pages p on p.id=f.page_id join fixes x on x.finding_id=f.id
 where f.code in ('A11Y-01','A11Y-04') and not exists(select 1 from retests r where r.finding_id=f.id);
insert into exceptions(finding_id,finding_revision,page_revision,reason,actor,evidence,expires_on)
 select f.id,f.revision,p.revision,'DEMO: supplier workaround awaiting review','Owen Patel','DEMO risk review E-01',current_date-2
 from findings f join pages p on p.id=f.page_id where f.code='A11Y-06'
 and not exists(select 1 from exceptions e where e.finding_id=f.id);
insert into activity(entity,record_id,actor,action,note)
 select 'sites',id,'Demo seed','seed','Synthetic records. No real organisation or assessment.' from sites
 where not exists(select 1 from activity where action='seed');
