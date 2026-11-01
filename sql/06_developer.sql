-- ০৬: ডেভেলপার একাউন্ট ও অনুমোদনের নতুন নিয়ম
--   • ডেভেলপার: উপজেলা কৃষি অফিসার, অতিরিক্ত কৃষি অফিসার ও কৃষি সম্প্রসারণ কর্মকর্তাদের
--     সক্রিয় করেন ও ভূমিকা (এডমিন/কো-এডমিন) দেন। সব ইউজার দেখতে ও বদলাতে পারেন।
--   • উপজেলা কৃষি অফিসার ও কো-এডমিন (৩ জন): শুধু উপসহকারী কৃষি কর্মকর্তাদের সক্রিয়/নিষ্ক্রিয় করতে পারেন।
--     কারও ভূমিকা বদলাতে বা কোনো কর্মকর্তার একাউন্টে হাত দিতে পারেন না।
--   • কেউ নিজের ভূমিকা, সক্রিয় অবস্থা বা পদবি বদলাতে পারেন না।
--   • ডেভেলপার ভূমিকা অ্যাপ থেকে দেওয়া যায় না, শুধু SQL Editor থেকে (নিচের ৬ নম্বর ধাপ)।
-- একাধিকবার চালালেও সমস্যা নেই।

-- ১) নতুন ভূমিকা 'developer'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('saao', 'coadmin', 'admin', 'developer'));

-- ২) সহায়ক ফাংশন
create or replace function public.is_developer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'developer', false)
$$;

-- ৩) প্রোফাইল দেখা ও বদলানো: ডেভেলপারও পারবেন
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_reviewer() or public.is_developer());

drop policy if exists profiles_update_staff on public.profiles;
create policy profiles_update_staff on public.profiles for update
  using (public.is_reviewer() or public.is_developer())
  with check (public.is_reviewer() or public.is_developer());

-- ৪) প্রোফাইল সুরক্ষার নতুন নিয়ম
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text;
  saao_title constant text := 'উপসহকারী কৃষি কর্মকর্তা';
begin
  if auth.uid() is null then
    return new; -- SQL Editor থেকে সব করা যায়
  end if;
  new.id := old.id;
  new.email := old.email;
  r := public.current_role_name();

  -- নিজের একাউন্ট: নাম, মোবাইল, ব্লক, ইউনিয়ন বদলানো যায়; ভূমিকা, সক্রিয়তা, পদবি নয়
  if old.id = auth.uid() then
    if new.role is distinct from old.role or new.active is distinct from old.active then
      raise exception 'নিজের role বা সক্রিয় অবস্থা বদলানো যায় না';
    end if;
    new.designation := old.designation;
    return new;
  end if;

  -- ডেভেলপার: সব পারেন, শুধু অন্য কাউকে ডেভেলপার বানানো বা ডেভেলপারকে বদলানো নয়
  if r = 'developer' then
    if new.role = 'developer' and old.role is distinct from 'developer' then
      raise exception 'ডেভেলপার ভূমিকা অ্যাপ থেকে দেওয়া যায় না';
    end if;
    if old.role = 'developer' then
      raise exception 'অন্য ডেভেলপারের একাউন্ট বদলানো যায় না';
    end if;
    return new;
  end if;

  -- উপজেলা কৃষি অফিসার ও কো-এডমিন: শুধু উপসহকারী কৃষি কর্মকর্তা
  if r in ('admin', 'coadmin') then
    if old.role <> 'saao' or coalesce(old.designation, saao_title) <> saao_title then
      raise exception 'কর্মকর্তাদের একাউন্ট শুধু ডেভেলপার অনুমোদন ও পরিবর্তন করতে পারেন';
    end if;
    if new.role is distinct from old.role then
      raise exception 'ভূমিকা বদলানো শুধু ডেভেলপার পারেন';
    end if;
    new.designation := old.designation;
    return new;
  end if;

  raise exception 'অন্যের একাউন্ট বদলানোর অনুমতি নেই';
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- ৫) এখনই চেক করতে: ভূমিকাগুলো
-- select full_name, email, designation, role, active from public.profiles order by role, full_name;

-- ৬) ডেভেলপার একাউন্ট বানানো (একবারই):
--    প্রথমে সাইটে আলাদা একটি ইমেইল দিয়ে সাইনআপ করুন (যেকোনো পদবি বাছলেই হবে),
--    তারপর নিচের লাইনে সেই ইমেইল বসিয়ে চালান:
-- update public.profiles set role = 'developer', active = true where email = 'developer-email@example.com';
