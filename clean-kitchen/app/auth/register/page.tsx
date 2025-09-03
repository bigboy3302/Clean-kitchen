"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  deleteUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type Phase = "form" | "verify";

export default function RegisterPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // resend cooldown
  const COOLDOWN = 60; // sekundes
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (cooldown <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [cooldown]);

  function startCooldown() {
    setCooldown(COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((s) => s - 1);
    }, 1000);
  }

  const actionCodeSettings = {
    url:
      typeof window !== "undefined"
        ? `${window.location.origin}/onboarding`
        : "http://localhost:3000/onboarding",
    handleCodeInApp: false,
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);

      const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }

      // saglabā profilam onboarding
      try {
        localStorage.setItem(
          "ck_pending_profile",
          JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
          })
        );
      } catch {}

      await sendEmailVerification(cred.user, actionCodeSettings);
      setPhase("verify");
      setInfo("We sent a verification email. Please check your inbox.");
      startCooldown();
    } catch (e: any) {
      console.error(e);
      if (e?.code === "auth/email-already-in-use") {
        setErr("Šis e-pasts jau ir reģistrēts. Lūdzu pieslēdzies ar Login.");
      } else {
        setErr(e?.message ?? "Neizdevās izveidot kontu.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendEmail() {
    setErr(null);
    setInfo(null);
    const u = auth.currentUser;
    if (!u) {
      setErr("Session lost. Please sign in again.");
      return;
    }
    setBusy(true);
    try {
      await sendEmailVerification(u, actionCodeSettings);
      setInfo("Verification email sent again!");
      startCooldown();
    } catch (e: any) {
      console.error(e);
      if (e?.code === "auth/too-many-requests") {
        setErr("Pārāk bieži mēģināji sūtīt e-pastu. Lūdzu pagaidi minūti un mēģini vēlreiz.");
      } else {
        setErr(e?.message ?? "Failed to send verification email.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function iVerified() {
    setErr(null);
    setInfo(null);
    const u = auth.currentUser;
    if (!u) {
      setErr("Session lost. Please sign in again.");
      return;
    }
    setBusy(true);
    try {
      await u.reload();
      if (auth.currentUser?.emailVerified) {
        router.replace("/onboarding");
      } else {
        setErr("Email is not verified yet. Check your inbox or resend.");
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Could not verify status.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelRegistration() {
    setErr(null);
    setInfo(null);
    const u = auth.currentUser;
    if (!u) {
      setErr("Nothing to cancel.");
      setPhase("form");
      return;
    }
    setBusy(true);
    try {
      await deleteUser(u);
      try {
        localStorage.removeItem("ck_pending_profile");
      } catch {}
      setPhase("form");
      setErr("Registration was cancelled.");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to cancel registration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">
        {phase === "form" ? "Create account" : "Verify your email"}
      </h1>

      {phase === "form" ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm">Vārds</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Uzvārds</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm">Password (min 6)</label>
            <input
              type="password"
              className="w-full rounded-lg border px-3 py-2"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
            />
          </div>

          {err && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{err}</p>}
          {info && <p className="rounded-md bg-green-50 p-2 text-sm text-green-700">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:opacity-95 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create account"}
          </button>

          <p className="mt-4 text-sm text-gray-600">
            Jau ir konts?{" "}
            <Link className="text-gray-900 underline" href="/auth/login">
              Sign in
            </Link>
          </p>
        </form>
      ) : (
        <section className="space-y-4">
          <p className="text-gray-600">
            We’ve sent a verification email. You can resend the email (1× per minute) or cancel the registration.
          </p>

          {err && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{err}</p>}
          {info && <p className="rounded-md bg-yellow-50 p-2 text-sm text-yellow-800">{info}</p>}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={resendEmail}
              disabled={busy || cooldown > 0}
              className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              {cooldown > 0 ? `Send again (${cooldown}s)` : "Send again"}
            </button>
            <button
              onClick={iVerified}
              disabled={busy}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:opacity-95 disabled:opacity-50"
            >
              I’ve verified
            </button>
            <button
              onClick={cancelRegistration}
              disabled={busy}
              className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
