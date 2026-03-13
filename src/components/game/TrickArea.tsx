import type { TrickCard } from '@/types/game';
import type { Player } from '@/types/game';
import { PlayingCard } from './PlayingCard';

interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: Player[];
}

export function TrickArea({ currentTrick, players }: TrickAreaProps) {
  const getPlayerName = (playerId: string) => {
    return players.find(p => p.player_id === playerId)?.name || 'Jogador';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Mesa</h3>
      <div className="flex gap-4 items-end min-h-[120px] justify-center flex-wrap">
        {currentTrick.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">Aguardando jogada...</p>
        ) : (
          currentTrick.map((tc, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <PlayingCard card={tc.card} disabled small />
              <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                {getPlayerName(tc.player_id)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
