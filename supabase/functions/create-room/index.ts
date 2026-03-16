import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { host_id, host_name, max_players, game_mode } = await req.json();

    if (!host_id || !host_name) {
      return new Response(
        JSON.stringify({ error: "host_id and host_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const code = generateRoomCode();

    // Create room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code,
        host_id,
        max_players: max_players || 4,
        status: "waiting",
        game_mode: game_mode || "classic",
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Add host as first player (seat 0)
    const { error: playerError } = await supabase.from("room_players").insert({
      room_id: room.id,
      player_id: host_id,
      name: host_name,
      is_bot: false,
      seat: 0,
    });

    if (playerError) throw playerError;

    // Create initial game state
    const { error: stateError } = await supabase.from("game_state").insert({
      room_id: room.id,
      phase: "waiting",
      dealer_seat: 0,
    });

    if (stateError) throw stateError;

    return new Response(
      JSON.stringify({ room }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
