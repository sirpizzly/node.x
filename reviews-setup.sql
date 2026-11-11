-- node.x reviews: one-time setup for a free Supabase database.
--
-- STEPS
-- 1. Go to supabase.com, make a free account, and create a new project.
-- 2. In the project: Authentication > Sign In / Providers > turn ON "Allow anonymous sign-ins".
--    (Visitors don't see anything. This is just how each person gets their own "one review" slot.)
-- 3. In the project: SQL Editor > New query > paste this whole file > Run.
-- 4. Project Settings > API: copy the "Project URL" and the "anon public" key
--    into reviews-config.js, then upload that file to your site.
--
-- What this enforces on the server (so it can't be skipped by editing the website):
--   * one review per visitor account (user_id is UNIQUE)
--   * only the owner can change or delete their review
--   * 1-5 stars, 3-500 characters, name up to 24 characters
--   * a basic slur / cuss word check (the word patterns are scrambled with ROT13 so this file isn't a list of slurs)
-- Note: visitors are anonymous accounts tied to their browser. Someone who clears their site data or uses
-- another browser gets a fresh account, so "one review per person" really means one per browser.

create extension if not exists pgcrypto;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid(),
  name text not null default 'Anonymous' check (char_length(name) between 1 and 24),
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists "reviews are public" on public.reviews;
drop policy if exists "insert own review" on public.reviews;
drop policy if exists "update own review" on public.reviews;
drop policy if exists "delete own review" on public.reviews;

create policy "reviews are public" on public.reviews for select using (true);
create policy "insert own review" on public.reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "update own review" on public.reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own review" on public.reviews for delete to authenticated using (auth.uid() = user_id);

-- language check (patterns are ROT13-scrambled; decoded at run time)
create or replace function public.nx_is_clean(t text) returns boolean
language plpgsql immutable as $$
declare
  s text;
  p text;
  pats text[] := array[
    '(^|[^n-m])s+h+p+x+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])s+p+x+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])s+h+x+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])z+b+g+u+r+e+s+h+p+x+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])f+u+v+g+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])o+h+y{2,}f+u+v+g+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])q+v+c+f+u+v+g+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])o+v+g+p+u+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])n+f{2,}(?:rf)?($|[^n-m])',
    '(^|[^n-m])n+f{2,}u+b+y+r+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])w+n+p+x+n+f{2,}(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])q+h+z+o+n+f{2,}(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])o+n+f+g+n+e+q+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])q+v+p+x+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])q+v+p+x+u+r+n+q+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])p+b+p+x+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])c+h+f{2,}l+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])c+h+f{2,}v+r+f+($|[^n-m])',
    '(^|[^n-m])p+h+a+g+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])q+n+z+a+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])q+n+z{2,}v+g+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])t+b+q{2,}n+z+a+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])u+r+y{2,}(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])p+e+n+c+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])c+v+f{2,}(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])f+y+h+g+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])j+u+b+e+r+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])g+j+n+g+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])j+n+a+x+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])a+v+t{2,}r+e+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])a+v+t{2,}n+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])a+v+t{2,}n+u+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])s+n+t{2,}b+g+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])s+n+t+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])e+r+g+n+e+q+(?:f|rf|rq|re|ref|vat|va|l|vrf|gl|cl|urnq|urnqf|snpr|jnq)?($|[^n-m])',
    '(^|[^n-m])g+e+n+a{2,}l+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])g+e+n+a{2,}v+r+f+($|[^n-m])',
    '(^|[^n-m])p+u+v+a+x+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])f+c+v+p+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])x+v+x+r+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])t+b{2,}x+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])j+r+g+o+n+p+x+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])o+r+n+a+r+e+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])q+l+x+r+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])c+n+x+v+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])g+b+j+r+y+u+r+n+q+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])e+n+t+u+r+n+q+(?:f|rf)?($|[^n-m])',
    '(^|[^n-m])p+b{2,}a+(?:f|rf)?($|[^n-m])'
  ];
begin
  s := translate(lower(t), '013457$@!+', 'oieastsait');
  foreach p in array pats loop
    if (' ' || s || ' ') ~ translate(p, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 'nopqrstuvwxyzabcdefghijklmNOPQRSTUVWXYZABCDEFGHIJKLM') or (' ' || lower(t) || ' ') ~ translate(p, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 'nopqrstuvwxyzabcdefghijklmNOPQRSTUVWXYZABCDEFGHIJKLM') then
      return false;
    end if;
  end loop;
  return true;
end $$;

create or replace function public.reviews_guard() returns trigger
language plpgsql as $$
begin
  if not public.nx_is_clean(coalesce(new.name, '') || '  ' || coalesce(new.body, '')) then
    raise exception 'profanity' using errcode = 'P0001';
  end if;
  new.user_id := auth.uid();
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard before insert or update on public.reviews
  for each row execute function public.reviews_guard();
