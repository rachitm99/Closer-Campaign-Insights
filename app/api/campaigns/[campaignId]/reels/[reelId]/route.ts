import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebaseAdmin";

type Params = {
  params: Promise<{ campaignId: string; reelId: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { campaignId, reelId } = await params;
    const db = getDb();

    await db.collection("campaigns").doc(campaignId).collection("reels").doc(reelId).delete();
    await db.collection("campaigns").doc(campaignId).set(
      {
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete reel" },
      { status: 500 },
    );
  }
}
