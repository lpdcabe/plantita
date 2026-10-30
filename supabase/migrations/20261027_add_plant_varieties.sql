-- Run once in the Supabase SQL Editor to enable the four new varieties.
-- Re-running is safe. Existing students, points, and ownership rules are preserved.
begin;
alter table public.students drop constraint if exists students_plant_check;
alter table public.students add constraint students_plant_check
  check (plant in (
    'sunflower', 'daisy', 'tulip', 'cactus', 'monstera', 'lavender', 'strawberry',
    'hibiscus', 'rose', 'marigold', 'bonsai'
  ));
commit;
