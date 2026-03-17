// ==========================================
// Eu Garanto - Game Rules & Logic
// ==========================================

import type { Card, Suit, Rank, TrickCard, GameState, GameMode } from '@/types/game';
import { RANK_ORDER, SUITS, MANILHA_SUIT_ORDER } from '@/types/game';

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

export function getManilhaRank(trumpCard: Card | null): Rank | null {
  if (!trumpCard) return null;
  const idx = RANK_ORDER.indexOf(trumpCard.rank);
  return RANK_ORDER[(idx + 1) % RANK_ORDER.length];
}

export function isManilha(card: Card, manilhaRank: Rank | null): boolean {
  return manilhaRank !== null && card.rank === manilhaRank;
}

export function getManilhaSuitStrength(suit: Suit): number {
  return MANILHA_SUIT_ORDER.indexOf(suit);
}

export function getEffectiveStrength(
  card: Card,
  trumpSuit: Suit | null,
  leadSuit: Suit,
  gameMode: GameMode = 'classic',
  manilhaRank: Rank | null = null
): number {
  if (gameMode === 'manilha' && isManilha(card, manilhaRank)) {
    return 100 + getManilhaSuitStrength(card.suit);
  }
  if (gameMode === 'manilha') {
    // In manilha mode: no suit restriction, pure rank strength
    return getCardStrength(card.rank);
  }
  // Classic mode
  const isTrump = trumpSuit && card.suit === trumpSuit;
  const isLead = card.suit === leadSuit;
  const strength = getCardStrength(card.rank);
  if (isTrump) return strength + 20;
  if (isLead) return strength;
  return -1;
}

export function compareCards(a: Card, b: Card, trumpSuit: Suit | null, leadSuit: Suit): number {
  const aIsTrump = trumpSuit && a.suit === trumpSuit;
  const bIsTrump = trumpSuit && b.suit === trumpSuit;
  const aIsLead = a.suit === leadSuit;
  const bIsLead = b.suit === leadSuit;

  if (aIsTrump && !bIsTrump) return 1;
  if (!aIsTrump && bIsTrump) return -1;
  if (aIsTrump && bIsTrump) {
    return getCardStrength(a.rank) - getCardStrength(b.rank);
  }
  if (aIsLead && !bIsLead) return 1;
  if (!aIsLead && bIsLead) return -1;
  if (a.suit === b.suit) {
    return getCardStrength(a.rank) - getCardStrength(b.rank);
  }
  return 0;
}

// ---- Trick Winner ----

export function determineTrickWinner(
  trick: TrickCard[],
  trumpSuit: Suit | null,
  gameMode: GameMode = 'classic',
  trumpCard: Card | null = null
): TrickCard | null {
  if (trick.length === 0) throw new Error('Empty trick');

  const leadSuit = trick[0].card.suit;
  const manilhaRank = gameMode === 'manilha' ? getManilhaRank(trumpCard) : null;
  let winner = trick[0];
  let bestStr = getEffectiveStrength(winner.card, trumpSuit, leadSuit, gameMode, manilhaRank);
  let tied = false;

  for (let i = 1; i < trick.length; i++) {
    const str = getEffectiveStrength(trick[i].card, trumpSuit, leadSuit, gameMode, manilhaRank);
    if (str > bestStr) {
      bestStr = str;
      winner = trick[i];
      tied = false;
    } else if (str === bestStr) {
      tied = true;
    }
  }

  // In manilha mode, ties between non-manilha cards = melada (draw)
  if (gameMode === 'manilha' && tied && bestStr < 100) {
    return null;
  }

  return winner;
}

// ---- Round Sequence ----

export function generateRoundSequence(numPlayers: number, gameMode: GameMode = 'classic'): number[] {
  let maxCards = Math.floor(40 / numPlayers);
  if (gameMode === 'manilha' && maxCards * numPlayers >= 40) {
    maxCards = Math.floor(39 / numPlayers);
  }
  const sequence: number[] = [];
  for (let i = maxCards; i >= 1; i--) sequence.push(i);
  for (let i = 2; i <= maxCards; i++) sequence.push(i);
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
  currentTrick: TrickCard[],
  gameMode: GameMode = 'classic'
): { valid: boolean; reason?: string } {
  const hasCard = hand.some(c => c.suit === card.suit && c.rank === card.rank);
  if (!hasCard) {
    return { valid: false, reason: 'Carta não está na sua mão' };
  }

  if (currentTrick.length === 0) {
    return { valid: true };
  }

  // In manilha mode: free play, no suit-following required
  if (gameMode === 'manilha') {
    return { valid: true };
  }

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
    scores[playerId] = won === bid ? 10 + bid : 0;
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
