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
import AuthShell from "@/components/auth/AuthShell";
import Input from "components/ui/Input";
import Button from "@/components/ui/button";

type Phase = "form" | "verify";

export default function RegisterPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [pass, setPass]           = useState("");

  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr]   = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // resend cooldown
  const COOLDOWN = 60;
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
    timerRef.current = setInterval(() => setCooldown((s) => s - 1), 1000);
  }

  const actionCodeSettings = {
    url:
      typeof window !== "undefined"
        ? `${window.location.origin}/onboarding`
        : "http://localhost:3000/onboarding",
    handleCodeInApp: false,
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      if (displayName) await updateProfile(cred.user, { displayName });

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
    if (!u) { setErr("Session lost. Please sign in again."); return; }
    setBusy(true);
    try {
      await sendEmailVerification(u, actionCodeSettings);
      setInfo("Verification email sent again!");
      startCooldown();
    } catch (e: any) {
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
    if (!u) { setErr("Session lost. Please sign in again."); return; }
    setBusy(true);
    try {
      await u.reload();
      if (auth.currentUser?.emailVerified) {
        router.replace("/onboarding");
      } else {
        setErr("Email is not verified yet. Check your inbox or resend.");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Could not verify status.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelRegistration() {
    setErr(null);
    setInfo(null);
    const u = auth.currentUser;
    if (!u) { setErr("Nothing to cancel."); setPhase("form"); return; }
    setBusy(true);
    try {
      await deleteUser(u);
      try { localStorage.removeItem("ck_pending_profile"); } catch {}
      setPhase("form");
      setErr("Registration was cancelled.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to cancel registration.");
    } finally {
      setBusy(false);
    }
  }

  return phase === "form" ? (
    <AuthShell
      title="Create account"
      subtitle="Get started with Clean-Kitchen"
      footer={<span>Jau ir konts? <Link className="underline" href="/auth/login">Sign in</Link></span>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Vārds"
            value={firstName}
            onChange={(e) => setFirstName((e.target as HTMLInputElement).value)}
            required
          />
          <Input
            label="Uzvārds"
            value={lastName}
            onChange={(e) => setLastName((e.target as HTMLInputElement).value)}
            required
          />
        </div>

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
          required
        />

        <Input
          label="Password (min 6)"
          type="password"
          value={pass}
          onChange={(e) => setPass((e.target as HTMLInputElement).value)}
          required
        />

        {err  && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        {info && <p className="rounded-md bg-green-50 p-2 text-sm text-green-700">{info}</p>}

        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  ) : (
    <AuthShell title="Verify your email" subtitle="We’ve sent a verification email.">
      <div className="space-y-4">
        {err  && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        {info && <p className="rounded-md bg-yellow-50 p-2 text-sm text-yellow-800">{info}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={resendEmail}
            disabled={busy || cooldown > 0}
            variant="secondary"
          >
            {cooldown > 0 ? `Send again (${cooldown}s)` : "Send again"}
          </Button>

          <Button onClick={iVerified} disabled={busy}>
            I’ve verified
          </Button>

          <Button onClick={cancelRegistration} disabled={busy} variant="ghost">
            Cancel
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
