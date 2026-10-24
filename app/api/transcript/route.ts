/**
 * POST /api/transcript
 * GET /api/transcript?videoUrl=...&langCode=en
 *
 * Replicates Tactiq's transcript API contract:
 *   POST https://tactiq-apps-prod.tactiq.io/transcript
 *   Headers: { content-type: application/json, X-Firebase-AppCheck: <token> }
 *   Body: { videoUrl: string, langCode: string }
 *   Response: { title: string, captions: [{ text, start, dur }], source: string }
 *
 * Uses youtube-transcript npm package with custom retry-enabled fetch,
 * plus fallbacks to InnerTube API and watch page scraping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId } from '@/lib/utils';
import { getTranscript } from '@/lib/youtube';

export async function POST(request: NextRequest) {
  let videoUrl: string | undefined;
  let langCode: string | undefined;

  try {
    const body = await request.json();
    videoUrl = body.videoUrl;
    langCode = body.langCode;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

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

  try {
    const result = await getTranscript(videoUrl, lang);
    return NextResponse.json({
      title: result.title,
      captions: result.captions,
      source: result.source,
      videoId: videoId,
    });
  } catch (error: any) {
    console.error('Transcript fetch error:', error);

    const errorMessage = error.message || 'Failed to fetch transcript';

    // Map known error types to appropriate status codes
    if (errorMessage.includes('captcha') || errorMessage.includes('rate limit') || errorMessage.includes('Too Many Request')) {
      return NextResponse.json(
        {
          error: `YouTube is rate limiting requests from this server. Try again in a few seconds.`,
          videoId,
          language: lang,
          originalError: errorMessage,
        },
        { status: 429 }
      );
    }

    if (errorMessage.includes('disabled') || errorMessage.includes('No transcripts') || errorMessage.includes('not available')) {
      return NextResponse.json(
        {
          error: `Transcript is not available for this video. It may be disabled by the creator or unavailable in ${lang}.`,
          videoId,
          language: lang,
          originalError: errorMessage,
        },
        { status: 404 }
      );
    }

    if (errorMessage.includes('unavailable') || errorMessage.includes('no longer available')) {
      return NextResponse.json(
        {
          error: `This video is unavailable. It may be private, deleted, or restricted.`,
          videoId,
          language: lang,
          originalError: errorMessage,
        },
        { status: 410 }
      );
    }

    return NextResponse.json(
      {
        error: `Couldn't get transcript for video: ${videoId} language: ${lang}`,
        videoId,
        language: lang,
        originalError: errorMessage,
        detail: errorMessage,
      },
      { status: 500 }
    );
  }
}

// GET endpoint — same logic, reads from query params
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

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return NextResponse.json(
      { error: 'Could not extract video ID from URL' },
      { status: 400 }
    );
  }

  const lang = langCode || 'en';

  try {
    const result = await getTranscript(videoUrl, lang);
    return NextResponse.json({
      title: result.title,
      captions: result.captions,
      source: result.source,
      videoId: videoId,
    });
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to fetch transcript';

    if (errorMessage.includes('captcha') || errorMessage.includes('rate limit') || errorMessage.includes('Too Many Request')) {
      return NextResponse.json(
        {
          error: `YouTube is rate limiting requests from this server. Try again in a few seconds.`,
          videoId,
          language: lang,
          originalError: errorMessage,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: `Couldn't get transcript for video: ${videoId} language: ${lang}`,
        videoId,
        language: lang,
        originalError: errorMessage,
        detail: errorMessage,
      },
      { status: 500 }
    );
  }
}
