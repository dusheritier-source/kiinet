import { NextResponse } from "next/server";
import { getFirebaseUserFromRequest } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { postId: string } }
) {
  try {
    const firebaseUser = await getFirebaseUserFromRequest(request);

    if (!firebaseUser?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const postId = params.postId;

    if (action === "like") {
      await prisma.like.create({
        data: {
          userId: firebaseUser.uid,
          postId,
        },
      });
    } else if (action === "unlike") {
      await prisma.like.delete({
        where: {
          userId_postId: {
            userId: firebaseUser.uid,
            postId,
          },
        },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error toggling like:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}