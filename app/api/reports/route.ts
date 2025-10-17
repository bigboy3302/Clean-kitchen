import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type ReportRequest = {
  postId?: string;
  postOwnerUid?: string | null;
  postAuthor?: unknown;
  reporterUid?: string | null;
  reporterEmail?: string | null;
  reason?: string;
  postText?: string | null;
  postUrl?: string | null;
};

function formatLine(label: string, value: string | null | undefined): string {
  if (!value) return `${label}: (not provided)`;
  return `${label}: ${value}`;
}

export async function POST(req: Request) {
  let payload: ReportRequest;
  try {
    payload = (await req.json()) as ReportRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const postId = payload.postId?.trim();
  const reason = payload.reason?.trim();
  if (!postId || !reason) {
    return NextResponse.json(
      { error: "Both postId and reason are required." },
      { status: 400 }
    );
  }

  const toAddress =
    process.env.REPORT_EMAIL_TO?.trim() || "adriansraitums95@gmail.com";
  const user = process.env.REPORT_EMAIL_USER?.trim();
  const pass = process.env.REPORT_EMAIL_PASS?.trim();
  const host = process.env.REPORT_EMAIL_HOST?.trim();
  const port = process.env.REPORT_EMAIL_PORT
    ? Number(process.env.REPORT_EMAIL_PORT)
    : undefined;
  const secure =
    process.env.REPORT_EMAIL_SECURE === "true" ||
    process.env.REPORT_EMAIL_SECURE === "1";
  const fromAddress =
    process.env.REPORT_EMAIL_FROM?.trim() ||
    user ||
    "reports@clean-kitchen";

  const subject = `Post report • ${postId}`;
  const textLines = [
    "A post has been reported:",
    "",
    formatLine("Post ID", postId),
    formatLine("Post URL", payload.postUrl),
    formatLine("Post owner UID", payload.postOwnerUid as string | undefined),
    formatLine("Reporter UID", payload.reporterUid),
    formatLine("Reporter email", payload.reporterEmail),
    "",
    "Reason:",
    reason,
    "",
    "Post snippet:",
    (payload.postText || "").slice(0, 400) || "(no text provided)",
    "",
    `Reported at: ${new Date().toISOString()}`,
  ];
  const textBody = textLines.join("\n");
  const htmlBody = `<h2>New post report</h2>
  <p><strong>Post ID:</strong> ${postId}</p>
  <p><strong>Post URL:</strong> ${payload.postUrl || "(not provided)"}</p>
  <p><strong>Post owner UID:</strong> ${
    payload.postOwnerUid || "(not provided)"
  }</p>
  <p><strong>Reporter UID:</strong> ${payload.reporterUid || "(not provided)"}</p>
  <p><strong>Reporter email:</strong> ${
    payload.reporterEmail || "(not provided)"
  }</p>
  <h3>Reason</h3>
  <p>${reason.replace(/\n/g, "<br/>")}</p>
  <h3>Post snippet</h3>
  <p>${(payload.postText || "(no text provided)").replace(
    /\n/g,
    "<br/>"
  )}</p>
  <p style="margin-top:20px;font-size:12px;color:#6b7280;">Sent ${new Date().toISOString()}</p>`;

  if (!user || !pass) {
    console.warn(
      "Report email skipped: REPORT_EMAIL_USER or REPORT_EMAIL_PASS not set.",
      { postId }
    );
    return NextResponse.json({
      ok: true,
      delivered: false,
      message: "Email credentials not configured. Report stored only.",
    });
  }

  const transporter = nodemailer.createTransport({
    host: host || "smtp.gmail.com",
    port: port || (secure ? 465 : 587),
    secure,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: toAddress,
      subject,
      text: textBody,
      html: htmlBody,
    });
    return NextResponse.json({ ok: true, delivered: true });
  } catch (error) {
    console.error("Failed to send report email", error);
    return NextResponse.json(
      { error: "Failed to send report email." },
      { status: 500 }
    );
  }
}
