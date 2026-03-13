import type { Card, Suit } from '@/types/game';
import { cn } from '@/lib/utils';

const suitSymbol: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

interface PlayingCardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  small?: boolean;
  faceDown?: boolean;
}

export function PlayingCard({ card, onClick, disabled, selected, small, faceDown }: PlayingCardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  if (faceDown) {
    return (
      <div className={cn(
        'rounded-lg border-2 border-border flex items-center justify-center',
        'bg-primary/20',
        small ? 'w-10 h-14 text-xs' : 'w-16 h-24 text-sm',
      )}>
        <span className="text-primary font-bold">?</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg border-2 flex flex-col items-center justify-between p-1 transition-all',
        'bg-card hover:scale-105',
        small ? 'w-10 h-14 text-xs' : 'w-16 h-24 text-sm',
        isRed ? 'text-suit-red' : 'text-foreground',
        selected ? 'border-primary ring-2 ring-primary -translate-y-2' : 'border-border',
        disabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : 'cursor-pointer',
      )}
    >
      <span className="font-bold self-start leading-none">{card.rank}</span>
      <span className={cn(small ? 'text-lg' : 'text-2xl')}>{suitSymbol[card.suit]}</span>
      <span className="font-bold self-end leading-none rotate-180">{card.rank}</span>
    </button>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg border-2 border-border flex items-center justify-center',
      'bg-primary/10',
      small ? 'w-10 h-14' : 'w-16 h-24',
    )}>
      <div className={cn(
        'rounded border border-primary/30 bg-primary/5',
        small ? 'w-7 h-10' : 'w-12 h-18',
      )} />
    </div>
  );
}
