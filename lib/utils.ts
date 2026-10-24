/**
 * Utility functions matching Tactiq YouTube Transcript tool behavior.
 * Reverse engineered from https://tactiq.io/tools/youtube-transcript
 */

/**
 * Extract YouTube video ID from a URL.
 * Same regex used by Tactiq's Astro client script:
 *   /(?<=[=/&])[a-zA-Z0-9_-]{11}(?=[=/&?#\n\r]|$)/
 */
export function extractVideoId(urlOrId: string): string | undefined {
  const match = /(?<=[=&/])[a-zA-Z0-9_-]{11}(?=[=&/?#\n\r]|$)/.exec(urlOrId);
  return match ? match[0] : undefined;
}

/**
 * Format seconds to HH:MM:SS.mmm timestamp string.
 * Matches Tactiq's US() function:
 *   new Date(seconds * 1000).toISOString().substring(11, 23)
 */
export function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toISOString().substring(11, 23);
}

/**
 * Generate the plain-text transcript format for copy/download.
 * Matches Tactiq's WS() function format:
 *   # tactiq.io free youtube transcript
 *   # {title}
 *   # https://www.youtube.com/watch/{videoId}
 *
 *   {timestamp} {text line}
 *   ...
 */
export function formatTranscriptText(
  title: string,
  videoId: string,
  captions: { text: string; start: number; dur: number }[]
): string {
  let result = `# tactiq.io free youtube transcript\n`;
  result += `# ${title}\n`;
  result += `# https://www.youtube.com/watch/${videoId}\n`;
  result += `\n`;
  for (const c of captions) {
    result += `${formatTimestamp(c.start)} ${c.text.replace(/\n/g, ' ')}\n`;
  }
  return result;
}

/**
 * HTML-escape function matching Tactiq's te() function.
 * (Used for safe display of transcript text)
 */
export function htmlEscape(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Decode URI component safely.
 * Matches Tactiq's decodeURI usage.
 */
export function safeDecodeURI(str: string): string {
  try {
    return decodeURI(str);
  } catch {
    return str;
  }
}
