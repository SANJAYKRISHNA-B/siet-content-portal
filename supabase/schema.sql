-- SIET Content Collection Portal schema
-- Run this in Supabase SQL Editor before using the app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'member' check (role in ('member','admin')),
  unit text,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null,
  unit text not null,
  academic_year text,
  description text not null,
  data jsonb not null default '{}'::jsonb,
  file_urls text[] not null default '{}',
  status text not null default 'Pending' check (status in ('Pending','Approved','Needs Correction')),
  feedback text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.submissions enable row level security;

create index if not exists submissions_submitted_by_idx on public.submissions (submitted_by);
create index if not exists submissions_created_at_idx on public.submissions (created_at desc);
create index if not exists submissions_status_idx on public.submissions (status);

-- Security-definer helper avoids recursive RLS checks when determining admin role.
create or replace function public.is_portal_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

revoke all on function public.is_portal_admin() from public;
grant execute on function public.is_portal_admin() to authenticated;

-- Policy definitions are dropped first so this complete script is safe to rerun.
drop policy if exists "profiles read own or admin" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles insert own member" on public.profiles;
drop policy if exists "submissions read own or admin" on public.submissions;
drop policy if exists "members create own submissions" on public.submissions;
drop policy if exists "admin updates submissions" on public.submissions;

-- Members can read their own profile. Admins can read all profiles.
create policy "profiles read own or admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_portal_admin());

-- Profile creation and role/unit changes are controlled by the signup trigger and administrators.

-- Members can view and create their own submissions; admins can view/update all submissions.
create policy "submissions read own or admin" on public.submissions
for select to authenticated
using (submitted_by = auth.uid() or public.is_portal_admin());

create policy "members create own submissions" on public.submissions
for insert to authenticated
with check (submitted_by = auth.uid() and not public.is_portal_admin());

create policy "admin updates submissions" on public.submissions
for update to authenticated
using (public.is_portal_admin())
with check (public.is_portal_admin());

-- Create a private storage bucket for uploaded content.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-files', 'content-files', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;

-- Keep an existing bucket aligned with the portal's current media limits.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']
where id = 'content-files';

drop policy if exists "members upload own files" on storage.objects;
drop policy if exists "members view own files and admins view all" on storage.objects;
drop policy if exists "members delete own files and admins delete all" on storage.objects;

create policy "members upload own files" on storage.objects
for insert to authenticated
with check (bucket_id = 'content-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "members view own files and admins view all" on storage.objects
for select to authenticated
using (bucket_id = 'content-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_portal_admin()));

create policy "members delete own files and admins delete all" on storage.objects
for delete to authenticated
using (bucket_id = 'content-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_portal_admin()));

-- Create profile records automatically at signup. Role is always member by default.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, unit)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'member', coalesce(new.raw_user_meta_data->>'unit',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- IMPORTANT: After creating your account, promote the designated portal administrator manually
-- from the SQL Editor. Replace the email below with the approved administrator's email:
-- update public.profiles p set role = 'admin'
-- from auth.users u where p.id = u.id and u.email = 'admin@your-institution.edu';

-- Uploaded files are stored privately. The UI generates short-lived signed URLs when a member
-- opens a file, and storage paths (not public URLs) are stored with the submission.
