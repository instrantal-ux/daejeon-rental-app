-- 포탈 월드 서버 표. Supabase → SQL Editor 에 붙여넣고 Run. (가계부 표와 별개, 계정은 공용)
create table if not exists public.pw_players (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '모험가',
  level int not null default 1,
  score int not null default 0,
  worlds int not null default 1,
  distance real not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.pw_players enable row level security;
drop policy if exists "pw_players read all" on public.pw_players;
create policy "pw_players read all" on public.pw_players for select using (true);
drop policy if exists "pw_players own write" on public.pw_players;
create policy "pw_players own write" on public.pw_players for all using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.pw_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.pw_saves enable row level security;
drop policy if exists "pw_saves own" on public.pw_saves;
create policy "pw_saves own" on public.pw_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.pw_players to anon;
grant select, insert, update, delete on public.pw_players to authenticated;
grant select, insert, update, delete on public.pw_saves to authenticated;
