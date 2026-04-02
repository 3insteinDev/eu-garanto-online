
ALTER TABLE public.rooms ALTER COLUMN max_players SET DEFAULT 4;

ALTER TABLE public.game_state ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.game_state ADD COLUMN IF NOT EXISTS pauses_used jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.game_state ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{"turn_timer": 15, "max_pauses": 2, "pause_duration": 30}'::jsonb;
