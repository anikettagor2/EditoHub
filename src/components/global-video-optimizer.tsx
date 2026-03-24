"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";

const VIEWPORT_THRESHOLD = 0.18;
const ROOT_MARGIN = "200px 0px";
const PRELOADED_SESSION_KEY = "editohub:preloaded-video-urls";

type VideoSources = {
  hlsUrl?: string;
  fallbackUrl?: string;
  sourceElements: Array<{ node: HTMLSourceElement; src: string; type: string }>;
};

type ManagedState = {
  loaded: boolean;
  preloaded: boolean;
  preloadingPromise?: Promise<void>;
  hlsInstance?: any;
  onError: () => void;
  onPlay?: () => void;
};

let hlsModulePromise: Promise<any> | null = null;

function loadHlsModule() {
  if (!hlsModulePromise) {
    hlsModulePromise = import("hls.js").then((mod) => mod.default);
  }
  return hlsModulePromise;
}

function readSessionPreloadedSet() {
  try {
    const raw = sessionStorage.getItem(PRELOADED_SESSION_KEY);
    const urls = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(urls);
  } catch {
    return new Set<string>();
  }
}

function writeSessionPreloadedSet(set: Set<string>) {
  try {
    sessionStorage.setItem(PRELOADED_SESSION_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage quota/privacy failures.
  }
}

function rememberPreloadedUrl(url?: string) {
  if (!url) return;
  const set = readSessionPreloadedSet();
  set.add(url);
  writeSessionPreloadedSet(set);
}

function isUrlPreloaded(url?: string) {
  if (!url) return false;
  return readSessionPreloadedSet().has(url);
}

async function warmupHlsManifestAndFirstSegment(hlsUrl: string) {
  try {
    const response = await fetch(hlsUrl, { credentials: "same-origin" });
    if (!response.ok) return;
    const text = await response.text();

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    if (lines.length === 0) return;

    const firstEntry = lines[0];
    const firstUrl = new URL(firstEntry, hlsUrl).toString();

    if (/\.m3u8(\?|$)/i.test(firstUrl)) {
      const child = await fetch(firstUrl, { credentials: "same-origin" });
      if (!child.ok) return;
      const childText = await child.text();
      const childLines = childText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"));

      if (childLines.length > 0) {
        const firstSegmentUrl = new URL(childLines[0], firstUrl).toString();
        await fetch(firstSegmentUrl, { credentials: "same-origin" });
      }
      return;
    }

    await fetch(firstUrl, { credentials: "same-origin" });
  } catch {
    // Warmup is best effort only.
  }
}

function buildDefaultPosterDataUri() {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f1115"/>
        <stop offset="100%" stop-color="#161920"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#g)"/>
    <circle cx="640" cy="360" r="62" fill="rgba(255,255,255,0.08)"/>
    <polygon points="620,325 620,395 685,360" fill="rgba(255,255,255,0.75)"/>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function extractVideoSources(video: HTMLVideoElement): VideoSources {
  const sourceElements = Array.from(video.querySelectorAll("source")).map((node) => ({
    node,
    src: node.getAttribute("src") || "",
    type: node.getAttribute("type") || "",
  }));

  const directSrc = video.getAttribute("src") || "";
  const sourceHls = sourceElements.find((entry) => /mpegurl|\.m3u8/i.test(entry.type) || /\.m3u8(\?|$)/i.test(entry.src))?.src;
  const sourceFallback = sourceElements.find((entry) => /mp4/i.test(entry.type) || /\.mp4(\?|$)/i.test(entry.src))?.src;

  const dataHls = video.dataset.hlsUrl || video.dataset.hlsSrc || undefined;
  const dataFallback = video.dataset.fallbackSrc || undefined;

  const hlsUrl = dataHls || sourceHls || (/\.m3u8(\?|$)/i.test(directSrc) ? directSrc : undefined);
  const fallbackUrl = dataFallback || sourceFallback || (/\.mp4(\?|$)/i.test(directSrc) ? directSrc : undefined);

  return {
    hlsUrl,
    fallbackUrl,
    sourceElements,
  };
}

function prepareVideoForLazyLoad(video: HTMLVideoElement) {
  if (!video.poster) {
    video.poster = buildDefaultPosterDataUri();
  }

  if (!video.getAttribute("playsinline")) {
    video.setAttribute("playsinline", "true");
  }

  if (!video.preload || video.preload === "auto") {
    video.preload = video.autoplay ? "auto" : "metadata";
  }
}

async function attachSource(video: HTMLVideoElement, sources: VideoSources, state: ManagedState) {
  if (state.loaded) return;

  const { hlsUrl, fallbackUrl } = sources;
  video.preload = video.autoplay ? "auto" : "metadata";

  if (hlsUrl) {
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.load();
      rememberPreloadedUrl(hlsUrl);
      state.loaded = true;
      return;
    }

    try {
      const Hls = await loadHlsModule();
      if (Hls?.isSupported?.()) {
        const hls = new Hls({
          autoStartLoad: true,
          startLevel: 0,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 12,
          maxMaxBufferLength: 20,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 2,
          fragLoadingMaxRetry: 2,
          startFragPrefetch: true,
        });

        state.hlsInstance = hls;
        hls.attachMedia(video);

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(hlsUrl);
          hls.startLoad(0);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          rememberPreloadedUrl(hlsUrl);
        });

        hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
          if (!data?.fatal) return;
          hls.destroy();
          state.hlsInstance = null;
          if (fallbackUrl) {
            video.src = fallbackUrl;
            video.load();
            rememberPreloadedUrl(fallbackUrl);
          }
        });

        state.loaded = true;
        return;
      }
    } catch {
      // Fall back below.
    }
  }

  if (fallbackUrl) {
    video.src = fallbackUrl;
    video.load();
    rememberPreloadedUrl(fallbackUrl);
    state.loaded = true;
    return;
  }

  // Restore source children if no explicit source found.
  for (const entry of sources.sourceElements) {
    if (entry.src) {
      entry.node.setAttribute("src", entry.src);
    }
  }
  video.load();
  state.loaded = true;
}

async function preloadVideoInBackground(video: HTMLVideoElement, sources: VideoSources, state: ManagedState) {
  if (state.preloaded || state.preloadingPromise) return;

  state.preloadingPromise = (async () => {
    if (sources.hlsUrl && !isUrlPreloaded(sources.hlsUrl)) {
      await warmupHlsManifestAndFirstSegment(sources.hlsUrl);
      rememberPreloadedUrl(sources.hlsUrl);
    }

    // Ensure media is attached and ready to start immediately when play is clicked.
    await attachSource(video, sources, state);
    state.preloaded = true;
  })();

  try {
    await state.preloadingPromise;
  } finally {
    state.preloadingPromise = undefined;
  }
}

export function GlobalVideoOptimizer() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sourcesMap = new Map<HTMLVideoElement, VideoSources>();
    const stateMap = new Map<HTMLVideoElement, ManagedState>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const video = entry.target as HTMLVideoElement;
          const sources = sourcesMap.get(video);
          const state = stateMap.get(video);
          if (!sources || !state) continue;

          void attachSource(video, sources, state);
          state.preloaded = true;
          io.unobserve(video);
        }
      },
      {
        root: null,
        rootMargin: ROOT_MARGIN,
        threshold: VIEWPORT_THRESHOLD,
      }
    );

    const registerVideo = (video: HTMLVideoElement) => {
      if (video.dataset.videoManagedPlayer === "true") return;
      if (stateMap.has(video)) return;

      prepareVideoForLazyLoad(video);

      const sources = extractVideoSources(video);
      const sourceAttr = video.getAttribute("src");
      if (sourceAttr) {
        video.removeAttribute("src");
      }
      for (const source of sources.sourceElements) {
        source.node.removeAttribute("src");
      }

      const state: ManagedState = {
        loaded: false,
        preloaded: false,
        onError: () => {
          const fallbackUrl = sources.fallbackUrl;
          if (!fallbackUrl) return;
          video.src = fallbackUrl;
          video.load();
        },
      };

      state.onPlay = () => {
        const allVideos = Array.from(document.querySelectorAll("video")) as HTMLVideoElement[];
        const currentIndex = allVideos.indexOf(video);
        if (currentIndex === -1) return;

        const nextVideo = allVideos.slice(currentIndex + 1).find((candidate) => {
          return candidate.dataset.videoManagedPlayer !== "true";
        });

        if (!nextVideo) return;

        const nextSources = sourcesMap.get(nextVideo);
        const nextState = stateMap.get(nextVideo);
        if (!nextSources || !nextState) return;

        void preloadVideoInBackground(nextVideo, nextSources, nextState);
      };

      video.addEventListener("error", state.onError);
      video.addEventListener("play", state.onPlay);

      sourcesMap.set(video, sources);
      stateMap.set(video, state);
      io.observe(video);
    };

    const unregisterVideo = (video: HTMLVideoElement) => {
      const state = stateMap.get(video);
      if (!state) return;

      io.unobserve(video);
      video.removeEventListener("error", state.onError);
      if (state.onPlay) {
        video.removeEventListener("play", state.onPlay);
      }
      if (state.hlsInstance) {
        state.hlsInstance.destroy();
      }

      stateMap.delete(video);
      sourcesMap.delete(video);
    };

    const scan = () => {
      const videos = Array.from(document.querySelectorAll("video"));
      videos.forEach((video) => registerVideo(video as HTMLVideoElement));

      for (const video of Array.from(stateMap.keys())) {
        if (!document.body.contains(video)) {
          unregisterVideo(video);
        }
      }

      if (!loading && user) {
        const firstPlayable = videos.find((video) => {
          const element = video as HTMLVideoElement;
          return element.dataset.videoManagedPlayer !== "true";
        }) as HTMLVideoElement | undefined;

        if (firstPlayable) {
          const firstSources = sourcesMap.get(firstPlayable);
          const firstState = stateMap.get(firstPlayable);
          if (firstSources && firstState) {
            void preloadVideoInBackground(firstPlayable, firstSources, firstState);
          }
        }
      }
    };

    const mo = new MutationObserver(() => {
      scan();
    });

    scan();
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
      for (const video of Array.from(stateMap.keys())) {
        unregisterVideo(video);
      }
    };
  }, [user, loading]);

  return null;
}
