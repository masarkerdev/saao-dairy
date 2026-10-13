-- ধাপ ৬: কো-এডমিন কর্মপ্রবাহ ও ছবির মতো ফর্ম কাঠামো
-- আগে 01_schema.sql ও 02_add_email.sql চালানো থাকতে হবে।
-- Supabase SQL Editor-এ পুরোটা একবারে Run করুন। আবার চালালেও সমস্যা নেই।
--
-- কর্মপ্রবাহ:
--   এসএএও (saao)          : খসড়া → জমা (submitted)
--   কো-এডমিন (coadmin)    : জমা → উপজেলা কৃষি অফিসারের কাছে পাঠানো (forwarded) / ফেরত (returned)
--   এডমিন (admin = উপজেলা কৃষি অফিসার): পাঠানো (বা জমা) → অনুমোদিত (approved) / ফেরত (returned)
--   ফেরত এলে এসএএও সংশোধন করে আবার জমা দেন।

begin;

-- ১) পুরোনো নিয়মগুলো সরানো (role-এর ধরন বদলানোর আগে এটা লাগে)
drop policy if exists profiles_self_read      on public.profiles;
drop policy if exists profiles_self_update    on public.profiles;
drop policy if exists profiles_admin_all      on public.profiles;
drop policy if exists profiles_read           on public.profiles;
drop policy if exists profiles_update_self    on public.profiles;
drop policy if exists profiles_update_staff   on public.profiles;
drop policy if exists sched_read              on public.schedules;
drop policy if exists sched_insert_own        on public.schedules;
drop policy if exists sched_update_own        on public.schedules;
drop policy if exists sched_review            on public.schedules;
drop policy if exists sched_update            on public.schedules;
drop policy if exists sched_delete_own_draft  on public.schedules;
drop policy if exists entries_read            on public.schedule_entries;
drop policy if exists entries_write           on public.schedule_entries;
drop policy if exists notes_read              on public.schedule_day_notes;
drop policy if exists notes_write             on public.schedule_day_notes;
do $$ begin
  if to_regclass('public.schedule_groups') is not null then
    drop policy if exists groups_read  on public.schedule_groups;
    drop policy if exists groups_write on public.schedule_groups;
  end if;
  if to_regclass('public.schedule_events') is not null then
    drop policy if exists events_read on public.schedule_events;
  end if;
end $$;
drop trigger if exists profiles_protect on public.profiles;
drop trigger if exists schedule_guard on public.schedules;
drop function if exists public.current_role_name() cascade;

-- ২) role ও status-কে enum থেকে text করা (নতুন মান যোগ সহজ করতে)
alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text using role::text;
update public.profiles set role = 'admin' where role = 'approver';
alter table public.profiles alter column role set default 'saao';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('saao', 'coadmin', 'admin'));

alter table public.schedules alter column status drop default;
alter table public.schedules alter column status type text using status::text;
alter table public.schedules alter column status set default 'draft';
alter table public.schedules drop constraint if exists schedules_status_check;
alter table public.schedules add constraint schedules_status_check
  check (status in ('draft', 'submitted', 'forwarded', 'approved', 'returned'));

drop type if exists public.user_role;
drop type if exists public.schedule_status;

-- ৩) কে কখন পাঠাল / ফেরত দিল
alter table public.schedules add column if not exists forwarded_by uuid references public.profiles(id) on delete set null;
alter table public.schedules add column if not exists forwarded_at timestamptz;
alter table public.schedules add column if not exists returned_by  uuid references public.profiles(id) on delete set null;
alter table public.schedules add column if not exists returned_at  timestamptz;
-- approver_note এখন থেকে "সর্বশেষ সিদ্ধান্তের মন্তব্য"

-- ৪) ছবির ফর্মের মতো গ্রুপভিত্তিক তথ্য
--    গ্রুপের ঘরে: গ্রুপের নাম, ঠিকানা, মোবাইল; পাশের কলামে আলোচ্য বিষয় ১-৫
create table if not exists public.schedule_groups (
  schedule_id  uuid not null references public.schedules(id) on delete cascade,
  group_no     smallint not null check (group_no between 1 and 12),
  group_name   text not null default '',
  address      text not null default '',
  mobile       text not null default '',
  topics       text[] not null default array['', '', '', '', '']::text[]
               check (cardinality(topics) <= 5),
  primary key (schedule_id, group_no)
);

-- ৫) সিদ্ধান্তের ইতিহাস
create table if not exists public.schedule_events (
  id           bigserial primary key,
  schedule_id  uuid not null references public.schedules(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  from_status  text,
  to_status    text not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists schedule_events_sched_idx on public.schedule_events (schedule_id, created_at);

-- ৬) সাহায্যকারী ফাংশন
create function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('coadmin', 'admin'), false)
$$;

-- ৭) প্রোফাইল সুরক্ষা
--    কেউ নিজের role/সক্রিয়তা বদলাতে পারে না।
--    কো-এডমিন এসএএও/কো-এডমিন সক্রিয় করতে ও role দিতে পারে, কিন্তু এডমিন role দিতে বা এডমিনকে বদলাতে পারে না।
--    SQL Editor থেকে (auth.uid() নেই) সব করা যায়।
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text;
begin
  if auth.uid() is null then
    return new;
  end if;
  new.id := old.id;
  new.email := old.email;
  if new.role is distinct from old.role or new.active is distinct from old.active then
    if old.id = auth.uid() then
      raise exception 'নিজের role বা সক্রিয় অবস্থা বদলানো যায় না';
    end if;
    r := public.current_role_name();
    if r = 'admin' then
      null;
    elsif r = 'coadmin' then
      if old.role = 'admin' or new.role = 'admin' then
        raise exception 'এডমিন (উপজেলা কৃষি অফিসার) role দেওয়া বা এডমিনের একাউন্ট বদলানো শুধু এডমিন পারেন';
      end if;
    else
      raise exception 'role বা সক্রিয় অবস্থা বদলানোর অনুমতি নেই';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- ৮) সূচির অবস্থা বদলের নিয়ম (সার্ভারে প্রয়োগ হয়, অ্যাপ এড়িয়ে যাওয়া যায় না)
create or replace function public.schedule_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r   text := public.current_role_name();
  own boolean := (old.saao_id = auth.uid());
  note text := nullif(btrim(coalesce(new.approver_note, '')), '');
begin
  if uid is null then
    return new;   -- SQL Editor
  end if;

  -- যা কখনো বদলানো যাবে না
  new.saao_id := old.saao_id;
  new.created_at := old.created_at;

  -- অবস্থা অপরিবর্তিত: শুধু খসড়া/ফেরত অবস্থায় মালিক তারিখ-মাস-পক্ষ বদলাতে পারেন
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

  -- নিজের সূচিতে নিজে সিদ্ধান্ত নেওয়া যাবে না (এডমিন ছাড়া)
  if own and new.status in ('forwarded', 'approved', 'returned') and r is distinct from 'admin' then
    raise exception 'নিজের সূচিতে নিজে সিদ্ধান্ত নেওয়া যায় না';
  end if;

  if own and old.status in ('draft', 'returned') and new.status = 'submitted' then
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

drop trigger if exists schedule_guard on public.schedules;
create trigger schedule_guard before update on public.schedules
  for each row execute function public.schedule_guard();

-- ৯) Row Level Security
alter table public.schedule_groups enable row level security;
alter table public.schedule_events enable row level security;

-- profiles
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_reviewer());
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_staff on public.profiles for update
  using (public.is_reviewer()) with check (public.is_reviewer());

-- schedules
create policy sched_read on public.schedules for select
  using (saao_id = auth.uid() or public.is_reviewer());
create policy sched_insert_own on public.schedules for insert
  with check (saao_id = auth.uid() and status = 'draft' and public.is_active_user());
create policy sched_update on public.schedules for update
  using ((saao_id = auth.uid() and status in ('draft', 'returned') and public.is_active_user())
         or public.is_reviewer())
  with check (saao_id = auth.uid() or public.is_reviewer());
create policy sched_delete_own_draft on public.schedules for delete
  using (saao_id = auth.uid() and status = 'draft' and public.is_active_user());

-- সূচির ভেতরের তথ্য: পড়তে পারেন মালিক ও কো-এডমিন/এডমিন; লিখতে পারেন শুধু মালিক, খসড়া/ফেরত অবস্থায়
create policy groups_read on public.schedule_groups for select
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and (s.saao_id = auth.uid() or public.is_reviewer())));
create policy groups_write on public.schedule_groups for all
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and s.saao_id = auth.uid() and s.status in ('draft', 'returned') and public.is_active_user()))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id
    and s.saao_id = auth.uid() and s.status in ('draft', 'returned') and public.is_active_user()));

create policy notes_read on public.schedule_day_notes for select
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and (s.saao_id = auth.uid() or public.is_reviewer())));
create policy notes_write on public.schedule_day_notes for all
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and s.saao_id = auth.uid() and s.status in ('draft', 'returned') and public.is_active_user()))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id
    and s.saao_id = auth.uid() and s.status in ('draft', 'returned') and public.is_active_user()));

-- পুরোনো টেবিল (আর ব্যবহার হয় না), শুধু পড়া যাবে
create policy entries_read on public.schedule_entries for select
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and (s.saao_id = auth.uid() or public.is_reviewer())));

create policy events_read on public.schedule_events for select
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and (s.saao_id = auth.uid() or public.is_reviewer())));
-- ইতিহাসে সরাসরি লেখা যায় না; শুধু schedule_guard ট্রিগার লেখে

commit;

-- ১০) role দেওয়া (প্রথমবার SQL Editor থেকে; পরে অ্যাপের "ইউজার ব্যবস্থাপনা" থেকে)
-- উপজেলা কৃষি অফিসার = এডমিন:
-- update public.profiles set role = 'admin', active = true
--   where id = (select id from auth.users where email = 'uao@example.com');
-- অতিরিক্ত কৃষি অফিসার ও কৃষি সম্প্রসারণ কর্মকর্তা = কো-এডমিন:
-- update public.profiles set role = 'coadmin', active = true
--   where id = (select id from auth.users where email in ('aao@example.com', 'aeo@example.com'));
