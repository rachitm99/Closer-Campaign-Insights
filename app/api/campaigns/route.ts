import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getDb } from "@/lib/firebaseAdmin";
import { serializeCampaign } from "@/lib/serialization";

const DEFAULT_LIMIT = 25;

const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || DEFAULT_LIMIT);
    const query = (searchParams.get("q") || "").trim().toLowerCase();
    const cursorId = searchParams.get("cursorId") || "";
    const db = getDb();
    let queryRef = query
      ? db
          .collection("campaigns")
          .where("nameLower", ">=", query)
          .where("nameLower", "<=", `${query}\uf8ff`)
          .orderBy("nameLower", "asc")
          .orderBy("createdAt", "desc")
      : db.collection("campaigns").orderBy("createdAt", "desc");

    if (cursorId) {
      const cursorSnapshot = await db.collection("campaigns").doc(cursorId).get();
      if (cursorSnapshot.exists) {
        queryRef = queryRef.startAfter(cursorSnapshot);
      }
    }

    const snapshot = await queryRef.limit(Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT).get();
    const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    const campaigns = snapshot.docs.map((doc) => serializeCampaign(doc.id, doc.data()));
    return NextResponse.json({
      campaigns,
      nextCursorId: lastDoc?.id || null,
      hasMore: snapshot.size === (Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load campaigns" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Campaign name is required." }, { status: 400 });
    }

    const db = getDb();
    const ref = db.collection("campaigns").doc();

    await ref.set({
      name: parsed.data.name,
      nameLower: parsed.data.name.toLowerCase(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const created = await ref.get();
    return NextResponse.json({ campaign: serializeCampaign(created.id, created.data() ?? {}) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create campaign" },
      { status: 500 },
    );
  }
}