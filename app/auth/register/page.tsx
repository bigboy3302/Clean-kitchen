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
        <span>
          Already have an account?{" "}
          <Link className="link" href="/auth/login">
            Sign in
          </Link>
        </span>
      }
      errorBanner={err ? <span>{err}</span> : null}
    >
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

        <Button type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create account"}
        </Button>
      </form>

      <style jsx>{`
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

        .link {
          font-weight: 600;
        }

        .info {
          border-radius: 14px;
          padding: 14px 16px;
          font-size: 0.95rem;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 197, 253, 0.12));
          border: 1px solid rgba(96, 165, 250, 0.3);
          color: rgba(219, 234, 254, 0.9);
          box-shadow: 0 14px 46px rgba(59, 130, 246, 0.16);
        }
      `}</style>
    </AuthShell>
  ) : (
    <AuthShell
      title="Verify your email"
      subtitle="We've sent a verification email so you can activate your Clean Kitchen profile."
      footer={
        <span>
          Need to change your email?{" "}
          <button className="linkButton" type="button" onClick={cancelRegistration} disabled={busy}>
            Cancel and start again
          </button>
        </span>
      }
      errorBanner={err ? <span>{err}</span> : null}
    >
      <div className="verify">
        {info ? <div className="verify__info">{info}</div> : null}
        <p className="verify__copy">
          Click the link in the email we just sent. Once you're verified, we'll take you straight to your onboarding.
        </p>
        <div className="verify__actions">
          <Button onClick={resendEmail} disabled={busy || cooldown > 0} variant="secondary">
            {cooldown > 0 ? `Send again (${cooldown}s)` : "Send again"}
          </Button>
          <Button onClick={iVerified} disabled={busy}>
            I&apos;ve verified
          </Button>
          <Button onClick={cancelRegistration} disabled={busy} variant="ghost">
            Cancel
          </Button>
        </div>
      </div>

      <style jsx>{`
        .verify {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .verify__info {
          border-radius: 18px;
          padding: 18px 20px;
          background: linear-gradient(140deg, rgba(59, 130, 246, 0.18), rgba(37, 99, 235, 0.25));
          border: 1px solid rgba(147, 197, 253, 0.35);
          color: rgba(226, 232, 240, 0.95);
          font-size: 0.95rem;
          box-shadow: 0 20px 50px rgba(59, 130, 246, 0.22);
        }

        .verify__copy {
          margin: 0;
          color: rgba(203, 213, 225, 0.85);
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

        .link {
          font-weight: 600;
        }

        .linkButton {
          background: none;
          border: none;
          color: inherit;
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
      `}</style>
    </AuthShell>
  );
}
