// ==========================================
// Eu Garanto - Game Rules & Logic
// ==========================================

import type { Card, Suit, Rank, TrickCard, GameState } from '@/types/game';
import { RANK_ORDER, SUITS } from '@/types/game';

// ---- Deck ----

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ---- Card Comparison ----

export function getCardStrength(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

export function compareCards(a: Card, b: Card, trumpSuit: Suit | null, leadSuit: Suit): number {
  const aIsTrump = trumpSuit && a.suit === trumpSuit;
  const bIsTrump = trumpSuit && b.suit === trumpSuit;
  const aIsLead = a.suit === leadSuit;
  const bIsLead = b.suit === leadSuit;

  // Trump beats non-trump
  if (aIsTrump && !bIsTrump) return 1;
  if (!aIsTrump && bIsTrump) return -1;

  // Both trump: compare rank
  if (aIsTrump && bIsTrump) {
    return getCardStrength(a.rank) - getCardStrength(b.rank);
  }

  // Lead suit beats non-lead
  if (aIsLead && !bIsLead) return 1;
  if (!aIsLead && bIsLead) return -1;

  // Same suit: compare rank
  if (a.suit === b.suit) {
    return getCardStrength(a.rank) - getCardStrength(b.rank);
  }

  // Neither trump nor lead: doesn't matter (both lose)
  return 0;
}

// ---- Trick Winner ----

export function determineTrickWinner(trick: TrickCard[], trumpSuit: Suit | null): TrickCard {
  if (trick.length === 0) throw new Error('Empty trick');

  const leadSuit = trick[0].card.suit;
  let winner = trick[0];

  for (let i = 1; i < trick.length; i++) {
    if (compareCards(trick[i].card, winner.card, trumpSuit, leadSuit) > 0) {
      winner = trick[i];
    }
  }

  return winner;
}

// ---- Round Sequence ----
// For N players: goes down from max cards to 1, then back up
// Max cards per player = floor(40 / N)

export function generateRoundSequence(numPlayers: number): number[] {
  const maxCards = Math.floor(40 / numPlayers);
  const sequence: number[] = [];

  // Descending: maxCards down to 1
  for (let i = maxCards; i >= 1; i--) {
    sequence.push(i);
  }
  // Ascending: 2 up to maxCards (skip 1 to avoid repeat)
  for (let i = 2; i <= maxCards; i++) {
    sequence.push(i);
  }

  return sequence;
}

// ---- Dealing ----

export function dealCards(
  numPlayers: number,
  numCardsPerPlayer: number,
  playerIds: string[]
): { hands: Record<string, Card[]>; trumpCard: Card | null; remainingDeck: Card[] } {
  const deck = shuffleDeck(createDeck());
  const hands: Record<string, Card[]> = {};

  let cardIndex = 0;
  for (const playerId of playerIds) {
    hands[playerId] = deck.slice(cardIndex, cardIndex + numCardsPerPlayer);
    cardIndex += numCardsPerPlayer;
  }

  // Trump card is the next card after dealing (if any remain)
  const trumpCard = cardIndex < deck.length ? deck[cardIndex] : null;
  const remainingDeck = deck.slice(cardIndex + 1);

  return { hands, trumpCard, remainingDeck };
}

// ---- Bid Validation ----

export function isValidBid(
  bid: number,
  numCards: number,
  bids: Record<string, number>,
  playerIds: string[],
  currentPlayerIndex: number,
  dealerIndex: number
): { valid: boolean; reason?: string } {
  if (bid < 0 || bid > numCards) {
    return { valid: false, reason: `Aposta deve ser entre 0 e ${numCards}` };
  }

  // Dealer restriction: sum of all bids cannot equal numCards
  const isDealer = currentPlayerIndex === dealerIndex;
  if (isDealer) {
    const totalBids = Object.values(bids).reduce((sum, b) => sum + b, 0);
    if (totalBids + bid === numCards) {
      return { valid: false, reason: `Dealer não pode apostar ${bid} (soma seria igual ao total de vazas)` };
    }
  }

  return { valid: true };
}

// ---- Play Validation ----

export function isValidPlay(
  card: Card,
  hand: Card[],
  currentTrick: TrickCard[]
): { valid: boolean; reason?: string } {
  // Check card is in hand
  const hasCard = hand.some(c => c.suit === card.suit && c.rank === card.rank);
  if (!hasCard) {
    return { valid: false, reason: 'Carta não está na sua mão' };
  }

  // If first card in trick, anything goes
  if (currentTrick.length === 0) {
    return { valid: true };
  }

  // Must follow lead suit if possible
  const leadSuit = currentTrick[0].card.suit;
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);

  if (hasLeadSuit && card.suit !== leadSuit) {
    return { valid: false, reason: `Deve seguir o naipe ${leadSuit}` };
  }

  return { valid: true };
}

// ---- Scoring ----

export function calculateRoundScores(
  bids: Record<string, number>,
  tricksWon: Record<string, number>,
  playerIds: string[]
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const playerId of playerIds) {
    const bid = bids[playerId] ?? 0;
    const won = tricksWon[playerId] ?? 0;

    if (won === bid) {
      // Hit the bid: 10 + bid points
      scores[playerId] = 10 + bid;
    } else {
      // Missed: 0 points
      scores[playerId] = 0;
    }
  }

  return scores;
}

// ---- Turn Order ----

export function getNextSeat(currentSeat: number, numPlayers: number): number {
  return (currentSeat + 1) % numPlayers;
}

export function getBiddingOrder(dealerSeat: number, numPlayers: number): number[] {
  const order: number[] = [];
  let seat = getNextSeat(dealerSeat, numPlayers);
  for (let i = 0; i < numPlayers; i++) {
    order.push(seat);
    seat = getNextSeat(seat, numPlayers);
  }
  return order;
}
