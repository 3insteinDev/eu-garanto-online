import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ====== Card Types & Logic ======

type Suit = "hearts" | "diamonds" | "clubs" | "spades";
type Rank = "4" | "5" | "6" | "7" | "Q" | "J" | "K" | "A" | "2" | "3";
type GameMode = "classic" | "manilha";

interface Card { suit: Suit; rank: Rank; }
interface TrickCard { player_id: string; seat: number; card: Card; }

const RANK_ORDER: Rank[] = ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"];
const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
// Manilha suit order: diamonds < spades < hearts < clubs (zap)
const MANILHA_SUIT_ORDER: Suit[] = ["diamonds", "spades", "hearts", "clubs"];

function getCardStrength(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

function getManilhaRank(trumpCard: Card | null): Rank | null {
  if (!trumpCard) return null;
  const idx = RANK_ORDER.indexOf(trumpCard.rank);
  // Next rank (wraps around)
  return RANK_ORDER[(idx + 1) % RANK_ORDER.length];
}

function isManilha(card: Card, manilhaRank: Rank | null): boolean {
  return manilhaRank !== null && card.rank === manilhaRank;
}

function getManilhaSuitStrength(suit: Suit): number {
  return MANILHA_SUIT_ORDER.indexOf(suit);
}

function getEffectiveStrength(
  card: Card,
  trumpSuit: Suit | null,
  leadSuit: Suit,
  gameMode: GameMode,
  manilhaRank: Rank | null
): number {
  if (gameMode === "manilha" && isManilha(card, manilhaRank)) {
    // Manilhas are the strongest: 100 + suit order
    return 100 + getManilhaSuitStrength(card.suit);
  }

  if (gameMode === "manilha") {
    // In manilha mode: no suit restriction, pure rank strength
    return getCardStrength(card.rank);
  }
  
  // Classic mode: trump > lead suit > off-suit
  const isTrump = trumpSuit && card.suit === trumpSuit;
  const isLead = card.suit === leadSuit;
  const strength = getCardStrength(card.rank);
  
  if (isTrump) return strength + 20;
  if (isLead) return strength;
  return -1; // Can't win
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

function determineTrickWinner(
  trick: TrickCard[],
  trumpSuit: Suit | null,
  gameMode: GameMode = "classic",
  trumpCard: Card | null = null
): TrickCard | null {
  const leadSuit = trick[0].card.suit;
  const manilhaRank = gameMode === "manilha" ? getManilhaRank(trumpCard) : null;
  let winner = trick[0];
  let bestStrength = getEffectiveStrength(winner.card, trumpSuit, leadSuit, gameMode, manilhaRank);
  let tied = false;

  for (let i = 1; i < trick.length; i++) {
    const str = getEffectiveStrength(trick[i].card, trumpSuit, leadSuit, gameMode, manilhaRank);
    if (str > bestStrength) {
      bestStrength = str;
      winner = trick[i];
      tied = false;
    } else if (str === bestStrength) {
      tied = true;
    }
  }

  // In manilha mode, ties between non-manilha cards = melada (draw)
  // Manilha ties can't happen (unique suits), but non-manilha same rank = melada
  if (gameMode === "manilha" && tied && bestStrength < 100) {
    return null; // melada
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

function wouldCardWin(
  card: Card,
  trick: TrickCard[],
  trumpSuit: Suit | null,
  gameMode: GameMode = "classic",
  trumpCard: Card | null = null
): boolean {
  if (trick.length === 0) return true;
  const leadSuit = trick[0].card.suit;
  const manilhaRank = gameMode === "manilha" ? getManilhaRank(trumpCard) : null;
  const cardStr = getEffectiveStrength(card, trumpSuit, leadSuit, gameMode, manilhaRank);
  
  let bestStr = -1;
  for (const tc of trick) {
    const s = getEffectiveStrength(tc.card, trumpSuit, leadSuit, gameMode, manilhaRank);
    if (s > bestStr) bestStr = s;
  }
  return cardStr > bestStr;
}

function botDecideBid(
  hand: Card[],
  trumpSuit: Suit | null,
  numCards: number,
  forbiddenBid?: number,
  botId?: string,
  otherBids?: Record<string, number>,
  gameMode: GameMode = "classic",
  trumpCard: Card | null = null
): number {
  const personality = getBotPersonality(botId || "default");
  const bluffChance = getBluffChance(personality);
  const manilhaRank = gameMode === "manilha" ? getManilhaRank(trumpCard) : null;

  let baseBid = 0;
  for (const card of hand) {
    if (gameMode === "manilha" && isManilha(card, manilhaRank)) {
      baseBid++; // Manilhas are almost guaranteed wins
      continue;
    }
    const strength = getCardStrength(card.rank);
    const isTrump = trumpSuit && card.suit === trumpSuit;
    if (isTrump && strength >= 4) baseBid++;
    else if (strength >= 7) baseBid++;
    else if (strength >= 6 && Math.random() > 0.5) baseBid++;
  }
  baseBid = Math.min(baseBid, numCards);

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

  if (forbiddenBid !== undefined && bid === forbiddenBid) {
    if (personality === "aggressive" && bid < numCards) bid++;
    else if (bid > 0) bid--;
    else bid++;
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
  botId?: string,
  gameMode: GameMode = "classic",
  trumpCard: Card | null = null
): Card {
  const personality = getBotPersonality(botId || "default");
  const manilhaRank = gameMode === "manilha" ? getManilhaRank(trumpCard) : null;

  let validCards = [...hand];
  // In manilha mode: free play, all cards valid
  if (gameMode !== "manilha" && currentTrick.length > 0) {
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
    const isManilhaCard = gameMode === "manilha" && isManilha(card, manilhaRank);

    if (needMore) {
      if (isLeading) {
        if (isManilhaCard) {
          score = 50 + getManilhaSuitStrength(card.suit);
          if (hand.length > 2 && personality !== "aggressive") score -= 30; // save for later
        } else if (isTrump) {
          score = strength + 10 + (personality === "aggressive" ? 5 : -8);
        } else {
          score = strength;
        }
      } else {
        const wins = wouldCardWin(card, currentTrick, trumpSuit, gameMode, trumpCard);
        if (wins) {
          score = 20 + (personality === "conservative" ? -strength : strength);
          if (isManilhaCard && personality !== "aggressive") score -= 10; // prefer weaker winning card
        } else {
          score = -strength - (isTrump ? 20 : 0) - (isManilhaCard ? 50 : 0);
        }
      }
    } else if (exactlyMet) {
      if (isLeading) {
        score = -strength - (isTrump ? 20 : 0) - (isManilhaCard ? 50 : 0);
      } else {
        const wins = wouldCardWin(card, currentTrick, trumpSuit, gameMode, trumpCard);
        score = wins ? -20 : 10 - strength;
      }
    } else {
      score = -strength - (isTrump ? 20 : 0) - (isManilhaCard ? 50 : 0);
    }

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

    // Load current state with optimistic locking via updated_at
    const { data: state, error: stateError } = await supabase
      .from("game_state")
      .select("*")
      .eq("room_id", room_id)
      .single();
    if (stateError || !state) throw new Error("Game state not found");

    const stateUpdatedAt = state.updated_at;

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

    const gameMode: GameMode = (room?.game_mode as GameMode) || "classic";
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
        // In manilha mode: free play (no suit-following required)
        if (gameMode !== "manilha" && trick.length > 0) {
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
          const winner = determineTrickWinner(newTrick, state.trump_suit, gameMode, state.trump_card);
          const tricksWon = { ...state.tricks_won };
          tricksWon[winner.player_id] = (tricksWon[winner.player_id] || 0) + 1;

          newState.tricks_won = tricksWon;
          newState.current_trick = newTrick;
          newState.phase = "trick_end";
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

    // Save state with optimistic locking
    const { error: updateError } = await supabase
      .from("game_state")
      .update(newState)
      .eq("room_id", room_id)
      .eq("updated_at", stateUpdatedAt);

    if (updateError) {
      // Retry once with fresh state for non-critical actions
      if (action.type === "next_trick" || action.type === "next_round") {
        return new Response(
          JSON.stringify({ success: true, retried: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Estado desatualizado, tente novamente");
    }

    // ====== Process bot turns automatically ======
    if (newState.phase === "bidding" || newState.phase === "playing" || newState.phase === "trick_end") {
      await processBotTurns(supabase, room_id, newState, players, gameMode);
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

async function processBotTurns(supabase: any, roomId: string, state: any, players: any[], gameMode: GameMode) {
  const numPlayers = players.length;
  const playerIds = players.map((p: any) => p.player_id);
  const playerBySeat = Object.fromEntries(players.map((p: any) => [p.seat, p]));

  let currentState = { ...state };
  const maxCards = currentState.round_num_cards || 1;
  let maxIterations = numPlayers * (maxCards + 1) + 2;
  const startTime = Date.now();

  while (maxIterations-- > 0) {
    if (Date.now() - startTime > 20000) break;

    // Handle trick_end
    if (currentState.phase === "trick_end") {
      const hasHuman = players.some((p: any) => !p.is_bot);
      if (hasHuman) break;

      await supabase.from("game_state").update(currentState).eq("room_id", roomId);
      await new Promise((r) => setTimeout(r, 300));

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

    // Faster bot thinking
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));

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
        hand, currentState.trump_suit, numCards, forbiddenBid,
        currentPlayer.player_id, bids, gameMode, currentState.trump_card
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
        hand, trick, currentState.trump_suit, tricksWon, bid,
        currentPlayer.player_id, gameMode, currentState.trump_card
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
        const winner = determineTrickWinner(newTrick, currentState.trump_suit, gameMode, currentState.trump_card);
        currentState.tricks_won[winner.player_id] = (currentState.tricks_won[winner.player_id] || 0) + 1;
        currentState.current_trick = newTrick;
        currentState.phase = "trick_end";
        currentState.current_player_seat = winner.seat;
      } else {
        currentState.current_trick = newTrick;
        currentState.current_player_seat = getNextSeat(currentState.current_player_seat, numPlayers);
      }
    }

    // Save intermediate state
    await supabase.from("game_state").update(currentState).eq("room_id", roomId);
  }
}
