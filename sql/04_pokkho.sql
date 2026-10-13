-- ধাপ ৭: পক্ষ (১-১৫ / ১৬-মাসের শেষ), সরকারি ছুটি, আমার কৃষক গ্রুপ, আলোচ্য বিষয়ের তালিকা, ব্লক/ইউনিয়ন, জমার শেষ সময়
-- আগে 01, 02, 03 চালানো থাকতে হবে। Supabase SQL Editor-এ পুরোটা একবারে Run করুন। আবার চালালেও সমস্যা নেই।

begin;

-- =========================================================================
-- ১) নতুন টেবিল
-- =========================================================================

-- সরকারি ছুটি (উপজেলা থেকে একবার তোলা হয়, সবার সূচিতে প্রযোজ্য)
create table if not exists public.holidays (
  holiday_date date primary key,
  name         text not null check (btrim(name) <> ''),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ব্লক ও ইউনিয়নের তালিকা (সাইনআপে বাছার জন্য)
create table if not exists public.locations (
  id    bigserial primary key,
  kind  text not null check (kind in ('union', 'block')),
  name  text not null check (btrim(name) <> ''),
  sort  int not null default 0,
  unique (kind, name)
);

-- আলোচ্য বিষয়ের প্রস্তাব (মাস অনুযায়ী; months খালি = সারা বছর)
create table if not exists public.topic_suggestions (
  id      bigserial primary key,
  topic   text not null unique check (btrim(topic) <> ''),
  months  smallint[] not null default '{}',
  sort    int not null default 0,
  active  boolean not null default true
);

-- সাধারণ সেটিং (যেমন: পক্ষ শুরুর কত দিন আগে জমা দিতে হবে)
create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values ('submit_days_before', '2')
  on conflict (key) do nothing;

-- এসএএও-র নিজের কৃষক গ্রুপের তালিকা (একবার লিখে বারবার বাছা যায়)
create table if not exists public.farmer_groups (
  id          uuid primary key default gen_random_uuid(),
  saao_id     uuid not null references public.profiles(id) on delete cascade,
  group_name  text not null check (btrim(group_name) <> ''),
  address     text not null default '',
  mobile      text not null default '',
  sort        int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists farmer_groups_saao_idx on public.farmer_groups (saao_id, sort);

-- =========================================================================
-- ২) সূচির গ্রুপ ও বিকেলের ঘর: সপ্তাহ-দিনের বদলে আসল তারিখ
-- =========================================================================
alter table public.schedule_groups add column if not exists visit_date date;
alter table public.schedule_groups add column if not exists slot smallint;
alter table public.schedule_groups add column if not exists farmer_group_id uuid references public.farmer_groups(id) on delete set null;
alter table public.schedule_groups drop constraint if exists schedule_groups_slot_check;
alter table public.schedule_groups add constraint schedule_groups_slot_check check (slot is null or slot in (1, 2));

-- পুরোনো (বুধবার-ভিত্তিক) গ্রুপের তারিখ বের করা: গ্রুপ ১-২ বৃহস্পতি, ৩-৪ সোম, ৫-৬ মঙ্গল; ৭-১২ পরের সপ্তাহে
update public.schedule_groups g
   set visit_date = s.start_date
                    + ((g.group_no - 1) / 6) * 7
                    + (case ((g.group_no - 1) % 6) / 2 when 0 then 1 when 1 then 5 else 6 end),
       slot = ((g.group_no - 1) % 2) + 1
  from public.schedules s
 where s.id = g.schedule_id and g.visit_date is null
   and extract(dow from s.start_date) = 3;

create unique index if not exists schedule_groups_place_uidx
  on public.schedule_groups (schedule_id, visit_date, slot) where visit_date is not null;

alter table public.schedule_day_notes add column if not exists note_date date;
update public.schedule_day_notes n
   set note_date = s.start_date + n.week_no * 7 + n.day_index
  from public.schedules s
 where s.id = n.schedule_id and n.note_date is null;
alter table public.schedule_day_notes drop constraint if exists schedule_day_notes_pkey;
alter table public.schedule_day_notes alter column week_no drop not null;
alter table public.schedule_day_notes alter column day_index drop not null;
alter table public.schedule_day_notes alter column note_date set not null;
create unique index if not exists schedule_day_notes_date_uidx on public.schedule_day_notes (schedule_id, note_date);

-- =========================================================================
-- ৩) সূচির শুরু: এখন থেকে মাসের ১ বা ১৬ তারিখ
-- =========================================================================
do $$
declare c text;
begin
  -- পুরোনো "বুধবার হতে হবে" নিয়ম সরানো
  for c in
    select conname from pg_constraint
     where conrelid = 'public.schedules'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%dow%'
  loop
    execute format('alter table public.schedules drop constraint %I', c);
  end loop;
end $$;

-- পুরোনো সূচিকে তার তারিখের পক্ষে সরানো (একই পক্ষে আগেই সূচি থাকলে সেটা বাদ)
update public.schedules s
   set start_date  = date_trunc('month', s.start_date)::date + (case when extract(day from s.start_date) <= 15 then 0 else 15 end),
       fortnight   = case when extract(day from s.start_date) <= 15 then 1 else 2 end,
       month_label = (array['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'])[extract(month from s.start_date)::int]
 where extract(day from s.start_date) not in (1, 16)
   and not exists (
     select 1 from public.schedules o
      where o.saao_id = s.saao_id and o.id <> s.id
        and o.start_date = date_trunc('month', s.start_date)::date + (case when extract(day from s.start_date) <= 15 then 0 else 15 end));

alter table public.schedules drop constraint if exists schedules_period_check;
alter table public.schedules add constraint schedules_period_check
  check (extract(day from start_date) in (1, 16)
         and fortnight = case when extract(day from start_date) = 1 then 1 else 2 end) not valid;

-- পক্ষের শেষ তারিখ
create or replace function public.period_end(d date) returns date
language sql immutable as $$
  select case when extract(day from d) <= 15
              then date_trunc('month', d)::date + 14
              else (date_trunc('month', d) + interval '1 month - 1 day')::date end
$$;

-- =========================================================================
-- ৪) জমা দেওয়ার আগে যাচাই: ছুটির দিনে বা ভুল দিনে কোনো গ্রুপ আছে কি না
-- =========================================================================
create or replace function public.schedule_problems(sid uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  s record;
  bad date;
begin
  select * into s from public.schedules where id = sid;
  select g.visit_date into bad
    from public.schedule_groups g
   where g.schedule_id = sid and btrim(g.group_name) <> '' and g.visit_date is not null
     and (g.visit_date < s.start_date
       or g.visit_date > public.period_end(s.start_date)
       or extract(dow from g.visit_date) in (3, 5, 6)
       or exists (select 1 from public.holidays h where h.holiday_date = g.visit_date))
   order by g.visit_date limit 1;
  if bad is not null then
    return format('%s তারিখে গ্রুপ ভিজিট রাখা যাবে না (ছুটি বা এই পক্ষের বাইরে)। "ছুটি অনুযায়ী আবার সাজান" চাপুন।', to_char(bad, 'DD/MM/YYYY'));
  end if;
  return null;
end $$;

create or replace function public.schedule_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r   text := public.current_role_name();
  own boolean := (old.saao_id = auth.uid());
  note text := nullif(btrim(coalesce(new.approver_note, '')), '');
  problem text;
begin
  if uid is null then
    return new;   -- SQL Editor
  end if;

  new.saao_id := old.saao_id;
  new.created_at := old.created_at;

  if new.status = old.status then
    if own and old.status in ('draft', 'returned') then
      new.approver_note := old.approver_note;
      new.submitted_at := old.submitted_at;
      new.forwarded_by := old.forwarded_by;  new.forwarded_at := old.forwarded_at;
      new.approved_by  := old.approved_by;   new.approved_at  := old.approved_at;
      new.returned_by  := old.returned_by;   new.returned_at  := old.returned_at;
      return new;
    end if;
    raise exception 'এই অবস্থায় সূচি বদলানো যাবে না';
  end if;

  if own and new.status in ('forwarded', 'approved', 'returned') and r is distinct from 'admin' then
    raise exception 'নিজের সূচিতে নিজে সিদ্ধান্ত নেওয়া যায় না';
  end if;

  if own and old.status in ('draft', 'returned') and new.status = 'submitted' then
    problem := public.schedule_problems(old.id);
    if problem is not null then
      raise exception '%', problem;
    end if;
    new.submitted_at := now();
    new.approver_note := null;
    new.forwarded_by := null; new.forwarded_at := null;
    new.approved_by  := null; new.approved_at  := null;

  elsif r = 'coadmin' and old.status = 'submitted' and new.status = 'forwarded' then
    new.forwarded_by := uid;
    new.forwarded_at := now();
    new.approver_note := note;

  elsif r = 'admin' and old.status in ('submitted', 'forwarded') and new.status = 'approved' then
    new.approved_by := uid;
    new.approved_at := now();
    new.approver_note := note;

  elsif new.status = 'returned'
        and ((r = 'coadmin' and old.status = 'submitted')
          or (r = 'admin' and old.status in ('submitted', 'forwarded'))) then
    if note is null then
      raise exception 'ফেরত দিতে মন্তব্য লিখতে হবে';
    end if;
    new.returned_by := uid;
    new.returned_at := now();
    new.approver_note := note;
    new.approved_by := null; new.approved_at := null;

  else
    raise exception 'এই পরিবর্তনের অনুমতি নেই (% → %)', old.status, new.status;
  end if;

  insert into public.schedule_events (schedule_id, actor_id, from_status, to_status, note)
  values (new.id, uid, old.status, new.status, new.approver_note);

  return new;
end $$;

-- =========================================================================
-- ৫) Row Level Security
-- =========================================================================
alter table public.holidays          enable row level security;
alter table public.locations         enable row level security;
alter table public.topic_suggestions enable row level security;
alter table public.app_settings      enable row level security;
alter table public.farmer_groups     enable row level security;

drop policy if exists holidays_read  on public.holidays;
drop policy if exists holidays_write on public.holidays;
create policy holidays_read  on public.holidays for select using (auth.uid() is not null);
create policy holidays_write on public.holidays for all using (public.is_reviewer()) with check (public.is_reviewer());

-- ব্লক/ইউনিয়ন সাইনআপের আগেও পড়া যায়
drop policy if exists locations_read  on public.locations;
drop policy if exists locations_write on public.locations;
create policy locations_read  on public.locations for select using (true);
create policy locations_write on public.locations for all using (public.is_reviewer()) with check (public.is_reviewer());

drop policy if exists topics_read  on public.topic_suggestions;
drop policy if exists topics_write on public.topic_suggestions;
create policy topics_read  on public.topic_suggestions for select using (auth.uid() is not null);
create policy topics_write on public.topic_suggestions for all using (public.is_reviewer()) with check (public.is_reviewer());

drop policy if exists settings_read  on public.app_settings;
drop policy if exists settings_write on public.app_settings;
create policy settings_read  on public.app_settings for select using (auth.uid() is not null);
create policy settings_write on public.app_settings for all using (public.is_reviewer()) with check (public.is_reviewer());

drop policy if exists fgroups_read  on public.farmer_groups;
drop policy if exists fgroups_write on public.farmer_groups;
create policy fgroups_read  on public.farmer_groups for select
  using (saao_id = auth.uid() or public.is_reviewer());
create policy fgroups_write on public.farmer_groups for all
  using (saao_id = auth.uid() and public.is_active_user())
  with check (saao_id = auth.uid() and public.is_active_user());

-- সাইনআপ পেজ লগইনের আগে তালিকা পড়ে
grant select on public.locations to anon;

-- =========================================================================
-- ৬) শুরুর তালিকা (পরে "সেটিংস" থেকে বদলানো যাবে)
-- =========================================================================
insert into public.locations (kind, name, sort) values
  ('union', 'বাগোয়ান', 1), ('union', 'বিনাজুরী', 2), ('union', 'চিকদাইর', 3), ('union', 'ডাবুয়া', 4),
  ('union', 'গহিরা', 5), ('union', 'হলদিয়া', 6), ('union', 'কদলপুর', 7), ('union', 'নোয়াপাড়া', 8),
  ('union', 'নোয়াজিশপুর', 9), ('union', 'পাহাড়তলী', 10), ('union', 'পশ্চিম গুজরা', 11), ('union', 'পূর্ব গুজরা', 12),
  ('union', 'রাউজান', 13), ('union', 'উরকিরচর', 14), ('union', 'রাউজান পৌরসভা', 15)
on conflict (kind, name) do nothing;

insert into public.topic_suggestions (topic, months, sort) values
  ('আমন ধানে মাজরা পোকা ও বাদামী গাছফড়িং দমন', '{8,9,10}', 1),
  ('ধানক্ষেতে পার্চিং ও আলোক ফাঁদ', '{8,9,10}', 2),
  ('আমন ধান কাটা, মাড়াই ও সংরক্ষণ', '{10,11,12}', 3),
  ('শীতকালীন সবজির চারা উৎপাদন', '{9,10,11}', 4),
  ('আলুর জমি তৈরি ও বীজ শোধন', '{10,11}', 5),
  ('আলুর নাবি ধসা রোগ দমন', '{12,1,2}', 6),
  ('সরিষার উন্নত জাত ও বপন সময়', '{10,11}', 7),
  ('ডাল ও তেল ফসল চাষ', '{10,11,12}', 8),
  ('গম বপন ও বীজ শোধন', '{11,12}', 9),
  ('ভুট্টা চাষ ও পরিচর্যা', '{11,12,1}', 10),
  ('বোরো বীজতলা তৈরি ও শীতে চারা রক্ষা', '{11,12,1}', 11),
  ('বোরো ধানে সুষম সার ও সেচ ব্যবস্থাপনা', '{1,2,3,4}', 12),
  ('বোরো ধানে ব্লাস্ট রোগ দমন', '{2,3,4}', 13),
  ('আম-লিচুর মুকুল পরিচর্যা ও ফল ঝরা রোধ', '{1,2,3}', 14),
  ('আউশ ধানের চাষ', '{3,4,5}', 15),
  ('পাটের জমি তৈরি ও বপন', '{3,4,5}', 16),
  ('ফল বাগান পরিচর্যা ও কলম তৈরি', '{5,6,7,8}', 17),
  ('আমন বীজতলা তৈরি', '{6,7}', 18),
  ('আমন ধান রোপণ ও আগাছা দমন', '{7,8}', 19),
  ('ইঁদুর দমন', '{9,10,11}', 20),
  ('মাটি পরীক্ষা ও সুষম সার প্রয়োগ', '{}', 21),
  ('সবজিতে ফেরোমন ফাঁদ স্থাপন', '{}', 22),
  ('ভার্মিকম্পোস্ট তৈরি ও ব্যবহার', '{}', 23),
  ('আইপিএম ও জৈব বালাইনাশক', '{}', 24),
  ('বালাইনাশকের নিরাপদ ব্যবহার', '{}', 25),
  ('বসতবাড়ির আঙিনায় সবজি চাষ', '{}', 26),
  ('কৃষি প্রণোদনা কর্মসূচি', '{}', 27)
on conflict (topic) do nothing;

commit;

-- সরকারি ছুটি অ্যাপের "সেটিংস" পেজ থেকে যোগ করুন, অথবা এখানে:
-- insert into public.holidays (holiday_date, name) values ('2026-12-16', 'বিজয় দিবস');
