import type { TrickCard } from '@/types/game';
import type { Player } from '@/types/game';
import { PlayingCard } from './PlayingCard';

interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: Player[];
  winnerSeat?: number | null;
  isTrickEnd?: boolean;
}

export function TrickArea({ currentTrick, players, winnerSeat, isTrickEnd }: TrickAreaProps) {
  const getPlayerName = (playerId: string) => {
    return players.find(p => p.player_id === playerId)?.name || 'Jogador';
  };

  const winnerPlayer = isTrickEnd && winnerSeat != null
    ? players.find(p => p.seat === winnerSeat)
    : null;

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Mesa</h3>

      {isTrickEnd && winnerPlayer && (
        <p className="text-lg text-primary font-semibold">
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
                className={`flex flex-col items-center gap-1 ${
                  isWinner ? 'ring-2 ring-primary rounded-lg p-1 bg-primary/10' : ''
                }`}
              >
                <PlayingCard card={tc.card} disabled small />
                <span className={`text-xs truncate max-w-[60px] ${
                  isWinner ? 'text-primary font-bold' : 'text-muted-foreground'
                }`}>
                  {getPlayerName(tc.player_id)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
