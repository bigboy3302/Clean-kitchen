"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, db } from "@/lib/firebas1e";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import AuthShell from "@/components/auth/AuthShell";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Phase = "form" | "verify";

function mapFirebaseError(code?: string, fallback?: string) {
  switch (code) {
    case "auth/invalid-email":
      return "The email address looks invalid.";
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6–8 characters.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return fallback || "Registration failed. Please try again.";
  }
}

/** Type guard for FirebaseError */
function isFirebaseError(e: unknown): e is FirebaseError {
  return typeof e === "object" && e !== null && "code" in e;
}

export default function RegisterPage() {
  const router = useRouter();

  // Form fields
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");

  // UI state
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");

  // Lock scroll (optional—mirrors your login behavior)
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
    setInfo(null);

    // Client-side validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !pass || !confirm) {
      setErr("Please fill in all required fields.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErr("Please enter a valid email address.");
      return;
    }
    if (pass.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (pass !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      // Create user
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, pass);

      // Optional displayName
      const name = displayName.trim();
      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }

      // Create/merge user doc
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          uid: cred.user.uid,
          email: cred.user.email ?? trimmedEmail,
          displayName: name || null,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Send verification (non-blocking UX)
      try {
        await sendEmailVerification(cred.user);
        setInfo("We sent a verification email. Please check your inbox.");
        setPhase("verify");
      } catch {
        setInfo("Account created. Please continue to onboarding.");
      }

      router.replace("/onboarding");
    } catch (e: unknown) {
      const msg = isFirebaseError(e)
        ? mapFirebaseError(e.code, e.message)
        : "Registration failed. Please try again.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join Clean Kitchen to track your pantry and fitness"
      footer={
        <span>
          Already have an account?{" "}
          <Link className="underline" href="/auth/login">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Display name (optional)"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName((e.target as HTMLInputElement).value)}
          placeholder="Jane Doe"
        />

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

        <Input
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm((e.target as HTMLInputElement).value)}
          placeholder="••••••••"
          required
        />

        {err && (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
            {err}
          </p>
        )}

        {info && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 ring-1 ring-blue-200">
            {info}
          </p>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      {phase === "verify" && (
        <p className="mt-4 text-xs text-gray-500">
          Didn’t get the email? Check your spam folder, or try again later.
        </p>
      )}
    </AuthShell>
  );
}
