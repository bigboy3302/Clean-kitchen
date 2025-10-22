"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  deleteUser,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebas1e";
import AuthShell from "@/components/auth/AuthShell";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Phase = "form" | "verify";

const REQUIRED_FIELDS_ERROR =
  "Please complete the following fields: Name, Surname, Email and Password.";
const EMAIL_ERROR = "Please enter a valid email address.";
const PASSWORD_ERROR = "Password must be at least 8 characters.";

function mapFirebaseError(code?: string, fallback?: string) {
  switch (code) {
    case "auth/invalid-email":
      return EMAIL_ERROR;
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in instead.";
    case "auth/weak-password":
      return PASSWORD_ERROR;
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return fallback || "Registration failed. Please try again.";
  }
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return typeof error === "object" && error !== null && "code" in error;
}

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");

  const COOLDOWN = 60;
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (cooldown <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [cooldown]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    },
    []
  );

  const handleFirstName = (event: ChangeEvent<HTMLInputElement>) =>
    setFirstName(event.currentTarget.value);
  const handleLastName = (event: ChangeEvent<HTMLInputElement>) =>
    setLastName(event.currentTarget.value);
  const handleEmail = (event: ChangeEvent<HTMLInputElement>) =>
    setEmail(event.currentTarget.value);
  const handlePassword = (event: ChangeEvent<HTMLInputElement>) =>
    setPass(event.currentTarget.value);

  function startCooldown() {
    setCooldown(COOLDOWN);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setCooldown((value) => Math.max(value - 1, 0));
    }, 1000);
  }

  async function resendEmail() {
    setErr(null);
    setInfo(null);

    const user = auth.currentUser;
    if (!user) {
      setErr("Session lost. Please sign in again.");
      return;
    }

    setBusy(true);
    try {
      await sendEmailVerification(user, actionCodeSettings);
      setInfo("Verification email sent again!");
      startCooldown();
    } catch (error: unknown) {
      if (isFirebaseError(error) && error.code === "auth/too-many-requests") {
        setErr("Too many attempts. Please wait a minute before trying again.");
      } else {
        const message = isFirebaseError(error)
          ? mapFirebaseError(error.code, error.message)
          : "Failed to send verification email. Please try again.";
        setErr(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function iVerified() {
    setErr(null);

    const user = auth.currentUser;
    if (!user) {
      setErr("Session lost. Please sign in again.");
      return;
    }

    setBusy(true);
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        try {
          localStorage.removeItem("ck_pending_profile");
        } catch {
          // ignore
        }
        router.replace("/onboarding");
      } else {
        setErr("Email is not verified yet. Check your inbox or resend the link.");
      }
    } catch (error: unknown) {
      const message = isFirebaseError(error)
        ? mapFirebaseError(error.code, error.message)
        : "Could not verify status. Please try again.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelRegistration() {
    setErr(null);
    setInfo(null);

    const user = auth.currentUser;
    if (!user) {
      setInfo("Nothing to cancel.");
      setPhase("form");
      return;
    }

    setBusy(true);
    try {
      await deleteUser(user);
      try {
        localStorage.removeItem("ck_pending_profile");
      } catch {
        // ignore
      }
      setPhase("form");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPass("");
      setInfo("Registration cancelled. You can start again anytime.");
    } catch {
      setErr("Failed to cancel registration. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const actionCodeSettings = {
    url:
      typeof window !== "undefined"
        ? `${window.location.origin}/onboarding`
        : "http://localhost:3000/onboarding",
    handleCodeInApp: false,
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr(null);
    setInfo(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedLast || !trimmedEmail || !pass) {
      setErr(REQUIRED_FIELDS_ERROR);
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErr(EMAIL_ERROR);
      return;
    }

    if (pass.length < 8) {
      setErr(PASSWORD_ERROR);
      return;
    }

    setBusy(true);
    try {
      const credentials = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        pass
      );
      const displayName = [trimmedFirst, trimmedLast].join(" ").trim();

      if (displayName) {
        await updateProfile(credentials.user, { displayName });
      }

      await setDoc(
        doc(db, "users", credentials.user.uid),
        {
          uid: credentials.user.uid,
          email: credentials.user.email ?? trimmedEmail,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          displayName: displayName || null,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.setItem(
          "ck_pending_profile",
          JSON.stringify({
            firstName: trimmedFirst,
            lastName: trimmedLast,
            email: trimmedEmail,
          })
        );
      } catch {
        // optional cache only
      }

      try {
        await sendEmailVerification(credentials.user, actionCodeSettings);
        setInfo("We sent a verification email. Please check your inbox.");
        startCooldown();
      } catch (error: unknown) {
        const message = isFirebaseError(error)
          ? mapFirebaseError(error.code, error.message)
          : "Account created, but the verification email could not be sent. Try resending.";
        setErr(message);
      }

      setPhase("verify");
    } catch (error: unknown) {
      const message = isFirebaseError(error)
        ? mapFirebaseError(error.code, error.message)
        : "Registration failed. Please try again.";
      setErr(message);
    } finally {
      setBusy(false);
    }
  }

  return phase === "form" ? (
    <AuthShell
      title="Create account"
      subtitle="Personalise your Clean Kitchen experience in seconds."
      footer={
        <div className="accountSwitch">
          <span className="accountSwitch__label">Already have an account?</span>
          <Link className="accountSwitch__cta accountSwitch__cta--outline" href="/auth/login">
            Sign in
          </Link>
        </div>
      }
      errorBanner={err ? <span>{err}</span> : null}
    >
      <div className="registerStack">
        <form onSubmit={onSubmit} className="registerForm">
          <div className="nameRow">
            <Input
              label="Name"
              value={firstName}
              onChange={handleFirstName}
            required
          />
          <Input
            label="Surname"
            value={lastName}
            onChange={handleLastName}
            required
          />
        </div>

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={handleEmail}
          placeholder="you@email.com"
          required
        />

        <Input
          label="Password (min 8)"
          type="password"
          value={pass}
          onChange={handlePassword}
          required
          />

          {info ? <p className="info">{info}</p> : null}

          <Button type="submit" disabled={busy} className="fullWidth">
            {busy ? "Creating..." : "Create account"}
          </Button>
        </form>
      </div>

      <style jsx>{`
        .registerStack {
          display: grid;
          gap: 20px;
          width: min(460px, 100%);
          margin: 0 auto;
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
          border-radius: 22px;
          padding: 26px;
          box-shadow: 0 18px 42px color-mix(in oklab, var(--primary) 10%, transparent);
        }
        .registerForm {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .nameRow {
          display: grid;
          gap: 12px;
          grid-template-columns: minmax(0, 1fr);
        }

        @media (min-width: 640px) {
          .nameRow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .footerNote {
          color: var(--muted);
        }

        .accountSwitch {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .accountSwitch__label {
          color: var(--muted);
          font-size: 0.9rem;
        }
        .accountSwitch__cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 18px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.95rem;
          text-decoration: none;
          background: color-mix(in oklab, var(--primary) 88%, transparent);
          color: var(--primary-contrast, #ffffff);
          border: 1px solid color-mix(in oklab, var(--primary) 40%, transparent);
          box-shadow: 0 16px 32px color-mix(in oklab, var(--primary) 18%, transparent);
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease, background 0.15s ease;
        }
        .accountSwitch__cta:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
          box-shadow: 0 18px 38px color-mix(in oklab, var(--primary) 22%, transparent);
        }
        .accountSwitch__cta:focus-visible {
          outline: 2px solid color-mix(in oklab, var(--ring) 55%, transparent);
          outline-offset: 3px;
        }
        .accountSwitch__cta--outline {
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          color: var(--text);
          border-color: color-mix(in oklab, var(--border) 78%, transparent);
          box-shadow: 0 12px 26px color-mix(in oklab, var(--primary) 10%, transparent);
        }
        .accountSwitch__cta--outline:hover {
          background: color-mix(in oklab, var(--bg2) 90%, var(--primary) 10%);
        }

        .info {
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 0.95rem;
          background: color-mix(in oklab, var(--primary) 12%, var(--bg) 88%);
          border: 1px solid color-mix(in oklab, var(--primary) 32%, var(--border));
          color: color-mix(in oklab, var(--primary) 70%, var(--text) 30%);
          box-shadow: 0 14px 46px color-mix(in oklab, var(--primary) 14%, transparent);
        }

        .fullWidth {
          width: 100%;
        }

        @media (max-width: 640px) {
          .registerStack {
            padding: 22px 18px;
            border-radius: 18px;
            box-shadow: 0 14px 30px color-mix(in oklab, var(--primary) 8%, transparent);
          }
        }
      `}</style>
    </AuthShell>
  ) : (
    <AuthShell
      title="Verify your email"
      subtitle="We&apos;ve sent a verification email so you can activate your Clean Kitchen profile."
      footer={
        <span className="footerNote">
          Need to change your email?{" "}
          <button className="linkButton" type="button" onClick={cancelRegistration} disabled={busy}>
            Cancel and start again
          </button>
        </span>
      }
      errorBanner={err ? <span>{err}</span> : null}
    >
      <div className="verifyCard">
        <div className="verify">
          {info ? <div className="verify__info">{info}</div> : null}
          <p className="verify__copy">
          Click the link in the email we just sent. Once you&apos;re verified, we&apos;ll take you straight to your onboarding.
          </p>
          <div className="verify__actions">
            <Button onClick={resendEmail} disabled={busy || cooldown > 0} variant="secondary" className="fullWidth">
              {cooldown > 0 ? `Send again (${cooldown}s)` : "Send again"}
            </Button>
            <Button onClick={iVerified} disabled={busy} className="fullWidth">
              I&apos;ve verified
            </Button>
            <Button onClick={cancelRegistration} disabled={busy} variant="ghost" className="fullWidth">
              Cancel
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .verifyCard {
          width: min(460px, 100%);
          margin: 0 auto;
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
          border-radius: 22px;
          padding: 26px;
          box-shadow: 0 18px 42px color-mix(in oklab, var(--primary) 10%, transparent);
        }
        .verify {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .verify__info {
          border-radius: 18px;
          padding: 18px 20px;
          background: color-mix(in oklab, var(--primary) 16%, var(--bg) 84%);
          border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border));
          color: color-mix(in oklab, var(--primary) 70%, var(--text) 30%);
          font-size: 0.95rem;
          box-shadow: 0 20px 50px color-mix(in oklab, var(--primary) 18%, transparent);
        }

        .verify__copy {
          margin: 0;
          color: var(--muted);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .verify__actions {
          display: grid;
          gap: 14px;
        }

        @media (min-width: 640px) {
          .verify__actions {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .linkButton {
          background: none;
          border: none;
          color: var(--primary);
          font: inherit;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        }

        .linkButton:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @media (max-width: 640px) {
          .verifyCard {
            padding: 22px 18px;
            border-radius: 18px;
            box-shadow: 0 14px 30px color-mix(in oklab, var(--primary) 8%, transparent);
          }
        }
      `}</style>
    </AuthShell>
  );
}
