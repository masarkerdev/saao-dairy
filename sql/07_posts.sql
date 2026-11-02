-- ০৭: পদ = ভূমিকা, আর ডেভেলপারের পূর্ণ অধিকার
--   উপজেলা কৃষি অফিসার        → এডমিন
--   অতিরিক্ত কৃষি অফিসার       → কো-এডমিন-১
--   কৃষি সম্প্রসারণ কর্মকর্তা (২) → কো-এডমিন-২
--   উপসহকারী কৃষি কর্মকর্তা     → এসএএও
--   ডেভেলপার                   → আলাদা একাউন্ট; সব দেখা ও ঠিক করা যায়
--                                 (ইউজারের পদ/ভূমিকা, সূচির অবস্থা, সেটিংস)
-- ০৬ চালানোর পরে চালাবেন। একাধিকবার চালালেও সমস্যা নেই।

-- ১) ডেভেলপারও সব সূচি, গ্রুপ, সেটিংস দেখতে ও বদলাতে পারবেন
create or replace function public.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('coadmin', 'admin', 'developer'), false)
$$;

-- ২) পদ অনুযায়ী ভূমিকা ঠিক রাখা: ভূমিকা বদলালে পদবিও মিলতে হবে
create or replace function public.fit_post() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role = 'admin' then
    new.designation := 'উপজেলা কৃষি অফিসার';
  elsif new.role = 'coadmin' and (new.role is distinct from old.role or new.designation is distinct from old.designation) then
    if new.designation is null or new.designation not in ('অতিরিক্ত কৃষি অফিসার', 'কৃষি সম্প্রসারণ কর্মকর্তা') then
      raise exception 'কো-এডমিনের পদবি হতে হবে অতিরিক্ত কৃষি অফিসার বা কৃষি সম্প্রসারণ কর্মকর্তা';
    end if;
  elsif new.role = 'saao' and new.active and old.active is distinct from true
        and coalesce(new.designation, 'উপসহকারী কৃষি কর্মকর্তা') <> 'উপসহকারী কৃষি কর্মকর্তা' then
    raise exception 'কর্মকর্তাকে এসএএও হিসেবে সক্রিয় করা যায় না; আগে সঠিক ভূমিকা দিন';
  end if;
  -- উপজেলা পর্যায়ের কর্মকর্তাদের ব্লক/ইউনিয়ন থাকে না
  if new.role in ('admin', 'coadmin') then
    new.block_name := null;
    new.union_name := null;
  end if;
  return new;
end $$;

drop trigger if exists profiles_fit_post on public.profiles;
create trigger profiles_fit_post before update on public.profiles
  for each row execute function public.fit_post();

-- ৩) প্রোফাইল সুরক্ষা: ডেভেলপার পদবিও বদলাতে পারেন
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text;
  saao_title constant text := 'উপসহকারী কৃষি কর্মকর্তা';
begin
  if auth.uid() is null then
    return new;
  end if;
  new.id := old.id;
  new.email := old.email;
  r := public.current_role_name();

  if old.id = auth.uid() then
    if new.role is distinct from old.role or new.active is distinct from old.active then
      raise exception 'নিজের role বা সক্রিয় অবস্থা বদলানো যায় না';
    end if;
    new.designation := old.designation;
    return new;
  end if;

  if r = 'developer' then
    if new.role = 'developer' and old.role is distinct from 'developer' then
      raise exception 'ডেভেলপার ভূমিকা অ্যাপ থেকে দেওয়া যায় না';
    end if;
    if old.role = 'developer' then
      raise exception 'অন্য ডেভেলপারের একাউন্ট বদলানো যায় না';
    end if;
    return new;
  end if;

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

-- ৪) সূচির অবস্থা: ডেভেলপার যেকোনো অবস্থায় বদলাতে পারেন (ভুল ঠিক করতে); ইতিহাসে লেখা থাকে
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

  if r = 'developer' then
    if new.status is distinct from old.status then
      if new.status in ('draft', 'submitted') then
        new.forwarded_by := null; new.forwarded_at := null;
        new.approved_by  := null; new.approved_at  := null;
      end if;
      insert into public.schedule_events (schedule_id, actor_id, from_status, to_status, note)
      values (new.id, uid, old.status, new.status, coalesce(note, 'ডেভেলপার সংশোধন'));
    end if;
    return new;
  end if;

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

-- ৫) পুরোনো ভুল তথ্য ঠিক করা
-- এডমিনের পদবি সবসময় উপজেলা কৃষি অফিসার
update public.profiles set designation = 'উপজেলা কৃষি অফিসার', block_name = null, union_name = null
 where role = 'admin' and designation is distinct from 'উপজেলা কৃষি অফিসার';
-- কো-এডমিনদের ব্লক/ইউনিয়ন মুছে ফেলা
update public.profiles set block_name = null, union_name = null
 where role = 'coadmin' and (block_name is not null or union_name is not null);

-- ৬) যাচাই: যেসব কো-এডমিনের পদবি এখনো ঠিক নেই (থাকলে ডেভেলপার প্যানেল থেকে বা নিচের মতো ঠিক করুন)
select email, full_name, designation, role from public.profiles
 where role = 'coadmin' and (designation is null or designation not in ('অতিরিক্ত কৃষি অফিসার', 'কৃষি সম্প্রসারণ কর্মকর্তা'));
-- উদাহরণ:
-- update public.profiles set designation = 'অতিরিক্ত কৃষি অফিসার' where email = 'xxx@gmail.com';
-- update public.profiles set designation = 'কৃষি সম্প্রসারণ কর্মকর্তা' where email = 'yyy@gmail.com';
