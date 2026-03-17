import { describe, it, expect } from 'vitest';
import { decideBid, decidePlay } from '@/lib/botEngine';
import {
  getEffectiveStrength,
  getManilhaRank,
  isManilha,
  determineTrickWinner,
  isValidPlay,
  getCardStrength,
} from '@/lib/gameRules';
import type { Card, Suit, TrickCard, Rank } from '@/types/game';

const RANK_ORDER: Rank[] = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

// ---- Manilha Rank Tests ----

describe('Manilha rank determination', () => {
  it('manilha is the rank above the trump card', () => {
    expect(getManilhaRank({ suit: 'hearts', rank: '4' })).toBe('5');
    expect(getManilhaRank({ suit: 'clubs', rank: 'A' })).toBe('2');
    expect(getManilhaRank({ suit: 'spades', rank: '3' })).toBe('4'); // wraps
  });

  it('identifies manilha cards correctly', () => {
    const trumpCard: Card = { suit: 'hearts', rank: '7' };
    const manilhaRank = getManilhaRank(trumpCard);
    expect(isManilha({ suit: 'clubs', rank: 'Q' }, manilhaRank)).toBe(true);
    expect(isManilha({ suit: 'hearts', rank: '7' }, manilhaRank)).toBe(false);
  });
});

// ---- Free Play (no suit-following) ----

describe('Manilha mode: free play', () => {
  it('allows playing any card regardless of lead suit', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'A' },
      { suit: 'clubs', rank: '3' },
      { suit: 'spades', rank: '7' },
    ];
    const trick: TrickCard[] = [
      { player_id: 'p1', seat: 0, card: { suit: 'hearts', rank: 'K' } },
    ];
    // In manilha mode, playing clubs on a hearts lead is valid
    const result = isValidPlay({ suit: 'clubs', rank: '3' }, hand, trick, 'manilha');
    expect(result.valid).toBe(true);
  });

  it('classic mode still requires suit-following', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: 'A' },
      { suit: 'clubs', rank: '3' },
    ];
    const trick: TrickCard[] = [
      { player_id: 'p1', seat: 0, card: { suit: 'hearts', rank: 'K' } },
    ];
    const result = isValidPlay({ suit: 'clubs', rank: '3' }, hand, trick, 'classic');
    expect(result.valid).toBe(false);
  });
});

// ---- Trick Winner with Manilhas ----

describe('Manilha mode: trick winner', () => {
  const trumpCard: Card = { suit: 'hearts', rank: '7' }; // manilha = Q

  it('manilha beats any non-manilha card', () => {
    const trick: TrickCard[] = [
      { player_id: 'p1', seat: 0, card: { suit: 'hearts', rank: '3' } }, // strongest non-manilha
      { player_id: 'p2', seat: 1, card: { suit: 'diamonds', rank: 'Q' } }, // manilha (weakest suit)
    ];
    const winner = determineTrickWinner(trick, trumpCard.suit, 'manilha', trumpCard);
    expect(winner.player_id).toBe('p2');
  });

  it('higher suit manilha beats lower suit manilha', () => {
    // Order: diamonds < spades < hearts < clubs (zap)
    const trick: TrickCard[] = [
      { player_id: 'p1', seat: 0, card: { suit: 'diamonds', rank: 'Q' } },
      { player_id: 'p2', seat: 1, card: { suit: 'spades', rank: 'Q' } },
      { player_id: 'p3', seat: 2, card: { suit: 'clubs', rank: 'Q' } }, // zap
      { player_id: 'p4', seat: 3, card: { suit: 'hearts', rank: 'Q' } },
    ];
    const winner = determineTrickWinner(trick, trumpCard.suit, 'manilha', trumpCard);
    expect(winner.player_id).toBe('p3'); // clubs = zap wins
  });

  it('without manilha, highest rank wins regardless of suit', () => {
    const trick: TrickCard[] = [
      { player_id: 'p1', seat: 0, card: { suit: 'hearts', rank: '4' } },
      { player_id: 'p2', seat: 1, card: { suit: 'clubs', rank: '3' } }, // rank 3 is strongest
      { player_id: 'p3', seat: 2, card: { suit: 'spades', rank: 'A' } },
    ];
    const winner = determineTrickWinner(trick, trumpCard.suit, 'manilha', trumpCard);
    expect(winner.player_id).toBe('p2');
  });

  it('off-suit card can win if it has higher rank (no suit restriction)', () => {
    const trick: TrickCard[] = [
      { player_id: 'p1', seat: 0, card: { suit: 'hearts', rank: '5' } },
      { player_id: 'p2', seat: 1, card: { suit: 'diamonds', rank: 'A' } },
    ];
    const winner = determineTrickWinner(trick, trumpCard.suit, 'manilha', trumpCard);
    expect(winner.player_id).toBe('p2');
  });
});

// ---- Bot Compatibility ----

describe('Manilha mode: bot simulation', () => {
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

  it('bots can play any card in manilha mode (no suit restriction)', () => {
    const hand: Card[] = [
      { suit: 'hearts', rank: '4' },
      { suit: 'hearts', rank: 'K' },
      { suit: 'clubs', rank: '7' },
    ];
    const trick: TrickCard[] = [
      { player_id: 'other', seat: 0, card: { suit: 'spades', rank: 'A' } },
    ];
    // Bot should be able to play any card - no crash
    for (let i = 0; i < 20; i++) {
      const card = decidePlay(hand, trick, 'hearts', 0, 1, 'medium', `bot_${i}`, 'manilha');
      expect(hand.some(c => c.suit === card.suit && c.rank === card.rank)).toBe(true);
    }
  });

  it('completes a full manilha game with 4 bots', () => {
    const numPlayers = 4;
    const maxCards = Math.floor(40 / numPlayers);
    const roundSeq: number[] = [];
    for (let i = maxCards; i >= 1; i--) roundSeq.push(i);

    const players = Array.from({ length: numPlayers }, (_, i) => ({
      id: `mbot_${i}`,
      seat: i,
      hand: [] as Card[],
      bid: 0,
      tricksWon: 0,
      score: 0,
    }));

    let dealerSeat = 0;

    for (const numCards of roundSeq) {
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
      let bidSeat = (dealerSeat + 1) % numPlayers;
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
        p.bid = bid;
        bids[p.id] = bid;
        bidSeat = (bidSeat + 1) % numPlayers;
      }

      // Playing tricks
      let leadSeat = (dealerSeat + 1) % numPlayers;
      for (let t = 0; t < numCards; t++) {
        const trick: TrickCard[] = [];
        let seat = leadSeat;
        for (let c = 0; c < numPlayers; c++) {
          const p = players[seat];
          const card = decidePlay(p.hand, trick, trumpSuit, p.tricksWon, p.bid, 'medium', p.id, 'manilha');
          const ci = p.hand.findIndex(h => h.suit === card.suit && h.rank === card.rank);
          expect(ci).toBeGreaterThanOrEqual(0);
          p.hand.splice(ci, 1);
          trick.push({ player_id: p.id, seat: p.seat, card });
          seat = (seat + 1) % numPlayers;
        }
        const winner = determineTrickWinner(trick, trumpSuit, 'manilha', trumpCard);
        players.find(p => p.id === winner.player_id)!.tricksWon++;
        leadSeat = winner.seat;
      }

      for (const p of players) {
        expect(p.hand.length).toBe(0);
        p.score += p.tricksWon === p.bid ? 10 + p.bid : 0;
      }

      dealerSeat = (dealerSeat + 1) % numPlayers;
    }

    expect(players.some(p => p.score > 0)).toBe(true);
  });
});
