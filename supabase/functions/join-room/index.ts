import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { room_code, player_id, player_name } = await req.json();

    if (!room_code || !player_id || !player_name) {
      return new Response(
        JSON.stringify({ error: "room_code, player_id and player_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", room_code.toUpperCase())
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ error: "Sala não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (room.status !== "waiting") {
      return new Response(
        JSON.stringify({ error: "Jogo já em andamento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check current players
    const { data: players, error: playersError } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", room.id)
      .order("seat", { ascending: true });

    if (playersError) throw playersError;

    if (players.length >= room.max_players) {
      return new Response(
        JSON.stringify({ error: "Sala cheia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if player already in room
    const existing = players.find((p: any) => p.player_id === player_id);
    if (existing) {
      // Reconnect
      await supabase
        .from("room_players")
        .update({ connected: true })
        .eq("id", existing.id);

      return new Response(
        JSON.stringify({ room, player: existing, players }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find next available seat
    const takenSeats = new Set(players.map((p: any) => p.seat));
    let nextSeat = 0;
    while (takenSeats.has(nextSeat)) nextSeat++;

    // Add player
    const { data: newPlayer, error: insertError } = await supabase
      .from("room_players")
      .insert({
        room_id: room.id,
        player_id,
        name: player_name,
        is_bot: false,
        seat: nextSeat,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ room, player: newPlayer, players: [...players, newPlayer] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
