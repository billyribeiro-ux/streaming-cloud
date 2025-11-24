/**
 * VideoTile Component - Displays a participant's video stream
 *
 * Features:
 * - Video/Audio indicators
 * - Name overlay
 * - Connection quality indicator
 * - Spotlight/Pin functionality
 */

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '../../utils/cn';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Pin,
  MoreVertical,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface VideoTileProps {
  stream: MediaStream | null;
  displayName: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  isScreenShare?: boolean;
  isSpotlighted?: boolean;
  connectionQuality?: 'good' | 'medium' | 'poor' | 'unknown';
  role?: string;
  onSpotlight?: () => void;
  onMute?: () => void;
  onKick?: () => void;
  className?: string;
}

export function VideoTile({
  stream,
  displayName,
  isLocal = false,
  isMuted = false,
  isVideoEnabled = true,
  isScreenShare = false,
  isSpotlighted = false,
  connectionQuality = 'unknown',
  role = 'viewer',
  onSpotlight,
  onMute,
  onKick,
  className,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  // Audio level monitoring
  useEffect(() => {
    if (!stream || isMuted) {
      setAudioLevel(0);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
    };

    const interval = setInterval(updateLevel, 100);

    return () => {
      clearInterval(interval);
      audioContext.close();
    };
  }, [stream, isMuted]);

  const connectionIcon = {
    good: <Wifi className="w-4 h-4 text-green-500" />,
    medium: <Wifi className="w-4 h-4 text-yellow-500" />,
    poor: <WifiOff className="w-4 h-4 text-red-500" />,
    unknown: null,
  };

  const roleColors = {
    host: 'bg-red-500',
    co_host: 'bg-orange-500',
    moderator: 'bg-blue-500',
    viewer: 'bg-gray-500',
  };

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden bg-gray-900',
        'aspect-video',
        isSpotlighted && 'ring-2 ring-yellow-500',
        audioLevel > 0.1 && 'ring-2 ring-green-500',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Video Element */}
      {isVideoEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            'w-full h-full object-cover',
            isLocal && !isScreenShare && 'transform scale-x-[-1]'
          )}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-2xl font-semibold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Audio Level Indicator */}
      {audioLevel > 0.05 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-green-500 transition-all"
          style={{ transform: `scaleX(${audioLevel})`, transformOrigin: 'left' }}
        />
      )}

      {/* Bottom Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Role Badge */}
            {role !== 'viewer' && (
              <span
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full text-white',
                  roleColors[role as keyof typeof roleColors] || 'bg-gray-500'
                )}
              >
                {role.replace('_', '-')}
              </span>
            )}

            {/* Name */}
            <span className="text-white text-sm font-medium truncate max-w-[150px]">
              {displayName}
              {isLocal && ' (You)'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Connection Quality */}
            {connectionIcon[connectionQuality]}

            {/* Audio Indicator */}
            {isMuted ? (
              <MicOff className="w-4 h-4 text-red-500" />
            ) : (
              <Mic className="w-4 h-4 text-white" />
            )}

            {/* Video Indicator */}
            {!isVideoEnabled && <VideoOff className="w-4 h-4 text-red-500" />}

            {/* Spotlight Indicator */}
            {isSpotlighted && <Pin className="w-4 h-4 text-yellow-500" />}
          </div>
        </div>
      </div>

      {/* Hover Controls */}
      {isHovered && !isLocal && (
        <div className="absolute top-2 right-2 flex gap-1">
          {onSpotlight && (
            <button
              onClick={onSpotlight}
              className={cn(
                'p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition',
                isSpotlighted && 'bg-yellow-500/50'
              )}
              title="Spotlight"
            >
              <Pin className="w-4 h-4 text-white" />
            </button>
          )}

          {(onMute || onKick) && (
            <div className="relative group">
              <button
                className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition"
                title="More options"
              >
                <MoreVertical className="w-4 h-4 text-white" />
              </button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block">
                <div className="bg-gray-800 rounded-lg shadow-lg py-1 min-w-[120px]">
                  {onMute && (
                    <button
                      onClick={onMute}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                    >
                      <MicOff className="w-4 h-4" />
                      Mute
                    </button>
                  )}
                  {onKick && (
                    <button
                      onClick={onKick}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Screen Share Label */}
      {isScreenShare && (
        <div className="absolute top-2 left-2">
          <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
            Screen
          </span>
        </div>
      )}
    </div>
  );
}
