export type ReelAnalytics = {
  shortcode: string;
  reelUrl: string;
  username: string;
  profileUrl: string;
  followers: number;
  views: number;
  comments: number;
  likes: number;
};

export type ParsedReelInput = {
  shortcode: string;
  reelUrl: string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

type RocketMediaItem = {
  user?: {
    pk_id?: string;
    username?: string;
    follower_count?: number;
    edge_followed_by?: {
      count?: number;
    };
    followerCount?: number;
  };
  play_count?: number;
  view_count?: number;
  video_view_count?: number;
  comment_count?: number;
  like_count?: number;
};

type RocketUserInfo = {
  user?: {
    username?: string;
    follower_count?: number;
    edge_followed_by?: {
      count?: number;
    };
    followerCount?: number;
  };
};

type RocketResponse = {
  response?: {
    body?: {
      items?: RocketMediaItem[];
    };
  };
};

export function extractShortcodeFromUrl(reelUrl: string): string | null {
  try {
    const parsed = new URL(reelUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const contentIndex = parts.findIndex((segment) => ["reel", "p", "tv"].includes(segment));

    if (contentIndex === -1 || !parts[contentIndex + 1]) {
      return null;
    }

    return parts[contentIndex + 1];
  } catch {
    return null;
  }
}

export function extractReelInputsFromText(text: string): ParsedReelInput[] {
  const reelUrlPattern = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p|tv)\/[A-Za-z0-9_-]+\/?(?:\?[^^\s]*)?/gi;
  const matches = text.match(reelUrlPattern) || [];
  const seen = new Set<string>();
  const parsedInputs: ParsedReelInput[] = [];

  for (const match of matches) {
    const shortcode = extractShortcodeFromUrl(match);
    if (!shortcode || seen.has(shortcode)) {
      continue;
    }

    seen.add(shortcode);
    parsedInputs.push({
      shortcode,
      reelUrl: match.replace(/[),.;\]]+$/u, ""),
    });
  }

  return parsedInputs;
}

function extractItem(raw: unknown): RocketMediaItem {
  const item = (raw as RocketResponse)?.response?.body?.items?.[0];
  if (!item) {
    throw new Error("RocketAPI response did not include a media item.");
  }
  return item;
}

async function fetchFollowerCountByUserId(userId: string): Promise<number | null> {
  const token = process.env.ROCKETAPI_TOKEN;

  if (!token) {
    throw new Error("Missing required environment variable: ROCKETAPI_TOKEN");
  }

  const response = await fetch("https://v1.rocketapi.io/instagram/user/get_info_by_id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify({ id: userId }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { response?: { body?: RocketUserInfo } };
  const user = payload?.response?.body?.user;

  return toNumber(user?.follower_count ?? user?.edge_followed_by?.count ?? user?.followerCount);
}

export async function fetchReelAnalyticsByShortcode(shortcode: string): Promise<ReelAnalytics> {
  const token = process.env.ROCKETAPI_TOKEN;

  if (!token) {
    throw new Error("Missing required environment variable: ROCKETAPI_TOKEN");
  }

  const response = await fetch("https://v1.rocketapi.io/instagram/media/get_info_by_shortcode", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify({ shortcode }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`RocketAPI request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const item = extractItem(payload);

  const username = item?.user?.username ?? "";
  const userId = item?.user?.pk_id ?? "";
  const followerCountFromReel = toNumber(
    item?.user?.follower_count ?? item?.user?.edge_followed_by?.count ?? item?.user?.followerCount,
  );
  const followerCountFromUserLookup = userId ? await fetchFollowerCountByUserId(userId) : null;

  return {
    shortcode,
    reelUrl: `https://www.instagram.com/reel/${shortcode}/`,
    username,
    profileUrl: username ? `https://www.instagram.com/${username}/` : "",
    followers: followerCountFromUserLookup ?? followerCountFromReel,
    views: toNumber(item?.play_count ?? item?.view_count ?? item?.video_view_count),
    comments: toNumber(item?.comment_count),
    likes: toNumber(item?.like_count),
  };
}