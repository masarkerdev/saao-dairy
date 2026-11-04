-- ১১: অন্যের পাসওয়ার্ড রিসেট
--   • ডেভেলপার: সবার (অন্য ডেভেলপার ছাড়া)
--   • উপজেলা কৃষি অফিসার (এডমিন) ও কো-এডমিন-১/২: উপসহকারী কৃষি কর্মকর্তাদের
--   • নিজের পাসওয়ার্ড সবাই প্রোফাইল পেজ থেকে বদলান (এই ফাংশন দিয়ে নয়)
--   • রিসেটের পর ওই ইউজারের চালু থাকা সব লগইন বন্ধ হয়, নতুন পাসওয়ার্ডে আবার ঢুকতে হয়
-- ১০ চালানোর পরে চালাবেন। একাধিকবার চালালেও সমস্যা নেই।

create or replace function public.reset_user_password(target uuid, new_password text) returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  r text := public.current_role_name();
  victim public.profiles%rowtype;
  saao_title constant text := 'উপসহকারী কৃষি কর্মকর্তা';
begin
  if auth.uid() is null or r is null or r not in ('developer', 'admin', 'coadmin') then
    raise exception 'পাসওয়ার্ড রিসেটের অনুমতি নেই';
  end if;
  if target = auth.uid() then
    raise exception 'নিজের পাসওয়ার্ড প্রোফাইল পেজ থেকে বদলান';
  end if;
  if new_password is null or length(new_password) < 8 then
    raise exception 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে';
  end if;

  select * into victim from public.profiles where id = target;
  if not found then
    raise exception 'ইউজার পাওয়া যায়নি';
  end if;
  if victim.role = 'developer' then
    raise exception 'ডেভেলপারের পাসওয়ার্ড অ্যাপ থেকে রিসেট করা যায় না';
  end if;
  if r in ('admin', 'coadmin')
     and (victim.role <> 'saao' or coalesce(victim.designation, saao_title) <> saao_title) then
    raise exception 'কর্মকর্তাদের পাসওয়ার্ড শুধু ডেভেলপার রিসেট করতে পারেন';
  end if;

  update auth.users
     set encrypted_password = crypt(new_password, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = target;
  if not found then
    raise exception 'লগইন একাউন্ট পাওয়া যায়নি';
  end if;

  -- চালু থাকা লগইন বন্ধ (টেবিল থাকলে)
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using target;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    execute 'delete from auth.refresh_tokens where user_id = $1::text' using target;
  end if;

  return victim.full_name;
end $$;

revoke all on function public.reset_user_password(uuid, text) from public, anon;
grant execute on function public.reset_user_password(uuid, text) to authenticated;
