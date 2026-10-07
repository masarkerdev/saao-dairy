-- পাক্ষিক ভ্রমণসূচী সিস্টেম — Supabase schema (Step 1, v2: নিজে সাইনআপ)
-- Supabase Dashboard → SQL Editor-এ পুরোটা একবারে Run করুন।

-- ০) রিসেট (এখনো কোনো আসল ডেটা না থাকলে নিরাপদ; আগের সংস্করণ চালিয়ে থাকলেও এটা পরিষ্কার করে দেবে)
drop table if exists public.schedule_day_notes, public.schedule_entries, public.schedules, public.profiles cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.current_role_name() cascade;
drop function if exists public.is_active_user() cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.protect_profile() cascade;
drop type if exists schedule_status, user_role cascade;

-- ১) ধরন (enum)
create type user_role as enum ('saao', 'approver', 'admin');
create type schedule_status as enum ('draft', 'submitted', 'approved', 'returned');

-- ২) প্রোফাইল (auth.users-এর সঙ্গে ১:১)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'saao',
  upazila     text not null default 'রাউজান',
  block_name  text,               -- ব্লক
  union_name  text,               -- ইউনিয়ন
  mobile      text,
  active      boolean not null default false,   -- অ্যাডমিন সক্রিয় না করা পর্যন্ত false
  created_at  timestamptz not null default now()
);

-- নিজে সাইনআপ করলে স্বয়ংক্রিয়ভাবে প্রোফাইল তৈরি।
-- নিরাপত্তা: role সবসময় 'saao' এবং active=false। সাইনআপের metadata থেকে role নেওয়া হয় না।
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, active, block_name, union_name, mobile)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'নামহীন'),
    'saao',
    false,
    new.raw_user_meta_data->>'block_name',
    new.raw_user_meta_data->>'union_name',
    new.raw_user_meta_data->>'mobile'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS-এ ব্যবহারের জন্য: শুধু সক্রিয় ইউজারের role (নিষ্ক্রিয় হলে null)
create function public.current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false)
$$;

-- সাধারণ ইউজার নিজের role/active বদলাতে পারবে না (অ্যাডমিন বা SQL Editor পারবে)
create function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and current_role_name() is distinct from 'admin'
     and (new.role is distinct from old.role or new.active is distinct from old.active) then
    raise exception 'role বা active বদলানোর অনুমতি নেই';
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- ৩) পাক্ষিক সূচি (একজন এসএএও-র একটি পক্ষের একটি সূচি)
create table public.schedules (
  id             uuid primary key default gen_random_uuid(),
  saao_id        uuid not null references public.profiles(id) on delete cascade,
  start_date     date not null,                       -- ১ম সপ্তাহের বুধবার
  month_label    text not null,                       -- যেমন: অক্টোবর
  fortnight      smallint not null check (fortnight in (1, 2)),
  status         schedule_status not null default 'draft',
  approver_note  text,
  submitted_at   timestamptz,
  approved_by    uuid references public.profiles(id),
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (saao_id, start_date),
  check (extract(dow from start_date) = 3)            -- বুধবার হতেই হবে
);

-- ৪) সূচির লাইন: ১২ গ্রুপ × ৫ লাইন
-- কোন গ্রুপ কোন বার/সময়ে পড়বে তা অ্যাপে স্থির (বৃহঃ/সোম/মঙ্গল, সকাল/দুপুর)
create table public.schedule_entries (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references public.schedules(id) on delete cascade,
  group_no     smallint not null check (group_no between 1 and 12),
  line_no      smallint not null check (line_no between 1 and 5),
  farmer_info  text not null default '',   -- কৃষক গ্রুপের নাম, ঠিকানা ও মোবাইল
  topic        text not null default '',   -- আলোচ্য বিষয়
  unique (schedule_id, group_no, line_no)
);

-- ৫) দিনভিত্তিক ৩.০০-৫.০০ (কৃষি তথ্য ও পরামর্শ কেন্দ্র) ঘর
create table public.schedule_day_notes (
  schedule_id  uuid not null references public.schedules(id) on delete cascade,
  week_no      smallint not null check (week_no in (1, 2)),
  day_index    smallint not null check (day_index between 0 and 6), -- 0=বুধ ... 6=মঙ্গল
  advisory_note text not null default '',
  primary key (schedule_id, week_no, day_index)
);

-- updated_at স্বয়ংক্রিয়
create function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger schedules_touch before update on public.schedules
  for each row execute function public.touch_updated_at();

create index on public.schedules (saao_id, start_date desc);
create index on public.schedules (status);

-- ৬) Row Level Security
alter table public.profiles           enable row level security;
alter table public.schedules          enable row level security;
alter table public.schedule_entries   enable row level security;
alter table public.schedule_day_notes enable row level security;

-- profiles: নিজেরটা সবাই দেখে; অনুমোদনকারী/অ্যাডমিন সবারটা দেখে; অ্যাডমিন সব বদলাতে পারে
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or current_role_name() in ('approver', 'admin'));
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all
  using (current_role_name() = 'admin') with check (current_role_name() = 'admin');

-- schedules
create policy sched_read on public.schedules for select
  using (saao_id = auth.uid() or current_role_name() in ('approver', 'admin'));

create policy sched_insert_own on public.schedules for insert
  with check (saao_id = auth.uid() and status = 'draft' and is_active_user());

-- এসএএও শুধু draft/returned অবস্থায় নিজের সূচি বদলাতে পারবে; জমা দিলে (submitted) আর নয়
create policy sched_update_own on public.schedules for update
  using (saao_id = auth.uid() and status in ('draft', 'returned') and is_active_user())
  with check (saao_id = auth.uid() and status in ('draft', 'submitted') and is_active_user());

-- অনুমোদনকারী: জমা দেওয়া সূচি অনুমোদন বা ফেরত
create policy sched_review on public.schedules for update
  using (current_role_name() in ('approver', 'admin') and status = 'submitted')
  with check (current_role_name() in ('approver', 'admin') and status in ('approved', 'returned'));

create policy sched_delete_own_draft on public.schedules for delete
  using (saao_id = auth.uid() and status = 'draft' and is_active_user());

-- entries ও day_notes: সূচির মালিক draft/returned অবস্থায় লিখতে পারবে; পড়তে পারবে মালিক + অনুমোদনকারী
create policy entries_read on public.schedule_entries for select
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and (s.saao_id = auth.uid() or current_role_name() in ('approver', 'admin'))));
create policy entries_write on public.schedule_entries for all
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and s.saao_id = auth.uid() and s.status in ('draft', 'returned') and is_active_user()))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id
    and s.saao_id = auth.uid() and s.status in ('draft', 'returned') and is_active_user()));

create policy notes_read on public.schedule_day_notes for select
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and (s.saao_id = auth.uid() or current_role_name() in ('approver', 'admin'))));
create policy notes_write on public.schedule_day_notes for all
  using (exists (select 1 from public.schedules s where s.id = schedule_id
    and s.saao_id = auth.uid() and s.status in ('draft', 'returned') and is_active_user()))
  with check (exists (select 1 from public.schedules s where s.id = schedule_id
    and s.saao_id = auth.uid() and s.status in ('draft', 'returned') and is_active_user()));

-- ৭) প্রথম অ্যাডমিন (আপনি): আগে অ্যাপ/Supabase Auth-এ আপনার ইমেইলে সাইনআপ করুন, তারপর এটা Run করুন।
-- ইমেইলটি নিজের ইমেইল দিয়ে বদলান:
-- update public.profiles set role = 'admin', active = true
--   where id = (select id from auth.users where email = 'your@email.com');
