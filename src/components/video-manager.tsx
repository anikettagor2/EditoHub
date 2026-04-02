import React, { createContext, useContext, useRef } from 'react';

// VideoManagerContext will track all video elements and enforce only one loaded/playing at a time
const VideoManagerContext = createContext<any>(null);

export function VideoManagerProvider({ children }: { children: React.ReactNode }) {
  // Store refs to all registered videos
  const videos = useRef<Set<HTMLVideoElement>>(new Set());
  // Track the currently active video
  const activeVideo = useRef<HTMLVideoElement | null>(null);

  // Register a video element
  const register = (video: HTMLVideoElement) => {
    videos.current.add(video);
  };
  // Unregister a video element
  const unregister = (video: HTMLVideoElement) => {
    videos.current.delete(video);
    if (activeVideo.current === video) activeVideo.current = null;
  };
  // Pause and unload all except the given video
  const pauseAndUnloadAllExcept = (video: HTMLVideoElement) => {
    videos.current.forEach((v) => {
      if (v !== video) {
        v.pause();
        v.removeAttribute('src');
        v.preload = 'none';
        v.load();
      }
    });
    activeVideo.current = video;
  };
  // Unload all videos
  const unloadAll = () => {
    videos.current.forEach((v) => {
      v.pause();
      v.removeAttribute('src');
      v.preload = 'none';
      v.load();
    });
    activeVideo.current = null;
  };
  // Get the currently active video
  const getActiveVideo = () => activeVideo.current;

  return (
    <VideoManagerContext.Provider value={{ register, unregister, pauseAndUnloadAllExcept, unloadAll, getActiveVideo }}>
      {children}
    </VideoManagerContext.Provider>
  );
}

export function useVideoManager() {
  return useContext(VideoManagerContext);
}
