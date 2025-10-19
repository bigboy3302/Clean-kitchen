"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebas1e";
import { sendEmailVerification } from "firebase/auth";
import { useRouter } from "next/navigation";

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/auth/login");
    }
  }, [router]);

  const resend = async () => {
    const current = auth.currentUser;
    if (!current) return;
    setBusy(true);
    setMsg(null);
    try {
      await sendEmailVerification(current);
      setMsg("Verification email sent again!");
    } catch (error: unknown) {
      setMsg(getErrorMessage(error, "Failed to send email."));
    } finally {
      setBusy(false);
    }
  };

  const checkVerified = async () => {
    const current = auth.currentUser;
    if (!current) return;
    setBusy(true);
    try {
      await current.reload();
      if (auth.currentUser?.emailVerified) {
        router.replace("/recipes");
      } else {
        setMsg("Still not verified. Check your inbox or try again.");
        setBusy(false);
      }
    } catch (error: unknown) {
      setMsg(getErrorMessage(error, "Could not verify status."));
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-semibold">Verify your email</h1>
      <p className="text-gray-600">We&apos;ve sent a verification link to your email. Open it to continue.</p>

      {msg && <p className="mt-3 rounded-md bg-yellow-50 p-2 text-sm text-yellow-800">{msg}</p>}

      <div className="mt-6 flex gap-3">
        <button
          onClick={resend}
          disabled={busy}
          className="rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          Resend email
        </button>
        <button
          onClick={checkVerified}
          disabled={busy}
          className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:opacity-95 disabled:opacity-50"
        >
          I&apos;ve verified
        </button>
      </div>
    </main>
  );
}
