/**
 * POST /api/transcript
 * 
 * Replicates Tactiq's transcript API contract:
 *   POST https://tactiq-apps-prod.tactiq.io/transcript
 *   Headers: { content-type: application/json, X-Firebase-AppCheck: <token> }
 *   Body: { videoUrl: string, langCode: string }
 *   Response: { title: string, captions: [{ text, start, dur }] }
 * 
 * Our version uses the youtube-transcript npm package (no Firebase AppCheck needed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchTranscript } from 'youtube-transcript';
import { extractVideoId } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrl, langCode } = body;

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Missing videoUrl parameter' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Could not extract video ID from URL' },
        { status: 400 }
      );
    }

    const lang = langCode || 'en';

    // Fetch transcript from YouTube using youtube-transcript package
    // Returns: [{ text, duration, offset, lang }]
    // Note: duration and offset are in milliseconds
    const transcript = await fetchTranscript(videoId, { lang });

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: 'No transcript available for this video' },
        { status: 404 }
      );
    }

    // Get video title from YouTube oEmbed API
    let title = videoId;
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { next: { revalidate: 3600 } } // cache for 1 hour
      );
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        title = oembedData.title || videoId;
      }
    } catch {
      // Fallback: try to scrape title from watch page
      try {
        const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        const html = await watchRes.text();
        const titleMatch = html.match(/<title>([^<]*)<\/title>/);
        if (titleMatch) {
          title = titleMatch[1].replace(' - YouTube', '').trim();
        }
      } catch {
        /* keep videoId as fallback title */
      }
    }

    // Convert to Tactiq's format: {text, start, dur} (seconds, not ms)
    const captions = transcript.map((item) => ({
      text: item.text,
      start: Math.round((item.offset || 0) / 1000),
      dur: Math.round((item.duration || 0) / 1000),
    }));

    return NextResponse.json({ title, captions });
  } catch (error: any) {
    console.error('Transcript fetch error:', error);

    // Handle rate limiting from youtube-transcript
    if (error.statusCode === 429) {
      return NextResponse.json(
        { error: 'Rate limited by YouTube. Try again in a few seconds.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch transcript',
        statusCode: error.statusCode || 500,
      },
      { status: error.statusCode || 500 }
    );
  }
}

// Also support GET for simple usage
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('videoUrl') || searchParams.get('url') || searchParams.get('yt');
  const langCode = searchParams.get('langCode') || searchParams.get('lang') || 'en';

  if (!videoUrl) {
    return NextResponse.json(
      { error: 'Missing videoUrl parameter' },
      { status: 400 }
    );
  }

  // Reuse POST logic by creating a mock request
  const mockRequest = {
    json: async () => ({ videoUrl, langCode }),
  } as any;

  return POST(mockRequest);
}
