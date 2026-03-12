import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ====== Card Types & Logic (inline to avoid import issues in edge functions) ======

type Suit = "hearts" | "diamonds" | "clubs" | "spades";
type Rank = "4" | "5" | "6" | "7" | "Q" | "J" | "K" | "A" | "2" | "3";

interface Card { suit: Suit; rank: Rank; }
interface TrickCard { player_id: string; seat: number; card: Card; }

const RANK_ORDER: Rank[] = ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"];
const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

function getCardStrength(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function determineTrickWinner(trick: TrickCard[], trumpSuit: Suit | null): TrickCard {
  const leadSuit = trick[0].card.suit;
  let winner = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const card = trick[i].card;
    const winnerCard = winner.card;
    const cardIsTrump = trumpSuit && card.suit === trumpSuit;
    const winnerIsTrump = trumpSuit && winnerCard.suit === trumpSuit;

    if (cardIsTrump && !winnerIsTrump) { winner = trick[i]; continue; }
    if (!cardIsTrump && winnerIsTrump) continue;
    if (cardIsTrump && winnerIsTrump) {
      if (getCardStrength(card.rank) > getCardStrength(winnerCard.rank)) winner = trick[i];
      continue;
    }
    if (card.suit === leadSuit && winnerCard.suit !== leadSuit) { winner = trick[i]; continue; }
    if (card.suit !== leadSuit) continue;
    if (getCardStrength(card.rank) > getCardStrength(winnerCard.rank)) winner = trick[i];
  }
  return winner;
}

function generateRoundSequence(numPlayers: number): number[] {
  const maxCards = Math.floor(40 / numPlayers);
  const seq: number[] = [];
  for (let i = maxCards; i >= 1; i--) seq.push(i);
  for (let i = 2; i <= maxCards; i++) seq.push(i);
  return seq;
}

function getNextSeat(seat: number, numPlayers: number): number {
  return (seat + 1) % numPlayers;
}

// ====== Bot AI ======

function botDecideBid(hand: Card[], trumpSuit: Suit | null, numCards: number, forbiddenBid?: number): number {
  let bid = 0;
  for (const card of hand) {
    const strength = getCardStrength(card.rank);
    const isTrump = trumpSuit && card.suit === trumpSuit;
    if (isTrump && strength >= 5) bid++;
    else if (strength >= 7) bid++;
  }
  bid = Math.min(bid, numCards);
  if (forbiddenBid !== undefined && bid === forbiddenBid) {
    bid = bid > 0 ? bid - 1 : bid + 1;
    bid = Math.max(0, Math.min(bid, numCards));
  }
  return bid;
}

function botDecidePlay(hand: Card[], currentTrick: TrickCard[], trumpSuit: Suit | null, tricksWon: number, bid: number): Card {
  let validCards = [...hand];
  if (currentTrick.length > 0) {
    const leadSuit = currentTrick[0].card.suit;
    const suitCards = hand.filter(c => c.suit === leadSuit);
    if (suitCards.length > 0) validCards = suitCards;
  }
  if (validCards.length === 1) return validCards[0];

  const needMore = tricksWon < bid;
  if (needMore) {
    // Play strongest
    return validCards.reduce((best, c) => {
      const bScore = getCardStrength(best.rank) + (trumpSuit && best.suit === trumpSuit ? 20 : 0);
      const cScore = getCardStrength(c.rank) + (trumpSuit && c.suit === trumpSuit ? 20 : 0);
      return cScore > bScore ? c : best;
    });
  } else {
    // Play weakest
    return validCards.reduce((best, c) => {
      const bScore = getCardStrength(best.rank) + (trumpSuit && best.suit === trumpSuit ? 20 : 0);
      const cScore = getCardStrength(c.rank) + (trumpSuit && c.suit === trumpSuit ? 20 : 0);
      return cScore < bScore ? c : best;
    });
  }
}

// ====== Main Handler ======

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { room_id, player_id, action } = await req.json();

    if (!room_id || !action) {
      return new Response(
        JSON.stringify({ error: "room_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load current state
    const { data: state, error: stateError } = await supabase
      .from("game_state")
      .select("*")
      .eq("room_id", room_id)
      .single();
    if (stateError || !state) throw new Error("Game state not found");

    const { data: players, error: playersError } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", room_id)
      .order("seat", { ascending: true });
    if (playersError) throw playersError;

    const { data: room } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", room_id)
      .single();

    const numPlayers = players.length;
    const playerIds = players.map((p: any) => p.player_id);
    const playerBySeat = Object.fromEntries(players.map((p: any) => [p.seat, p]));
    const seatByPlayerId = Object.fromEntries(players.map((p: any) => [p.player_id, p.seat]));

    let newState = { ...state };
    let response: any = { success: true };

    switch (action.type) {
      // ============ START GAME ============
      case "start_game": {
        if (numPlayers < 2) throw new Error("Mínimo 2 jogadores");
        if (state.phase !== "waiting") throw new Error("Jogo já iniciado");

        const roundSequence = generateRoundSequence(numPlayers);
        const numCards = roundSequence[0];
        const deck = shuffleDeck(createDeck());

        const hands: Record<string, any[]> = {};
        let idx = 0;
        for (const pid of playerIds) {
          hands[pid] = deck.slice(idx, idx + numCards);
          idx += numCards;
        }
        const trumpCard = idx < deck.length ? deck[idx] : null;

        const dealerSeat = 0;
        const firstBidder = getNextSeat(dealerSeat, numPlayers);

        newState = {
          ...newState,
          phase: "bidding",
          round_number: 1,
          round_num_cards: numCards,
          trump_card: trumpCard,
          trump_suit: trumpCard?.suit || null,
          dealer_seat: dealerSeat,
          hands,
          bids: {},
          current_trick: [],
          tricks_won: Object.fromEntries(playerIds.map((id: string) => [id, 0])),
          tricks_played: [],
          round_sequence: roundSequence,
          round_index: 0,
          current_player_seat: firstBidder,
          scores: Object.fromEntries(playerIds.map((id: string) => [id, 0])),
        };

        // Update room status
        await supabase.from("rooms").update({ status: "in_progress" }).eq("id", room_id);
        break;
      }

      // ============ PLACE BID ============
      case "place_bid": {
        if (state.phase !== "bidding") throw new Error("Não é fase de apostas");
        const currentPlayer = playerBySeat[state.current_player_seat];
        if (!currentPlayer || currentPlayer.player_id !== player_id) {
          throw new Error("Não é sua vez");
        }

        const bid = action.bid;
        const numCards = state.round_num_cards;

        // Validate bid
        if (bid < 0 || bid > numCards) throw new Error(`Aposta inválida (0-${numCards})`);

        // Dealer restriction
        const bids = { ...state.bids };
        const dealerPlayer = playerBySeat[state.dealer_seat];
        if (currentPlayer.player_id === dealerPlayer.player_id) {
          const totalBids = Object.values(bids).reduce((s: number, b: any) => s + (b as number), 0);
          if (totalBids + bid === numCards) {
            throw new Error(`Dealer não pode apostar ${bid} (soma = total de vazas)`);
          }
        }

        bids[player_id] = bid;
        newState.bids = bids;

        // Check if all bids placed
        if (Object.keys(bids).length === numPlayers) {
          // Move to playing phase; first player after dealer leads
          const firstPlayer = getNextSeat(state.dealer_seat, numPlayers);
          newState.phase = "playing";
          newState.current_player_seat = firstPlayer;
        } else {
          newState.current_player_seat = getNextSeat(state.current_player_seat, numPlayers);
        }
        break;
      }

      // ============ PLAY CARD ============
      case "play_card": {
        if (state.phase !== "playing") throw new Error("Não é fase de jogo");
        const currentPlayer = playerBySeat[state.current_player_seat];
        if (!currentPlayer || currentPlayer.player_id !== player_id) {
          throw new Error("Não é sua vez");
        }

        const card = action.card as Card;
        const hand: Card[] = state.hands[player_id] || [];

        // Validate card in hand
        const cardIdx = hand.findIndex((c: Card) => c.suit === card.suit && c.rank === card.rank);
        if (cardIdx === -1) throw new Error("Carta não está na sua mão");

        // Validate follow suit
        const trick: TrickCard[] = state.current_trick || [];
        if (trick.length > 0) {
          const leadSuit = trick[0].card.suit;
          const hasLeadSuit = hand.some((c: Card) => c.suit === leadSuit);
          if (hasLeadSuit && card.suit !== leadSuit) {
            throw new Error(`Deve seguir o naipe ${leadSuit}`);
          }
        }

        // Remove card from hand
        const newHand = [...hand];
        newHand.splice(cardIdx, 1);
        const newHands = { ...state.hands, [player_id]: newHand };

        // Add to trick
        const newTrick: TrickCard[] = [
          ...trick,
          { player_id, seat: currentPlayer.seat, card },
        ];

        newState.hands = newHands;

        // Check if trick is complete
        if (newTrick.length === numPlayers) {
          const winner = determineTrickWinner(newTrick, state.trump_suit);
          const tricksWon = { ...state.tricks_won };
          tricksWon[winner.player_id] = (tricksWon[winner.player_id] || 0) + 1;

          const tricksPlayed = [...(state.tricks_played || []), newTrick];

          newState.tricks_won = tricksWon;
          newState.tricks_played = tricksPlayed;
          newState.current_trick = [];

          // Check if round is over (no more cards)
          const anyHand = Object.values(newHands) as Card[][];
          const cardsRemaining = anyHand.some((h: Card[]) => h.length > 0);

          if (!cardsRemaining) {
            // Round over - calculate scores
            const bids = state.bids;
            const roundScores: Record<string, number> = {};
            const totalScores = { ...state.scores };

            for (const pid of playerIds) {
              const bidVal = bids[pid] ?? 0;
              const won = tricksWon[pid] ?? 0;
              roundScores[pid] = won === bidVal ? 10 + bidVal : 0;
              totalScores[pid] = (totalScores[pid] || 0) + roundScores[pid];
            }

            newState.scores = totalScores;
            newState.phase = "round_end";
            newState.current_player_seat = null;

            // Update player scores in DB
            for (const p of players) {
              await supabase
                .from("room_players")
                .update({ score: totalScores[p.player_id] || 0 })
                .eq("id", p.id);
            }

            response.round_scores = roundScores;
          } else {
            // Winner leads next trick
            newState.current_player_seat = winner.seat;
          }
        } else {
          newState.current_trick = newTrick;
          newState.current_player_seat = getNextSeat(state.current_player_seat, numPlayers);
        }
        break;
      }

      // ============ NEXT ROUND ============
      case "next_round": {
        if (state.phase !== "round_end") throw new Error("Rodada não terminou");

        const roundSeq: number[] = state.round_sequence;
        const nextIdx = state.round_index + 1;

        if (nextIdx >= roundSeq.length) {
          // Game over
          newState.phase = "game_over";
          await supabase.from("rooms").update({ status: "finished" }).eq("id", room_id);
          break;
        }

        const numCards = roundSeq[nextIdx];
        const newDealerSeat = getNextSeat(state.dealer_seat, numPlayers);
        const deck = shuffleDeck(createDeck());

        const hands: Record<string, Card[]> = {};
        let idx = 0;
        for (const pid of playerIds) {
          hands[pid] = deck.slice(idx, idx + numCards);
          idx += numCards;
        }
        const trumpCard = idx < deck.length ? deck[idx] : null;

        const firstBidder = getNextSeat(newDealerSeat, numPlayers);

        newState = {
          ...newState,
          phase: "bidding",
          round_number: state.round_number + 1,
          round_num_cards: numCards,
          trump_card: trumpCard,
          trump_suit: trumpCard?.suit || null,
          dealer_seat: newDealerSeat,
          hands,
          bids: {},
          current_trick: [],
          tricks_won: Object.fromEntries(playerIds.map((id: string) => [id, 0])),
          tricks_played: [],
          round_index: nextIdx,
          current_player_seat: firstBidder,
        };
        break;
      }

      // ============ ADD BOT ============
      case "add_bot": {
        if (state.phase !== "waiting") throw new Error("Jogo já iniciado");
        if (numPlayers >= (room?.max_players || 4)) throw new Error("Sala cheia");

        const botName = action.bot_name || `Bot ${numPlayers}`;
        const botId = `bot_${crypto.randomUUID().slice(0, 8)}`;

        const takenSeats = new Set(players.map((p: any) => p.seat));
        let nextSeat = 0;
        while (takenSeats.has(nextSeat)) nextSeat++;

        await supabase.from("room_players").insert({
          room_id,
          player_id: botId,
          name: botName,
          is_bot: true,
          seat: nextSeat,
        });

        response.bot_id = botId;
        response.bot_name = botName;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action.type}`);
    }

    // Save state
    await supabase
      .from("game_state")
      .update(newState)
      .eq("room_id", room_id);

    // ====== Process bot turns automatically ======
    if (newState.phase === "bidding" || newState.phase === "playing") {
      await processBotTurns(supabase, room_id, newState, players);
    }

    // Reload final state to return
    const { data: finalState } = await supabase
      .from("game_state")
      .select("*")
      .eq("room_id", room_id)
      .single();

    response.state = finalState;

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ====== Bot Turn Processing ======

async function processBotTurns(supabase: any, roomId: string, state: any, players: any[]) {
  const numPlayers = players.length;
  const playerIds = players.map((p: any) => p.player_id);
  const playerBySeat = Object.fromEntries(players.map((p: any) => [p.seat, p]));

  let currentState = { ...state };
  let maxIterations = numPlayers * 2; // Safety limit

  while (maxIterations-- > 0) {
    const currentPlayer = playerBySeat[currentState.current_player_seat];
    if (!currentPlayer || !currentPlayer.is_bot) break;
    if (currentState.phase !== "bidding" && currentState.phase !== "playing") break;

    // Small delay to simulate thinking
    await new Promise((r) => setTimeout(r, 500));

    if (currentState.phase === "bidding") {
      const hand: Card[] = currentState.hands[currentPlayer.player_id] || [];
      const numCards = currentState.round_num_cards;
      const bids = { ...currentState.bids };

      // Check if dealer restriction applies
      let forbiddenBid: number | undefined;
      const dealerPlayer = playerBySeat[currentState.dealer_seat];
      if (currentPlayer.player_id === dealerPlayer.player_id) {
        const totalBids = Object.values(bids).reduce((s: number, b: any) => s + (b as number), 0);
        forbiddenBid = numCards - totalBids;
        if (forbiddenBid < 0 || forbiddenBid > numCards) forbiddenBid = undefined;
      }

      const bid = botDecideBid(hand, currentState.trump_suit, numCards, forbiddenBid);
      bids[currentPlayer.player_id] = bid;
      currentState.bids = bids;

      if (Object.keys(bids).length === numPlayers) {
        currentState.phase = "playing";
        currentState.current_player_seat = getNextSeat(currentState.dealer_seat, numPlayers);
      } else {
        currentState.current_player_seat = getNextSeat(currentState.current_player_seat, numPlayers);
      }
    } else if (currentState.phase === "playing") {
      const hand: Card[] = currentState.hands[currentPlayer.player_id] || [];
      const trick: TrickCard[] = currentState.current_trick || [];
      const tricksWon = currentState.tricks_won[currentPlayer.player_id] || 0;
      const bid = currentState.bids[currentPlayer.player_id] || 0;

      const card = botDecidePlay(hand, trick, currentState.trump_suit, tricksWon, bid);

      // Remove from hand
      const cardIdx = hand.findIndex((c: Card) => c.suit === card.suit && c.rank === card.rank);
      const newHand = [...hand];
      newHand.splice(cardIdx, 1);
      currentState.hands[currentPlayer.player_id] = newHand;

      const newTrick: TrickCard[] = [
        ...trick,
        { player_id: currentPlayer.player_id, seat: currentPlayer.seat, card },
      ];

      if (newTrick.length === numPlayers) {
        const winner = determineTrickWinner(newTrick, currentState.trump_suit);
        currentState.tricks_won[winner.player_id] = (currentState.tricks_won[winner.player_id] || 0) + 1;
        currentState.tricks_played = [...(currentState.tricks_played || []), newTrick];
        currentState.current_trick = [];

        const anyHand = Object.values(currentState.hands) as Card[][];
        const cardsRemaining = anyHand.some((h: Card[]) => h.length > 0);

        if (!cardsRemaining) {
          // Round over
          const totalScores = { ...currentState.scores };
          for (const pid of playerIds) {
            const bidVal = currentState.bids[pid] ?? 0;
            const won = currentState.tricks_won[pid] ?? 0;
            totalScores[pid] = (totalScores[pid] || 0) + (won === bidVal ? 10 + bidVal : 0);
          }
          currentState.scores = totalScores;
          currentState.phase = "round_end";
          currentState.current_player_seat = null;

          for (const p of players) {
            await supabase
              .from("room_players")
              .update({ score: totalScores[p.player_id] || 0 })
              .eq("id", p.id);
          }
          break;
        } else {
          currentState.current_player_seat = winner.seat;
        }
      } else {
        currentState.current_trick = newTrick;
        currentState.current_player_seat = getNextSeat(currentState.current_player_seat, numPlayers);
      }
    }

    // Save intermediate state
    await supabase
      .from("game_state")
      .update(currentState)
      .eq("room_id", roomId);
  }
}
