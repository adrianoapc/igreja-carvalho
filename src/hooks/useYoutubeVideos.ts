import { useEffect, useState } from "react";

export interface YoutubeVideo {
  videoId:     string;
  title:       string;
  description: string;
  publishedAt: string;
  thumbnail:   string;
}

interface FetchState {
  videos:  YoutubeVideo[];
  loading: boolean;
  error:   string | null;
}

const API_KEY    = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const CHANNEL_ID = import.meta.env.VITE_YOUTUBE_CHANNEL_ID as string | undefined;

export function useYoutubeVideos(maxResults = 12): FetchState {
  const [state, setState] = useState<FetchState>({ videos: [], loading: true, error: null });

  useEffect(() => {
    if (!API_KEY || !CHANNEL_ID) {
      setState({ videos: [], loading: false, error: "not-configured" });
      return;
    }

    const controller = new AbortController();

    async function fetchVideos() {
      try {
        // Usa playlistItems (uploads playlist = "UU" + channelId sem "UC")
        const uploadsPlaylistId = "UU" + CHANNEL_ID!.slice(2);
        const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
        url.searchParams.set("part", "snippet");
        url.searchParams.set("playlistId", uploadsPlaylistId);
        url.searchParams.set("maxResults", String(maxResults));
        url.searchParams.set("key", API_KEY!);

        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error(`YouTube API ${res.status}`);

        const data = await res.json();

        const videos: YoutubeVideo[] = (data.items ?? []).map((item: {
          snippet: {
            resourceId: { videoId: string };
            title: string;
            description: string;
            publishedAt: string;
            thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
          };
        }) => ({
          videoId:     item.snippet.resourceId.videoId,
          title:       item.snippet.title,
          description: item.snippet.description,
          publishedAt: item.snippet.publishedAt,
          thumbnail:   item.snippet.thumbnails.high?.url
                    ?? item.snippet.thumbnails.medium?.url
                    ?? item.snippet.thumbnails.default?.url
                    ?? "",
        }));

        setState({ videos, loading: false, error: null });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState({ videos: [], loading: false, error: (err as Error).message });
      }
    }

    fetchVideos();
    return () => controller.abort();
  }, [maxResults]);

  return state;
}
