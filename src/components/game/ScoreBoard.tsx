import type { Player } from '@/types/game';

interface ScoreBoardProps {
  players: Player[];
  bids: Record<string, number>;
  tricksWon: Record<string, number>;
  scores: Record<string, number>;
  currentPlayerSeat: number | null;
  dealerSeat: number;
  myPlayerId: string;
  cardCounts?: Record<string, number>;
}

export function ScoreBoard({ players, bids, tricksWon, scores, currentPlayerSeat, dealerSeat, myPlayerId, cardCounts }: ScoreBoardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Jogadores</h3>
      <div className="space-y-1">
        {players.map(p => {
          const isCurrentTurn = p.seat === currentPlayerSeat;
          const isDealer = p.seat === dealerSeat;
          const isMe = p.player_id === myPlayerId;
          const cards = cardCounts?.[p.player_id];

          return (
            <div
              key={p.player_id}
              className={`flex items-center justify-between px-2 py-1.5 rounded text-sm transition-all ${
                isCurrentTurn ? 'bg-primary/15 border border-primary/30 shadow-sm shadow-primary/10' : ''
              } ${isMe ? 'font-semibold' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isCurrentTurn && (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                )}
                <span className="truncate">
                  {p.name}
                  {isMe && ' (você)'}
                  {isDealer && ' 🃏'}
                  {p.is_bot && ' 🤖'}
                </span>
                {/* Card count indicator */}
                {cards !== undefined && cards > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                    <span className="inline-block w-2.5 h-3.5 rounded-sm border border-muted-foreground/40 bg-muted-foreground/10" />
                    {cards}
                  </span>
                )}
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
                {bids[p.player_id] !== undefined && (
                  <span>Aposta: {bids[p.player_id]}</span>
                )}
                <span>Vazas: {tricksWon[p.player_id] ?? 0}</span>
                <span className="text-primary font-medium">{scores[p.player_id] ?? 0} pts</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
