# YouTube Transcript — Tactiq Clone (Reverse-Engineered)

A complete clone of [https://tactiq.io/tools/youtube-transcript](https://tactiq.io/tools/youtube-transcript), built by reverse-engineering the original web app end-to-end using the REA (Reverse Engineer Anything) MCP and browser analysis.

## Reverse-Engineering Summary

### Architecture Map (Recovered from Source)

| Layer | Tactiq Original | This Clone |
|-------|-----------------|------------|
| Frontend | Next.js (Turbopack, RSC) landing page | Next.js 15 App Router landing page |
| Results Page | Astro-generated HTML + client JS | Next.js client component |
| Transcript API | `POST https://tactiq-apps-prod.tactiq.io/transcript` (Firebase AppCheck) | `POST /api/transcript` (local API route) |
| Transcript Source | Internal YouTube endpoints via Firebase | `youtube-transcript` npm package |
| Player | YouTube Iframe API | YouTube Iframe API |

### Key Reverse-Engineered Details

1. **Form structure**: `<form action="/tools/run/youtube_transcript" method="get">` with `<input name="yt" type="text">`

2. **Video ID extraction regex**: `/(?<=[=&/])[a-zA-Z0-9_-]{11}(?=[=&/?#\n\r]|$)/`

3. **Timestamp formatting**: `new Date(seconds * 1000).toISOString().substring(11, 23)` → `HH:MM:SS.mmm`

4. **Transcript API contract**:
   - Request: `{ videoUrl: string, langCode: string }`
   - Response: `{ title: string, captions: [{ text, start, dur }] }` (seconds, not ms)

5. **Client features**: Copy to clipboard, download as `.txt`, clickable timestamps that seek the YouTube player, auto-stop after 100ms of playback

### What We Tried (That Didn't Work)

- **Tactiq's own API**: Returns 401 without Firebase AppCheck token
- **YouTube timedtext API**: Returns empty for the test video
- **yt-dlp**: Blocked with 429 by YouTube
- **Result**: `youtube-transcript` npm package works reliably

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 3
- **Transcript**: `youtube-transcript` npm package
- **Video Player**: YouTube IFrame API
- **Deployment**: Vercel-ready (or `npm run build && npm start`)

## Getting Started

```bash
cd yt-transcript-app
npm install
npm run dev    # http://localhost:3000
# or
npm run build && npm start
```

## Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Static | Landing page with form |
| `/tools/run/youtube_transcript?yt=<url>&lang=<lang>` | Static (CSR) | Results page with player + transcript |
| `/api/transcript` | Dynamic | API endpoint for fetching transcripts |

## Project Structure

```
yt-transcript-app/
├── app/
│   ├── layout.tsx                           # Root layout with fonts + metadata
│   ├── page.tsx                             # Landing page (form)
│   ├── api/transcript/route.ts              # Transcript API endpoint
│   └── tools/run/youtube_transcript/
│       └── page.tsx                         # Results page (player + transcript)
├── lib/
│   ├── utils.ts                             # Video ID, timestamp, text formatting
│   └── youtube.ts                           # YouTube transcript helper
├── types/
│   └── global.d.ts                          # YouTube IFrame API types
├── styles/globals.css                       # Tailwind + custom styles
├── public/
│   ├── favicon.ico
│   └── tactiq-logo.svg
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
├── tsconfig.json
└── package.json
```

## License

Built for educational/reverse-engineering purposes.
# youtubetranscript
