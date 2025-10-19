"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import AuthShell from "@/components/auth/AuthShell";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function mapAuthError(code?: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/popup-closed-by-user":
      return "The sign-in popup was closed before completing.";
    case "auth/popup-blocked":
      return "Popup was blocked by the browser. Allow popups and try again.";
    default:
      return "Could not sign in. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPass, setTouchedPass] = useState(false);

  // lock scrolling like your original
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

  // validate on change/touch
  useEffect(() => {
    if (!touchedEmail) return;
    if (!email.trim()) setEmailErr("Email is required.");
    else if (!isEmail(email.trim())) setEmailErr("Enter a valid email.");
    else setEmailErr(null);
  }, [email, touchedEmail]);

  useEffect(() => {
    if (!touchedPass) return;
    if (!pass) setPassErr("Password is required.");
    else if (pass.length < 8) setPassErr("Password must be at least 8 characters.");
    else setPassErr(null);
  }, [pass, touchedPass]);

  const canSubmit = useMemo(() => {
    return (
      !busy &&
      email.trim().length > 0 &&
      pass.length > 0 &&
      isEmail(email.trim()) &&
      pass.length >= 6
    );
  }, [busy, email, pass]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormErr(null);
    setTouchedEmail(true);
    setTouchedPass(true);

    if (!isEmail(email.trim())) {
      setEmailErr("Enter a valid email.");
      return;
    }
    if (!pass || pass.length < 8) {
      setPassErr("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      router.replace("/recipes");
    } catch (err: any) {
      const msg = mapAuthError(err?.code);
      setFormErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setFormErr(null);
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.replace("/recipes");
    } catch (err: any) {
      const msg = mapAuthError(err?.code);
      setFormErr(msg);
    } finally {
      setBusy(false);
    }
  }

  // helper classes to make red accent consistent
  const inputAccent =
    "focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-500";
  const linkAccent = "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to access your pantry and recipes"
      footer={
        <span>
          No account yet?{" "}
          <Link className={`underline ${linkAccent}`} href="/auth/register">
            Create one
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Input
            label="Email"
            type="email"
            value={email}
            onBlur={() => setTouchedEmail(true)}
            onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
            placeholder="you@email.com"
            aria-invalid={Boolean(emailErr)}
            aria-describedby={emailErr ? "email-error" : undefined}
            className={inputAccent}
            required
          />
          {emailErr && (
            <p id="email-error" className="mt-1 text-xs font-medium text-red-600">
              {emailErr}
            </p>
          )}
        </div>

        <div>
          <Input
            label="Password"
            type="password"
            value={pass}
            onBlur={() => setTouchedPass(true)}
            onChange={(e) => setPass((e.target as HTMLInputElement).value)}
            placeholder="••••••••"
            aria-invalid={Boolean(passErr)}
            aria-describedby={passErr ? "password-error" : undefined}
            className={inputAccent}
            required
          />
          {passErr && (
            <p id="password-error" className="mt-1 text-xs font-medium text-red-600">
              {passErr}
            </p>
          )}
        </div>

        {formErr && (
          <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
            {formErr}
          </p>
        )}

        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500"
        >
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-red-200 dark:bg-red-900/40" />
        <span className="text-xs text-red-600/80 dark:text-red-300/80">or</span>
        <div className="h-px flex-1 bg-red-200 dark:bg-red-900/40" />
      </div>

      <Button
        onClick={signInWithGoogle}
        variant="secondary"
        disabled={busy}
        className="w-full border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
      >
        <span className="inline-flex w-full items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.8 6.1 29.7 4 24 4 16 4 9.2 8.5 6.3 14.7z"/>
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
