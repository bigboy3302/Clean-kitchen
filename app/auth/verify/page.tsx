"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/firebase";
import { sendEmailVerification } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function VerifyEmailPage() {
  const router = useRouter();
  const user = auth.currentUser;
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/auth/login");
  }, [user, router]);

  async function resend() {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    try {
      await sendEmailVerification(user);
      setMsg("Verification email sent again!");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to send email.");
    } finally {
      setBusy(false);
    }
  }

  async function iVerified() {
    if (!user) return;
    setBusy(true);
    await user.reload();
    if (auth.currentUser?.emailVerified) {
      router.replace("/recipes");
    } else {
      setMsg("Still not verified. Check your inbox or try again.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-semibold">Verify your email</h1>
      <p className="text-gray-600">We’ve sent a verification link to your email. Open it to continue.</p>

      {msg && <p className="mt-3 rounded-md bg-yellow-50 p-2 text-sm text-yellow-800">{msg}</p>}

      <div className="mt-6 flex gap-3">
        <button onClick={resend} disabled={busy}
          className="rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:opacity-50">
          Resend email
        </button>
        <button onClick={iVerified} disabled={busy}
          className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:opacity-95 disabled:opacity-50">
          I’ve verified
        </button>
      </div>
    </main>
  );
}