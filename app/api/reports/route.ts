import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

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
      uid?: string;
    };

    const to = process.env.REPORT_EMAIL_TO!;
    const from = process.env.REPORT_EMAIL_FROM!;

    const [resp] = await sgMail.send({
      to,
      from: { email: from, name: "Clean Kitchen Reports" },
      subject: `New report for post ${body.postId ?? ""}`,
      text:
        `Report submitted.\n\n` +
        `Post: ${body.postId ?? ""}\n` +
        `Reason: ${body.reason ?? ""}\n` +
        `Reporter: ${body.uid ?? ""}`,
      html: `
        <h2>New Report</h2>
        <p><b>Post:</b> ${body.postId ?? ""}</p>
        <p><b>Reason:</b> ${body.reason ?? ""}</p>
        <p><b>Reporter UID:</b> ${body.uid ?? ""}</p>
      `,
    });

    console.log("SendGrid accepted:", {
      statusCode: resp.statusCode,
      messageId: resp.headers["x-message-id"],
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const details = getSendGridDetails(err);
    console.error("Report email failed:", JSON.stringify(details ?? err, null, 2));
    return NextResponse.json(
      { error: "Email failed", details },
      { status: 500 }
    );
  }
}
