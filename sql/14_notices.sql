-- ১৪: নোটিশ বোর্ড
--   • নোটিশ দেন উপজেলা কৃষি অফিসার, কো-এডমিন-১/২ ও ডেভেলপার
--   • কারা দেখবেন: সবাই / শুধু উপসহকারী কৃষি কর্মকর্তা / শুধু কর্মকর্তা
--   • উপরে আটকে রাখা (পিন) ও মেয়াদ (এই তারিখের পর আর দেখাবে না) রাখা যায়
--   • নিজের দেওয়া নোটিশ সম্পাদনা/মোছা যায়; উপজেলা কৃষি অফিসার ও ডেভেলপার সবগুলো পারেন
-- ১৩ চালানোর পরে চালাবেন। একাধিকবার চালালেও সমস্যা নেই।

create table if not exists public.notices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (btrim(title) <> ''),
  body        text not null default '',
  audience    text not null default 'all' check (audience in ('all', 'saao', 'officers')),
  pinned      boolean not null default false,
  expires_on  date,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notices_created_idx on public.notices (created_at desc);

alter table public.notices enable row level security;
drop policy if exists notices_read   on public.notices;
drop policy if exists notices_insert on public.notices;
drop policy if exists notices_change on public.notices;
drop policy if exists notices_delete on public.notices;

-- দেখা: সক্রিয় ইউজার, নিজের দলের জন্য দেওয়া নোটিশ (কর্মকর্তারা সবগুলো দেখেন)
create policy notices_read on public.notices for select using (
  public.current_role_name() is not null and (
    public.is_reviewer()
    or audience = 'all'
    or (audience = 'saao' and public.current_role_name() = 'saao')
  )
);
create policy notices_insert on public.notices for insert
  with check (public.is_reviewer() and created_by = auth.uid());
create policy notices_change on public.notices for update
  using (created_by = auth.uid() or public.current_role_name() in ('admin', 'developer'))
  with check (public.is_reviewer());
create policy notices_delete on public.notices for delete
  using (created_by = auth.uid() or public.current_role_name() in ('admin', 'developer'));
grant select, insert, update, delete on public.notices to authenticated;

create or replace function public.notice_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  new.title := btrim(new.title);
  new.body := btrim(coalesce(new.body, ''));
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists notices_stamp on public.notices;
create trigger notices_stamp before insert or update on public.notices
  for each row execute function public.notice_stamp();
