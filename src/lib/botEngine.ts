// ==========================================
// Eu Garanto - Bot AI Engine
// ==========================================

import type { Card, Suit, TrickCard } from '@/types/game';
import { getCardStrength, RANK_ORDER } from '@/types/game';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

// ---- Bid Decision ----

export function decideBid(
  hand: Card[],
  trumpSuit: Suit | null,
  numCards: number,
  difficulty: BotDifficulty,
  forbiddenBid?: number // dealer can't make sum = numCards
): number {
  let bid: number;

  if (difficulty === 'easy') {
    bid = Math.floor(Math.random() * (numCards + 1));
  } else {
    // Medium/Hard: count strong cards
    bid = 0;
    for (const card of hand) {
      const strength = getCardStrength(card.rank);
      const isTrump = trumpSuit && card.suit === trumpSuit;

      if (difficulty === 'medium') {
        // Count trumps and high cards (A, 2, 3)
        if (isTrump && strength >= 5) bid++;
        else if (strength >= 7) bid++; // A, 2, 3
      } else {
        // Hard: more nuanced
        if (isTrump) {
          if (strength >= 4) bid++; // Trump K or higher
        } else {
          if (strength >= 8) bid++; // Only 2 or 3 of non-trump
        }
      }
    }
    bid = Math.min(bid, numCards);
  }

  // Respect dealer restriction
  if (forbiddenBid !== undefined && bid === forbiddenBid) {
    bid = bid > 0 ? bid - 1 : bid + 1;
    bid = Math.max(0, Math.min(bid, numCards));
  }

  return bid;
}

// ---- Card Play Decision ----

export function decidePlay(
  hand: Card[],
  currentTrick: TrickCard[],
  trumpSuit: Suit | null,
  tricksWon: number,
  bid: number,
  difficulty: BotDifficulty
): Card {
  const validCards = getValidCards(hand, currentTrick);

  if (validCards.length === 1) return validCards[0];

  if (difficulty === 'easy') {
    return validCards[Math.floor(Math.random() * validCards.length)];
  }

  const needMoreTricks = tricksWon < bid;

  if (needMoreTricks) {
    // Try to win: play strongest valid card
    return pickStrongest(validCards, trumpSuit, currentTrick);
  } else {
    // Don't need more: play weakest
    return pickWeakest(validCards, trumpSuit);
  }
}

function getValidCards(hand: Card[], currentTrick: TrickCard[]): Card[] {
  if (currentTrick.length === 0) return [...hand];

  const leadSuit = currentTrick[0].card.suit;
  const suitCards = hand.filter(c => c.suit === leadSuit);

  return suitCards.length > 0 ? suitCards : [...hand];
}

function pickStrongest(cards: Card[], trumpSuit: Suit | null, trick: TrickCard[]): Card {
  return cards.reduce((best, card) => {
    const bestScore = cardScore(best, trumpSuit, trick);
    const cardScoreVal = cardScore(card, trumpSuit, trick);
    return cardScoreVal > bestScore ? card : best;
  });
}

function pickWeakest(cards: Card[], trumpSuit: Suit | null): Card {
  return cards.reduce((weakest, card) => {
    const weakScore = getCardStrength(weakest.rank) + (trumpSuit && weakest.suit === trumpSuit ? 20 : 0);
    const cardScoreVal = getCardStrength(card.rank) + (trumpSuit && card.suit === trumpSuit ? 20 : 0);
    return cardScoreVal < weakScore ? card : weakest;
  });
}

function cardScore(card: Card, trumpSuit: Suit | null, trick: TrickCard[]): number {
  let score = getCardStrength(card.rank);
  if (trumpSuit && card.suit === trumpSuit) score += 20;
  if (trick.length > 0 && card.suit === trick[0].card.suit) score += 10;
  return score;
}
