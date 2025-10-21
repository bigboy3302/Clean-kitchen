// lib/authActions.ts
import { auth } from "./firebaseClient";
import {
  sendPasswordResetEmail,
  sendEmailVerification,
  isSignInWithEmailLink,
  signInWithEmailLink,
  applyActionCode,
} from "firebase/auth";

/**
 * Build a stable, allowlisted base URL for email actions & redirects.
 * Make sure NEXT_PUBLIC_SITE_URL matches a domain you added to Authorized domains.
 */
export function getAppBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, ""); // no trailing slash
  // sensible fallback for dev
  return typeof window !== "undefined" && location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://www.clean-kitchen.xyz"; // change to your prod host
}

/**
 * All email actions (verification, reset) use the same continue URL.
 * This MUST be an allowlisted domain.
 */
export function actionCodeSettings(path: string = "/auth/complete") {
  const base = getAppBaseUrl();
  return {
    url: `${base}${path}`,
    handleCodeInApp: true,
  };
}

/** Send password reset email */
export async function sendReset(email: string) {
  return await sendPasswordResetEmail(auth, email, actionCodeSettings());
}

/** Send verification email for the currently signed-in user */
export async function sendVerification() {
  if (!auth.currentUser) throw new Error("No signed-in user");
  return await sendEmailVerification(auth.currentUser, actionCodeSettings());
}

/** If your app uses email link sign-in, complete it here */
export async function completeEmailLinkSignIn(emailFromStorage?: string) {
  if (typeof window === "undefined") return;
  const href = window.location.href;
  if (!isSignInWithEmailLink(auth, href)) return;

  // You should have stored the email when starting link sign-in
  let email = emailFromStorage || window.localStorage.getItem("emailForSignIn") || "";
  if (!email) {
    // last-ditch: prompt the user
    email = window.prompt("Please confirm your email for sign-in") || "";
  }
  await signInWithEmailLink(auth, email, href);
  window.localStorage.removeItem("emailForSignIn");
}

/** Optional: handle “verify email” links if you aren’t using signInWithEmailLink */
export async function applyEmailVerificationFromOobCode(oobCode?: string | null) {
  if (!oobCode) return;
  await applyActionCode(auth, oobCode);
}
