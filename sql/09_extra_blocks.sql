-- ০৯: অতিরিক্ত দায়িত্বের ব্লক
--   • একজন এসএএও নিজ ব্লকের পাশাপাশি এক বা একাধিক ব্লকের অতিরিক্ত দায়িত্ব পেতে পারেন
--   • দায়িত্ব দেন এডমিন, কো-এডমিন-১/২ বা ডেভেলপার (এসএএও নিজে নন)
--   • প্রতিটি ব্লকের সূচি আলাদা: একই পক্ষে নিজ ব্লকের একটি, প্রতিটি অতিরিক্ত ব্লকের একটি করে
--   • একই দিনের একই বেলায় দুই ব্লকে ভিজিট রেখে জমা দেওয়া যায় না
-- ০৮ চালানোর পরে চালাবেন। একাধিকবার চালালেও সমস্যা নেই।

-- ১) অতিরিক্ত দায়িত্বের তালিকা
create table if not exists public.block_charges (
  id          uuid primary key default gen_random_uuid(),
  saao_id     uuid not null references public.profiles(id) on delete cascade,
  block_name  text not null check (btrim(block_name) <> ''),
  union_name  text,
  from_date   date,          -- খালি = আজ থেকেই
  to_date     date,          -- খালি = পরবর্তী আদেশ না পাওয়া পর্যন্ত
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (saao_id, block_name),
  check (to_date is null or from_date is null or to_date >= from_date)
);

alter table public.block_charges enable row level security;
drop policy if exists charges_read  on public.block_charges;
drop policy if exists charges_write on public.block_charges;
create policy charges_read  on public.block_charges for select
  using (saao_id = auth.uid() or public.is_reviewer());
create policy charges_write on public.block_charges for all
  using (public.is_reviewer()) with check (public.is_reviewer());
grant select, insert, update, delete on public.block_charges to authenticated;

create or replace function public.charge_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  new.block_name := btrim(new.block_name);
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists charges_stamp on public.block_charges;
create trigger charges_stamp before insert on public.block_charges
  for each row execute function public.charge_stamp();

-- ২) সূচিতে ব্লকের নাম ও "অতিরিক্ত দায়িত্ব" চিহ্ন
alter table public.schedules add column if not exists block_name   text;
alter table public.schedules add column if not exists extra_charge boolean not null default false;

update public.schedules s set block_name = coalesce(p.block_name, '')
  from public.profiles p
 where p.id = s.saao_id and s.block_name is null;
update public.schedules set block_name = '' where block_name is null;
alter table public.schedules alter column block_name set default '';
alter table public.schedules alter column block_name set not null;

-- আগে "এক এসএএও, এক পক্ষ, এক সূচি" ছিল; এখন "এক এসএএও, এক পক্ষ, এক ব্লক, এক সূচি"
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.schedules'::regclass and contype = 'u'
       and pg_get_constraintdef(oid) ilike '%(saao_id, start_date)%'
  loop
    execute format('alter table public.schedules drop constraint %I', c);
  end loop;
end $$;
create unique index if not exists schedules_saao_period_block_uidx
  on public.schedules (saao_id, start_date, block_name);

-- নতুন সূচি: ব্লক না দিলে নিজ ব্লক; অন্য ব্লক হলে অতিরিক্ত দায়িত্ব থাকতে হবে
create or replace function public.schedule_block() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  own_block text;
begin
  select coalesce(block_name, '') into own_block from public.profiles where id = new.saao_id;
  new.block_name := btrim(coalesce(new.block_name, ''));
  if new.block_name = '' then
    new.block_name := own_block;
  end if;
  new.extra_charge := (new.block_name <> own_block);
  if new.extra_charge and auth.uid() is not null and not exists (
       select 1 from public.block_charges c
        where c.saao_id = new.saao_id and c.block_name = new.block_name
          and (c.from_date is null or c.from_date <= public.period_end(new.start_date))
          and (c.to_date   is null or c.to_date   >= new.start_date)) then
    raise exception '% ব্লকের অতিরিক্ত দায়িত্ব এই পক্ষে আপনার নামে নেই', new.block_name;
  end if;
  return new;
end $$;
drop trigger if exists schedules_block on public.schedules;
create trigger schedules_block before insert on public.schedules
  for each row execute function public.schedule_block();

-- সূচির ব্লক পরে বদলানো যাবে না
create or replace function public.schedule_block_lock() returns trigger
language plpgsql set search_path = public as $$
begin
  new.block_name := old.block_name;
  new.extra_charge := old.extra_charge;
  return new;
end $$;
drop trigger if exists schedules_block_lock on public.schedules;
create trigger schedules_block_lock before update on public.schedules
  for each row execute function public.schedule_block_lock();

-- ৩) কৃষক গ্রুপও ব্লক অনুযায়ী
alter table public.farmer_groups add column if not exists block_name text;
update public.farmer_groups f set block_name = coalesce(p.block_name, '')
  from public.profiles p
 where p.id = f.saao_id and f.block_name is null;

create or replace function public.farmer_group_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.block_name is null or btrim(new.block_name) = '' then
    select coalesce(block_name, '') into new.block_name from public.profiles where id = new.saao_id;
  end if;
  return new;
end $$;
drop trigger if exists farmer_groups_block on public.farmer_groups;
create trigger farmer_groups_block before insert on public.farmer_groups
  for each row execute function public.farmer_group_block();

-- ৪) জমার আগে যাচাই: ছুটি/ভুল দিন + অন্য ব্লকের সূচির সাথে একই সময়ে ভিজিট
create or replace function public.schedule_problems(sid uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  s record;
  bad date;
  clash record;
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

  select g.visit_date, g.slot, o.block_name into clash
    from public.schedule_groups g
    join public.schedule_groups og on og.visit_date = g.visit_date and og.slot = g.slot and btrim(og.group_name) <> ''
    join public.schedules o on o.id = og.schedule_id
   where g.schedule_id = sid and btrim(g.group_name) <> '' and g.visit_date is not null
     and o.saao_id = s.saao_id and o.id <> s.id
   order by g.visit_date limit 1;
  if clash.visit_date is not null then
    return format('%s তারিখের %s বেলায় %s ব্লকের সূচিতেও ভিজিট আছে। একই সময়ে দুই ব্লকে থাকা যায় না, তারিখ বা বেলা বদলান।',
      to_char(clash.visit_date, 'DD/MM/YYYY'), case when clash.slot = 1 then 'সকাল' else 'দুপুর' end,
      coalesce(nullif(clash.block_name, ''), 'অন্য'));
  end if;
  return null;
end $$;
