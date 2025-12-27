create table if not exists games (
  id text primary key,
  state text not null,
  round integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists players (
  id text primary key,
  game_id text not null references games(id) on delete cascade,
  name text not null,
  name_key text not null,
  role text not null default '',
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists players_game_name_key_idx
  on players (game_id, name_key);

create unique index if not exists players_game_token_idx
  on players (game_id, token);

create table if not exists events (
  id text primary key,
  game_id text not null references games(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists events_game_created_idx
  on events (game_id, created_at);
