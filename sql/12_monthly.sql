-- ১২: মাসে একবার জমা (দুই পক্ষ একসাথে) ও ঘণ্টার বার্তা "দেখা হয়েছে"
--   • সূচি আগের মতোই পক্ষ অনুযায়ী দুই সারিতে থাকে (ফর্মের দুই পাতা),
--     কিন্তু জমা, যাচাই, উপজেলায় পাঠানো, অনুমোদন ও ফেরত একসাথে দুই পক্ষে হয়
--   • change_month_status: একই এসএএও, একই ব্লক, একই মাসের দুই পক্ষ এক লেনদেনে বদলায়;
--     একটিতে সমস্যা থাকলে কোনোটাই বদলায় না। আগের নিয়ম (schedule_guard) দুটোতেই খাটে।
--   • reminder_seen: ঘণ্টায় দেখা বার্তা আর দেখায় না (যেকোনো ডিভাইসে)
--   • এসএএও-রা কর্মকর্তাদের নাম দেখতে পারেন (কে পাঠালেন/অনুমোদন দিলেন)
-- ১১ চালানোর পরে চালাবেন। একাধিকবার চালালেও সমস্যা নেই।

-- ১) পুরো মাসের অবস্থা একসাথে বদলানো
create or replace function public.change_month_status(sid uuid, from_statuses text[], to_status text, note text default null)
returns setof public.schedules
language plpgsql security invoker set search_path = public as $$
declare
  s public.schedules%rowtype;
  r public.schedules%rowtype;
  sib public.schedules%rowtype;
  sib_start date;
  n int := 0;
  rc int;
begin
  select * into s from public.schedules where id = sid;
  if not found then
    raise exception 'সূচি পাওয়া যায়নি';
  end if;
  sib_start := case when extract(day from s.start_date) = 1 then s.start_date + 15 else date_trunc('month', s.start_date)::date end;
  select * into sib from public.schedules
   where saao_id = s.saao_id and block_name = s.block_name and start_date = sib_start;
  if not found and to_status = 'submitted' then
    raise exception 'এই মাসের অন্য পক্ষের সূচি এখনো তৈরি হয়নি। দুই পক্ষ পূরণ করে একসাথে জমা দিন।';
  end if;

  -- আগে ১ম পক্ষ, তারপর ২য় পক্ষ
  for r in
    select * from public.schedules
     where saao_id = s.saao_id and block_name = s.block_name
       and start_date in (date_trunc('month', s.start_date)::date, date_trunc('month', s.start_date)::date + 15)
       and status = any (from_statuses)
     order by start_date
  loop
    update public.schedules
       set status = to_status, approver_note = note
     where id = r.id;
    get diagnostics rc = row_count;
    if rc = 0 then
      raise exception 'এই পরিবর্তনের অনুমতি নেই';
    end if;
    n := n + 1;
  end loop;

  if n = 0 then
    raise exception 'সূচিটি আর এই অবস্থায় নেই। পেজ রিফ্রেশ করে দেখুন।';
  end if;
  return query select * from public.schedules where id = sid;
end $$;

revoke all on function public.change_month_status(uuid, text[], text, text) from public, anon;
grant execute on function public.change_month_status(uuid, text[], text, text) to authenticated;

-- ২) ঘণ্টার বার্তা "দেখা হয়েছে"
create table if not exists public.reminder_seen (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  item_id  text not null,
  seen_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.reminder_seen enable row level security;
drop policy if exists seen_own on public.reminder_seen;
create policy seen_own on public.reminder_seen for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.reminder_seen to authenticated;

-- পুরোনো "দেখা" তথ্য ৬০ দিন পর আর লাগে না
create or replace function public.reminder_seen_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.reminder_seen where user_id = new.user_id and seen_at < now() - interval '60 days';
  return new;
end $$;
drop trigger if exists reminder_seen_cleanup on public.reminder_seen;
create trigger reminder_seen_cleanup after insert on public.reminder_seen
  for each row execute function public.reminder_seen_cleanup();

-- ৩) এসএএও-রা কর্মকর্তাদের প্রোফাইল দেখতে পারবেন (নাম, পদবি; কে পাঠালেন/অনুমোদন দিলেন)
drop policy if exists profiles_read_officers on public.profiles;
create policy profiles_read_officers on public.profiles for select
  using (auth.uid() is not null and role in ('admin', 'coadmin'));
