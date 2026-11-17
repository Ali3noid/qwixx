-- The SvelteKit server reads rooms through the Supabase service role. RLS bypass
-- does not replace PostgreSQL table privileges, so grant the required reads.
grant select on table public.rooms, public.room_participants, public.room_games to service_role;
