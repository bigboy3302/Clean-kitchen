import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      postId?: string;
      reason?: string;
      reporterUid?: string;
    };

    const { postId, reason, reporterUid } = body;
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
      text: `Post: ${postId}\nReporter: ${reporterUid ?? "unknown"}\n\nReason:\n${reason}`,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    console.error("Report email failed:", getSendGridDetails(err));
    return NextResponse.json(
      { ok: false, error: "Email failed" },
      { status: 500 }
    );
  }
}
