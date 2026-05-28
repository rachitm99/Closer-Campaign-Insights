type FirestoreTimestamp = {
  toDate?: () => Date;
};

function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const maybeTimestamp = value as FirestoreTimestamp;
  if (typeof maybeTimestamp.toDate === "function") {
    return maybeTimestamp.toDate().toISOString();
  }

  return null;
}

export function serializeCampaign(docId: string, data: Record<string, unknown>) {
  return {
    id: docId,
    name: typeof data.name === "string" ? data.name : "Untitled Campaign",
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export function serializeReel(docId: string, data: Record<string, unknown>) {
  return {
    id: docId,
    shortcode: typeof data.shortcode === "string" ? data.shortcode : "",
    reelUrl: typeof data.reelUrl === "string" ? data.reelUrl : "",
    username: typeof data.username === "string" ? data.username : "",
    profileUrl: typeof data.profileUrl === "string" ? data.profileUrl : "",
    followers: typeof data.followers === "number" ? data.followers : 0,
    views: typeof data.views === "number" ? data.views : 0,
    comments: typeof data.comments === "number" ? data.comments : 0,
    likes: typeof data.likes === "number" ? data.likes : 0,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}
