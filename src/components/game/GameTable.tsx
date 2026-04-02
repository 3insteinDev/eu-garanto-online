import { useState, useCallback, useEffect, useRef } from 'react';
import type { Card as CardType, Player, PublicGameState, Suit, GameMode } from '@/types/game';
import { RANK_ORDER, MANILHA_SUIT_ORDER } from '@/types/game';
import { useGameApi } from '@/hooks/useGameApi';
import { PlayerHand } from './PlayerHand';
import { TrickArea } from './TrickArea';
import { BidPanel } from './BidPanel';
import { ScoreBoard } from './ScoreBoard';
import { TrickHistory } from './TrickHistory';
import { PlayingCard } from './PlayingCard';
import { RoundFeedback } from './RoundFeedback';
import { TurnTimer } from './TurnTimer';
import { ChatPanel } from './ChatPanel';
import { GameSettingsPanel, type GameSettings } from './GameSettingsPanel';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface GameTableProps {
  roomId: string;
  playerId: string;
  playerName: string;
  gameState: PublicGameState;
  players: Player[];
  onRefresh: () => void;
  onLeave: () => void;
  gameMode?: GameMode;
  hostId: string;
}

export function GameTable({ roomId, playerId, playerName, gameState, players, onRefresh, onLeave, gameMode = 'classic', hostId }: GameTableProps) {
  const api = useGameApi();
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRoundResult, setShowRoundResult] = useState(false);
  const prevPhaseRef = useRef(gameState.phase);
  const roundResultDataRef = useRef<{ bids: Record<string, number>; tricksWon: Record<string, number> } | null>(null);
  const nextTrickCalledRef = useRef(false);

  const myPlayer = players.find(p => p.player_id === playerId);
  const currentPlayer = players.find(p => p.seat === gameState.current_player_seat);
  const isTrickEnd = gameState.phase === 'trick_end';
  const isMyTurn = !isTrickEnd && currentPlayer?.player_id === playerId;

  // Compute manilha rank for display
  const manilhaRank = gameMode === 'manilha' && gameState.trump_card
    ? RANK_ORDER[(RANK_ORDER.indexOf(gameState.trump_card.rank as any) + 1) % RANK_ORDER.length]
    : null;

  // Compute card counts for all players
  const cardCounts: Record<string, number> = {};
  if (gameState.player_count) {
    // We know our hand size; estimate others from round info
    const myCards = (gameState.my_hand || []).length;
    cardCounts[playerId] = myCards;
    // Other players: same count based on tricks played
    for (const p of players) {
      if (p.player_id !== playerId) {
        // All players start with same cards; subtract tricks they participated in
        const totalTricks = (gameState.tricks_played || []).length;
        const currentTrickPlayed = (gameState.current_trick || []).some((tc: any) => tc.player_id === p.player_id) ? 1 : 0;
        cardCounts[p.player_id] = (gameState.round_num_cards ?? 0) - totalTricks - currentTrickPlayed;
      }
    }
  }

  // Auto-advance trick_end after 2 seconds
  useEffect(() => {
    if (gameState.phase !== 'trick_end') {
      nextTrickCalledRef.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      if (nextTrickCalledRef.current) return;
      nextTrickCalledRef.current = true;
      try {
        await api.nextTrick(roomId, playerId);
      } catch {
        // another player may have already advanced
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [gameState.phase, roomId, playerId, api]);

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

  // Timer auto-action: play random card or bid 0
  const handleTimeout = useCallback(async () => {
    if (gameState.phase === 'playing' && isMyTurn) {
      const hand = gameState.my_hand || [];
      if (hand.length > 0) {
        const randomCard = hand[Math.floor(Math.random() * hand.length)];
        try {
          await api.playCard(roomId, playerId, randomCard);
          toast.info('Tempo esgotado! Carta jogada automaticamente.');
        } catch { /* ignore */ }
      }
    } else if (gameState.phase === 'bidding' && isMyTurn) {
      // Auto-bid 0 (or 1 if 0 is forbidden)
      const fb = forbiddenBid;
      const autoBid = fb === 0 ? 1 : 0;
      try {
        await api.placeBid(roomId, playerId, autoBid);
        toast.info('Tempo esgotado! Aposta automática.');
      } catch { /* ignore */ }
    }
  }, [gameState.phase, gameState.my_hand, isMyTurn, roomId, playerId, api]);

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

  const modeLabel = gameMode === 'manilha' ? '🔥 Manilha' : '🃏 Clássico';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Round result overlay */}
      {showRoundResult && roundResultDataRef.current && (
        <RoundFeedback
          players={players}
          bids={roundResultDataRef.current.bids}
          tricksWon={roundResultDataRef.current.tricksWon}
          onDismiss={handleRoundResultDismiss}
        />
      )}

      {/* Chat */}
      <ChatPanel roomId={roomId} playerId={playerId} playerName={playerName} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl text-primary">EU GARANTO</h2>
          <span className="text-sm text-muted-foreground">
            Rodada {gameState.round_number} • {gameState.round_num_cards} carta{(gameState.round_num_cards ?? 0) > 1 ? 's' : ''}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
            {modeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {gameState.trump_card && (
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">Trunfo:</span>
              <PlayingCard card={gameState.trump_card} disabled small />
              {manilhaRank && (
                <span className="text-xs text-primary ml-1">(Manilha: {manilhaRank})</span>
              )}
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
            cardCounts={cardCounts}
          />
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
          {/* Status + Timer */}
          <div className="text-center space-y-2">
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

            {/* Turn timer */}
            {isMyTurn && (
              <div className="flex justify-center">
                <TurnTimer
                  isMyTurn={isMyTurn}
                  duration={15}
                  onTimeout={handleTimeout}
                  phase={gameState.phase}
                />
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
              winnerSeat={isTrickEnd ? gameState.current_player_seat : undefined}
              isTrickEnd={isTrickEnd}
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
              cardCounts={cardCounts}
            />
          </div>
          <PlayerHand
            cards={gameState.my_hand || []}
            onPlayCard={handlePlayCard}
            disabled={!isMyTurn || gameState.phase !== 'playing' || loading}
            selectedCard={selectedCard}
            onSelectCard={setSelectedCard}
            manilhaRank={manilhaRank}
          />
        </div>
      )}
    </div>
  );
}
