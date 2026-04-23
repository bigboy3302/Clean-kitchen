import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { requireUser, UnauthorizedError } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendGridError = {
  response?: {
    body?: unknown;
  };
  message?: string;
};

function getSendGridDetails(err: unknown): unknown {
  if (!err || typeof err !== "object") return err;
  const maybe = err as SendGridError;
  return maybe.response?.body ?? maybe.message ?? err;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = (await req.json()) as {
      postId?: string;
      reason?: string;
      reporterUid?: string;
      reporterEmail?: string | null;
      postUrl?: string | null;
    };

    const { postId, reason, reporterEmail, postUrl } = body;
    if (!postId || !reason) {
      return NextResponse.json(
        { ok: false, error: "Missing postId or reason" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "SENDGRID_API_KEY not set" },
        { status: 500 }
      );
    }

    sgMail.setApiKey(apiKey);

    await sgMail.send({
      to: process.env.REPORT_EMAIL_TO!,
      from: process.env.REPORT_EMAIL_FROM!,
      replyTo: process.env.REPORT_EMAIL_TO!,
      subject: `New report for post ${postId}`,
      text: [
        `Post: ${postId}`,
        `Reporter UID: ${user.uid}`,
        `Reporter Email: ${reporterEmail || user.email || "unknown"}`,
        postUrl ? `Post URL: ${postUrl}` : null,
        "",
        "Reason:",
        reason,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    console.error("Report email failed:", getSendGridDetails(err));
    return NextResponse.json(
      { ok: false, error: "Email failed" },
      { status: 500 }
    );
  }
}
