import type { TrickCard } from '@/types/game';
import type { Player } from '@/types/game';
import { PlayingCard } from './PlayingCard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: Player[];
  winnerSeat?: number | null;
  isTrickEnd?: boolean;
  isMelada?: boolean;
}

export function TrickArea({ currentTrick, players, winnerSeat, isTrickEnd, isMelada }: TrickAreaProps) {
  const getPlayerName = (playerId: string) => {
    return players.find(p => p.player_id === playerId)?.name || 'Jogador';
  };

  const winnerPlayer = isTrickEnd && winnerSeat != null
    ? players.find(p => p.seat === winnerSeat)
    : null;

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-col items-center gap-2">

      {isTrickEnd && isMelada && (
        <p className="text-lg text-destructive font-semibold animate-fade-in">
          🔄 MELADA! Ninguém ganhou a vaza
        </p>
      )}

      {isTrickEnd && winnerPlayer && !isMelada && (
        <p className="text-lg text-primary font-semibold animate-fade-in">
          🏆 {winnerPlayer.name} ganhou a vaza!
        </p>
      )}

      <div className="flex gap-4 items-end min-h-[120px] justify-center flex-wrap">
        {currentTrick.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">Aguardando jogada...</p>
        ) : (
          currentTrick.map((tc, i) => {
            const isWinner = isTrickEnd && winnerSeat != null && tc.seat === winnerSeat;
            return (
              <div
                key={i}
                className={`flex flex-col items-center gap-1 transition-all ${
                  isWinner ? 'ring-2 ring-primary rounded-lg p-1 bg-primary/10 scale-105' : ''
                }`}
              >
                <PlayingCard card={tc.card} disabled small isWinner={isWinner} animateIn />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`text-xs truncate max-w-[80px] block cursor-default ${
                      isWinner ? 'text-primary font-bold' : 'text-muted-foreground'
                    }`}>
                      {getPlayerName(tc.player_id)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{getPlayerName(tc.player_id)}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
