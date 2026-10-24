/**
 * YouTube transcript fetching with robust retry logic and fallbacks.
 *
 * Strategy chain:
 * 1. youtube-transcript npm package (InnerTube API → HTML scraping fallback)
 * 2. Direct InnerTube API call (Android client context)
 * 3. Direct watch page HTML scraping (browser-like headers)
 * 4. YouTube timedtext API (last resort)
 *
 * The retry-enabled fetchWithRetry adds browser-like headers but NEVER
 * overwrites headers already set by the caller (critical for InnerTube).
 */

import { extractVideoId } from './utils';
import { fetchTranscript as ytFetchTranscript } from 'youtube-transcript';

interface Caption {
  text: string;
  start: number;
  dur: number;
}

interface TranscriptResult {
  title: string;
  captions: Caption[];
  source: string;
}

// Browser-like headers for web page scraping (NOT for InnerTube API)
const BROWSER_HEADERS = {
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Referer': 'https://www.youtube.com/',
};

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const INNERTUBE_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)';

/**
 * Retry wrapper around fetch with exponential backoff.
 * Adds browser-like headers but NEVER overwrites headers already set by caller.
 * Retries on network errors, 429, 503, and 403 responses.
 */
async function fetchWithRetry(
  input: string,
  init: RequestInit = {},
  retries: number = 3
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  // Only add browser headers if not already set by caller
  for (const [key, value] of Object.entries(BROWSER_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  // Only set browser UA if not already set
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', BROWSER_UA);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(input, { ...init, headers });

      if (response.status === 429 || response.status === 503 || response.status === 403) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * 1500;

        if (attempt < retries) {
          console.warn(
            `[fetchWithRetry] Attempt ${attempt + 1} got status ${response.status}, retrying in ${delay}ms`
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
      }

      return response;
    } catch (error: any) {
      lastError = error;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1500;
        console.warn(
          `[fetchWithRetry] Attempt ${attempt + 1} failed: ${error.message}, retrying in ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  if (lastError) throw lastError;
  return fetch(input, { ...init, headers });
}

/**
 * Strategy 1: youtube-transcript npm package.
 * Does NOT pass a custom fetch — lets the package use its own UA
 * (Android for InnerTube, Mac Chrome for web scraping).
 */
async function fetchViaYoutubeTranscriptPackage(
  videoId: string,
  lang: string
): Promise<Caption[] | null> {
  try {
    const transcript = await ytFetchTranscript(videoId, { lang });
    if (transcript && transcript.length > 0) {
      return transcript.map((item) => ({
        text: item.text,
        start: Math.round((item.offset || 0) / 1000),
        dur: Math.round((item.duration || 0) / 1000),
      }));
    }
    return null;
  } catch (error: any) {
    console.warn('[youtube-transcript package] Failed:', error.message);
    return null;
  }
}

/**
 * Strategy 2: Direct InnerTube API call.
 * Uses Android client context — same as what youtube-transcript does internally.
 */
async function fetchViaInnerTubeAPI(videoId: string, lang: string): Promise<Caption[] | null> {
  try {
    const resp = await fetchWithRetry('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': INNERTUBE_UA,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
          },
        },
        videoId: videoId,
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    const track = tracks.find((t: any) => t.languageCode === lang) || tracks[0];
    if (!track?.baseUrl) return null;

    const captionResp = await fetchWithRetry(track.baseUrl, {
      headers: { 'Accept-Language': lang },
    });
    if (!captionResp.ok) return null;
    const xml = await captionResp.text();
    return parseCaptionXML(xml, lang);
  } catch (error: any) {
    console.warn('[InnerTube API fallback] Failed:', error.message);
    return null;
  }
}

/**
 * Strategy 3: Direct watch page HTML scraping.
 * Fetches YouTube watch page, parses ytInitialPlayerResponse, extracts caption tracks.
 */
async function fetchViaWatchPage(videoId: string, lang: string): Promise<Caption[] | null> {
  try {
    const resp = await fetchWithRetry(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'Accept-Language': lang },
    });

    if (!resp.ok) return null;
    const html = await resp.text();

    if (html.includes('class="g-recaptcha"')) {
      throw new Error('YouTube requires solving a captcha (rate limited)');
    }

    if (!html.includes('"playabilityStatus":')) {
      throw new Error('Video is unavailable');
    }

    // Parse ytInitialPlayerResponse JSON
    const startToken = 'var ytInitialPlayerResponse = ';
    const startIndex = html.indexOf(startToken);
    if (startIndex === -1) return null;

    const jsonStart = startIndex + startToken.length;
    let depth = 0;
    let jsonEnd = jsonStart;
    for (let i = jsonStart; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }

    const playerResponse = JSON.parse(html.slice(jsonStart, jsonEnd));
    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      throw new Error('Transcript is disabled on this video');
    }

    const track = tracks.find((t: any) => t.languageCode === lang) || tracks[0];
    if (!track?.baseUrl) return null;

    const captionResp = await fetchWithRetry(track.baseUrl, {
      headers: { 'Accept-Language': lang },
    });
    if (!captionResp.ok) return null;
    const xml = await captionResp.text();
    return parseCaptionXML(xml, lang);
  } catch (error: any) {
    console.warn('[Watch page fallback] Failed:', error.message);
    return null;
  }
}

/**
 * Strategy 4: YouTube timedtext API (last resort).
 * Simple endpoint: GET https://www.youtube.com/api/timedtext?v=ID&lang=xx
 */
async function fetchViaTimedTextAPI(videoId: string, lang: string): Promise<Caption[] | null> {
  try {
    const resp = await fetchWithRetry(
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`
    );
    if (!resp.ok) return null;
    const xml = await resp.text();

    // Check if empty
    if (!xml || xml.trim() === '<tracks/>' || xml.includes('<tracks/>')) {
      return null;
    }

    const captions = parseCaptionXML(xml, lang);
    return captions.length > 0 ? captions : null;
  } catch (error: any) {
    console.warn('[TimedText API fallback] Failed:', error.message);
    return null;
  }
}

/**
 * Parse YouTube caption XML into Caption objects.
 * Supports both srv3 format (<p t="ms" d="ms">) and classic (<text start="s" dur="s">).
 */
function parseCaptionXML(xml: string, lang: string): Caption[] {
  const results: Caption[] = [];
  let match: RegExpExecArray | null;

  // srv3 format: <p t="ms" d="ms">text</p>
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durMs = parseInt(match[2], 10);
    let text = match[3];
    // Extract text from <s> tags
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch;
    let combined = '';
    while ((sMatch = sRegex.exec(text)) !== null) {
      combined += sMatch[1];
    }
    if (!combined) {
      combined = text.replace(/<[^>]+>/g, '');
    }
    combined = decodeHTMLEntities(combined).trim();
    if (combined) {
      results.push({
        text: combined,
        start: Math.round(startMs / 1000),
        dur: Math.round(durMs / 1000),
      });
    }
  }

  if (results.length > 0) return results;

  // Classic format: <text start="s" dur="s">content</text>
  const classicRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
  while ((match = classicRegex.exec(xml)) !== null) {
    results.push({
      text: decodeHTMLEntities(match[3]),
      start: parseFloat(match[1]),
      dur: parseFloat(match[2]),
    });
  }

  return results;
}

/**
 * Decode common HTML entities.
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/**
 * Fetch video title from YouTube oEmbed API with fallback to watch page scraping.
 */
async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const resp = await fetchWithRetry(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (resp.ok) {
      const data = await resp.json();
      return data.title || videoId;
    }
  } catch {
    // Fallback: scrape title from watch page
    try {
      const resp = await fetchWithRetry(`https://www.youtube.com/watch?v=${videoId}`);
      if (resp.ok) {
        const html = await resp.text();
        const titleMatch = html.match(/<title>([^<]*)<\/title>/);
        if (titleMatch) {
          return titleMatch[1].replace(' - YouTube', '').trim();
        }
      }
    } catch {
      // keep video ID as fallback
    }
  }
  return videoId;
}

/**
 * Main entry point: fetch transcript with multiple fallback strategies.
 */
export async function getTranscript(
  videoUrl: string,
  langCode: string
): Promise<TranscriptResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Could not extract video ID from URL');
  }

  const lang = langCode || 'en';
  let captions: Caption[] | null = null;
  let source = 'unknown';
  let lastError: string | null = null;

  // Strategy 1: youtube-transcript npm package (uses its own fetch, no custom headers)
  captions = await fetchViaYoutubeTranscriptPackage(videoId, lang);
  if (captions) {
    source = 'youtube-transcript-pkg';
  } else {
    lastError = 'youtube-transcript package failed';
  }

  // Strategy 2: Direct InnerTube API (Android context, retry-enabled)
  if (!captions) {
    captions = await fetchViaInnerTubeAPI(videoId, lang);
    if (captions) source = 'youtube-innertube-api';
  }

  // Strategy 3: Watch page HTML scraping (browser-like headers)
  if (!captions) {
    captions = await fetchViaWatchPage(videoId, lang);
    if (captions) source = 'youtube-watch-page-scrape';
  }

  // Strategy 4: YouTube timedtext API (last resort)
  if (!captions) {
    captions = await fetchViaTimedTextAPI(videoId, lang);
    if (captions) source = 'youtube-timedtext-api';
  }

  if (!captions || captions.length === 0) {
    const detail = lastError || 'No captions found through any method';
    throw new Error(detail);
  }

  const title = await fetchVideoTitle(videoId);

  return { title, captions, source };
}
