import type { Card } from '@/types/game';
import { PlayingCard } from './PlayingCard';

interface PlayerHandProps {
  cards: Card[];
  onPlayCard?: (card: Card) => void;
  disabled?: boolean;
  selectedCard?: Card | null;
  onSelectCard?: (card: Card | null) => void;
  manilhaRank?: string | null;
}

export function PlayerHand({ cards, onPlayCard, disabled, selectedCard, onSelectCard, manilhaRank }: PlayerHandProps) {
  const handleClick = (card: Card) => {
    if (disabled) return;
    if (onSelectCard) {
      const isSelected = selectedCard?.suit === card.suit && selectedCard?.rank === card.rank;
      if (isSelected) {
        onPlayCard?.(card);
      } else {
        onSelectCard(card);
      }
    } else {
      onPlayCard?.(card);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center py-4">
      {cards.map((card, i) => (
        <PlayingCard
          key={`${card.suit}-${card.rank}-${i}`}
          card={card}
          onClick={() => handleClick(card)}
          disabled={disabled}
          selected={selectedCard?.suit === card.suit && selectedCard?.rank === card.rank}
          isManilha={!!manilhaRank && card.rank === manilhaRank}
        />
      ))}
    </div>
  );
}
