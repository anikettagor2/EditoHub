"use client";

interface SimpleVideoPlayerProps {
  src?: string;
  hlsUrl?: string;
  videoUrl?: string;
  projectName?: string;
  onTimeUpdate?: (currentTime: number, duration?: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlaying?: () => void;
  onPause?: () => void;
  onCanPlay?: () => void;
  onWaiting?: () => void;
  onCanPlayThrough?: () => void;
  onStalled?: () => void;
  onError?: (error: any) => void;
  title?: string;
  className?: string;
}

export function AdaptiveVideoPlayer({
  videoUrl,
  hlsUrl,
  onTimeUpdate,
  onDurationChange,
  onPlaying,
  onPause,
  onCanPlay,
  onWaiting,
  onCanPlayThrough,
  onStalled,
  onError,
  className = '',
}: SimpleVideoPlayerProps) {
  // Use videoUrl or hlsUrl - videoUrl takes priority
  const video_src = videoUrl || hlsUrl;

  console.log('[SimpleVideoPlayer] Video src:', video_src);

  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      <video
        src={video_src}
        controls
        className="w-full h-full"
        crossOrigin="anonymous"
        onTimeUpdate={(e) => {
          const target = e.currentTarget;
          onTimeUpdate?.(target.currentTime, target.duration);
        }}
        onLoadedMetadata={(e) => {
          const target = e.currentTarget;
          onDurationChange?.(target.duration);
        }}
        onPlay={() => onPlaying?.()}
        onPause={() => onPause?.()}
        onCanPlay={() => onCanPlay?.()}
        onWaiting={() => onWaiting?.()}
        onCanPlayThrough={() => onCanPlayThrough?.()}
        onStalled={() => onStalled?.()}
        onError={(e) => {
          console.error('[SimpleVideoPlayer] Video error:', e);
          onError?.(e);
        }}
      />
    </div>
  );
}
