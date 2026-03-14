import { useEffect, useState } from 'react';
import type { Player } from '@/types/game';

interface RoundResultOverlayProps {
  players: Player[];
  bids: Record<string, number>;
  tricksWon: Record<string, number>;
  onDismiss: () => void;
}

export function RoundResultOverlay({ players, bids, tricksWon, onDismiss }: RoundResultOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 2000);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl">
        <h2 className="text-3xl text-primary text-center">Resultado da Rodada</h2>
        <div className="space-y-2">
          {results.map(r => (
            <div
              key={r.player_id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                r.success
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-destructive/30 bg-destructive/10'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">
                  {r.name} {r.is_bot ? '🤖' : ''}
                </span>
                <span className="text-xs text-muted-foreground">
                  Apostou {r.bid} • Fez {r.won}
                </span>
              </div>
              <div className="text-right">
                {r.success ? (
                  <span className="text-primary font-bold">+{r.points} ✓</span>
                ) : (
                  <span className="text-destructive font-bold">+0 ✗</span>
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
