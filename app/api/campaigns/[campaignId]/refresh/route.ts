import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebaseAdmin";
import { fetchReelAnalyticsByShortcode } from "@/lib/instagram";
import { serializeReel } from "@/lib/serialization";

const BATCH_LIMIT = 25;

type Params = {
  params: Promise<{ campaignId: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const { campaignId } = await params;
    const db = getDb();
    const reelsCollection = db.collection("campaigns").doc(campaignId).collection("reels");

    let lastSnapshot: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;
    let totalRefreshed = 0;

    while (true) {
      let query = reelsCollection.orderBy("updatedAt", "desc").orderBy("__name__", "desc");

      if (lastSnapshot) {
        query = query.startAfter(lastSnapshot);
      }

      const existing = await query.limit(BATCH_LIMIT).get();

      if (existing.empty) {
        break;
      }

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

        totalRefreshed += 1;
      }

      lastSnapshot = existing.docs[existing.docs.length - 1] || null;
      if (existing.size < BATCH_LIMIT) {
        break;
      }
    }

    await db.collection("campaigns").doc(campaignId).set(
      {
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const refreshed = await reelsCollection.orderBy("updatedAt", "desc").orderBy("__name__", "desc").limit(BATCH_LIMIT).get();
    const reels = refreshed.docs.map((doc) => serializeReel(doc.id, doc.data()));

    return NextResponse.json({ refreshedCount: totalRefreshed, reels });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to refresh reels" },
      { status: 500 },
    );
  }
}