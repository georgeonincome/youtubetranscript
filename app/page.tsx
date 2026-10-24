'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    // Match Tactiq's form: action="/tools/run/youtube_transcript" method="get"
    // with input name="yt"
    const params = new URLSearchParams({ yt: url });
    router.push(`/tools/run/youtube_transcript?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#1c172e] text-white font-sans">
      {/* Header */}
      <header className="border-b border-[#2d2a3b] bg-[#1c172e]/80 backdrop-blur">
        <div className="mx-auto max-w-7xl flex h-16 items-center justify-between px-5 sm:px-8">
          <a href="/" className="text-xl font-bold text-white">
            YouTube Transcript
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="mx-auto max-w-3xl px-5 pt-12 pb-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
          Free YouTube Transcript Generator
        </h1>
        <p className="mt-6 text-lg text-[#b7b4c7]">
          Instantly, without uploading video files.
        </p>

        {/* Form — matches Tactiq's form: action="/tools/run/youtube_transcript" method="get" */}
        <form
          onSubmit={handleSubmit}
          action="/tools/run/youtube_transcript"
          method="get"
          className="mt-10 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            name="yt"
            required
            maxLength={256}
            aria-label="YouTube video URL"
            placeholder="Enter YouTube URL... https://www.youtube.com/watch?v=example"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="min-h-12 flex-1 rounded-full border-2 border-[#4d54ff] bg-transparent px-5 text-foreground placeholder:text-[#b7b4c7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d54ff]/80 text-white"
          />
          <input
            type="submit"
            disabled={loading || !url.trim()}
            className="min-h-12 cursor-pointer rounded-full border-2 border-[#4d54ff] bg-[#4f46e5] px-7 font-semibold text-white hover:bg-indigo-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d54ff]/80 disabled:opacity-50"
            value={loading ? 'Generating...' : 'Get Video Transcript'}
          />
        </form>

        {/* How it works */}
        <div className="mt-16 text-left">
          <h2 className="text-2xl font-semibold text-white">How to get the transcript of a YouTube video</h2>
          <div className="mt-8 space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4d54ff]/20 text-[#4d54ff]">
                1
              </div>
              <div>
                <h3 className="font-semibold text-white">Copy the YouTube URL</h3>
                <p className="text-sm text-[#b7b4c7]">Copy the URL from the address bar of your web browser or right-click the video and select "Copy Video URL".</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4d54ff]/20 text-[#4d54ff]">
                2
              </div>
              <div>
                <h3 className="font-semibold text-white">Paste the URL above</h3>
                <p className="text-sm text-[#b7b4c7]">Simply paste the copied YouTube video URL and click "Get Video Transcript".</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4d54ff]/20 text-[#4d54ff]">
                3
              </div>
              <div>
                <h3 className="font-semibold text-white">View the Youtube Transcript</h3>
                <p className="text-sm text-[#b7b4c7]">Instantly view, copy and download the YouTube video's transcript text without entering your email.</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 text-left">
          <h2 className="text-2xl font-semibold text-white">Frequently Asked Questions</h2>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="font-semibold text-white">How do I transcribe a YouTube video to text?</h3>
              <p className="mt-2 text-sm text-[#b7b4c7]">
                Go to YouTube and open the video that you want to transcribe. Click the three dots below the video,
                next to the Share and Save buttons. Select "Show transcript" from the menu.
              </p>
              <p className="mt-2 text-sm text-[#b7b4c7]">
                Alternatively, just paste the YouTube URL above and click "Get Video Transcript".
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">Is YouTube Video Transcript Generator Available for Free?</h3>
              <p className="mt-2 text-sm text-[#b7b4c7]">
                Yes, YouTube video transcripts generator is available for free. You can transcribe YouTube video to text
                using automatic speech recognition technology.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-white">What is a YouTube video transcript?</h3>
              <p className="mt-2 text-sm text-[#b7b4c7]">
                Transcripts are literal word-for-word transcription of the audio in a video. They are typically displayed
                below the video player but can also be downloaded as a text file.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#2d2a3b] py-6 text-center text-sm text-[#b7b4c7]">
        <p>&copy; 2026 YouTube Transcript. All rights reserved.</p>
      </footer>
    </main>
  );
}
