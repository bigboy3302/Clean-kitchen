"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      router.replace(snap.exists() && snap.data()?.username ? "/dashboard" : "/onboarding");
    } catch (e: any) {
      setErr(e?.message ?? "Neizdevās ielogoties.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setErr(null);
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      router.replace(snap.exists() && snap.data()?.username ? "/dashboard" : "/onboarding");
    } catch (e: any) {
      setErr(e?.message ?? "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm">Email</label>
          <input
            type="email"
            className="w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Password</label>
          <input
            type="password"
            className="w-full rounded-lg border px-3 py-2"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        {err && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:opacity-95 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-4 text-center text-sm text-gray-500">or</div>

      <button
        onClick={signInWithGoogle}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.8 6.1 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.4 0 19-8.4 19-19 0-1.3-.1-2.2-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.9C14.7 16.3 18.9 14 24 14c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.8 6.1 29.7 4 24 4 16 4 9.2 8.5 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.4 35.9 26.9 37 24 37c-5.2 0-9.6-3.3-11.3-7.8l-6.6 5.1C9.1 39.4 16 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.2 3.3-4.7 8-11.3 8-6.6 0-12-5.4-12-12 0-1.9.5-3.7 1.3-5.3l-6.6-5.1C4.7 15.6 4 19 4 24c0 11.1 8.9 20 20 20 10.4 0 19-8.4 19-19 0-1.3-.1-2.2-.4-3.5z"/>
        </svg>
        Continue with Google
      </button>

      <p className="mt-4 text-sm text-gray-600">
        Nav konta?{" "}
        <Link className="text-gray-900 underline" href="/auth/register">
          Izveidot kontu
        </Link>
      </p>
    </main>
  );
}
