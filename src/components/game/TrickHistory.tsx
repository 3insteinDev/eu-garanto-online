import type { TrickCard, Player, Suit } from '@/types/game';
import { PlayingCard } from './PlayingCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TrickHistoryProps {
  tricksPlayed: TrickCard[][];
  players: Player[];
  trumpSuit: Suit | null;
}

export function TrickHistory({ tricksPlayed, players }: TrickHistoryProps) {
  const getPlayerName = (playerId: string) =>
    players.find(p => p.player_id === playerId)?.name || '?';

  if (tricksPlayed.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic p-3">
        Nenhuma vaza jogada ainda.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3 p-2">
        {tricksPlayed.map((trick, tIdx) => (
          <div key={tIdx} className="rounded border border-border p-2 bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-1">Vaza {tIdx + 1}</p>
            <div className="flex gap-2 flex-wrap">
              {trick.map((tc, cIdx) => (
                <div key={cIdx} className="flex flex-col items-center gap-0.5">
                  <PlayingCard card={tc.card} disabled small />
                  <span className="text-[10px] text-muted-foreground truncate max-w-[50px]">
                    {getPlayerName(tc.player_id)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
