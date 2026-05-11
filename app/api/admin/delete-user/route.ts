import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

const ADMIN_UIDS = ["X4kOwvUI62NCseuMpqgrqvsFgdm2"];

export async function POST(req: NextRequest) {
  try {
    const caller = await requireUser(req);
    if (!ADMIN_UIDS.includes(caller.uid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as { targetUid?: string };
    const targetUid = (body?.targetUid ?? "").trim();
    if (!targetUid || targetUid.length < 4) {
      return NextResponse.json({ error: "Invalid targetUid" }, { status: 400 });
    }
    if (ADMIN_UIDS.includes(targetUid)) {
      return NextResponse.json({ error: "Cannot delete an admin account" }, { status: 400 });
    }

    const [adminDb, adminAuth] = await Promise.all([getAdminDb(), getAdminAuth()]);

    // grab username before deleting so we can clean up the usernames collection
    const pubSnap = await adminDb.doc(`usersPublic/${targetUid}`).get().catch(() => null);
    const username = pubSnap?.exists
      ? (pubSnap.data() as { username?: string | null })?.username ?? null
      : null;

    // delete Firebase Auth account — throw if it fails (not just "user not found")
    try {
      await adminAuth.deleteUser(targetUid);
    } catch (authErr: unknown) {
      const code = (authErr as { code?: string })?.code;
      // ignore "user not found" — already deleted
      if (code !== "auth/user-not-found") {
        const msg = authErr instanceof Error ? authErr.message : String(authErr);
        console.error("[delete-user] adminAuth.deleteUser failed:", msg);
        return NextResponse.json({ error: `Firebase Auth delete failed: ${msg}` }, { status: 500 });
      }
    }

    // delete Firestore profile docs
    await Promise.all([
      adminDb.doc(`users/${targetUid}`).delete(),
      adminDb.doc(`usersPublic/${targetUid}`).delete(),
      adminDb.doc(`userModeration/${targetUid}`).delete().catch(() => {}),
    ]);

    if (username) {
      await adminDb.doc(`usernames/${username}`).delete().catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[delete-user] route error:", msg, e);
    const status = msg.includes("Forbidden") ? 403 : msg.includes("Authentication") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
