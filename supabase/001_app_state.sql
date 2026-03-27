create table if not exists app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function set_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_state_updated_at on app_state;

create trigger app_state_updated_at
before update on app_state
for each row
execute function set_app_state_updated_at();
