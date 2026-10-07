-- ধাপ ৫: অ্যাডমিন পেজে ইউজার চেনার জন্য profiles-এ ইমেইল রাখা
-- Supabase SQL Editor-এ পুরোটা একবারে Run করুন (বারবার চালালেও সমস্যা নেই)।

alter table public.profiles add column if not exists email text;

-- যারা আগেই সাইনআপ করেছে তাদের ইমেইল ভরে দেওয়া
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is null;

-- নতুন সাইনআপে ইমেইলসহ প্রোফাইল তৈরি (role সবসময় 'saao', active=false)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, active, block_name, union_name, mobile, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'নামহীন'),
    'saao',
    false,
    new.raw_user_meta_data->>'block_name',
    new.raw_user_meta_data->>'union_name',
    new.raw_user_meta_data->>'mobile',
    new.email
  );
  return new;
end $$;
