import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";

type Params = {
  params: Promise<{ campaignId: string }>;
};

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
