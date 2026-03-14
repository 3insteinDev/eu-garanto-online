import { useState, useCallback, useEffect, useRef } from 'react';
import type { Card as CardType, Player, PublicGameState, Suit } from '@/types/game';
import { useGameApi } from '@/hooks/useGameApi';
import { PlayerHand } from './PlayerHand';
import { TrickArea } from './TrickArea';
import { BidPanel } from './BidPanel';
import { ScoreBoard } from './ScoreBoard';
import { TrickHistory } from './TrickHistory';
import { PlayingCard } from './PlayingCard';
import { RoundResultOverlay } from './RoundResultOverlay';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface GameTableProps {
  roomId: string;
  playerId: string;
  gameState: PublicGameState;
  players: Player[];
  onRefresh: () => void;
  onLeave: () => void;
}

export function GameTable({ roomId, playerId, gameState, players, onRefresh, onLeave }: GameTableProps) {
  const api = useGameApi();
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRoundResult, setShowRoundResult] = useState(false);
  const prevPhaseRef = useRef(gameState.phase);
  const roundResultDataRef = useRef<{ bids: Record<string, number>; tricksWon: Record<string, number> } | null>(null);

  const myPlayer = players.find(p => p.player_id === playerId);
  const currentPlayer = players.find(p => p.seat === gameState.current_player_seat);
  const isMyTurn = currentPlayer?.player_id === playerId;

  // Detect phase transition to round_end -> show overlay
  useEffect(() => {
    if (prevPhaseRef.current !== 'round_end' && gameState.phase === 'round_end') {
      roundResultDataRef.current = {
        bids: gameState.bids as Record<string, number>,
        tricksWon: gameState.tricks_won as Record<string, number>,
      };
      setShowRoundResult(true);
    }
    prevPhaseRef.current = gameState.phase;
  }, [gameState.phase, gameState.bids, gameState.tricks_won]);

  const handleRoundResultDismiss = useCallback(async () => {
    setShowRoundResult(false);
    // Auto-advance to next round
    try {
      await api.nextRound(roomId, playerId);
    } catch {
      // another player may have already advanced
    }
  }, [roomId, playerId, api]);

  const handleBid = async (bid: number) => {
    setLoading(true);
    try {
      await api.placeBid(roomId, playerId, bid);
    } catch (e: any) {
      toast.error(e.message || 'Erro na aposta');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayCard = async (card: CardType) => {
    setLoading(true);
    setSelectedCard(null);
    try {
      await api.playCard(roomId, playerId, card);
    } catch (e: any) {
      toast.error(e.message || 'Jogada inválida');
    } finally {
      setLoading(false);
    }
  };

  const handleNextRound = async () => {
    setLoading(true);
    try {
      await api.nextRound(roomId, playerId);
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally {
      setLoading(false);
    }
  };

  // Compute forbidden bid for dealer
  let forbiddenBid: number | undefined;
  if (gameState.phase === 'bidding' && isMyTurn && myPlayer) {
    const dealerPlayer = players.find(p => p.seat === gameState.dealer_seat);
    if (dealerPlayer?.player_id === playerId) {
      const totalBids = Object.values(gameState.bids).reduce((s, b) => s + (b as number), 0);
      const fb = (gameState.round_num_cards ?? 0) - totalBids;
      if (fb >= 0 && fb <= (gameState.round_num_cards ?? 0)) {
        forbiddenBid = fb;
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Round result overlay */}
      {showRoundResult && roundResultDataRef.current && (
        <RoundResultOverlay
          players={players}
          bids={roundResultDataRef.current.bids}
          tricksWon={roundResultDataRef.current.tricksWon}
          onDismiss={handleRoundResultDismiss}
        />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl text-primary">EU GARANTO</h2>
          <span className="text-sm text-muted-foreground">
            Rodada {gameState.round_number} • {gameState.round_num_cards} carta{(gameState.round_num_cards ?? 0) > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {gameState.trump_card && (
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">Trunfo:</span>
              <PlayingCard card={gameState.trump_card} disabled small />
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? 'Mesa' : 'Histórico'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onLeave} className="text-muted-foreground">
            Sair
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex">
        {/* Score sidebar */}
        <div className="w-64 border-r border-border p-3 hidden md:block">
          <ScoreBoard
            players={players}
            bids={gameState.bids as Record<string, number>}
            tricksWon={gameState.tricks_won as Record<string, number>}
            scores={gameState.scores as Record<string, number>}
            currentPlayerSeat={gameState.current_player_seat}
            dealerSeat={gameState.dealer_seat}
            myPlayerId={playerId}
          />
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
          {/* Status */}
          <div className="text-center">
            {gameState.phase === 'bidding' && (
              <p className="text-lg">
                {isMyTurn ? (
                  <span className="text-primary font-semibold">Sua vez de apostar!</span>
                ) : (
                  <span className="text-muted-foreground">
                    Vez de <span className="text-foreground">{currentPlayer?.name}</span> apostar
                  </span>
                )}
              </p>
            )}
            {gameState.phase === 'playing' && (
              <p className="text-lg">
                {isMyTurn ? (
                  <span className="text-primary font-semibold">Sua vez de jogar!</span>
                ) : (
                  <span className="text-muted-foreground">
                    Vez de <span className="text-foreground">{currentPlayer?.name}</span> jogar
                  </span>
                )}
              </p>
            )}
            {gameState.phase === 'round_end' && !showRoundResult && (
              <div className="space-y-2">
                <p className="text-2xl text-primary">Rodada Encerrada!</p>
                <Button onClick={handleNextRound} disabled={loading}>
                  Próxima Rodada
                </Button>
              </div>
            )}
            {gameState.phase === 'game_over' && (
              <div className="space-y-2">
                <p className="text-3xl text-primary">Fim de Jogo!</p>
                {(() => {
                  const scores = gameState.scores as Record<string, number>;
                  const winnerId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
                  const winner = players.find(p => p.player_id === winnerId);
                  return winner ? (
                    <p className="text-xl">🏆 {winner.name} venceu com {scores[winnerId]} pontos!</p>
                  ) : null;
                })()}
                <Button variant="secondary" onClick={onLeave}>
                  Voltar ao Lobby
                </Button>
              </div>
            )}
          </div>

          {/* Trick / History */}
          {showHistory ? (
            <TrickHistory
              tricksPlayed={(gameState.tricks_played || []) as any}
              players={players}
              trumpSuit={gameState.trump_suit}
            />
          ) : (
            <TrickArea
              currentTrick={(gameState.current_trick || []) as any}
              players={players}
            />
          )}

          {/* Bid panel */}
          {gameState.phase === 'bidding' && isMyTurn && (
            <BidPanel
              maxBid={gameState.round_num_cards ?? 1}
              onBid={handleBid}
              disabled={loading}
              forbiddenBid={forbiddenBid}
            />
          )}
        </div>
      </div>

      {/* Player's hand */}
      {gameState.phase !== 'game_over' && (
        <div className="border-t border-border bg-card/30 px-4 pb-4">
          {/* Mobile scoreboard */}
          <div className="md:hidden mb-2 pt-2">
            <ScoreBoard
              players={players}
              bids={gameState.bids as Record<string, number>}
              tricksWon={gameState.tricks_won as Record<string, number>}
              scores={gameState.scores as Record<string, number>}
              currentPlayerSeat={gameState.current_player_seat}
              dealerSeat={gameState.dealer_seat}
              myPlayerId={playerId}
            />
          </div>
          <PlayerHand
            cards={gameState.my_hand || []}
            onPlayCard={handlePlayCard}
            disabled={!isMyTurn || gameState.phase !== 'playing' || loading}
            selectedCard={selectedCard}
            onSelectCard={setSelectedCard}
          />
        </div>
      )}
    </div>
  );
}
