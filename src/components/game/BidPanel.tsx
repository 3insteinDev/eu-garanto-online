import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface BidPanelProps {
  maxBid: number;
  onBid: (bid: number) => void;
  disabled?: boolean;
  forbiddenBid?: number;
}

export function BidPanel({ maxBid, onBid, disabled, forbiddenBid }: BidPanelProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border">
      <h3 className="text-lg font-semibold text-primary uppercase tracking-wider">Faça sua aposta</h3>
      <div className="flex flex-wrap gap-2 justify-center">
        {Array.from({ length: maxBid + 1 }, (_, i) => i).map(bid => (
          <Button
            key={bid}
            variant={selected === bid ? 'default' : 'outline'}
            size="sm"
            disabled={disabled || bid === forbiddenBid}
            onClick={() => setSelected(bid)}
            className="w-10 h-10"
          >
            {bid}
          </Button>
        ))}
      </div>
      {forbiddenBid !== undefined && forbiddenBid >= 0 && forbiddenBid <= maxBid && (
        <p className="text-xs text-destructive">Dealer não pode apostar {forbiddenBid}</p>
      )}
      <Button
        onClick={() => selected !== null && onBid(selected)}
        disabled={disabled || selected === null}
        className="mt-2"
      >
        Confirmar Aposta
      </Button>
    </div>
  );
}
