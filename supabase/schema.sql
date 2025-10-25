-- Run this inside the Supabase SQL editor or via `psql` to bootstrap Pulsewave.
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  handle text not null,
  content text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  likes integer not null default 0,
  boosts integer not null default 0,
  replies integer not null default 0,
  avatar_hue integer not null default floor(random() * 360),
  user_id text,
  is_bot boolean not null default false
);

alter table public.posts enable row level security;

alter table if exists public.posts
  add column if not exists user_id text;

alter table if exists public.posts
  add column if not exists is_bot boolean not null default false;

create or replace function public.increment_post_metric(p_post_id uuid, p_metric text)
returns posts
language plpgsql
as $$
declare
  updated_row posts;
begin
  update public.posts
  set
    likes = case when p_metric = 'likes' then likes + 1 else likes end,
    boosts = case when p_metric = 'boosts' then boosts + 1 else boosts end,
    replies = case when p_metric = 'replies' then replies + 1 else replies end
  where id = p_post_id
  returning * into updated_row;

  return updated_row;
end;
$$;

-- Optional: seed the table with a few demo posts directly from SQL.
-- insert into public.posts (author, handle, content, tags, likes, boosts, replies, avatar_hue)
-- values ('Pulsewave', '@pulsewave', 'Hello from Supabase!', array['welcome','pulsewave'], 3, 1, 0, 210);
