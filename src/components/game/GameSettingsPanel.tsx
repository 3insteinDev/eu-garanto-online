import { useState } from 'react';
import { Settings, X, Plus, Minus, Pause, Play, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Player, PublicGameState } from '@/types/game';

interface GameSettingsPanelProps {
  roomId: string;
  playerId: string;
  hostId: string;
  players: Player[];
  gameState: PublicGameState;
  onAddBot: () => Promise<void>;
  onRemoveBot: (botId: string) => Promise<void>;
  onUpdateSettings: (settings: GameSettings) => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
}

export interface GameSettings {
  turn_timer: number; // 0 = no timer
  max_pauses: number;
  pause_duration: number;
}

export function GameSettingsPanel({
  roomId,
  playerId,
  hostId,
  players,
  gameState,
  onAddBot,
  onRemoveBot,
  onUpdateSettings,
  onPause,
  onResume,
}: GameSettingsPanelProps) {
  const isHost = playerId === hostId;
  const isPaused = (gameState as any).is_paused ?? false;
  const settings: GameSettings = (gameState as any).settings ?? {
    turn_timer: 15,
    max_pauses: 2,
    pause_duration: 30,
  };
  const pausesUsed: Record<string, number> = (gameState as any).pauses_used ?? {};
  const myPausesUsed = pausesUsed[playerId] ?? 0;

  const bots = players.filter(p => p.is_bot);
  const isWaiting = gameState.phase === 'waiting';
  const isGameOver = gameState.phase === 'game_over';

  const [loading, setLoading] = useState(false);
  const [localTimer, setLocalTimer] = useState(settings.turn_timer);
  const [localMaxPauses, setLocalMaxPauses] = useState(settings.max_pauses);
  const [localPauseDuration, setLocalPauseDuration] = useState(settings.pause_duration);

  const handleSaveSettings = async () => {
    if (!isHost) return;
    setLoading(true);
    try {
      await onUpdateSettings({
        turn_timer: localTimer,
        max_pauses: localMaxPauses,
        pause_duration: localPauseDuration,
      });
      toast.success('Configurações salvas');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBot = async () => {
    setLoading(true);
    try {
      await onAddBot();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao adicionar bot');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBot = async (botId: string) => {
    setLoading(true);
    try {
      await onRemoveBot(botId);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover bot');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseToggle = async () => {
    setLoading(true);
    try {
      if (isPaused) {
        await onResume();
      } else {
        if (myPausesUsed >= settings.max_pauses) {
          toast.error(`Você já usou todas as ${settings.max_pauses} pausas`);
          setLoading(false);
          return;
        }
        await onPause();
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-primary">Configurações</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Pause control */}
          {!isWaiting && !isGameOver && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase text-muted-foreground">Pausa</h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">
                    {isPaused ? '⏸ Jogo pausado' : '▶ Jogo em andamento'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pausas usadas: {myPausesUsed}/{settings.max_pauses}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isPaused ? 'default' : 'secondary'}
                  onClick={handlePauseToggle}
                  disabled={loading || (!isPaused && myPausesUsed >= settings.max_pauses)}
                >
                  {isPaused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                  {isPaused ? 'Retomar' : 'Pausar'}
                </Button>
              </div>
              <Separator />
            </div>
          )}

          {/* Bot management */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase text-muted-foreground">Bots</h4>
            {bots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum bot na sala</p>
            ) : (
              <div className="space-y-2">
                {bots.map(bot => (
                  <div key={bot.player_id} className="flex items-center justify-between px-3 py-2 rounded bg-secondary/30 border border-border">
                    <span className="text-sm flex items-center gap-1">
                      <Bot className="h-3.5 w-3.5" /> {bot.name}
                    </span>
                    {isHost && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveBot(bot.player_id)}
                        disabled={loading}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isHost && players.length < 6 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddBot}
                disabled={loading || players.length >= 6}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar Bot
              </Button>
            )}
            <Separator />
          </div>

          {/* Timer settings (host only) */}
          {isHost && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold uppercase text-muted-foreground">Tempo de Turno</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Timer</Label>
                  <span className="text-sm font-mono text-primary">
                    {localTimer === 0 ? 'Sem limite' : `${localTimer}s`}
                  </span>
                </div>
                <Slider
                  value={[localTimer]}
                  onValueChange={v => setLocalTimer(v[0])}
                  min={0}
                  max={60}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  0 = sem limite de tempo
                </p>
              </div>

              <Separator />

              <h4 className="text-sm font-semibold uppercase text-muted-foreground">Pausas</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Máximo de pausas</Label>
                  <span className="text-sm font-mono text-primary">{localMaxPauses}</span>
                </div>
                <Slider
                  value={[localMaxPauses]}
                  onValueChange={v => setLocalMaxPauses(v[0])}
                  min={0}
                  max={5}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Duração da pausa</Label>
                  <span className="text-sm font-mono text-primary">{localPauseDuration}s</span>
                </div>
                <Slider
                  value={[localPauseDuration]}
                  onValueChange={v => setLocalPauseDuration(v[0])}
                  min={10}
                  max={120}
                  step={10}
                />
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={loading}
                size="sm"
                className="w-full"
              >
                Salvar Configurações
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
