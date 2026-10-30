-- Run this entire file in the Supabase SQL editor once before connecting Sprout.
-- Re-running it is safe for this schema. Classroom requests use the teacher's JWT;
-- only server-side account administration uses a secret key. Every table enforces ownership.
begin;

-- Account creation belongs to the administrator. Keep this email in sync with
-- ADMIN_EMAIL in the Express server's .env. This private row is intentionally
-- inaccessible to browser roles, including users who edit their own metadata.
-- To change owners, update this row in SQL Editor and ADMIN_EMAIL together.
create schema if not exists sprout_private;
revoke all on schema sprout_private from public, anon, authenticated, service_role;

create table if not exists sprout_private.settings (
  singleton boolean primary key default true check (singleton),
  admin_email text not null check (admin_email = lower(btrim(admin_email)) and position('@' in admin_email) > 1)
);
alter table sprout_private.settings enable row level security;
revoke all on sprout_private.settings from public, anon, authenticated, service_role;
insert into sprout_private.settings(singleton, admin_email)
  values (true, 'lpdcabe@gmail.com') on conflict (singleton) do nothing;

-- Read current server-managed metadata, not a possibly stale JWT. Suspending a
-- teacher therefore blocks direct REST/RPC calls immediately, even with a token
-- issued while that teacher was active. A user can only check their own access.
create or replace function public.sprout_has_access()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and (
        (u.email_confirmed_at is not null and lower(u.email) =
          (select s.admin_email from sprout_private.settings s where s.singleton))
        or (u.raw_app_meta_data ->> 'sprout_role' = 'teacher'
          and u.raw_app_meta_data ->> 'sprout_status' = 'active')
      )
  );
$$;
revoke all on function public.sprout_has_access() from public, anon, authenticated;
grant execute on function public.sprout_has_access() to authenticated;

-- Supabase Auth admin.createUser inserts the user, then updates app_metadata
-- inside the same transaction. A BEFORE INSERT check would reject legitimate
-- admin creations. Defer this check to commit and read the final stored row.
-- Public signUp cannot set raw_app_meta_data, so it cannot pass this gate.
-- Existing users are preserved and can be approved through Account management.
create or replace function sprout_private.require_managed_account()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_owner_email text;
begin
  select * into v_user from auth.users where id = new.id;
  if not found then return null; end if;
  select s.admin_email into v_owner_email from sprout_private.settings s where s.singleton;
  if v_user.raw_app_meta_data ->> 'sprout_status' = 'active'
    and (
      v_user.raw_app_meta_data ->> 'sprout_role' = 'teacher'
      or (v_user.raw_app_meta_data ->> 'sprout_role' = 'admin'
        and lower(v_user.email) = v_owner_email)
    ) then
    return null;
  end if;
  raise exception 'Accounts must be created by the Sprout administrator.' using errcode = '42501';
end;
$$;
revoke all on function sprout_private.require_managed_account() from public, anon, authenticated, service_role;
drop trigger if exists sprout_managed_accounts_only on auth.users;
create constraint trigger sprout_managed_accounts_only
  after insert on auth.users deferrable initially deferred
  for each row execute function sprout_private.require_managed_account();

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Our little garden' check (char_length(btrim(name)) between 1 and 80),
  goal integer not null default 1000 check (goal between 1 and 1000000),
  theme text not null default 'sunshine' check (theme in ('sunshine', 'sunset', 'moonlight')),
  decorations jsonb not null default '[]'::jsonb check (jsonb_typeof(decorations) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  plant text not null default 'sunflower' check (plant in ('sunflower', 'daisy', 'tulip', 'cactus', 'monstera', 'lavender', 'strawberry', 'hibiscus', 'rose', 'marigold', 'bonsai')),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);

-- Expand the allowed varieties on existing installations as well as new ones.
alter table public.students drop constraint if exists students_plant_check;
alter table public.students add constraint students_plant_check
  check (plant in ('sunflower', 'daisy', 'tulip', 'cactus', 'monstera', 'lavender', 'strawberry', 'hibiscus', 'rose', 'marigold', 'bonsai'));

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  student_name text not null,
  points integer not null check (points between 1 and 100),
  reason text not null check (char_length(btrim(reason)) between 1 and 120),
  created_at timestamptz not null default now()
);

-- Upgrade existing single-class installations without deleting any data.
alter table public.classrooms drop constraint if exists classrooms_owner_id_key;
create index if not exists classrooms_owner_idx on public.classrooms(owner_id);
create index if not exists students_classroom_idx on public.students(classroom_id);
create index if not exists activities_classroom_time_idx on public.activities(classroom_id, created_at desc);
create index if not exists activities_student_idx on public.activities(student_id);

alter table public.classrooms enable row level security;
alter table public.students enable row level security;
alter table public.activities enable row level security;

drop policy if exists classroom_owner on public.classrooms;
create policy classroom_owner on public.classrooms for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists student_owner on public.students;
create policy student_owner on public.students for all to authenticated
  using (exists (select 1 from public.classrooms c where c.id = classroom_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.classrooms c where c.id = classroom_id and c.owner_id = (select auth.uid())));

drop policy if exists activity_owner on public.activities;
create policy activity_owner on public.activities for all to authenticated
  using (exists (select 1 from public.classrooms c where c.id = classroom_id and c.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.classrooms c where c.id = classroom_id and c.owner_id = (select auth.uid()))
    and exists (select 1 from public.students s where s.id = student_id and s.classroom_id = activities.classroom_id)
  );

-- Restrictive access policies apply in addition to the existing ownership
-- policies. An account's role never grants access to another teacher's records.
drop policy if exists classroom_account_access on public.classrooms;
create policy classroom_account_access on public.classrooms as restrictive for all to authenticated
  using ((select public.sprout_has_access()))
  with check ((select public.sprout_has_access()));
drop policy if exists student_account_access on public.students;
create policy student_account_access on public.students as restrictive for all to authenticated
  using ((select public.sprout_has_access()))
  with check ((select public.sprout_has_access()));
drop policy if exists activity_account_access on public.activities;
create policy activity_account_access on public.activities as restrictive for all to authenticated
  using ((select public.sprout_has_access()))
  with check ((select public.sprout_has_access()));

-- Column grants stop authenticated users from bypassing the award RPC through
-- Supabase's REST API. Points and history may only change inside the functions.
revoke all on public.classrooms, public.students, public.activities from public, anon, authenticated;
grant select, delete on public.classrooms, public.students to authenticated;
grant insert (owner_id, name, goal, theme, decorations) on public.classrooms to authenticated;
grant update (name, goal, theme, decorations) on public.classrooms to authenticated;
grant insert (classroom_id, name, plant) on public.students to authenticated;
grant update (name, plant) on public.students to authenticated;
grant select on public.activities to authenticated;

-- The complete batch is validated before any mutation. A classroom lock serializes
-- competing award/undo requests. An exception rolls back every point and activity.
-- SECURITY DEFINER permits only these bounded point mutations; every query is
-- schema-qualified and each mutation explicitly checks the caller's ownership.
-- Remove old signatures so PostgREST has only one version of each RPC.
drop function if exists public.award_points(uuid[], boolean, integer, text);
drop function if exists public.undo_award(uuid);
create or replace function public.award_points(
  p_student_ids uuid[], p_all boolean, p_points integer, p_reason text,
  p_classroom_id uuid default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_classroom_id uuid;
  v_ids uuid[];
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to award points.'; end if;
  if not public.sprout_has_access() then raise exception 'Your account does not have classroom access.' using errcode = '42501'; end if;
  if p_points is null or p_points < 1 or p_points > 100 then raise exception 'Points must be between 1 and 100.'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 120 then raise exception 'Enter a reason of up to 120 characters.'; end if;

  if p_classroom_id is null and (select count(*) from public.classrooms where owner_id = auth.uid()) > 1 then
    raise exception 'Choose a classroom before awarding points.';
  end if;
  select id into v_classroom_id from public.classrooms
    where owner_id = auth.uid() and (p_classroom_id is null or id = p_classroom_id) for update;
  if v_classroom_id is null then raise exception 'Create your classroom first.'; end if;

  if coalesce(p_all, false) then
    select array_agg(id) into v_ids from public.students where classroom_id = v_classroom_id;
  else
    if p_student_ids is null or cardinality(p_student_ids) not between 1 and 1000 then raise exception 'Choose at least one student.'; end if;
    select array_agg(distinct chosen_id) into v_ids from unnest(p_student_ids) as input(chosen_id);
  end if;

  if v_ids is null or cardinality(v_ids) = 0 then raise exception 'Add a student before awarding points.'; end if;
  -- Lock each selected student too: concurrent roster deletion cannot silently
  -- turn a requested batch into a partial award between validation and UPDATE.
  perform 1 from public.students where classroom_id = v_classroom_id and id = any(v_ids) order by id for update;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_ids) then raise exception 'One or more students are not in your classroom.'; end if;
  if exists (select 1 from public.students where id = any(v_ids) and points > 2147483647 - p_points) then
    raise exception 'A student has reached the maximum supported points.';
  end if;

  with awarded as (
    update public.students set points = points + p_points
    where classroom_id = v_classroom_id and id = any(v_ids)
    returning id, name
  )
  insert into public.activities(classroom_id, student_id, student_name, points, reason)
  select v_classroom_id, id, name, p_points, btrim(p_reason) from awarded;
end;
$$;

create or replace function public.undo_award(p_activity_id uuid, p_classroom_id uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_classroom_id uuid;
  v_activity public.activities%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to undo points.'; end if;
  if not public.sprout_has_access() then raise exception 'Your account does not have classroom access.' using errcode = '42501'; end if;
  select c.id into v_classroom_id from public.classrooms c
    where c.owner_id = auth.uid() and (p_classroom_id is null or c.id = p_classroom_id)
    and c.id = (select a.classroom_id from public.activities a where a.id = p_activity_id) for update;
  if v_classroom_id is null then raise exception 'Create your classroom first.'; end if;
  select * into v_activity from public.activities where id = p_activity_id and classroom_id = v_classroom_id;
  if not found then raise exception 'This award was already undone or no longer exists.'; end if;
  -- Lock the student before the activity, matching the order used by a roster
  -- delete and its cascading history deletion, to avoid an undo/delete deadlock.
  perform 1 from public.students where id = v_activity.student_id and classroom_id = v_classroom_id for update;
  if not found then raise exception 'This student no longer exists.'; end if;
  select * into v_activity from public.activities where id = p_activity_id and classroom_id = v_classroom_id for update;
  if not found then raise exception 'This award was already undone or no longer exists.'; end if;
  update public.students set points = points - v_activity.points
    where id = v_activity.student_id and classroom_id = v_classroom_id;
  delete from public.activities where id = v_activity.id;
end;
$$;

revoke all on function public.award_points(uuid[], boolean, integer, text, uuid) from public, anon;
revoke all on function public.undo_award(uuid, uuid) from public, anon;
grant execute on function public.award_points(uuid[], boolean, integer, text, uuid) to authenticated;
grant execute on function public.undo_award(uuid, uuid) to authenticated;

commit;
