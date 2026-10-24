'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  extractVideoId,
  formatTimestamp,
  formatTranscriptText,
  safeDecodeURI,
} from '@/lib/utils';

interface Caption {
  text: string;
  start: number;
  dur: number;
}

interface TranscriptResponse {
  title: string;
  captions: Caption[];
}

/**
 * Inner component containing all the transcript viewer logic.
 * Wrapped in Suspense by the default export to satisfy Next.js
 * useSearchParams() suspense boundary requirement.
 */
function YoutubeTranscriptContent() {
  const router = useRouter();
  const playerRef = useRef<YTPlayer | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasAutoStopped = useRef(false);

  // Read URL params on the client side (matches Tactiq's Astro behavior)
  const [ytParam, setYtParam] = useState<string | null>(null);
  const [langParam, setLangParam] = useState('en');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setYtParam(params.get('yt'));
    setLangParam(params.get('lang') || 'en');
  }, []);

  // Load YouTube IFrame API and create player
  useEffect(() => {
    if (!ytParam) return;

    const decodedUrl = safeDecodeURI(ytParam);
    const id = extractVideoId(decodedUrl);
    if (!id) {
      setError("Couldn't extract video ID from URL");
      return;
    }
    setVideoId(id);
    setTitle(decodedUrl); // fallback title

    // Load YouTube IFrame API script (matches Tactiq's approach)
    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        createPlayer(id);
      } else {
        const script = document.createElement('script');
        script.id = 'ytframe';
        script.src = 'https://www.youtube.com/iframe_api';
        const existing = document.getElementsByTagName('script')[0];
        existing?.parentNode?.insertBefore(script, existing);

        window.onYouTubeIframeAPIReady = () => createPlayer(id);
      }
    };

    function createPlayer(vidId: string) {
      const existing = playerRef.current;
      if (existing) existing.destroy();

      playerRef.current = new window.YT.Player('player', {
        height: '390',
        width: '640',
        videoId: vidId,
        playerVars: {
          playsinline: 1,
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
          },
          onStateChange: (event: any) => {
            // Auto-stop after 100ms of playing (matches Tactiq's auto-pause behavior)
            if (event.data === window.YT.PlayerState.PLAYING && !hasAutoStopped.current) {
              setTimeout(() => {
                if (playerRef.current) playerRef.current.stopVideo();
                hasAutoStopped.current = true;
              }, 100);
            }
          },
        },
      });
    }

    loadYouTubeAPI();

    // Cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [ytParam, langParam, router]);

  // Fetch transcript
  const fetchTranscript = useCallback(async () => {
    if (!ytParam) return;

    const decodedUrl = safeDecodeURI(ytParam);
    const id = extractVideoId(decodedUrl);
    if (!id) return;

    setLoading(true);
    try {
      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: decodedUrl, langCode: langParam }),
      });

      const data = await res.json();

      if (!res.ok || 'error' in data) {
        // Use the detailed error message from the API, or fall back to generic
        const errMsg = (data as any).detail || (data as any).originalError || (data as any).error || `Couldn't get transcript for video: ${id} language: ${langParam}`;
        setError(errMsg);
        return;
      }

      setTitle(data.title);
      setCaptions(data.captions);
    } catch (e: any) {
      setError(`Couldn't get transcript for video: ${id} language: ${langParam}`);
    } finally {
      setLoading(false);
    }
  }, [ytParam, langParam]);

  // Trigger transcript fetch when videoId is set
  useEffect(() => {
    if (videoId) {
      fetchTranscript();
    }
  }, [videoId, fetchTranscript]);

  // --- Copy button handler (matches Tactiq's WS/GS) ---
  const copyTranscript = () => {
    if (!videoId) return;
    const text = formatTranscriptText(title, videoId, captions);
    navigator.clipboard.writeText(text).catch((e) => console.error('Copy error:', e));
  };

  // --- Download button handler (matches Tactiq's KS) ---
  const downloadTranscript = () => {
    if (!videoId) return;
    const text = formatTranscriptText(title, videoId, captions);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tactiq-free-transcript-${videoId}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Seek player handler ---
  const seekTo = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true);
    }
  };

  // --- Render transcript items ---
  const renderTranscript = () => {
    if (loading) {
      return (
        <div className="py-6 text-center text-[#b7b4c7]">
          Fetching transcript...
        </div>
      );
    }

    if (error) {
      return (
        <div className="py-6 text-center text-red-400">
          {error}
        </div>
      );
    }

    if (captions.length === 0) {
      return null;
    }

    return captions.map((c, i) => (
      <li key={i} className="flex">
        <code className="text-white opacity-40 mr-4 md:mr-10 md:text-lg">
          {formatTimestamp(c.start)}
        </code>
        <a
          href="#!"
          className="hover:underline hover:decoration-indigo-500 hover:decoration-2 hover:underline-offset-2 font-medium md:text-lg"
          onClick={(e) => {
            e.preventDefault();
            seekTo(c.start);
          }}
          data-start={c.start}
          data-end={c.start + c.dur}
        >
          {c.text}
        </a>
      </li>
    ));
  };

  return (
    <main className="bg-[#1c172e] text-white min-h-screen font-sans">
      {/* Header */}
      <nav className="border-b border-[#2d2a3b] bg-[#1c172e]/80">
        <div className="mx-auto max-w-7xl py-5 px-6 flex justify-between items-center">
          <a href="/" className="text-xl font-bold text-white">
            YouTube Transcript
          </a>
        </div>
      </nav>

      <div className="-z-10">
        {/* Background gradient glow */}
        <div
          className="fixed inset-0 opacity-30 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #4d54ff4d 0%, #ff3868a4 100%)',
            filter: 'blur(20px)',
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-20 lg:px-8 lg:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 items-stretch">
          {/* Video + Controls */}
          <div className="max-h-full">
            <div className="flex flex-col gap-y-6 justify-between h-full relative">
              {/* Video player */}
              <div className="w-full aspect-video rounded-3xl overflow-hidden bg-black">
                <div id="player" />
              </div>

              {/* Copy / Download buttons */}
              <div className="flex flex-col md:flex-row items-stretch w-full md:justify-between md:items-center bg-[#241f3a] px-6 py-6 mb-8 lg:mb-0 gap-y-4 md:gap-y-0 rounded-2xl relative">
                <div className="gradient-glow rounded-3xl absolute top-0 opacity-60 left-0 -z-10 w-full h-full" />
                <p className="font-medium text-center md:text-left text-lg">
                  Get the transcript:
                </p>
                <div className="flex w-auto gap-4">
                  <button
                    id="copy"
                    onClick={copyTranscript}
                    disabled={captions.length === 0}
                    className="w-full hover:bg-indigo-600/10 group flex items-center justify-center rounded-full border-2 border-indigo-600 text-white font-semibold pl-6 pr-8 gap-x-4 py-3 shadow-xs hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="#ffffff"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Z"
                      />
                      <path
                        stroke="#ffffff"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                      />
                    </svg>
                    Copy
                  </button>
                  <button
                    id="download"
                    onClick={downloadTranscript}
                    disabled={captions.length === 0}
                    className="hover:bg-indigo-600/80 group w-full flex items-center justify-center rounded-full bg-indigo-600 text-white font-semibold pl-6 pr-8 gap-x-4 py-3 shadow-xs hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke="#ffffff"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                      />
                    </svg>
                    Download
                  </button>
                </div>
              </div>

              {/* Title group + learn more */}
              <div className="flex flex-row justify-between items-center">
                <p className="text-[#b7b4c7]">
                  Upload the transcript to Tactiq to get a summary of this video.
                </p>
                <a
                  id="learn-more"
                  href="https://tactiq.io/learn/how-to-get-summary-of-youtube-video"
                  className="bg-white hover:bg-white/90 group flex items-center justify-center rounded-full text-gray-800 font-semibold px-3 gap-x-2 py-1.5 shadow-xs hover:cursor-pointer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>

          {/* Transcript */}
          <div
            id="transcript"
            className="bg-[#241f3a] relative p-5 rounded-3xl overflow-x-hidden h-[516px] overflow-y-auto"
          >
            {videoId && (
              <>
                <div id="title_group" className="mb-4">
                  <h3 className="text-3xl font-medium">{title}</h3>
                </div>
                <ul className="space-y-3">
                  {renderTranscript()}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="sticky top-[100vh] my-4">
        <div className="mx-auto max-w-7xl flex flex-col justify-center text-center md:flex-row items-center md:justify-between border-t border-[#2d2a3b] py-6">
          <img
            src="/tactiq-logo.svg"
            alt="Logo"
            className="w-[140px] mb-6 md:mb-0"
            loading="lazy"
            decoding="async"
          />
          <p className="text-[#b7b4c7]">&copy; 2026 YouTube Transcript. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

export const dynamic = 'force-dynamic';

export default function YoutubeTranscriptPage() {
  return (
    <Suspense fallback={
      <main className="bg-[#1c172e] text-white min-h-screen font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-[#b7b4c7]">Loading...</div>
        </div>
      </main>
    }>
      <YoutubeTranscriptContent />
    </Suspense>
  );
}
