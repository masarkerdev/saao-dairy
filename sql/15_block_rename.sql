-- ১৫: উপসহকারী কৃষি কর্মকর্তার ব্লকের নাম বদলানো/সংশোধন
--   • এসএএও নিজে (প্রোফাইল থেকে) বা উপজেলা কৃষি অফিসার, কো-এডমিন-১/২, ডেভেলপার (ইউজার পেজ থেকে)
--   • নতুন নাম বসে প্রোফাইলে, তাঁর নিজ ব্লকের সব কৃষক গ্রুপে ও সব সূচিতে (প্রিন্টে নতুন নাম আসে)
--   • অতিরিক্ত দায়িত্বের ব্লকের সূচি ও গ্রুপ যেমন আছে তেমন থাকে
-- ১৪ চালানোর পরে চালাবেন। একাধিকবার চালালেও সমস্যা নেই।

-- সূচির ব্লক সাধারণত বদলানো যায় না; শুধু এই ফাংশনের ভেতর থেকে যায়
create or replace function public.schedule_block_lock() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.block_rename', true), '') = '1' then
    return new;
  end if;
  new.block_name := old.block_name;
  new.extra_charge := old.extra_charge;
  return new;
end $$;

-- সূচির অবস্থা-পাহারা (schedule_guard) এই ফাংশনের ভেতরের নাম-বদল আটকাবে না
do $$
declare d text; nd text;
begin
  d := pg_get_functiondef('public.schedule_guard'::regproc);
  if position('app.block_rename' in d) = 0 then
    nd := regexp_replace(d, E'\\mbegin\\s*\\n(\\s*)if uid is null',
      E'begin\n\\1if coalesce(current_setting(''app.block_rename'', true), '''') = ''1'' then\n\\1  return new;\n\\1end if;\n\\1if uid is null');
    if nd = d then
      raise exception 'schedule_guard আপডেট করা যায়নি';
    end if;
    execute nd;
  end if;
end $$;

create or replace function public.rename_saao_block(target uuid, new_block text, new_union text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  r text := public.current_role_name();
  p public.profiles%rowtype;
  nb text := btrim(coalesce(new_block, ''));
  old_block text;
begin
  if nb = '' then
    raise exception 'ব্লকের নাম লিখুন';
  end if;
  select * into p from public.profiles where id = target;
  if not found then
    raise exception 'ইউজার পাওয়া যায়নি';
  end if;
  if p.role <> 'saao' then
    raise exception 'শুধু উপসহকারী কৃষি কর্মকর্তার ব্লক বদলানো যায়';
  end if;
  if not (target = auth.uid() or r in ('admin', 'coadmin', 'developer')) then
    raise exception 'ব্লক বদলানোর অনুমতি নেই';
  end if;

  old_block := coalesce(p.block_name, '');
  if exists (select 1 from public.block_charges c where c.saao_id = target and c.block_name = nb) then
    raise exception '% ব্লক এই কর্মকর্তার অতিরিক্ত দায়িত্বে আছে। আগে অতিরিক্ত দায়িত্বটি তুলে নিন।', nb;
  end if;

  update public.profiles
     set block_name = nb, union_name = coalesce(nullif(btrim(coalesce(new_union, '')), ''), union_name)
   where id = target;

  if old_block <> nb then
    update public.farmer_groups
       set block_name = nb,
           address = replace(address, 'ব্লক: ' || old_block, 'ব্লক: ' || nb)
     where saao_id = target and coalesce(block_name, '') in (old_block, '');

    perform set_config('app.block_rename', '1', true);
    update public.schedules set block_name = nb
     where saao_id = target and not extra_charge and block_name = old_block;
    perform set_config('app.block_rename', '', true);
  end if;

  return nb;
end $$;

revoke all on function public.rename_saao_block(uuid, text, text) from public, anon;
grant execute on function public.rename_saao_block(uuid, text, text) to authenticated;
