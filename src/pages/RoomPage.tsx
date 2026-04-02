import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePlayerId, usePlayerName } from '@/hooks/usePlayerId';
import { useActiveRoom } from '@/hooks/useActiveRoom';
import { useGameApi } from '@/hooks/useGameApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { GameTable } from '@/components/game/GameTable';
import type { Player, PublicGameState, GameMode } from '@/types/game';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const playerId = usePlayerId();
  const [playerName] = usePlayerName();
  const { setActiveRoom } = useActiveRoom();
  const api = useGameApi();

  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [hostId, setHostId] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [loading, setLoading] = useState(false);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchState = useCallback(async () => {
    if (!roomId) return;
    try {
      const data = await api.getGameState(roomId, playerId);
      setGameState(data.state);
      setPlayers(data.players || []);
    } catch {
      // might not have state yet
    }
  }, [roomId, playerId]);

  // Debounced fetch to prevent flooding from realtime events
  const debouncedFetch = useCallback(() => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      fetchState();
    }, 150);
  }, [fetchState]);

  // Track active room
  useEffect(() => {
    if (roomId && roomCode) {
      setActiveRoom({ roomId, roomCode });
    }
  }, [roomId, roomCode]);

  // Initial load
  useEffect(() => {
    if (!roomId) return;
    supabase.from('rooms').select('*').eq('id', roomId).single().then(({ data }) => {
      if (data) {
        setRoomCode(data.code);
        setHostId(data.host_id);
        setGameMode((data as any).game_mode || 'classic');
      }
    });
    fetchState();
  }, [roomId, fetchState]);

  // Realtime subscription with debounce
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state', filter: `room_id=eq.${roomId}` }, () => {
        debouncedFetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, () => {
        debouncedFetch();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    };
  }, [roomId, debouncedFetch]);

  const handleStartGame = async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      await api.startGame(roomId, playerId);
      toast.success('Jogo iniciado!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBot = async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      await api.addBot(roomId, playerId);
      toast.success('Bot adicionado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao adicionar bot');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = () => {
    setActiveRoom(null);
    navigate('/');
  };

  const isHost = playerId === hostId;
  const isWaiting = !gameState || gameState.phase === 'waiting';

  const gameModeLabel = gameMode === 'manilha' ? '🔥 Manilha' : '🃏 Clássico';

  if (isWaiting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-5xl text-primary">SALA</h1>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-mono tracking-[0.3em] text-primary bg-secondary/50 px-4 py-2 rounded-lg border border-border">
                {roomCode}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Compartilhe este código com seus amigos</p>
            <p className="text-sm font-medium text-primary">{gameModeLabel}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-primary">
                Jogadores ({players.length}/6)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {players.map(p => (
                <div key={p.player_id} className="flex items-center justify-between px-3 py-2 rounded bg-secondary/30 border border-border">
                  <span className={p.player_id === playerId ? 'font-semibold text-primary' : ''}>
                    {p.name}
                    {p.player_id === playerId && ' (você)'}
                  </span>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {p.is_bot && <span>🤖</span>}
                    {p.player_id === hostId && <span>👑</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {isHost && (
            <div className="space-y-3">
              <Button onClick={handleAddBot} disabled={loading || players.length >= 6} variant="secondary" className="w-full">
                Adicionar Bot 🤖
              </Button>
              <Button onClick={handleStartGame} disabled={loading || players.length < 2} className="w-full text-lg h-12">
                {loading ? 'Iniciando...' : 'Iniciar Jogo'}
              </Button>
            </div>
          )}

          <Button variant="ghost" onClick={handleLeave} className="w-full text-muted-foreground">
            ← Voltar ao Lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <GameTable
      roomId={roomId!}
      playerId={playerId}
      playerName={playerName}
      gameState={gameState}
      players={players}
      onRefresh={fetchState}
      onLeave={handleLeave}
      gameMode={gameMode}
    />
  );
}
