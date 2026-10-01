'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  label: string;
  onComplete?: () => void;
}

function formatTime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0)
    parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

export default function CountdownTimer({
  targetDate,
  label,
  onComplete,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const target = new Date(targetDate).getTime();

    function update() {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setTimeLeft(diff);
      if (diff === 0 && onComplete) {
        onComplete();
      }
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate, onComplete]);

  if (timeLeft === 0) {
    return null;
  }

  return (
    <div className="text-sm">
      <span className="text-gray-500">{label}: </span>
      <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
    </div>
  );
}
