import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

type Params = {
  params: Promise<{ campaignId: string }>;
};

const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { campaignId } = await params;
    const db = getDb();
    const campaignRef = db.collection("campaigns").doc(campaignId);

    await db.recursiveDelete(campaignRef);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete campaign" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { campaignId } = await params;
    const body = await request.json();
    const parsed = updateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Campaign name is required." }, { status: 400 });
    }

    const db = getDb();
    const campaignRef = db.collection("campaigns").doc(campaignId);

    await campaignRef.set(
      {
        name: parsed.data.name,
        nameLower: parsed.data.name.toLowerCase(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const updated = await campaignRef.get();
    return NextResponse.json({ campaign: { id: updated.id, ...updated.data() } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update campaign" },
      { status: 500 },
    );
  }
}
