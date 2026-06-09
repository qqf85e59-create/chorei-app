'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Timer as TimerIcon } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';

export function SpeechTimer({ defaultSeconds = 180 }: { defaultSeconds?: number }) {
  const [timeLeft, setTimeLeft] = useState(defaultSeconds);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      setIsFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const toggleTimer = () => {
    if (timeLeft === 0) return;
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setIsFinished(false);
    setTimeLeft(defaultSeconds);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (isFinished) return 'text-brand-danger animate-pulse';
    if (timeLeft <= 30) return 'text-brand-warning';
    return 'text-brand-primary';
  };

  return (
    <Card className="border-brand-border bg-white shadow-sm overflow-hidden">
      <div className="bg-brand-bg px-4 py-2 flex items-center justify-between border-b border-brand-border">
        <h3 className="text-xs font-semibold text-brand-primary flex items-center gap-1 uppercase tracking-widest">
          <TimerIcon className="h-3.5 w-3.5" />
          発話タイマー
        </h3>
      </div>
      <CardContent className="p-4 flex items-center justify-between">
        <div className={`text-4xl font-mono tracking-tighter transition-colors ${getTimerColor()}`}>
          {formatTime(timeLeft)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className={`h-10 w-10 p-0 rounded-full ${isActive ? 'border-brand-danger text-brand-danger bg-red-50' : 'border-brand-success text-brand-success bg-green-50'}`}
            onClick={toggleTimer}
          >
            {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-1" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-10 w-10 p-0 rounded-full text-muted-foreground hover:text-brand-text hover:bg-brand-bg/80"
            onClick={resetTimer}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
