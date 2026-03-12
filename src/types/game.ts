// ==========================================
// Eu Garanto - Game Types
// ==========================================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';

export interface Card {
  suit: Suit;
  rank: Rank;
}

// Card strength order (index = strength, higher = stronger)
export const RANK_ORDER: Rank[] = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export interface TrickCard {
  player_id: string;
  seat: number;
  card: Card;
}

export type GamePhase = 'waiting' | 'dealing' | 'bidding' | 'playing' | 'trick_end' | 'round_end' | 'game_over';

export type RoomStatus = 'waiting' | 'in_progress' | 'finished';

export interface Player {
  id: string;
  player_id: string;
  room_id: string;
  name: string;
  is_bot: boolean;
  seat: number;
  score: number;
  connected: boolean;
}

export interface Room {
  id: string;
  code: string;
  host_id: string;
  max_players: number;
  status: RoomStatus;
  created_at: string;
}

export interface GameState {
  room_id: string;
  phase: GamePhase;
  current_player_seat: number | null;
  round_number: number;
  round_num_cards: number | null;
  trump_card: Card | null;
  trump_suit: Suit | null;
  dealer_seat: number;
  hands: Record<string, Card[]>;       // player_id -> cards (server only, filtered per player on client)
  bids: Record<string, number>;         // player_id -> bid
  current_trick: TrickCard[];
  tricks_won: Record<string, number>;   // player_id -> tricks won this round
  tricks_played: TrickCard[][];
  scores: Record<string, number>;       // player_id -> total score
  round_sequence: number[];             // e.g. [6,5,4,3,2,1,1,2,3,4,5,6]
  round_index: number;
}

// Actions sent from client to server
export type GameAction =
  | { type: 'start_game' }
  | { type: 'place_bid'; bid: number }
  | { type: 'play_card'; card: Card }
  | { type: 'next_trick' }
  | { type: 'next_round' };

// Public game state sent to each player (hand filtered)
export interface PublicGameState extends Omit<GameState, 'hands'> {
  my_hand: Card[];
  player_count: number;
}
