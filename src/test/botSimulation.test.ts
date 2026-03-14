import { describe, it, expect } from 'vitest';
import { decideBid, decidePlay } from '@/lib/botEngine';
import { getCardStrength } from '@/lib/gameRules';
import type { Card, Suit, TrickCard, Rank } from '@/types/game';

const RANK_ORDER: Rank[] = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function determineTrickWinner(trick: TrickCard[], trumpSuit: Suit | null): TrickCard {
  const leadSuit = trick[0].card.suit;
  let winner = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const card = trick[i].card;
    const wc = winner.card;
    const cIsTrump = trumpSuit && card.suit === trumpSuit;
    const wIsTrump = trumpSuit && wc.suit === trumpSuit;
    if (cIsTrump && !wIsTrump) { winner = trick[i]; continue; }
    if (!cIsTrump && wIsTrump) continue;
    if (cIsTrump && wIsTrump) {
      if (getCardStrength(card.rank) > getCardStrength(wc.rank)) winner = trick[i];
      continue;
    }
    if (card.suit === leadSuit && wc.suit !== leadSuit) { winner = trick[i]; continue; }
    if (card.suit !== leadSuit) continue;
    if (getCardStrength(card.rank) > getCardStrength(wc.rank)) winner = trick[i];
  }
  return winner;
}

function getNextSeat(seat: number, n: number) { return (seat + 1) % n; }

interface SimPlayer {
  id: string;
  seat: number;
  hand: Card[];
  bid: number;
  tricksWon: number;
  score: number;
}

function simulateFullGame(numPlayers: number) {
  const maxCards = Math.floor(40 / numPlayers);
  const roundSeq: number[] = [];
  for (let i = maxCards; i >= 1; i--) roundSeq.push(i);
  for (let i = 2; i <= maxCards; i++) roundSeq.push(i);

  const players: SimPlayer[] = Array.from({ length: numPlayers }, (_, i) => ({
    id: `bot_${i}`,
    seat: i,
    hand: [],
    bid: 0,
    tricksWon: 0,
    score: 0,
  }));

  let dealerSeat = 0;
  let totalRounds = 0;
  const MAX_ROUNDS = roundSeq.length + 5; // safety

  for (const numCards of roundSeq) {
    totalRounds++;
    if (totalRounds > MAX_ROUNDS) throw new Error('Game stuck: too many rounds');

    const deck = shuffle(createDeck());
    let idx = 0;
    for (const p of players) {
      p.hand = deck.slice(idx, idx + numCards);
      idx += numCards;
      p.bid = 0;
      p.tricksWon = 0;
    }
    const trumpCard = idx < deck.length ? deck[idx] : null;
    const trumpSuit = trumpCard?.suit ?? null;

    // Bidding
    let bidSeat = getNextSeat(dealerSeat, numPlayers);
    const bids: Record<string, number> = {};
    for (let b = 0; b < numPlayers; b++) {
      const p = players[bidSeat];
      let forbiddenBid: number | undefined;
      if (bidSeat === dealerSeat) {
        const total = Object.values(bids).reduce((s, v) => s + v, 0);
        const fb = numCards - total;
        if (fb >= 0 && fb <= numCards) forbiddenBid = fb;
      }
      const bid = decideBid(p.hand, trumpSuit, numCards, 'medium', forbiddenBid, p.id, bids);
      expect(bid).toBeGreaterThanOrEqual(0);
      expect(bid).toBeLessThanOrEqual(numCards);
      if (forbiddenBid !== undefined) expect(bid).not.toBe(forbiddenBid);
      p.bid = bid;
      bids[p.id] = bid;
      bidSeat = getNextSeat(bidSeat, numPlayers);
    }

    // Verify dealer constraint
    const totalBids = Object.values(bids).reduce((s, v) => s + v, 0);
    expect(totalBids).not.toBe(numCards);

    // Playing tricks
    let leadSeat = getNextSeat(dealerSeat, numPlayers);
    for (let t = 0; t < numCards; t++) {
      const trick: TrickCard[] = [];
      let seat = leadSeat;
      for (let c = 0; c < numPlayers; c++) {
        const p = players[seat];
        expect(p.hand.length).toBeGreaterThan(0);
        const card = decidePlay(p.hand, trick, trumpSuit, p.tricksWon, p.bid, 'medium', p.id);
        expect(card).toBeDefined();
        // Validate suit following
        if (trick.length > 0) {
          const ls = trick[0].card.suit;
          const hasSuit = p.hand.some(c => c.suit === ls);
          if (hasSuit) expect(card.suit).toBe(ls);
        }
        // Remove from hand
        const ci = p.hand.findIndex(h => h.suit === card.suit && h.rank === card.rank);
        expect(ci).toBeGreaterThanOrEqual(0);
        p.hand.splice(ci, 1);
        trick.push({ player_id: p.id, seat: p.seat, card });
        seat = getNextSeat(seat, numPlayers);
      }
      const winner = determineTrickWinner(trick, trumpSuit);
      players.find(p => p.id === winner.player_id)!.tricksWon++;
      leadSeat = winner.seat;
    }

    // Score
    for (const p of players) {
      expect(p.hand.length).toBe(0);
      p.score += p.tricksWon === p.bid ? 10 + p.bid : 0;
    }

    dealerSeat = getNextSeat(dealerSeat, numPlayers);
  }

  return { players, totalRounds };
}

describe('Bot Game Simulation', () => {
  it('completes a full game with 2 bots without blocking', () => {
    const { players, totalRounds } = simulateFullGame(2);
    expect(totalRounds).toBeGreaterThan(0);
    expect(players.some(p => p.score > 0)).toBe(true);
  });

  it('completes a full game with 4 bots without blocking', () => {
    const { players, totalRounds } = simulateFullGame(4);
    expect(totalRounds).toBeGreaterThan(0);
    expect(players.some(p => p.score > 0)).toBe(true);
  });

  it('runs 10 games with 4 bots without any stuck state', () => {
    for (let i = 0; i < 10; i++) {
      const { totalRounds } = simulateFullGame(4);
      expect(totalRounds).toBeGreaterThan(0);
    }
  });

  it('runs 10 games with 2 bots without any stuck state', () => {
    for (let i = 0; i < 10; i++) {
      const { totalRounds } = simulateFullGame(2);
      expect(totalRounds).toBeGreaterThan(0);
    }
  });

  it('bots always respect forbidden bid for dealer', () => {
    for (let trial = 0; trial < 50; trial++) {
      const hand: Card[] = [
        { suit: 'hearts', rank: 'A' },
        { suit: 'spades', rank: '3' },
        { suit: 'clubs', rank: 'K' },
      ];
      const forbiddenBid = 2;
      const bid = decideBid(hand, 'hearts', 3, 'medium', forbiddenBid, `bot_test_${trial}`);
      expect(bid).not.toBe(forbiddenBid);
      expect(bid).toBeGreaterThanOrEqual(0);
      expect(bid).toBeLessThanOrEqual(3);
    }
  });

  it('bots always play a valid card', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: '4' },
      { suit: 'hearts', rank: 'K' },
      { suit: 'clubs', rank: '7' },
    ];
    const trick: TrickCard[] = [
      { player_id: 'other', seat: 0, card: { suit: 'hearts', rank: 'A' } },
    ];
    for (let i = 0; i < 20; i++) {
      const card = decidePlay(hand, trick, 'spades', 0, 1, 'medium', `bot_${i}`);
      // Must follow hearts since we have hearts
      expect(card.suit).toBe('hearts');
    }
  });
});
