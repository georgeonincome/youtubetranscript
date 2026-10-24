/**
 * Global type declarations for YouTube IFrame API
 * and other browser globals used across the app.
 */

export {};

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: (() => void) | undefined;
  }

  interface YT {
    Player: new (
      elementId: string,
      config: {
        height: string;
        width: string;
        videoId: string;
        playerVars?: Record<string, unknown>;
        events?: Record<string, (event: any) => void>;
      }
    ) => YTPlayer;
    PlayerState: {
      UNSTARTED: -1;
      ENDED: 0;
      PLAYING: 1;
      PAUSED: 2;
      BUFFERING: 3;
      VIDEO_CUED: 5;
    };
  }

  interface YTPlayer {
    playVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    destroy(): void;
  }
}
