"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractReelInputsFromText } from "@/lib/instagram";

const CAMPAIGN_PAGE_SIZE = 25;
const REEL_PAGE_SIZE = 25;

type Campaign = {
  id: string;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type Reel = {
  id: string;
  shortcode: string;
  reelUrl: string;
  username: string;
  profileUrl: string;
  followers: number;
  views: number;
  comments: number;
  likes: number;
  updatedAt: string | null;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [reels, setReels] = useState<Reel[]>([]);
  const [campaignCursorId, setCampaignCursorId] = useState<string>("");
  const [campaignHasMore, setCampaignHasMore] = useState(false);
  const [reelCursorId, setReelCursorId] = useState<string>("");
  const [reelsHasMore, setReelsHasMore] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [editingCampaignId, setEditingCampaignId] = useState<string>("");
  const [editingCampaignName, setEditingCampaignName] = useState("");
  const [reelText, setReelText] = useState("");

  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingMoreCampaigns, setLoadingMoreCampaigns] = useState(false);
  const [loadingReels, setLoadingReels] = useState(false);
  const [loadingMoreReels, setLoadingMoreReels] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [addingReel, setAddingReel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addProgress, setAddProgress] = useState<{ current: number; total: number; shortcode?: string } | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number; shortcode?: string } | null>(null);
  const [refreshingReelIds, setRefreshingReelIds] = useState<string[]>([]);
  const [justUpdatedReelIds, setJustUpdatedReelIds] = useState<string[]>([]);
  const [refreshWarningReelIds, setRefreshWarningReelIds] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const campaignsRequestRef = useRef(0);
  const reelsRequestRef = useRef(0);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId),
    [campaigns, selectedCampaignId],
  );

  const refreshingReelIdSet = useMemo(() => new Set(refreshingReelIds), [refreshingReelIds]);
  const justUpdatedReelIdSet = useMemo(() => new Set(justUpdatedReelIds), [justUpdatedReelIds]);
  const refreshWarningReelIdSet = useMemo(() => new Set(refreshWarningReelIds), [refreshWarningReelIds]);

  const loadCampaigns = useCallback(
    async ({ append = false, cursorId = "", query = campaignSearch.trim() }: { append?: boolean; cursorId?: string; query?: string } = {}) => {
      const requestId = ++campaignsRequestRef.current;

      if (append) {
        setLoadingMoreCampaigns(true);
      } else {
        setLoadingCampaigns(true);
      }

      setError("");

      try {
        const search = query.trim();
        const params = new URLSearchParams();
        params.set("limit", String(CAMPAIGN_PAGE_SIZE));
        if (search) {
          params.set("q", search);
        }
        if (cursorId) {
          params.set("cursorId", cursorId);
        }

        const response = await fetch(`/api/campaigns?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load campaigns");
        }

        if (requestId !== campaignsRequestRef.current) {
          return;
        }

        const loadedCampaigns: Campaign[] = payload.campaigns || [];
        setCampaigns((current) => {
          if (!append) {
            return loadedCampaigns;
          }

          const knownIds = new Set(current.map((campaign) => campaign.id));
          return [...current, ...loadedCampaigns.filter((campaign) => !knownIds.has(campaign.id))];
        });
        setCampaignCursorId(payload.nextCursorId || "");
        setCampaignHasMore(Boolean(payload.hasMore));

        setSelectedCampaignId((current) => current || loadedCampaigns[0]?.id || "");
      } catch (err) {
        if (requestId === campaignsRequestRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load campaigns");
        }
      } finally {
        if (requestId === campaignsRequestRef.current) {
          if (append) {
            setLoadingMoreCampaigns(false);
          } else {
            setLoadingCampaigns(false);
          }
        }
      }
    },
    [campaignSearch],
  );

  const loadReels = useCallback(
    async ({ campaignId, append = false, cursorId = "" }: { campaignId: string; append?: boolean; cursorId?: string }) => {
      if (!campaignId) {
        setReels([]);
        setReelCursorId("");
        setReelsHasMore(false);
        setRefreshWarningReelIds([]);
        return;
      }

      const requestId = ++reelsRequestRef.current;

      if (append) {
        setLoadingMoreReels(true);
      } else {
        setLoadingReels(true);
      }

      setError("");

      try {
        const params = new URLSearchParams();
        params.set("limit", String(REEL_PAGE_SIZE));
        if (cursorId) {
          params.set("cursorId", cursorId);
        }

        const response = await fetch(`/api/campaigns/${campaignId}/reels?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load reels");
        }

        if (requestId !== reelsRequestRef.current) {
          return;
        }

        const loadedReels: Reel[] = payload.reels || [];
        setRefreshWarningReelIds([]);
        setReels((current) => {
          if (!append) {
            return loadedReels;
          }

          const knownIds = new Set(current.map((reel) => reel.id));
          return [...current, ...loadedReels.filter((reel) => !knownIds.has(reel.id))];
        });
        setReelCursorId(payload.nextCursorId || "");
        setReelsHasMore(Boolean(payload.hasMore));
      } catch (err) {
        if (requestId === reelsRequestRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load reels");
        }
      } finally {
        if (requestId === reelsRequestRef.current) {
          if (append) {
            setLoadingMoreReels(false);
          } else {
            setLoadingReels(false);
          }
        }
      }
    },
    [],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadCampaigns({ query: campaignSearch.trim() });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [campaignSearch, loadCampaigns]);

  useEffect(() => {
    if (selectedCampaignId) {
      const timeoutId = setTimeout(() => {
        void loadReels({ campaignId: selectedCampaignId });
      }, 0);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [selectedCampaignId, loadReels]);

  function loadMoreCampaigns() {
    if (!campaignHasMore || loadingMoreCampaigns) {
      return;
    }

    void loadCampaigns({ append: true, cursorId: campaignCursorId, query: campaignSearch.trim() });
  }

  function loadMoreReels() {
    if (!selectedCampaignId || !reelsHasMore || loadingMoreReels) {
      return;
    }

    void loadReels({ campaignId: selectedCampaignId, append: true, cursorId: reelCursorId });
  }

  async function handleCreateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignName.trim()) {
      return;
    }

    setCreatingCampaign(true);
    setError("");

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: campaignName.trim() }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to create campaign");
      }

      const createdCampaign: Campaign = payload.campaign;
      setCampaigns((current) => [createdCampaign, ...current]);
      setSelectedCampaignId(createdCampaign.id);
      setCampaignName("");
      setReels([]);
      setRefreshWarningReelIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setCreatingCampaign(false);
    }
  }

  function beginEditCampaign(campaignId: string) {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      return;
    }

    setEditingCampaignId(campaignId);
    setEditingCampaignName(campaign.name);
  }

  function cancelEditCampaign() {
    setEditingCampaignId("");
    setEditingCampaignName("");
  }

  async function handleUpdateCampaign(campaignId: string) {
    const nextName = editingCampaignName.trim();

    if (!nextName) {
      setError("Campaign name is required.");
      return;
    }

    setError("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to update campaign");
      }

      const updatedCampaign = payload.campaign as Campaign;
      setCampaigns((current) => current.map((item) => (item.id === campaignId ? updatedCampaign : item)));
      setSelectedCampaignId(campaignId);
      cancelEditCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update campaign");
    }
  }

  async function handleAddReel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCampaignId || !reelText.trim()) {
      return;
    }

    const parsedReels = extractReelInputsFromText(reelText);

    if (parsedReels.length === 0) {
      setError("Paste one or more valid Instagram reel URLs.");
      return;
    }

    setAddingReel(true);
    setError("");
    setAddProgress({ current: 0, total: parsedReels.length });

    try {
      let addedCount = 0;
      let skippedCount = 0;

      for (let index = 0; index < parsedReels.length; index += 1) {
        const item = parsedReels[index];

        setAddProgress({ current: index + 1, total: parsedReels.length, shortcode: item.shortcode });

        const response = await fetch(`/api/campaigns/${selectedCampaignId}/reels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reelUrl: item.reelUrl }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to add reel");
        }

        addedCount += payload.addedCount || 0;
        skippedCount += payload.skippedCount || 0;

        if (payload.reel) {
          setReels((current) => {
            const withoutDuplicate = current.filter((reel) => reel.id !== payload.reel.id);
            return [payload.reel, ...withoutDuplicate];
          });
          setRefreshWarningReelIds((current) => current.filter((id) => id !== payload.reel.id));
          setJustUpdatedReelIds((current) => [...current, payload.reel.id]);
          setTimeout(() => {
            setJustUpdatedReelIds((current) => current.filter((id) => id !== payload.reel.id));
          }, 2000);
        }

      }

      setReelText("");

      if (skippedCount > 0 && addedCount === 0) {
        setError("All pasted reels were duplicates and were ignored.");
      } else if (skippedCount > 0) {
        setError(`${skippedCount} duplicate reel${skippedCount === 1 ? " was" : "s were"} ignored.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add reel");
    } finally {
      setAddingReel(false);
      setAddProgress(null);
    }
  }

  async function handleRefreshCampaign() {
    if (!selectedCampaignId) {
      return;
    }

    setRefreshing(true);
    setError("");
    const snapshot = [...reels];
    setRefreshProgress({ current: 0, total: snapshot.length });
    setRefreshingReelIds(snapshot.map((reel) => reel.id));

    let errorCount = 0;

    for (let index = 0; index < snapshot.length; index += 1) {
      const reel = snapshot[index];
      setRefreshProgress({ current: index + 1, total: snapshot.length, shortcode: reel.shortcode });

      try {
        const response = await fetch(`/api/campaigns/${selectedCampaignId}/reels/${reel.id}/refresh`, {
          method: "POST",
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to refresh reel");
        }

        if (payload.reel) {
          setReels((current) => current.map((item) => (item.id === reel.id ? payload.reel : item)));
          setRefreshWarningReelIds((current) => current.filter((id) => id !== reel.id));
          setJustUpdatedReelIds((current) => [...current, reel.id]);
          setTimeout(() => {
            setJustUpdatedReelIds((current) => current.filter((id) => id !== reel.id));
          }, 2000);
        }
      } catch {
        errorCount += 1;
        setRefreshWarningReelIds((current) => (current.includes(reel.id) ? current : [...current, reel.id]));
      } finally {
        setRefreshingReelIds((current) => current.filter((id) => id !== reel.id));
      }
    }

    if (errorCount > 0) {
      setError(`${errorCount} reel${errorCount === 1 ? "" : "s"} failed to refresh.`);
    }

    setRefreshing(false);
    setRefreshProgress(null);
    setRefreshingReelIds([]);
  }

  async function handleDeleteCampaign(campaignId: string) {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign || !window.confirm(`Delete campaign \"${campaign.name}\" and all its reels?`)) {
      return;
    }

    setError("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to delete campaign");
      }

      const remainingCampaigns = campaigns.filter((item) => item.id !== campaignId);
      setCampaigns(remainingCampaigns);

      if (selectedCampaignId === campaignId) {
        setSelectedCampaignId(remainingCampaigns[0]?.id || "");
        setReels([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete campaign");
    }
  }

  async function handleRefreshReel(reelId: string) {
    if (!selectedCampaignId) {
      return;
    }

    setError("");
    setRefreshingReelIds((current) => [...current, reelId]);

    try {
      const response = await fetch(`/api/campaigns/${selectedCampaignId}/reels/${reelId}/refresh`, {
        method: "POST",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to refresh reel");
      }

      if (payload.reel) {
        setReels((current) => current.map((item) => (item.id === reelId ? payload.reel : item)));
        setRefreshWarningReelIds((current) => current.filter((id) => id !== reelId));
        setJustUpdatedReelIds((current) => [...current, reelId]);
        setTimeout(() => {
          setJustUpdatedReelIds((current) => current.filter((id) => id !== reelId));
        }, 2000);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh reel");
      setRefreshWarningReelIds((current) => (current.includes(reelId) ? current : [...current, reelId]));
    } finally {
      setRefreshingReelIds((current) => current.filter((id) => id !== reelId));
    }
  }

  async function handleDeleteReel(reelId: string) {
    if (!selectedCampaignId || !window.confirm("Delete this reel from the campaign?")) {
      return;
    }

    setError("");

    try {
      const response = await fetch(`/api/campaigns/${selectedCampaignId}/reels/${reelId}`, {
        method: "DELETE",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to delete reel");
      }

      setReels((current) => current.filter((reel) => reel.id !== reelId));
      setRefreshWarningReelIds((current) => current.filter((id) => id !== reelId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete reel");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Closer Campaign Insights</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Instagram Reel Campaign Analytics</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create campaigns, add reel URLs, and refresh all reel analytics from one button inside each campaign.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {addProgress ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          Adding reel {addProgress.current} of {addProgress.total}
          {addProgress.shortcode ? ` - ${addProgress.shortcode}` : ""}
        </div>
      ) : null}

      {refreshProgress ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Refreshing reel {refreshProgress.current} of {refreshProgress.total}
          {refreshProgress.shortcode ? ` - ${refreshProgress.shortcode}` : ""}
        </div>
      ) : null}

      <main className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Campaigns</h2>

          <form onSubmit={handleCreateCampaign} className="mt-3 flex flex-col gap-2">
            <input
              type="text"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder="New campaign name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:ring-2"
            />
            <button
              type="submit"
              disabled={creatingCampaign}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingCampaign ? "Creating..." : "Create Campaign"}
            </button>
          </form>

          <input
            type="search"
            value={campaignSearch}
            onChange={(event) => setCampaignSearch(event.target.value)}
            placeholder="Search campaigns"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 transition focus:ring-2"
          />

          <div className="mt-4 space-y-2">
            {loadingCampaigns ? <p className="text-sm text-slate-500">Loading campaigns...</p> : null}

            {!loadingCampaigns && campaigns.length === 0 ? (
              <p className="text-sm text-slate-500">
                {campaignSearch.trim() ? "No campaigns match your search." : "No campaigns yet. Create your first campaign."}
              </p>
            ) : null}

            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition ${
                  campaign.id === selectedCampaignId
                    ? "border-teal-600 bg-teal-50 text-teal-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {editingCampaignId === campaign.id ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <input
                      type="text"
                      value={editingCampaignName}
                      onChange={(event) => setEditingCampaignName(event.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none ring-teal-500 focus:ring-2"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleUpdateCampaign(campaign.id)}
                        className="rounded-md bg-teal-700 px-2 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditCampaign}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className="flex-1 text-left"
                    type="button"
                  >
                    <p className="text-sm font-semibold">{campaign.name}</p>
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => beginEditCampaign(campaign.id)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCampaign(campaign.id)}
                    className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {campaignHasMore ? (
              <button
                type="button"
                onClick={loadMoreCampaigns}
                disabled={loadingMoreCampaigns}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMoreCampaigns ? "Loading more..." : "Load more campaigns"}
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedCampaign ? selectedCampaign.name : "Select a campaign"}
              </h2>
              <p className="text-sm text-slate-500">Campaign reels and analytics table</p>
            </div>

            <button
              type="button"
              onClick={handleRefreshCampaign}
              disabled={!selectedCampaignId || refreshing}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing visible reels..." : "Refresh Visible Reels"}
            </button>
          </div>

          <form onSubmit={handleAddReel} className="mt-4 flex flex-col gap-2">
            <textarea
              value={reelText}
              onChange={(event) => setReelText(event.target.value)}
              placeholder={
                selectedCampaignId
                  ? "Paste one or more Instagram reel URLs here, one per line or mixed into text."
                  : "Select a campaign first"
              }
              disabled={!selectedCampaignId}
              rows={6}
              className="min-h-32 w-full resize-y rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none ring-teal-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <button
              type="submit"
              disabled={!selectedCampaignId || addingReel}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addingReel ? "Adding..." : "Add Reels"}
            </button>
          </form>

          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[980px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-3 font-semibold">Username</th>
                  <th className="px-3 py-3 font-semibold">Profile URL</th>
                  <th className="px-3 py-3 font-semibold">Reel URL</th>
                  <th className="px-3 py-3 font-semibold">Total Followers</th>
                  <th className="px-3 py-3 font-semibold">Total Views</th>
                  <th className="px-3 py-3 font-semibold">Total Comments</th>
                  <th className="px-3 py-3 font-semibold">Likes</th>
                  <th className="px-3 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingReels ? (
                  <tr>
                    <td className="px-3 py-5 text-slate-500" colSpan={8}>
                      Loading reels...
                    </td>
                  </tr>
                ) : null}

                {!loadingReels && reels.length === 0 ? (
                  <tr>
                    <td className="px-3 py-5 text-slate-500" colSpan={8}>
                      {selectedCampaignId
                        ? "No reels in this campaign yet. Add a reel URL to begin."
                        : "Create or select a campaign to manage reels."}
                    </td>
                  </tr>
                ) : null}

                {reels.map((reel) => (
                  <tr
                    key={reel.id}
                    className={`border-t border-slate-100 transition-all duration-500 ${
                      refreshingReelIdSet.has(reel.id)
                        ? "bg-slate-100 opacity-40"
                        : justUpdatedReelIdSet.has(reel.id)
                        ? "bg-teal-50/60"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-3 font-medium text-slate-900">{reel.username || "-"}</td>
                    <td className="px-3 py-3">
                      {reel.profileUrl ? (
                        <a className="text-teal-700 underline" href={reel.profileUrl} target="_blank" rel="noreferrer">
                          Open Profile
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {reel.reelUrl ? (
                        <a className="text-teal-700 underline" href={reel.reelUrl} target="_blank" rel="noreferrer">
                          Open Reel
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {refreshingReelIdSet.has(reel.id) ? <span className="text-slate-300">—</span> : formatNumber(reel.followers)}
                    </td>
                    <td className="px-3 py-3">
                      {refreshingReelIdSet.has(reel.id) ? <span className="text-slate-300">—</span> : formatNumber(reel.views)}
                    </td>
                    <td className="px-3 py-3">
                      {refreshingReelIdSet.has(reel.id) ? <span className="text-slate-300">—</span> : formatNumber(reel.comments)}
                    </td>
                    <td className="px-3 py-3">
                      {refreshingReelIdSet.has(reel.id) ? <span className="text-slate-300">—</span> : formatNumber(reel.likes)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        {refreshWarningReelIdSet.has(reel.id) ? (
                          <span
                            className="inline-flex items-center self-center text-amber-500"
                            title="Refresh failed. Keeping previous values."
                            aria-label="Refresh failed"
                          >
                            ⚠
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleRefreshReel(reel.id)}
                          disabled={refreshingReelIdSet.has(reel.id)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {refreshingReelIdSet.has(reel.id) ? "Refreshing..." : "Refresh"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteReel(reel.id)}
                          className="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reelsHasMore ? (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={loadMoreReels}
                disabled={loadingMoreReels}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMoreReels ? "Loading more reels..." : "Load more reels"}
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}