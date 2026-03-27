# startlista

Din og dine løpevenners terminliste.

## Komplett oppsett fra scratch

### 1. Supabase
1. Gå til supabase.com → opprett konto → nytt prosjekt "Startlista" → Region: Europe → Huk av "Enable automatic RLS"
2. Kopier prosjekt-URL og anon key fra Settings → API
3. Oppdater src/supabase.js med dine verdier
4. Kjør SQL 1 (tabeller) i SQL Editor — se nederst i denne filen
5. Trykk + for ny fane, kjør SQL 2 (løp) — se nederst i denne filen
6. Gå til Authentication → Email Templates → endre til norsk tekst
7. Gå til Authentication → URL Configuration → sett Site URL til https://startlista.no

### 2. GitHub
1. Gå til github.com → opprett gratis konto
2. Klikk "New repository" → navn: "startlista" → Create
3. Dra alle prosjektfilene inn i nettleseren → "Commit changes"

### 3. Vercel
1. Gå til vercel.com → logg inn
2. "Add New" → "Project" → koble GitHub → velg "startlista"
3. Klikk "Deploy" — ferdig på ca 1 minutt

### 4. Domene
1. Kjøp startlista.no på domeneshop.no
2. I Vercel: Settings → Domains → legg til "startlista.no"
3. I Domeneshop: CNAME www → cname.vercel-dns.com, A @ → 76.76.21.21
4. Vent noen timer

---

## SQL 1: Tabeller

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text not null, last_name text not null, city text not null,
  created_at timestamp with time zone default now()
);
alter table profiles enable row level security;
create policy "Profiler synlige for alle" on profiles for select using (true);
create policy "Oppdater egen profil" on profiles for update using (auth.uid() = id);
create policy "Sett inn egen profil" on profiles for insert with check (auth.uid() = id);

create table races (
  id bigint generated always as identity primary key,
  name text not null, location text not null, date date not null, distance text not null,
  country text default '', user_created boolean default false,
  created_at timestamp with time zone default now()
);
alter table races enable row level security;
create policy "Løp synlige for alle" on races for select using (true);
create policy "Innloggede kan legge til" on races for insert with check (auth.uid() is not null);

create table entries (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  race_id bigint references races(id) on delete cascade not null,
  goal text default '',
  created_at timestamp with time zone default now(),
  unique(user_id, race_id)
);
alter table entries enable row level security;
create policy "Påmeldinger synlige" on entries for select using (true);
create policy "Legg til egne" on entries for insert with check (auth.uid() = user_id);
create policy "Slett egne" on entries for delete using (auth.uid() = user_id);
create policy "Oppdater egne" on entries for update using (auth.uid() = user_id);

create table follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (follower_id, following_id)
);
alter table follows enable row level security;
create policy "Følginger synlige" on follows for select using (true);
create policy "Følg andre" on follows for insert with check (auth.uid() = follower_id);
create policy "Avfølg" on follows for delete using (auth.uid() = follower_id);

create or replace function delete_user()
returns void language sql security definer
as $$ delete from auth.users where id = auth.uid(); $$;
```

## SQL 2: Løp

```sql
insert into races (name, location, date, distance, country) values
('Oslo Maraton', 'Oslo', '2026-09-12', '42.195 km', 'Norge'),
('Sentrumsløpet', 'Oslo', '2026-04-25', '10 km', 'Norge'),
('Birkebeinerløpet', 'Lillehammer', '2026-06-13', '21.0975 km', 'Norge'),
('Holmenkollstafetten', 'Oslo', '2026-05-09', 'Stafett', 'Norge'),
('Midnight Sun Marathon', 'Tromsø', '2026-06-20', '42.195 km', 'Norge'),
('Bergen City Marathon', 'Bergen', '2026-04-25', '42.195 km', 'Norge'),
('Nordmarka Skogsmaraton', 'Sognsvann, Oslo', '2026-06-20', '42.195 km', 'Norge'),
('Hytteplanmila', 'Hole, Ringerike', '2026-10-17', '10 km', 'Norge'),
('Stavanger Marathon', 'Stavanger', '2026-08-29', '42.195 km', 'Norge'),
('Berlin Marathon', 'Berlin', '2026-09-27', '42.195 km', 'Tyskland'),
('London Marathon', 'London', '2026-04-26', '42.195 km', 'England'),
('New York City Marathon', 'New York', '2026-11-01', '42.195 km', 'USA'),
('Chicago Marathon', 'Chicago', '2026-10-11', '42.195 km', 'USA'),
('Tokyo Marathon', 'Tokyo', '2027-03-06', '42.195 km', 'Japan'),
('Boston Marathon', 'Boston', '2026-04-20', '42.195 km', 'USA'),
('Copenhagen Marathon', 'København', '2026-05-10', '42.195 km', 'Danmark'),
('Stockholm Marathon', 'Stockholm', '2026-05-30', '42.195 km', 'Sverige'),
('Drammen 10K', 'Drammen', '2026-04-11', '10 km', 'Norge'),
('Kristinaløpet', 'Tønsberg', '2026-06-20', '10 km', 'Norge'),
('OBOS Fornebuløpet', 'Fornebu, Bærum', '2026-05-27', '10 km', 'Norge'),
('Trondheim Maraton', 'Trondheim', '2026-09-06', '42.195 km', 'Norge'),
('Larviksløpet', 'Stavern → Larvik', '2026-04-25', '7.75 km', 'Norge'),
('Jessheim Halvmaraton', 'Jessheim', '2026-05-31', '21.0975 km', 'Norge'),
('Perseløpet', 'Oslo', '2026-04-19', '42.195 km', 'Norge'),
('Drammen Halvmaraton', 'Drammen', '2026-09-05', '21.0975 km', 'Norge'),
('Fredrikstadløpet', 'Fredrikstad', '2026-04-12', '10 km', 'Norge'),
('Fredrikstad Maraton', 'Fredrikstad', '2026-10-11', '42.195 km', 'Norge'),
('Tordenskioldløpet', 'Stavern', '2026-05-05', '10 km', 'Norge'),
('Sandefjordsløpet', 'Sandefjord', '2026-05-23', '10 km', 'Norge'),
('Holmestrand Maraton', 'Holmestrand', '2026-04-11', '42.195 km', 'Norge'),
('Revetal Halvmaraton', 'Revetal', '2026-05-14', '21.0975 km', 'Norge'),
('EcoTrail Oslo', 'Oslo', '2026-05-30', '21 km / 80 km', 'Norge');
```
