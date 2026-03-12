
-- Enum for game phase
CREATE TYPE public.game_phase AS ENUM (
  'waiting', 'dealing', 'bidding', 'playing', 'trick_end', 'round_end', 'game_over'
);

-- Enum for room status
CREATE TYPE public.room_status AS ENUM ('waiting', 'in_progress', 'finished');

-- Enum for card suit
CREATE TYPE public.card_suit AS ENUM ('hearts', 'diamonds', 'clubs', 'spades');

-- Rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id TEXT NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 6),
  status public.room_status NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Room players table
CREATE TABLE public.room_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  seat INTEGER NOT NULL CHECK (seat >= 0 AND seat <= 5),
  score INTEGER NOT NULL DEFAULT 0,
  connected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (room_id, seat),
  UNIQUE (room_id, player_id)
);

-- Game state table (JSONB for flexible game state)
CREATE TABLE public.game_state (
  room_id UUID NOT NULL PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  phase public.game_phase NOT NULL DEFAULT 'waiting',
  current_player_seat INTEGER,
  round_number INTEGER NOT NULL DEFAULT 0,
  round_num_cards INTEGER,
  trump_card JSONB,
  trump_suit public.card_suit,
  dealer_seat INTEGER NOT NULL DEFAULT 0,
  hands JSONB NOT NULL DEFAULT '{}'::jsonb,
  bids JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_trick JSONB NOT NULL DEFAULT '[]'::jsonb,
  tricks_won JSONB NOT NULL DEFAULT '{}'::jsonb,
  tricks_played JSONB NOT NULL DEFAULT '[]'::jsonb,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  round_sequence JSONB NOT NULL DEFAULT '[]'::jsonb,
  round_index INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;

-- Rooms policies
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Host can update room" ON public.rooms FOR UPDATE USING (true);

-- Room players policies
CREATE POLICY "Anyone can view players" ON public.room_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join" ON public.room_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON public.room_players FOR UPDATE USING (true);
CREATE POLICY "Anyone can leave" ON public.room_players FOR DELETE USING (true);

-- Game state policies
CREATE POLICY "Anyone can view game state" ON public.game_state FOR SELECT USING (true);
CREATE POLICY "Anyone can insert game state" ON public.game_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game state" ON public.game_state FOR UPDATE USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_state_updated_at
  BEFORE UPDATE ON public.game_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
