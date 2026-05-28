import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getDb } from "@/lib/firebaseAdmin";
import { extractShortcodeFromUrl, fetchReelAnalyticsByShortcode } from "@/lib/instagram";
import { serializeReel } from "@/lib/serialization";

const addReelSchema = z.object({
  reelUrl: z.string().trim().url(),
});

type Params = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { campaignId } = await params;
    const db = getDb();

    const snapshot = await db
      .collection("campaigns")
      .doc(campaignId)
      .collection("reels")
      .orderBy("updatedAt", "desc")
      .get();

    const reels = snapshot.docs.map((doc) => serializeReel(doc.id, doc.data()));
    return NextResponse.json({ reels });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load reels" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { campaignId } = await params;
    const body = await request.json();
    const parsed = addReelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Valid reelUrl is required." }, { status: 400 });
    }

    const shortcode = extractShortcodeFromUrl(parsed.data.reelUrl);
    if (!shortcode) {
      return NextResponse.json(
        { message: "Could not extract shortcode from reel URL." },
        { status: 400 },
      );
    }

    const analytics = await fetchReelAnalyticsByShortcode(shortcode);
    const db = getDb();

    const reelRef = db
      .collection("campaigns")
      .doc(campaignId)
      .collection("reels")
      .doc(shortcode);

    await reelRef.set(
      {
        ...analytics,
        reelUrl: parsed.data.reelUrl,
        createdAt: FieldValue.serverTimestamp(),
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
    return NextResponse.json({ reel: serializeReel(updated.id, updated.data() ?? {}) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to add reel" },
      { status: 500 },
    );
  }
}
