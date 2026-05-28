import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getDb } from "@/lib/firebaseAdmin";
import { serializeCampaign } from "@/lib/serialization";

const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET() {
  try {
    const db = getDb();
    const snapshot = await db.collection("campaigns").orderBy("createdAt", "desc").get();

    const campaigns = snapshot.docs.map((doc) => serializeCampaign(doc.id, doc.data()));
    return NextResponse.json({ campaigns });
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
