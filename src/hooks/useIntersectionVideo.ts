/**
 * useIntersectionVideo Hook
 * Lazy loads videos only when they become visible on screen
 * Uses Intersection Observer for optimal performance
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVideoLoader, UseVideoLoaderOptions } from './useVideoLoader';

export interface UseIntersectionVideoOptions extends UseVideoLoaderOptions {
  threshold?: number | number[];
  rootMargin?: string;
  loadingFallback?: React.ReactNode;
}

/**
 * Hook that combines Intersection Observer with video loading
 * Videos only start loading when they become visible in viewport
 * 
 * @example
 * const {
 *   ref,
 *   isVisible,
 *   videoLoader,
 * } = useIntersectionVideo({
 *   storagePath: 'videos/original/video123.mp4',
 *   threshold: 0.25,
 *   rootMargin: '100px'
 * });
 *
 * return (
 *   <div ref={ref}>
 *     {videoLoader.isLoading && <Spinner />}
 *     {videoLoader.url && <video src={videoLoader.url} />}
 *   </div>
 * );
 */
export function useIntersectionVideo(options: UseIntersectionVideoOptions) {
  const {
    threshold = 0.25,
    rootMargin = '50px',
    ...videoLoaderOptions
  } = options;

  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Use lazy video loader that doesn't auto-load
  const videoLoader = useVideoLoader({
    ...videoLoaderOptions,
    autoLoad: false, // Don't load until visible
  });

  /**
   * Setup intersection observer
   */
  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Load video when visible
            if (!videoLoader.url && !videoLoader.isLoading) {
              videoLoader.load().catch(error => {
                console.warn('[useIntersectionVideo] Load error:', error);
              });
            }
            // Unobserve after first visibility
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
    };
  }, [videoLoader, threshold, rootMargin]);

  return {
    ref: elementRef,
    isVisible,
    videoLoader,
  };
}

/**
 * Hook for lazy loading multiple videos in a list
 * Prevents loading all videos at once
 */
export function useIntersectionVideoList(
  videos: Array<UseIntersectionVideoOptions>,
  options?: {
    threshold?: number | number[];
    rootMargin?: string;
    maxConcurrentLoads?: number;
  }
) {
  const {
    threshold = 0.25,
    rootMargin = '50px',
    maxConcurrentLoads = 2,
  } = options || {};

  const loadersRef = useRef<Map<string, any>>(new Map());
  const [loadedCount, setLoadedCount] = useState(0);
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());
  const elementsRef = useRef<Map<number, HTMLDivElement | null>>(new Map());

  /**
   * Initialize loaders and observers
   */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoIndex = parseInt(
            (entry.target as HTMLElement).getAttribute('data-video-index') || '-1',
            10
          );

          if (videoIndex === -1) return;

          if (entry.isIntersecting) {
            // Mark as visible
            setVisibleIndices((prev) => {
              const newSet = new Set(prev);
              newSet.add(videoIndex);
              return newSet;
            });
          } else {
            // Mark as invisible (can potentially unload here)
            setVisibleIndices((prev) => {
              const newSet = new Set(prev);
              newSet.delete(videoIndex);
              return newSet;
            });
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    // Initialize loaders
    videos.forEach((video, index) => {
      const key = String(index);
      if (!loadersRef.current.has(key)) {
        loadersRef.current.set(
          key,
          useVideoLoader({
            ...video,
            autoLoad: false,
          })
        );
      }

      // Register element
      const element = elementsRef.current.get(index);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [videos, threshold, rootMargin]);

  /**
   * Smart loading: load visible videos
   */
  useEffect(() => {
    const visibleArray = Array.from(visibleIndices).sort();
    
    // Load up to maxConcurrentLoads visible videos
    visibleArray.slice(0, maxConcurrentLoads).forEach((index) => {
      const loader = loadersRef.current.get(String(index));
      if (loader && !loader.url && !loader.isLoading) {
        loader.load().catch(() => {
          // Silently fail, user will see error in component
        });
      }
    });
  }, [visibleIndices, maxConcurrentLoads]);

  /**
   * Register element for observation
   */
  const registerElement = useCallback((index: number, element: HTMLDivElement | null) => {
    if (element) {
      element.setAttribute('data-video-index', String(index));
      elementsRef.current.set(index, element);
    } else {
      elementsRef.current.delete(index);
    }
  }, []);

  /**
   * Get loader for specific index
   */
  const getLoader = useCallback((index: number) => {
    const key = String(index);
    if (!loadersRef.current.has(key)) {
      return null;
    }
    return loadersRef.current.get(key);
  }, []);

  return {
    registerElement,
    getLoader,
    visibleIndices,
    loadedCount,
  };
}

// Component wrapper for easy intersection video loading
// Note: This component has been commented out - move to .tsx file if needed
/*
export interface LazyVideoProps extends UseIntersectionVideoOptions {
  children?: (state: {
    isVisible: boolean;
    isLoading: boolean;
    url: string | null;
    error: Error | null;
  }) => React.ReactNode;
}

export function LazyVideo({
  children,
  threshold = 0.25,
  rootMargin = '50px',
  ...videoLoaderOptions
}: LazyVideoProps) {
  const { ref, isVisible, videoLoader } = useIntersectionVideo({
    ...videoLoaderOptions,
    threshold,
    rootMargin,
  });

  return (
    <div ref={ref} data-lazy-video>
      {children?.({
        isVisible,
        isLoading: videoLoader.isLoading,
        url: videoLoader.url,
        error: videoLoader.error,
      })}
    </div>
  );
}
*/
