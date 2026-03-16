import { supabase } from '@/integrations/supabase/client';
import type { Card, GameMode } from '@/types/game';

async function invoke(fn: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message || 'Erro na requisição');
  return data;
}

export function useGameApi() {
  const createRoom = (hostId: string, hostName: string, maxPlayers = 4, gameMode: GameMode = 'classic') =>
    invoke('create-room', { host_id: hostId, host_name: hostName, max_players: maxPlayers, game_mode: gameMode });

  const joinRoom = (roomCode: string, playerId: string, playerName: string) =>
    invoke('join-room', { room_code: roomCode, player_id: playerId, player_name: playerName });

  const getGameState = (roomId: string, playerId: string) =>
    invoke('get-game-state', { room_id: roomId, player_id: playerId });

  const gameAction = (roomId: string, playerId: string, action: Record<string, unknown>) =>
    invoke('game-action', { room_id: roomId, player_id: playerId, action });

  const startGame = (roomId: string, playerId: string) =>
    gameAction(roomId, playerId, { type: 'start_game' });

  const placeBid = (roomId: string, playerId: string, bid: number) =>
    gameAction(roomId, playerId, { type: 'place_bid', bid });

  const playCard = (roomId: string, playerId: string, card: Card) =>
    gameAction(roomId, playerId, { type: 'play_card', card });

  const addBot = (roomId: string, playerId: string, botName?: string) =>
    gameAction(roomId, playerId, { type: 'add_bot', bot_name: botName });

  const nextRound = (roomId: string, playerId: string) =>
    gameAction(roomId, playerId, { type: 'next_round' });

  const nextTrick = (roomId: string, playerId: string) =>
    gameAction(roomId, playerId, { type: 'next_trick' });

  return { createRoom, joinRoom, getGameState, startGame, placeBid, playCard, addBot, nextRound, nextTrick };
}
