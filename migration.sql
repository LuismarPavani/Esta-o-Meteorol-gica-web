-- Rode no Supabase > SQL Editor. Mantém os dados que já existem.

create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null default 'user' check (role in ('admin','user')),
  owm_key text,                              -- chave da OpenWeatherMap deste usuário
  created_at timestamptz default now()
);

-- Quais dispositivos cada usuário normal pode ver (admin vê todos)
create table user_devices (
  user_id uuid references users(id) on delete cascade,
  device_id text references devices(id) on delete cascade,
  primary key (user_id, device_id)
);

alter table devices
  add column city_id int,
  add column city_name text;

alter table readings
  add column city_id int,
  add column city_name text;

-- Cidades já usadas por cada ESP (alimenta o seletor de cidade do painel)
create table device_cities (
  device_id text references devices(id) on delete cascade,
  city_id int,
  city_name text,
  last_seen timestamptz default now(),
  primary key (device_id, city_id)
);

create index on readings (device_id, city_id, created_at desc);

alter table users enable row level security;
alter table user_devices enable row level security;
alter table device_cities enable row level security;

-- Opcional: leituras antigas (sem cidade) passam a pertencer a Franca
-- update readings set city_id = 3463011, city_name = 'Franca' where city_id is null;
-- update devices set city_id = 3463011, city_name = 'Franca' where city_id is null;
-- insert into device_cities (device_id, city_id, city_name)
--   select id, 3463011, 'Franca' from devices on conflict do nothing;
