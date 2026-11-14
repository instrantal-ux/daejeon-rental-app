-- 석재 가계부 서버 표 만들기. Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
-- 여러 번 실행해도 안전하다.

-- 1) 공개 프로필 (랭킹용: 별명·레벨·경험치만 공개. 이메일·장부는 공개 안 됨)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '사장님',
  level int not null default 1,
  xp int not null default 0,
  streak int not null default 0,
  best int not null default 0,
  today_count int not null default 0,
  last_active date,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles for select using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- 2) 개인 장부 문서 (본인만 읽고 쓸 수 있음)
create table if not exists public.ledger_docs (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,          -- entry | payout | settings | game
  id text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);
alter table public.ledger_docs enable row level security;
drop policy if exists "docs own" on public.ledger_docs;
create policy "docs own" on public.ledger_docs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists ledger_docs_user_updated on public.ledger_docs (user_id, updated_at);

-- 3) 고칠 때마다 updated_at 을 지금 시각으로 (동기화 커서용)
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists ledger_docs_touch on public.ledger_docs;
create trigger ledger_docs_touch before update on public.ledger_docs for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- 4) 익명 접근(publishable 키만)으로도 랭킹은 볼 수 있게
grant select on public.profiles to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.ledger_docs to authenticated;
