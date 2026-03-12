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

    const { room_id, player_id } = await req.json();

    if (!room_id || !player_id) {
      return new Response(
        JSON.stringify({ error: "room_id and player_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get game state
    const { data: state, error: stateError } = await supabase
      .from("game_state")
      .select("*")
      .eq("room_id", room_id)
      .single();

    if (stateError || !state) {
      return new Response(
        JSON.stringify({ error: "Game state not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get players
    const { data: players } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", room_id)
      .order("seat", { ascending: true });

    // Build public state (filter hands - only show requesting player's hand)
    const myHand = state.hands?.[player_id] || [];

    const publicState = {
      room_id: state.room_id,
      phase: state.phase,
      current_player_seat: state.current_player_seat,
      round_number: state.round_number,
      round_num_cards: state.round_num_cards,
      trump_card: state.trump_card,
      trump_suit: state.trump_suit,
      dealer_seat: state.dealer_seat,
      bids: state.bids,
      current_trick: state.current_trick,
      tricks_won: state.tricks_won,
      tricks_played: state.tricks_played,
      scores: state.scores,
      round_sequence: state.round_sequence,
      round_index: state.round_index,
      my_hand: myHand,
      player_count: players?.length || 0,
    };

    return new Response(
      JSON.stringify({ state: publicState, players }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
