
CREATE TABLE public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  player_name text NOT NULL,
  message text NOT NULL,
  is_reaction boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view messages" ON public.room_messages FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can send messages" ON public.room_messages FOR INSERT TO public WITH CHECK (true);

CREATE INDEX idx_room_messages_room_id ON public.room_messages(room_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
