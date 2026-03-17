// ==========================================
// Eu Garanto - Enhanced Bot AI Engine
// Bots have personalities: aggressive, conservative, tricky
// They bluff on bids and play strategically
// ==========================================

import type { Card, Suit, TrickCard, GameMode } from '@/types/game';
import { RANK_ORDER } from '@/types/game';
import { getCardStrength } from '@/lib/gameRules';

export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type BotPersonality = 'aggressive' | 'conservative' | 'tricky';

export function getBotPersonality(botId: string): BotPersonality {
  const hash = botId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const types: BotPersonality[] = ['aggressive', 'conservative', 'tricky'];
  return types[hash % 3];
}

function getBluffChance(personality: BotPersonality): number {
  switch (personality) {
    case 'aggressive': return 0.35;
    case 'conservative': return 0.10;
    case 'tricky': return 0.50;
  }
}

// ---- Bid Decision with Bluffing ----

export function decideBid(
  hand: Card[],
  trumpSuit: Suit | null,
  numCards: number,
  difficulty: BotDifficulty,
  forbiddenBid?: number,
  botId?: string,
  otherBids?: Record<string, number>
): number {
  if (difficulty === 'easy') {
    let bid = Math.floor(Math.random() * (numCards + 1));
    if (forbiddenBid !== undefined && bid === forbiddenBid) {
      bid = bid > 0 ? bid - 1 : bid + 1;
      bid = Math.max(0, Math.min(bid, numCards));
    }
    return bid;
  }

  const personality = getBotPersonality(botId || 'default');
  const bluffChance = getBluffChance(personality);

  let baseBid = 0;
  for (const card of hand) {
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
    if (personality === 'aggressive') {
      bid = Math.min(baseBid + (Math.random() > 0.5 ? 2 : 1), numCards);
    } else if (personality === 'tricky') {
      bid = Math.random() > 0.5 && baseBid > 0
        ? Math.max(0, baseBid - 1)
        : Math.min(baseBid + 1, numCards);
    } else {
      bid = Math.max(0, baseBid - 1);
    }
  }

  if (otherBids && Object.keys(otherBids).length > 0) {
    const totalOtherBids = Object.values(otherBids).reduce((s, b) => s + b, 0);
    if (totalOtherBids > numCards * 0.7 && personality !== 'aggressive') {
      bid = Math.max(0, bid - 1);
    }
    if (totalOtherBids < numCards * 0.3 && personality !== 'conservative') {
      bid = Math.min(bid + 1, numCards);
    }
  }

  bid = Math.max(0, Math.min(bid, numCards));

  if (forbiddenBid !== undefined && bid === forbiddenBid) {
    if (personality === 'aggressive' && bid < numCards) bid++;
    else if (bid > 0) bid--;
    else bid++;
    bid = Math.max(0, Math.min(bid, numCards));
  }

  return bid;
}

// ---- Card Play Decision with Strategy ----

export function decidePlay(
  hand: Card[],
  currentTrick: TrickCard[],
  trumpSuit: Suit | null,
  tricksWon: number,
  bid: number,
  difficulty: BotDifficulty,
  botId?: string,
  gameMode: GameMode = 'classic'
): Card {
  const validCards = getValidCards(hand, currentTrick, gameMode);
  if (validCards.length === 1) return validCards[0];

  if (difficulty === 'easy') {
    return validCards[Math.floor(Math.random() * validCards.length)];
  }

  const personality = getBotPersonality(botId || 'default');
  const needMore = tricksWon < bid;
  const exactlyMet = tricksWon === bid;
  const isLeading = currentTrick.length === 0;

  const scored = validCards.map(card => {
    let score = 0;
    const strength = getCardStrength(card.rank);
    const isTrump = trumpSuit && card.suit === trumpSuit;

    if (needMore) {
      if (isLeading) {
        score = isTrump ? strength + 10 + (personality === 'aggressive' ? 5 : -8) : strength;
      } else {
        const wins = wouldCardWin(card, currentTrick, trumpSuit);
        score = wins ? 20 + (personality === 'conservative' ? -strength : strength) : -strength - (isTrump ? 20 : 0);
      }
    } else if (exactlyMet) {
      if (isLeading) {
        score = -strength - (isTrump ? 20 : 0);
      } else {
        const wins = wouldCardWin(card, currentTrick, trumpSuit);
        score = wins ? -20 : 10 - strength;
      }
    } else {
      score = -strength - (isTrump ? 20 : 0);
    }

    score += Math.random() * 2;
    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].card;
}

function getValidCards(hand: Card[], currentTrick: TrickCard[], gameMode: GameMode = 'classic'): Card[] {
  if (currentTrick.length === 0) return [...hand];
  // In manilha mode: free play, all cards valid
  if (gameMode === 'manilha') return [...hand];
  const leadSuit = currentTrick[0].card.suit;
  const suitCards = hand.filter(c => c.suit === leadSuit);
  return suitCards.length > 0 ? suitCards : [...hand];
}

function getCurrentWinnerStrength(trick: TrickCard[], trumpSuit: Suit | null): number {
  if (trick.length === 0) return -1;
  const leadSuit = trick[0].card.suit;
  let best = -1;
  for (const tc of trick) {
    const isTrump = trumpSuit && tc.card.suit === trumpSuit;
    const isLead = tc.card.suit === leadSuit;
    const str = getCardStrength(tc.card.rank);
    const eff = isTrump ? str + 20 : isLead ? str : -1;
    if (eff > best) best = eff;
  }
  return best;
}

function wouldCardWin(card: Card, trick: TrickCard[], trumpSuit: Suit | null): boolean {
  if (trick.length === 0) return true;
  const leadSuit = trick[0].card.suit;
  const isTrump = trumpSuit && card.suit === trumpSuit;
  const str = getCardStrength(card.rank);
  const eff = isTrump ? str + 20 : card.suit === leadSuit ? str : -1;
  return eff > getCurrentWinnerStrength(trick, trumpSuit);
}
