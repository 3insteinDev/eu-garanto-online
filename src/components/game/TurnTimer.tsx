import { useEffect, useState, useRef } from 'react';

interface TurnTimerProps {
  isMyTurn: boolean;
  duration?: number; // seconds
  onTimeout: () => void;
  phase: string;
}

export function TurnTimer({ isMyTurn, duration = 10, onTimeout, phase }: TurnTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!isMyTurn || (phase !== 'bidding' && phase !== 'playing')) {
      setTimeLeft(duration);
      calledRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setTimeLeft(duration);
    calledRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (!calledRef.current) {
            calledRef.current = true;
            onTimeout();
          }
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isMyTurn, phase, duration, onTimeout]);

  if (!isMyTurn || (phase !== 'bidding' && phase !== 'playing')) return null;

  const pct = (timeLeft / duration) * 100;
  const isLow = timeLeft <= 3;

  return (
    <div className="flex items-center gap-2 w-full max-w-[200px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            isLow ? 'bg-destructive' : 'bg-primary'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-bold tabular-nums ${isLow ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}>
        {timeLeft}s
      </span>
    </div>
  );
}
