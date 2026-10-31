-- ধাপ ৯: সাইনআপে পদবি (উপজেলা পর্যায়ের কর্মকর্তাদের ব্লক/ইউনিয়ন লাগে না)
-- আগে 01-04 চালানো থাকতে হবে। Supabase SQL Editor-এ পুরোটা Run করুন। আবার চালালেও সমস্যা নেই।
-- পদবি শুধু পরিচয়ের জন্য; ভূমিকা (এডমিন/কো-এডমিন) আগের মতোই এডমিন যাচাই করে দেন।

alter table public.profiles add column if not exists designation text;

-- আগের সবাই এসএএও ধরা হলো (পরে "ইউজার" পেজে দেখা যাবে)
update public.profiles set designation = 'উপসহকারী কৃষি কর্মকর্তা'
 where designation is null and role = 'saao';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, active, block_name, union_name, mobile, email, designation)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'নামহীন'),
    'saao',   -- ভূমিকা সবসময় এসএএও দিয়ে শুরু; এডমিন বদলান
    false,
    nullif(new.raw_user_meta_data->>'block_name', ''),
    nullif(new.raw_user_meta_data->>'union_name', ''),
    new.raw_user_meta_data->>'mobile',
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'designation', ''), 'উপসহকারী কৃষি কর্মকর্তা')
  );
  return new;
end $$;
