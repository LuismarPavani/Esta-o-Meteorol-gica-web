-- Instalação nova. (Para um banco que já existe, use migration.sql.)
create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null default 'user' check (role in ('admin','user')),
  owm_key text,
  created_at timestamptz default now()
);

create table devices (
  id text primary key,
  name text not null default '',
  description text,
  ip text, rssi int,
  battery int, battery_voltage real, battery_active boolean,
  firmware text,
  city_id int, city_name text,
  last_temperature real, last_humidity real,
  last_seen timestamptz,
  created_at timestamptz default now()
);

create table user_devices (
  user_id uuid references users(id) on delete cascade,
  device_id text references devices(id) on delete cascade,
  primary key (user_id, device_id)
);

create table readings (
  id bigint generated always as identity primary key,
  device_id text not null references devices(id) on delete cascade,
  temperature real not null,
  humidity real not null,
  city_id int, city_name text,
  created_at timestamptz default now()
);
create index on readings (device_id, city_id, created_at desc);

create table device_cities (
  device_id text references devices(id) on delete cascade,
  city_id int,
  city_name text,
  last_seen timestamptz default now(),
  primary key (device_id, city_id)
);

alter table users enable row level security;
alter table devices enable row level security;
alter table user_devices enable row level security;
alter table readings enable row level security;
alter table device_cities enable row level security;
