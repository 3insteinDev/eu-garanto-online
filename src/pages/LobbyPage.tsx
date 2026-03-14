import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlayerId, usePlayerName } from '@/hooks/usePlayerId';
import { useActiveRoom } from '@/hooks/useActiveRoom';
import { useGameApi } from '@/hooks/useGameApi';
import { toast } from 'sonner';
import { TutorialOverlay, shouldShowTutorial } from '@/components/game/TutorialOverlay';

export default function LobbyPage() {
  const navigate = useNavigate();
  const playerId = usePlayerId();
  const [playerName, setPlayerName] = usePlayerName();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { activeRoom } = useActiveRoom();
  const api = useGameApi();
  const [showTutorial, setShowTutorial] = useState(shouldShowTutorial);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      toast.error('Digite seu nome');
      return;
    }
    setLoading(true);
    try {
      const data = await api.createRoom(playerId, playerName.trim());
      navigate(`/room/${data.room.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar sala');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      toast.error('Digite seu nome');
      return;
    }
    if (!roomCode.trim()) {
      toast.error('Digite o código da sala');
      return;
    }
    setLoading(true);
    try {
      const data = await api.joinRoom(roomCode.trim(), playerId, playerName.trim());
      navigate(`/room/${data.room.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao entrar na sala');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-6xl text-primary">EU GARANTO</h1>
          <p className="text-muted-foreground">Jogo de cartas multiplayer</p>
        </div>

        {/* Rejoin active game */}
        {activeRoom && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4 space-y-2">
              <p className="text-sm text-muted-foreground text-center">Você tem uma partida ativa</p>
              <Button
                onClick={() => navigate(`/room/${activeRoom.roomId}`)}
                className="w-full text-lg h-12"
              >
                Voltar para Partida ({activeRoom.roomCode})
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Seu Nome</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Digite seu nome..."
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={20}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Criar Partida</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCreate} disabled={loading} className="w-full text-lg h-12">
              {loading ? 'Criando...' : 'Criar Nova Sala'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Entrar em Partida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Código da sala (ex: ABC123)"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center text-lg tracking-widest uppercase"
            />
            <Button onClick={handleJoin} disabled={loading} variant="secondary" className="w-full text-lg h-12">
              {loading ? 'Entrando...' : 'Entrar na Sala'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
