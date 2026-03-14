import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ====== Card Types & Logic ======

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

// ====== Enhanced Bot AI with Bluffing & Strategy ======

type BotPersonality = "aggressive" | "conservative" | "tricky";

function getBotPersonality(botId: string): BotPersonality {
  const hash = botId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const types: BotPersonality[] = ["aggressive", "conservative", "tricky"];
  return types[hash % 3];
}

function getBluffChance(personality: BotPersonality): number {
  switch (personality) {
    case "aggressive": return 0.35;
    case "conservative": return 0.10;
    case "tricky": return 0.50;
  }
}

function getCurrentWinnerStrength(trick: TrickCard[], trumpSuit: Suit | null): number {
  if (trick.length === 0) return -1;
  const leadSuit = trick[0].card.suit;
  let bestStrength = -1;
  for (const tc of trick) {
    const isTrump = trumpSuit && tc.card.suit === trumpSuit;
    const isLead = tc.card.suit === leadSuit;
    const strength = getCardStrength(tc.card.rank);
    let effective = -1;
    if (isTrump) effective = strength + 20;
    else if (isLead) effective = strength;
    if (effective > bestStrength) bestStrength = effective;
  }
  return bestStrength;
}

function wouldCardWin(card: Card, trick: TrickCard[], trumpSuit: Suit | null): boolean {
  if (trick.length === 0) return true;
  const leadSuit = trick[0].card.suit;
  const cardIsTrump = trumpSuit && card.suit === trumpSuit;
  const cardStrength = getCardStrength(card.rank);
  let cardEffective = -1;
  if (cardIsTrump) cardEffective = cardStrength + 20;
  else if (card.suit === leadSuit) cardEffective = cardStrength;
  return cardEffective > getCurrentWinnerStrength(trick, trumpSuit);
}

function botDecideBid(
  hand: Card[],
  trumpSuit: Suit | null,
  numCards: number,
  forbiddenBid?: number,
  botId?: string,
  otherBids?: Record<string, number>
): number {
  const personality = getBotPersonality(botId || "default");
  const bluffChance = getBluffChance(personality);

  // Base bid: count strong cards
  let baseBid = 0;
  let trumpCount = 0;

  for (const card of hand) {
    const strength = getCardStrength(card.rank);
    const isTrump = trumpSuit && card.suit === trumpSuit;
    if (isTrump) {
      trumpCount++;
      if (strength >= 4) baseBid++; // Trump K+
    } else if (strength >= 7) {
      baseBid++; // A, 2, 3
    } else if (strength >= 6 && Math.random() > 0.5) {
      baseBid++; // K sometimes
    }
  }
  baseBid = Math.min(baseBid, numCards);

  // Bluffing logic
  let bid = baseBid;
  const isBluffing = Math.random() < bluffChance;

  if (isBluffing) {
    if (personality === "aggressive") {
      bid = Math.min(baseBid + (Math.random() > 0.5 ? 2 : 1), numCards);
    } else if (personality === "tricky") {
      if (Math.random() > 0.5 && baseBid > 0) {
        bid = Math.max(0, baseBid - 1);
      } else {
        bid = Math.min(baseBid + 1, numCards);
      }
    } else {
      bid = Math.max(0, baseBid - 1);
    }
  }

  // Adapt based on other players' bids
  if (otherBids && Object.keys(otherBids).length > 0) {
    const totalOtherBids = Object.values(otherBids).reduce((s, b) => s + b, 0);
    if (totalOtherBids > numCards * 0.7 && personality !== "aggressive") {
      bid = Math.max(0, bid - 1);
    }
    if (totalOtherBids < numCards * 0.3 && personality !== "conservative") {
      bid = Math.min(bid + 1, numCards);
    }
  }

  bid = Math.max(0, Math.min(bid, numCards));

  // Dealer restriction
  if (forbiddenBid !== undefined && bid === forbiddenBid) {
    if (personality === "aggressive" && bid < numCards) {
      bid = bid + 1;
    } else if (bid > 0) {
      bid = bid - 1;
    } else {
      bid = bid + 1;
    }
    bid = Math.max(0, Math.min(bid, numCards));
  }

  return bid;
}

function botDecidePlay(
  hand: Card[],
  currentTrick: TrickCard[],
  trumpSuit: Suit | null,
  tricksWon: number,
  bid: number,
  botId?: string
): Card {
  const personality = getBotPersonality(botId || "default");

  let validCards = [...hand];
  if (currentTrick.length > 0) {
    const leadSuit = currentTrick[0].card.suit;
    const suitCards = hand.filter(c => c.suit === leadSuit);
    if (suitCards.length > 0) validCards = suitCards;
  }
  if (validCards.length === 1) return validCards[0];

  const needMore = tricksWon < bid;
  const exactlyMet = tricksWon === bid;
  const isLeading = currentTrick.length === 0;

  const scored = validCards.map(card => {
    let score = 0;
    const strength = getCardStrength(card.rank);
    const isTrump = trumpSuit && card.suit === trumpSuit;

    if (needMore) {
      if (isLeading) {
        if (isTrump) {
          score = strength + 10;
          if (personality === "aggressive") score += 5;
          if (hand.length > 2 && personality !== "aggressive") score -= 8;
        } else {
          score = strength;
        }
      } else {
        const wins = wouldCardWin(card, currentTrick, trumpSuit);
        if (wins) {
          score = 20 + strength;
          if (personality === "conservative") score = 20 - strength; // minimum winning card
        } else {
          score = -strength;
          if (isTrump) score -= 20;
        }
      }
    } else if (exactlyMet) {
      // Need to LOSE remaining tricks
      if (isLeading) {
        score = -strength;
        if (isTrump) score -= 20;
      } else {
        const wins = wouldCardWin(card, currentTrick, trumpSuit);
        if (!wins) {
          score = 10 - strength;
        } else {
          score = -20;
        }
      }
    } else {
      // Over bid, dump everything
      score = -strength;
      if (isTrump) score -= 20;
    }

    // Unpredictability factor
    score += Math.random() * 2;
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].card;
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

        if (bid < 0 || bid > numCards) throw new Error(`Aposta inválida (0-${numCards})`);

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

        if (Object.keys(bids).length === numPlayers) {
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

        const cardIdx = hand.findIndex((c: Card) => c.suit === card.suit && c.rank === card.rank);
        if (cardIdx === -1) throw new Error("Carta não está na sua mão");

        const trick: TrickCard[] = state.current_trick || [];
        if (trick.length > 0) {
          const leadSuit = trick[0].card.suit;
          const hasLeadSuit = hand.some((c: Card) => c.suit === leadSuit);
          if (hasLeadSuit && card.suit !== leadSuit) {
            throw new Error(`Deve seguir o naipe ${leadSuit}`);
          }
        }

        const newHand = [...hand];
        newHand.splice(cardIdx, 1);
        const newHands = { ...state.hands, [player_id]: newHand };

        const newTrick: TrickCard[] = [
          ...trick,
          { player_id, seat: currentPlayer.seat, card },
        ];

        newState.hands = newHands;

        if (newTrick.length === numPlayers) {
          const winner = determineTrickWinner(newTrick, state.trump_suit);
          const tricksWon = { ...state.tricks_won };
          tricksWon[winner.player_id] = (tricksWon[winner.player_id] || 0) + 1;

          newState.tricks_won = tricksWon;
          // Keep the completed trick visible, set phase to trick_end
          newState.current_trick = newTrick;
          newState.phase = "trick_end";
          // Use current_player_seat to indicate the winner's seat
          newState.current_player_seat = winner.seat;

          response.trick_winner = winner.player_id;
        } else {
          newState.current_trick = newTrick;
          newState.current_player_seat = getNextSeat(state.current_player_seat, numPlayers);
        }
        break;
      }

      // ============ NEXT TRICK (resolve trick_end) ============
      case "next_trick": {
        if (state.phase !== "trick_end") throw new Error("Não é fase de fim de vaza");

        const trickWinnerSeat = state.current_player_seat;
        const completedTrick = state.current_trick || [];
        const tricksPlayed = [...(state.tricks_played || []), completedTrick];

        newState.tricks_played = tricksPlayed;
        newState.current_trick = [];

        const anyHand = Object.values(state.hands) as Card[][];
        const cardsRemaining = anyHand.some((h: Card[]) => h.length > 0);

        if (!cardsRemaining) {
          const bids = state.bids;
          const tricksWon = state.tricks_won;
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

          for (const p of players) {
            await supabase
              .from("room_players")
              .update({ score: totalScores[p.player_id] || 0 })
              .eq("id", p.id);
          }

          response.round_scores = roundScores;
        } else {
          newState.phase = "playing";
          newState.current_player_seat = trickWinnerSeat;
        }
        break;
      }

      // ============ NEXT ROUND ============
      case "next_round": {
        if (state.phase !== "round_end") throw new Error("Rodada não terminou");

        const roundSeq: number[] = state.round_sequence;
        const nextIdx = state.round_index + 1;

        if (nextIdx >= roundSeq.length) {
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
    if (newState.phase === "bidding" || newState.phase === "playing" || newState.phase === "trick_end") {
      await processBotTurns(supabase, room_id, newState, players);
    }

    // Reload final state
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
  // Allow enough iterations for all bots to play all their cards + bids
  const maxCards = currentState.round_num_cards || 1;
  let maxIterations = numPlayers * (maxCards + 1) + 2;
  const startTime = Date.now();

  while (maxIterations-- > 0) {
    // Safety timeout: 25 seconds max for bot processing
    if (Date.now() - startTime > 25000) break;

    // Handle trick_end: if all remaining players are bots, auto-advance
    if (currentState.phase === "trick_end") {
      // Check if any human player exists
      const hasHuman = players.some((p: any) => !p.is_bot);
      if (hasHuman) break; // Let the human's frontend handle trick_end display

      // All bots: save state so realtime fires, wait, then resolve
      await supabase
        .from("game_state")
        .update(currentState)
        .eq("room_id", roomId);

      await new Promise((r) => setTimeout(r, 500));

      // Resolve trick_end (same logic as next_trick action)
      const trickWinnerSeat = currentState.current_player_seat;
      const completedTrick = currentState.current_trick || [];
      currentState.tricks_played = [...(currentState.tricks_played || []), completedTrick];
      currentState.current_trick = [];

      const anyHand = Object.values(currentState.hands) as Card[][];
      const cardsRemaining = anyHand.some((h: Card[]) => h.length > 0);

      if (!cardsRemaining) {
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
        currentState.phase = "playing";
        currentState.current_player_seat = trickWinnerSeat;
      }

      await supabase.from("game_state").update(currentState).eq("room_id", roomId);
      continue;
    }

    const currentPlayer = playerBySeat[currentState.current_player_seat];
    if (!currentPlayer || !currentPlayer.is_bot) break;
    if (currentState.phase !== "bidding" && currentState.phase !== "playing") break;

    // Simulate thinking time (faster to avoid timeouts)
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 400));

    if (currentState.phase === "bidding") {
      const hand: Card[] = currentState.hands[currentPlayer.player_id] || [];
      const numCards = currentState.round_num_cards;
      const bids = { ...currentState.bids };

      let forbiddenBid: number | undefined;
      const dealerPlayer = playerBySeat[currentState.dealer_seat];
      if (currentPlayer.player_id === dealerPlayer.player_id) {
        const totalBids = Object.values(bids).reduce((s: number, b: any) => s + (b as number), 0);
        forbiddenBid = numCards - totalBids;
        if (forbiddenBid < 0 || forbiddenBid > numCards) forbiddenBid = undefined;
      }

      const bid = botDecideBid(
        hand,
        currentState.trump_suit,
        numCards,
        forbiddenBid,
        currentPlayer.player_id,
        bids
      );
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

      const card = botDecidePlay(
        hand,
        trick,
        currentState.trump_suit,
        tricksWon,
        bid,
        currentPlayer.player_id
      );

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
        // Keep trick visible, set trick_end
        currentState.current_trick = newTrick;
        currentState.phase = "trick_end";
        currentState.current_player_seat = winner.seat;
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
