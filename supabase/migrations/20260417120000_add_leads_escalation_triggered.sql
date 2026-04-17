alter table public.leads
add column if not exists escalation_triggered boolean not null default false;

update public.leads
set escalation_triggered = false
where escalation_triggered is null;
