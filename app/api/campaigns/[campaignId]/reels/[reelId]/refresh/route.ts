import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebaseAdmin";
import { fetchReelAnalyticsByShortcode } from "@/lib/instagram";
import { serializeReel } from "@/lib/serialization";

type Params = {
  params: Promise<{ campaignId: string; reelId: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const { campaignId, reelId } = await params;
    const db = getDb();
    const reelRef = db.collection("campaigns").doc(campaignId).collection("reels").doc(reelId);

    const reelSnapshot = await reelRef.get();
    if (!reelSnapshot.exists) {
      return NextResponse.json({ message: "Reel not found." }, { status: 404 });
    }

    const reelData = reelSnapshot.data();
    const shortcode = typeof reelData?.shortcode === "string" ? reelData.shortcode : reelId;
    const latest = await fetchReelAnalyticsByShortcode(shortcode);

    await reelRef.set(
      {
        ...latest,
        reelUrl: typeof reelData?.reelUrl === "string" ? reelData.reelUrl : latest.reelUrl,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await db.collection("campaigns").doc(campaignId).set(
      {
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const updated = await reelRef.get();
    return NextResponse.json({ reel: serializeReel(updated.id, updated.data() ?? {}) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to refresh reel" },
      { status: 500 },
    );
  }
}
