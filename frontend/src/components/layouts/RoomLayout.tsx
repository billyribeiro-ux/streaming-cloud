/**
 * RoomLayout - Full-screen layout for live room
 *
 * Features:
 * - No sidebar, full width/height
 * - Top bar with room name, participant count, duration timer
 * - Children fill remaining space
 * - Dark theme optimized for video viewing
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, ArrowLeft } from 'lucide-react';
import { cn } from '../../utils/cn';

interface RoomLayoutProps {
  children: ReactNode;
  roomName: string;
  participantCount: number;
  startedAt?: Date | null;
  className?: string;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function RoomLayout({
  children,
  roomName,
  participantCount,
  startedAt,
  className,
}: RoomLayoutProps) {
  const navigate = useNavigate();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Duration timer
  useEffect(() => {
    if (!startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const start = startedAt.getTime();

    const updateDuration = () => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - start) / 1000));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className={cn('h-screen w-screen flex flex-col bg-gray-950', className)}>
      {/* Top Bar */}
      <header className="h-12 flex-shrink-0 bg-gray-950/90 backdrop-blur border-b border-gray-800 flex items-center justify-between px-4">
        {/* Left: Back button + Room Name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Leave room"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-[300px]">
            {roomName}
          </h1>
        </div>

        {/* Center: Duration */}
        {startedAt && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-mono tabular-nums">
              {formatDuration(elapsedSeconds)}
            </span>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-1" />
          </div>
        )}

        {/* Right: Participant Count */}
        <div className="flex items-center gap-1.5 text-gray-400">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">{participantCount}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
