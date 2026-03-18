import { useEffect, useState } from 'react';
import type { Player } from '@/types/game';

interface RoundFeedbackProps {
  players: Player[];
  bids: Record<string, number>;
  tricksWon: Record<string, number>;
  onDismiss: () => void;
}

export function RoundFeedback({ players, bids, tricksWon, onDismiss }: RoundFeedbackProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  const results = players.map(p => {
    const bid = bids[p.player_id] ?? 0;
    const won = tricksWon[p.player_id] ?? 0;
    const success = won === bid;
    const points = success ? 10 + bid : 0;
    return { ...p, bid, won, success, points };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl animate-scale-in">
        <h2 className="text-3xl text-primary text-center">Resultado da Rodada</h2>
        <div className="space-y-2">
          {results.map(r => (
            <div
              key={r.player_id}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                r.success
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-destructive/30 bg-destructive/10'
              }`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {r.name} {r.is_bot ? '🤖' : ''}
                  </span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    r.success
                      ? 'bg-primary/20 text-primary'
                      : 'bg-destructive/20 text-destructive'
                  }`}>
                    {r.success ? 'ACERTOU!' : 'BLEFOU!'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Apostou {r.bid} • Fez {r.won}
                </span>
              </div>
              <div className="text-right">
                {r.success ? (
                  <span className="text-primary font-bold text-lg">+{r.points} ✓</span>
                ) : (
                  <span className="text-destructive font-bold text-lg">+0 ✗</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">Continuando automaticamente...</p>
      </div>
    </div>
  );
}
