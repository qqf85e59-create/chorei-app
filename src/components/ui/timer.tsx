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
    if (isFinished) return 'text-[#C0392B] animate-pulse';
    if (timeLeft <= 30) return 'text-[#D97706]';
    return 'text-[#00135D]';
  };

  const progress = ((defaultSeconds - timeLeft) / defaultSeconds) * 100;

  return (
    <Card className="border-[#E0E4EF] bg-white shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
      <div className="bg-[#F8F9FC] px-5 py-3 flex items-center justify-between border-b border-[#E0E4EF]">
        <h3 className="text-xs font-bold text-[#00135D] flex items-center gap-1.5 uppercase tracking-widest">
          <TimerIcon className="h-3.5 w-3.5 text-[#0070CC]" />
          発話タイマー
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {isFinished ? '時間になりました' : isActive ? '計測中...' : '開始前'}
        </span>
      </div>
      <CardContent className="p-5">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-[#E0E4EF] rounded-full mb-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isFinished ? 'bg-[#C0392B]' : timeLeft <= 30 ? 'bg-[#D97706]' : 'bg-[#0070CC]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className={`text-5xl font-mono font-bold tracking-tighter transition-colors ${getTimerColor()}`}>
            {formatTime(timeLeft)}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isFinished}
              className={`h-11 w-11 p-0 rounded-full transition-colors ${
                isActive
                  ? 'border-[#C0392B] text-[#C0392B] bg-[#FEF2F2] hover:bg-[#FCCACA]/30'
                  : 'border-[#047857] text-[#047857] bg-[#ECFDF5] hover:bg-[#D1FAE5]/50'
              } disabled:opacity-40`}
              onClick={toggleTimer}
            >
              {isActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-11 w-11 p-0 rounded-full text-muted-foreground hover:text-[#1A1D23] hover:bg-[#F0F2F8]"
              onClick={resetTimer}
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
        {isFinished && (
          <p className="mt-3 text-center text-xs font-semibold text-[#C0392B]">
            時間になりました。まとめてください。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
