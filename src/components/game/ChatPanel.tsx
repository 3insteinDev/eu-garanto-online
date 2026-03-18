import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const QUICK_REACTIONS = ['👍', '👀', '😂', '😡', '🎯'];
const MAX_MESSAGES = 50;

interface ChatMessage {
  id: string;
  player_id: string;
  player_name: string;
  message: string;
  is_reaction: boolean;
  created_at: string;
}

interface ChatPanelProps {
  roomId: string;
  playerId: string;
  playerName: string;
}

export function ChatPanel({ roomId, playerId, playerName }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load initial messages
  useEffect(() => {
    if (!roomId) return;
    supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(MAX_MESSAGES)
      .then(({ data }) => {
        if (data) setMessages(data as ChatMessage[]);
      });
  }, [roomId]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`chat-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages(prev => {
          const next = [...prev, msg];
          return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
        });
        if (!isOpen && msg.player_id !== playerId) {
          setUnread(u => u + 1);
        }
        setTimeout(scrollToBottom, 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, isOpen, playerId, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(scrollToBottom, 100);
    }
  }, [isOpen, scrollToBottom]);

  const sendMessage = async (msg: string, isReaction = false) => {
    if (!msg.trim()) return;
    await supabase.from('room_messages').insert({
      room_id: roomId,
      player_id: playerId,
      player_name: playerName,
      message: msg.trim(),
      is_reaction: isReaction,
    });
    setInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
      >
        💬
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-h-[420px] flex flex-col rounded-xl border border-border bg-card shadow-2xl animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold text-primary">Chat</span>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 max-h-[280px]">
        <div ref={scrollRef} className="p-2 space-y-1">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem ainda</p>
          )}
          {messages.map(msg => {
            const isMe = msg.player_id === playerId;
            if (msg.is_reaction) {
              return (
                <div key={msg.id} className="text-center">
                  <span className="text-xs text-muted-foreground">{msg.player_name}</span>
                  <span className="text-2xl ml-1">{msg.message}</span>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-muted-foreground">{msg.player_name}</span>
                <div className={`px-2.5 py-1 rounded-lg text-sm max-w-[85%] break-words ${
                  isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}>
                  {msg.message}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Quick reactions */}
      <div className="flex justify-center gap-1 px-2 py-1 border-t border-border">
        {QUICK_REACTIONS.map(r => (
          <button
            key={r}
            onClick={() => sendMessage(r, true)}
            className="text-lg hover:scale-125 transition-transform px-1"
          >
            {r}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-1 p-2 border-t border-border">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Mensagem..."
          maxLength={200}
          className="flex-1 h-8 text-sm"
        />
        <Button type="submit" size="sm" className="h-8 px-3" disabled={!input.trim()}>
          ➤
        </Button>
      </form>
    </div>
  );
}
