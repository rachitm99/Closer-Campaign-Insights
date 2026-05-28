import { NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getDb } from "@/lib/firebaseAdmin";
import {
  extractReelInputsFromText,
  extractShortcodeFromUrl,
  fetchReelAnalyticsByShortcode,
} from "@/lib/instagram";
import { serializeReel } from "@/lib/serialization";

const addReelSchema = z.object({
  reelUrl: z.string().trim().url().optional(),
  reelUrls: z.array(z.string().trim().url()).optional(),
  bulkText: z.string().trim().optional(),
});

const DEFAULT_LIMIT = 25;

type Params = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { campaignId } = await params;
    const requestUrl = new URL(_.url);
    const limit = Number(requestUrl.searchParams.get("limit") || DEFAULT_LIMIT);
    const cursorId = requestUrl.searchParams.get("cursorId") || "";
    const db = getDb();

    let query = db
      .collection("campaigns")
      .doc(campaignId)
      .collection("reels")
      .orderBy("updatedAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");

    if (cursorId) {
      const cursorSnapshot = await db.collection("campaigns").doc(campaignId).collection("reels").doc(cursorId).get();
      if (cursorSnapshot.exists) {
        query = query.startAfter(cursorSnapshot);
      }
    }

    const snapshot = await query.limit(Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT).get();
    const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    const reels = snapshot.docs.map((doc) => serializeReel(doc.id, doc.data()));
    return NextResponse.json({
      reels,
      nextCursorId: lastDoc?.id || null,
      hasMore: snapshot.size === (Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT),
    });
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

    const reelInputs =
      parsed.data.reelUrls?.map((reelUrl) => ({
        reelUrl,
        shortcode: extractShortcodeFromUrl(reelUrl),
      })) ??
      (parsed.data.bulkText ? extractReelInputsFromText(parsed.data.bulkText) : []) ??
      [];

    if (!parsed.data.reelUrls?.length && parsed.data.reelUrl) {
      const shortcode = extractShortcodeFromUrl(parsed.data.reelUrl);
      if (shortcode) {
        reelInputs.push({ reelUrl: parsed.data.reelUrl, shortcode });
      }
    }

    const validInputs = reelInputs.filter(
      (item): item is { reelUrl: string; shortcode: string } => Boolean(item.shortcode),
    );

    if (validInputs.length === 0) {
      return NextResponse.json(
        { message: "Paste one or more valid Instagram reel URLs." },
        { status: 400 },
      );
    }

    const db = getDb();
    const reelsCollection = db.collection("campaigns").doc(campaignId).collection("reels");
    const addedReels = [] as Awaited<ReturnType<typeof fetchReelAnalyticsByShortcode>>[];

    for (const input of validInputs) {
      const reelRef = reelsCollection.doc(input.shortcode);
      const existing = await reelRef.get();

      if (existing.exists) {
        continue;
      }

      const analytics = await fetchReelAnalyticsByShortcode(input.shortcode);

      await reelRef.set(
        {
          ...analytics,
          reelUrl: input.reelUrl,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      addedReels.push(analytics);
    }

    await db.collection("campaigns").doc(campaignId).set(
      {
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const updated = await reelsCollection.orderBy("updatedAt", "desc").get();
    const reels = updated.docs.map((doc) => serializeReel(doc.id, doc.data()));

    if (validInputs.length === 1) {
      const addedReel = reels.find((reel) => reel.shortcode === validInputs[0].shortcode);

      return NextResponse.json(
        {
          reel: addedReel ?? null,
          addedCount: addedReels.length,
          skippedCount: validInputs.length - addedReels.length,
        },
        { status: addedReel ? 201 : 200 },
      );
    }

    return NextResponse.json(
      { reels, addedCount: addedReels.length, skippedCount: validInputs.length - addedReels.length },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to add reel" },
      { status: 500 },
    );
  }
}