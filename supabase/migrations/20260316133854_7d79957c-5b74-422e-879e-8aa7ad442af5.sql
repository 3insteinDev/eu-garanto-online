
CREATE TYPE public.game_mode AS ENUM ('classic', 'manilha');

ALTER TABLE public.rooms ADD COLUMN game_mode public.game_mode NOT NULL DEFAULT 'classic';
