-- ০৮: ডেভেলপার প্যানেল থেকে ইউজার মোছা
--   • শুধু ডেভেলপার পারেন; নিজের বা অন্য ডেভেলপারের একাউন্ট মোছা যায় না
--   • মুছলে লগইন একাউন্ট, প্রোফাইল, তাঁর নিজের সূচি ও কৃষক গ্রুপ মুছে যায়
--   • তিনি অন্যের সূচি যাচাই/অনুমোদন করে থাকলে সেই সূচি থাকে, শুধু নামটা খালি হয়
-- ০৭ চালানোর পরে চালাবেন। একাধিকবার চালালেও সমস্যা নেই।

create or replace function public.delete_user(target uuid) returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  victim public.profiles%rowtype;
begin
  if auth.uid() is null or public.current_role_name() is distinct from 'developer' then
    raise exception 'ইউজার মোছার অনুমতি শুধু ডেভেলপারের';
  end if;
  if target = auth.uid() then
    raise exception 'নিজের একাউন্ট মোছা যায় না';
  end if;

  select * into victim from public.profiles where id = target;
  if victim.role = 'developer' then
    raise exception 'ডেভেলপারের একাউন্ট অ্যাপ থেকে মোছা যায় না';
  end if;

  -- অন্যের সূচিতে তাঁর নাম থাকলে খালি করা (নইলে মোছা আটকে যায়)
  update public.schedules set approved_by = null where approved_by = target;

  delete from auth.users where id = target;
  if not found then
    -- লগইন একাউন্ট না থাকলেও প্রোফাইল থেকে গেলে সেটাও মোছা
    delete from public.profiles where id = target;
    if not found then
      raise exception 'ইউজার পাওয়া যায়নি';
    end if;
  end if;
  return coalesce(victim.full_name, 'ইউজার');
end $$;

revoke all on function public.delete_user(uuid) from public, anon;
grant execute on function public.delete_user(uuid) to authenticated;
