"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AuthShell from "@/components/auth/AuthShell";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const prevBodyOverflow = bodyStyle.overflow;
    const prevBodyPadding = bodyStyle.paddingBottom;
    const prevHtmlOverflow = htmlStyle.overflow;

    bodyStyle.overflow = "hidden";
    bodyStyle.paddingBottom = "0";
    htmlStyle.overflow = "hidden";

    return () => {
      bodyStyle.overflow = prevBodyOverflow;
      bodyStyle.paddingBottom = prevBodyPadding;
      htmlStyle.overflow = prevHtmlOverflow;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      router.replace("/recipes");
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
      await signInWithPopup(auth, provider);
      router.replace("/recipes");
    } catch (e: any) {
      setErr(e?.message ?? "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to access your pantry and recipes"
      footer={<span>Nav konta?{" "}
        <Link className="underline" href="/auth/register">Izveidot kontu</Link></span>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
          placeholder="you@email.com"
          required
        />
        <Input
          label="Password"
          type="password"
          value={pass}
          onChange={(e) => setPass((e.target as HTMLInputElement).value)}
          placeholder="••••••••"
          required
        />

        {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}

        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-500">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <Button onClick={signInWithGoogle} variant="secondary">
        <span className="inline-flex w-full items-center justify-center gap-2">
          {/* Google ikona */}
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.8 6.1 29.7 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.4 0 19-8.4 19-19 0-1.3-.1-2.2-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.9C14.7 16.3 18.9 14 24 14c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.8 6.1 29.7 4 24 4 16 4 9.2 8.5 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.4 35.9 26.9 37 24 37c-5.2 0-9.6-3.3-11.3-7.8l-6.6 5.1C9.1 39.4 16 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.2 3.3-4.7 8-11.3 8-6.6 0-12-5.4-12-12 0-1.9.5-3.7 1.3-5.3l-6.6-5.1C4.7 15.6 4 19 4 24c0 11.1 8.9 20 20 20 10.4 0 19-8.4 19-19 0-1.3-.1-2.2-.4-3.5z"/>
          </svg>
          Continue with Google
        </span>
      </Button>
    </AuthShell>
  );
}
