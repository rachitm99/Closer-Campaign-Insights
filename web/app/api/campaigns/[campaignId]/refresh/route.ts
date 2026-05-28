import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebaseAdmin";
import { fetchReelAnalyticsByShortcode } from "@/lib/instagram";
import { serializeReel } from "@/lib/serialization";

type Params = {
  params: Promise<{ campaignId: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const { campaignId } = await params;
    const db = getDb();
    const reelsCollection = db.collection("campaigns").doc(campaignId).collection("reels");

    const existing = await reelsCollection.get();

    for (const doc of existing.docs) {
      const data = doc.data();
      const shortcode = typeof data.shortcode === "string" ? data.shortcode : doc.id;

      if (!shortcode) {
        continue;
      }

      const latest = await fetchReelAnalyticsByShortcode(shortcode);
      await reelsCollection.doc(doc.id).set(
        {
          ...latest,
          reelUrl: typeof data.reelUrl === "string" ? data.reelUrl : latest.reelUrl,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    await db.collection("campaigns").doc(campaignId).set(
      {
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const refreshed = await reelsCollection.orderBy("updatedAt", "desc").get();
    const reels = refreshed.docs.map((doc) => serializeReel(doc.id, doc.data()));

    return NextResponse.json({ refreshedCount: reels.length, reels });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to refresh reels" },
      { status: 500 },
    );
  }
}
