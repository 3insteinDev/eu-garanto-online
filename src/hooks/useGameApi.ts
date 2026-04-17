import { supabase } from '@/integrations/supabase/client';
import type { Card, GameMode } from '@/types/game';

async function invoke(fn: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // Try to extract structured error message from edge function response body
    let serverMessage: string | null = null;
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const parsed = await ctx.json();
        serverMessage = parsed?.error || null;
      } else if (ctx && typeof ctx.text === 'function') {
        const txt = await ctx.text();
        try {
          serverMessage = JSON.parse(txt)?.error || txt;
        } catch {
          serverMessage = txt;
        }
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(serverMessage || error.message || 'Erro na requisição');
  }
  if (data && typeof data === 'object' && 'error' in data && (data as any).error) {
    throw new Error(String((data as any).error));
  }
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

  const removeBot = (roomId: string, playerId: string, botId: string) =>
    gameAction(roomId, playerId, { type: 'remove_bot', bot_id: botId });

  const nextRound = (roomId: string, playerId: string) =>
    gameAction(roomId, playerId, { type: 'next_round' });

  const nextTrick = (roomId: string, playerId: string) =>
    gameAction(roomId, playerId, { type: 'next_trick' });

  const pauseGame = (roomId: string, playerId: string) =>
    gameAction(roomId, playerId, { type: 'pause_game' });

  const resumeGame = (roomId: string, playerId: string) =>
    gameAction(roomId, playerId, { type: 'resume_game' });

  const updateSettings = (roomId: string, playerId: string, settings: object) =>
    gameAction(roomId, playerId, { type: 'update_settings', settings: settings as Record<string, unknown> });

  return { createRoom, joinRoom, getGameState, startGame, placeBid, playCard, addBot, removeBot, nextRound, nextTrick, pauseGame, resumeGame, updateSettings };
}
