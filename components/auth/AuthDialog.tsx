"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Eye, EyeOff, X } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { auth, db } from "@/lib/firebas1e";

type AuthDialogMode = "login" | "register";
type RegisterPhase = "form" | "verify";

type Props = {
  mode: AuthDialogMode;
  onModeChange: (mode: AuthDialogMode) => void;
  onClose: () => void;
  redirectTo?: string | null;
};

const REQUIRED_FIELDS_ERROR =
  "Please complete the following fields: Name, Surname, Email and Password.";
const EMAIL_ERROR = "Please enter a valid email address.";
const PASSWORD_ERROR = "Password must be at least 8 characters.";
const NAME_ERROR = "Name is required.";
const SURNAME_ERROR = "Surname is required.";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateRequiredName(value: string) {
  return value.trim() ? null : NAME_ERROR;
}

function validateRequiredSurname(value: string) {
  return value.trim() ? null : SURNAME_ERROR;
}

function validateRegisterEmail(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required.";
  if (!isEmail(trimmed)) return EMAIL_ERROR;
  return null;
}

function validateRegisterPassword(value: string) {
  if (!value) return "Password is required.";
  if (value.length < 8) return PASSWORD_ERROR;
  return null;
}

function mapLoginError(code?: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
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

function mapRegisterError(code?: string, fallback?: string) {
  switch (code) {
    case "auth/invalid-email":
      return EMAIL_ERROR;
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in instead.";
    case "auth/weak-password":
      return PASSWORD_ERROR;
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a minute before trying again.";
    default:
      return fallback || "Registration failed. Please try again.";
  }
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return typeof error === "object" && error !== null && "code" in error;
}

export default function AuthDialog({ mode, onModeChange, onClose, redirectTo }: Props) {
  const router = useRouter();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginEmailErr, setLoginEmailErr] = useState<string | null>(null);
  const [loginPasswordErr, setLoginPasswordErr] = useState<string | null>(null);
  const [loginFormErr, setLoginFormErr] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerFirstNameErr, setRegisterFirstNameErr] = useState<string | null>(null);
  const [registerLastNameErr, setRegisterLastNameErr] = useState<string | null>(null);
  const [registerEmailErr, setRegisterEmailErr] = useState<string | null>(null);
  const [registerPasswordErr, setRegisterPasswordErr] = useState<string | null>(null);
  const [registerErr, setRegisterErr] = useState<string | null>(null);
  const [registerInfo, setRegisterInfo] = useState<string | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [touchedFirstName, setTouchedFirstName] = useState(false);
  const [touchedLastName, setTouchedLastName] = useState(false);
  const [touchedRegisterEmail, setTouchedRegisterEmail] = useState(false);
  const [touchedRegisterPassword, setTouchedRegisterPassword] = useState(false);
  const [phase, setPhase] = useState<RegisterPhase>("form");
  const COOLDOWN = 60;
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!touchedEmail) return;
    if (!loginEmail.trim()) setLoginEmailErr("Email is required.");
    else if (!isEmail(loginEmail.trim())) setLoginEmailErr("Enter a valid email.");
    else setLoginEmailErr(null);
  }, [loginEmail, touchedEmail]);

  useEffect(() => {
    if (!touchedPassword) return;
    if (!loginPassword) setLoginPasswordErr("Password is required.");
    else if (loginPassword.length < 8) {
      setLoginPasswordErr("Password must be at least 8 characters.");
    } else {
      setLoginPasswordErr(null);
    }
  }, [loginPassword, touchedPassword]);

  useEffect(() => {
    if (cooldown > 0 || !timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, [cooldown]);

  useEffect(() => {
    if (!touchedFirstName) return;
    setRegisterFirstNameErr(validateRequiredName(firstName));
  }, [firstName, touchedFirstName]);

  useEffect(() => {
    if (!touchedLastName) return;
    setRegisterLastNameErr(validateRequiredSurname(lastName));
  }, [lastName, touchedLastName]);

  useEffect(() => {
    if (!touchedRegisterEmail) return;
    setRegisterEmailErr(validateRegisterEmail(registerEmail));
  }, [registerEmail, touchedRegisterEmail]);

  useEffect(() => {
    if (!touchedRegisterPassword) return;
    setRegisterPasswordErr(validateRegisterPassword(registerPassword));
  }, [registerPassword, touchedRegisterPassword]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  useEffect(() => {
    setLoginFormErr(null);
    setRegisterErr(null);
    setRegisterInfo(null);
  }, [mode]);

  const nextPath = redirectTo || "/recipes";

  const actionCodeSettings = useMemo(
    () => ({
      url:
        typeof window !== "undefined"
          ? `${window.location.origin}/onboarding`
          : "http://localhost:3000/onboarding",
      handleCodeInApp: false,
    }),
    []
  );

  function resetRegisterFlow() {
    setPhase("form");
    setFirstName("");
    setLastName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterFirstNameErr(null);
    setRegisterLastNameErr(null);
    setRegisterEmailErr(null);
    setRegisterPasswordErr(null);
    setRegisterErr(null);
    setRegisterInfo(null);
    setTouchedFirstName(false);
    setTouchedLastName(false);
    setTouchedRegisterEmail(false);
    setTouchedRegisterPassword(false);
    setCooldown(0);
  }

  function startCooldown() {
    setCooldown(COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((value) => Math.max(value - 1, 0));
    }, 1000);
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginFormErr(null);
    setTouchedEmail(true);
    setTouchedPassword(true);

    if (!isEmail(loginEmail.trim())) {
      setLoginEmailErr("Enter a valid email.");
      return;
    }
    if (!loginPassword || loginPassword.length < 8) {
      setLoginPasswordErr("Password must be at least 8 characters.");
      return;
    }

    setLoginBusy(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      onClose();
      router.replace(nextPath);
    } catch (error: unknown) {
      setLoginFormErr(mapLoginError(getErrorCode(error)));
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoginFormErr(null);
    setLoginBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
      router.replace(nextPath);
    } catch (error: unknown) {
      setLoginFormErr(mapLoginError(getErrorCode(error)));
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterErr(null);
    setRegisterInfo(null);
    setTouchedFirstName(true);
    setTouchedLastName(true);
    setTouchedRegisterEmail(true);
    setTouchedRegisterPassword(true);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = registerEmail.trim();
    const nextFirstNameErr = validateRequiredName(firstName);
    const nextLastNameErr = validateRequiredSurname(lastName);
    const nextEmailErr = validateRegisterEmail(registerEmail);
    const nextPasswordErr = validateRegisterPassword(registerPassword);

    setRegisterFirstNameErr(nextFirstNameErr);
    setRegisterLastNameErr(nextLastNameErr);
    setRegisterEmailErr(nextEmailErr);
    setRegisterPasswordErr(nextPasswordErr);

    if (nextFirstNameErr || nextLastNameErr || nextEmailErr || nextPasswordErr) {
      setRegisterErr(REQUIRED_FIELDS_ERROR);
      return;
    }

    setRegisterBusy(true);
    try {
      const credentials = await createUserWithEmailAndPassword(auth, trimmedEmail, registerPassword);
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
        // optional
      }

      try {
        await sendEmailVerification(credentials.user, actionCodeSettings);
        setRegisterInfo("We sent a verification email. Please check your inbox.");
        startCooldown();
      } catch (error: unknown) {
        setRegisterErr(
          isFirebaseError(error)
            ? mapRegisterError(error.code, error.message)
            : "Account created, but the verification email could not be sent. Try resending."
        );
      }

      setPhase("verify");
    } catch (error: unknown) {
      setRegisterErr(
        isFirebaseError(error)
          ? mapRegisterError(error.code, error.message)
          : "Registration failed. Please try again."
      );
    } finally {
      setRegisterBusy(false);
    }
  }

  async function resendEmail() {
    setRegisterErr(null);
    setRegisterInfo(null);
    const user = auth.currentUser;

    if (!user) {
      setRegisterErr("Session lost. Please sign in again.");
      return;
    }

    setRegisterBusy(true);
    try {
      await sendEmailVerification(user, actionCodeSettings);
      setRegisterInfo("Verification email sent again.");
      startCooldown();
    } catch (error: unknown) {
      setRegisterErr(
        isFirebaseError(error)
          ? mapRegisterError(error.code, error.message)
          : "Failed to send verification email. Please try again."
      );
    } finally {
      setRegisterBusy(false);
    }
  }

  async function confirmVerification() {
    setRegisterErr(null);
    const user = auth.currentUser;

    if (!user) {
      setRegisterErr("Session lost. Please sign in again.");
      return;
    }

    setRegisterBusy(true);
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        try {
          localStorage.removeItem("ck_pending_profile");
        } catch {
          // ignore
        }
        onClose();
        router.replace("/onboarding");
      } else {
        setRegisterErr("Email is not verified yet. Check your inbox or resend the link.");
      }
    } catch (error: unknown) {
      setRegisterErr(
        isFirebaseError(error)
          ? mapRegisterError(error.code, error.message)
          : "Could not verify status. Please try again."
      );
    } finally {
      setRegisterBusy(false);
    }
  }

  async function cancelRegistration() {
    setRegisterErr(null);
    setRegisterInfo(null);
    const user = auth.currentUser;

    if (!user) {
      resetRegisterFlow();
      return;
    }

    setRegisterBusy(true);
    try {
      await deleteUser(user);
      try {
        localStorage.removeItem("ck_pending_profile");
      } catch {
        // ignore
      }
      resetRegisterFlow();
    } catch {
      setRegisterErr("Failed to cancel registration. Please try again.");
    } finally {
      setRegisterBusy(false);
    }
  }

  const closeLabel = mode === "login" ? "Close sign in" : "Close sign up";
  const loginPasswordToggleLabel = showLoginPassword ? "Hide password" : "Show password";
  const registerPasswordToggleLabel = showRegisterPassword ? "Hide password" : "Show password";
  const lockVerificationStep = mode === "register" && phase === "verify";

  return (
    <div
      className="authModalBackdrop"
      onClick={() => {
        if (!lockVerificationStep) onClose();
      }}
      role="presentation"
    >
      <section
        className="authModalPanel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {!lockVerificationStep ? (
          <button type="button" className="authModalClose" onClick={onClose} aria-label={closeLabel}>
            <X size={18} />
          </button>
        ) : null}

        <aside className="authModalBrand">
          <span className="authModalBadge">Clean Kitchen</span>
          <h2 className="authModalBrandTitle">
            Plan your kitchen.
            <br />
            Waste less food.
          </h2>
          <p className="authModalBrandCopy">
            Keep your pantry, recipes, and fitness plans in one place.
          </p>
          <div className="authModalStats">
            <div>
              <strong>Pantry</strong>
              <span>track what you have</span>
            </div>
            <div>
              <strong>Recipes</strong>
              <span>cook from your ingredients</span>
            </div>
            <div>
              <strong>Plans</strong>
              <span>save meals and workouts</span>
            </div>
          </div>
        </aside>

        <div className="authModalForm">
          <header className="authModalHeader">
            <p className="authModalEyebrow">
              {mode === "login" ? "Welcome back" : phase === "verify" ? "Almost there" : "Create account"}
            </p>
            <h1 id="auth-modal-title">
              {mode === "login"
                ? "Sign in to your account"
                : phase === "verify"
                ? "Verify your email"
                : "Start your Clean Kitchen account"}
            </h1>
            <p className="authModalSubtitle">
              {mode === "login"
                ? "Open your saved recipes, pantry, and plans."
                : phase === "verify"
                ? "We sent you an email. Use the link inside to finish setting up your account."
                : "Create a profile so your recipes, pantry, and plans stay saved."}
            </p>
          </header>

          {mode === "login" ? (
            <>
              <form onSubmit={handleLoginSubmit} className="authFormStack" noValidate>
                <div>
                  <Input
                    label="Email"
                    type="email"
                    value={loginEmail}
                    onBlur={() => setTouchedEmail(true)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setLoginEmail(event.currentTarget.value)
                    }
                    placeholder="you@email.com"
                    aria-invalid={Boolean(loginEmailErr)}
                    aria-describedby={loginEmailErr ? "auth-login-email-error" : undefined}
                    required
                  />
                  {loginEmailErr ? (
                    <p id="auth-login-email-error" className="fieldError">
                      {loginEmailErr}
                    </p>
                  ) : null}
                </div>

                <div>
                  <Input
                    label="Password"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onBlur={() => setTouchedPassword(true)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setLoginPassword(event.currentTarget.value)
                    }
                    placeholder="••••••••"
                    aria-invalid={Boolean(loginPasswordErr)}
                    aria-describedby={loginPasswordErr ? "auth-login-password-error" : undefined}
                    endAdornment={
                      <button
                        type="button"
                        className="passwordToggle"
                        aria-label={loginPasswordToggleLabel}
                        aria-pressed={showLoginPassword}
                        onClick={() => setShowLoginPassword((value) => !value)}
                      >
                        {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    required
                  />
                  {loginPasswordErr ? (
                    <p id="auth-login-password-error" className="fieldError">
                      {loginPasswordErr}
                    </p>
                  ) : null}
                </div>

                {loginFormErr ? (
                  <p className="formAlert" role="alert">
                    <strong>Sign in failed.</strong> {loginFormErr}
                  </p>
                ) : null}

                <Button type="submit" disabled={loginBusy} className="fullWidth">
                  {loginBusy ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="divider">
                <span className="dividerLine" />
                <span className="dividerLabel">or</span>
                <span className="dividerLine" />
              </div>

              <Button
                onClick={handleGoogleSignIn}
                variant="secondary"
                disabled={loginBusy}
                className="fullWidth authAltButton"
              >
                <span className="googleLabel">
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.8 6.1 29.7 4 24 4 16 4 9.2 8.5 6.3 14.7z" />
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.9C14.7 16.3 18.9 14 24 14c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.8 6.1 29.7 4 24 4 16 4 9.2 8.5 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.4 35.9 26.9 37 24 37c-5.2 0-9.6-3.3-11.3-7.8l-6.6 5.1C9.1 39.4 16 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.2 3.3-4.7 8-11.3 8-6.6 0-12-5.4-12-12 0-1.9.5-3.7 1.3-5.3l-6.6-5.1C4.7 15.6 4 19 4 24c0 11.1 8.9 20 20 20 10.4 0 19-8.4 19-19 0-1.3-.1-2.2-.4-3.5z" />
                  </svg>
                  Continue with Google
                </span>
              </Button>

              <p className="switchCopy">
                No account yet?{" "}
                <button type="button" className="switchButton" onClick={() => onModeChange("register")}>
                  Create one
                </button>
              </p>
            </>
          ) : phase === "form" ? (
            <>
              <form onSubmit={handleRegisterSubmit} className="authFormStack" noValidate>
                <div className="nameRow">
                  <div>
                    <Input
                      label="Name"
                      value={firstName}
                      onBlur={() => setTouchedFirstName(true)}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setFirstName(event.currentTarget.value)
                      }
                      aria-invalid={Boolean(registerFirstNameErr)}
                      aria-describedby={
                        registerFirstNameErr ? "auth-register-name-error" : undefined
                      }
                      required
                    />
                    {registerFirstNameErr ? (
                      <p id="auth-register-name-error" className="fieldError">
                        {registerFirstNameErr}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Input
                      label="Surname"
                      value={lastName}
                      onBlur={() => setTouchedLastName(true)}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setLastName(event.currentTarget.value)
                      }
                      aria-invalid={Boolean(registerLastNameErr)}
                      aria-describedby={
                        registerLastNameErr ? "auth-register-surname-error" : undefined
                      }
                      required
                    />
                    {registerLastNameErr ? (
                      <p id="auth-register-surname-error" className="fieldError">
                        {registerLastNameErr}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <Input
                    label="Email"
                    type="email"
                    value={registerEmail}
                    onBlur={() => setTouchedRegisterEmail(true)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setRegisterEmail(event.currentTarget.value)
                    }
                    placeholder="you@email.com"
                    aria-invalid={Boolean(registerEmailErr)}
                    aria-describedby={
                      registerEmailErr ? "auth-register-email-error" : undefined
                    }
                    required
                  />
                  {registerEmailErr ? (
                    <p id="auth-register-email-error" className="fieldError">
                      {registerEmailErr}
                    </p>
                  ) : null}
                </div>

                <div>
                  <Input
                    label="Password (min 8)"
                    type={showRegisterPassword ? "text" : "password"}
                    value={registerPassword}
                    onBlur={() => setTouchedRegisterPassword(true)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setRegisterPassword(event.currentTarget.value)
                    }
                    aria-invalid={Boolean(registerPasswordErr)}
                    aria-describedby={
                      registerPasswordErr ? "auth-register-password-error" : undefined
                    }
                    endAdornment={
                      <button
                        type="button"
                        className="passwordToggle"
                        aria-label={registerPasswordToggleLabel}
                        aria-pressed={showRegisterPassword}
                        onClick={() => setShowRegisterPassword((value) => !value)}
                      >
                        {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    required
                  />
                  {registerPasswordErr ? (
                    <p id="auth-register-password-error" className="fieldError">
                      {registerPasswordErr}
                    </p>
                  ) : null}
                </div>

                {registerErr ? (
                  <p className="formAlert" role="alert">
                    <strong>Check the form.</strong> {registerErr}
                  </p>
                ) : null}
                {registerInfo ? <p className="infoAlert">{registerInfo}</p> : null}

                <Button type="submit" disabled={registerBusy} className="fullWidth">
                  {registerBusy ? "Creating..." : "Create account"}
                </Button>
              </form>

              <p className="switchCopy">
                Already have an account?{" "}
                <button type="button" className="switchButton" onClick={() => onModeChange("login")}>
                  Sign in
                </button>
              </p>
            </>
          ) : (
            <>
              {registerErr ? <p className="formAlert">{registerErr}</p> : null}
              {registerInfo ? <p className="infoAlert">{registerInfo}</p> : null}

              <p className="verifyCopy">
                Click the link in the email we just sent. After that, come back here and continue.
              </p>

              <div className="verifyActions">
                <Button
                  onClick={resendEmail}
                  disabled={registerBusy || cooldown > 0}
                  variant="secondary"
                  className="fullWidth"
                >
                  {cooldown > 0 ? `Send again (${cooldown}s)` : "Send again"}
                </Button>
                <Button onClick={confirmVerification} disabled={registerBusy} className="fullWidth">
                  I&apos;ve verified
                </Button>
                <Button onClick={cancelRegistration} disabled={registerBusy} variant="ghost" className="fullWidth">
                  Cancel
                </Button>
              </div>

              <p className="switchCopy">
                Want to use a different account?{" "}
                <button type="button" className="switchButton" onClick={cancelRegistration}>
                  Start again
                </button>
              </p>
            </>
          )}
        </div>
      </section>

      <style jsx>{`
        .authModalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 2100;
          display: grid;
          place-items: center;
          padding: 20px;
          background:
            radial-gradient(circle at top, rgba(24, 39, 75, 0.24), transparent 40%),
            rgba(7, 10, 19, 0.58);
          backdrop-filter: blur(18px);
          animation: authModalFadeIn 180ms ease-out;
        }
        .authModalPanel {
          position: relative;
          width: min(980px, 100%);
          max-height: min(860px, calc(100dvh - 40px));
          overflow: auto;
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
          border-radius: 30px;
          border: 1px solid color-mix(in oklab, var(--border) 75%, transparent);
          background:
            radial-gradient(120% 140% at 10% 0%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 55%),
            linear-gradient(140deg, color-mix(in oklab, var(--bg2) 96%, transparent), color-mix(in oklab, var(--bg) 92%, var(--primary) 8%));
          box-shadow: 0 36px 120px rgba(10, 15, 28, 0.48);
        }
        .authModalClose {
          position: absolute;
          top: 18px;
          right: 18px;
          z-index: 2;
          width: 40px;
          height: 40px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          border-radius: 999px;
          background: color-mix(in oklab, var(--bg) 82%, transparent);
          color: var(--text);
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .authModalBrand {
          padding: clamp(28px, 5vw, 56px);
          display: grid;
          align-content: space-between;
          gap: 24px;
          background:
            radial-gradient(90% 100% at 20% 15%, color-mix(in oklab, var(--primary) 34%, transparent), transparent 55%),
            linear-gradient(145deg, color-mix(in oklab, var(--primary) 24%, var(--bg2) 76%), color-mix(in oklab, var(--primary) 46%, var(--bg2) 54%));
          color: var(--primary-contrast);
        }
        .authModalBadge {
          display: inline-flex;
          width: fit-content;
          padding: 6px 12px;
          border-radius: 999px;
          background: color-mix(in oklab, var(--primary-contrast) 18%, transparent);
          border: 1px solid color-mix(in oklab, var(--primary-contrast) 25%, transparent);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        .authModalBrandTitle {
          margin: 0;
          font-size: clamp(32px, 4.5vw, 48px);
          line-height: 1.02;
        }
        .authModalBrandCopy {
          margin: 0;
          max-width: 28ch;
          line-height: 1.7;
          color: color-mix(in oklab, var(--primary-contrast) 88%, transparent);
        }
        .authModalStats {
          display: grid;
          gap: 14px;
        }
        .authModalStats div {
          display: grid;
          gap: 2px;
          padding: 14px 16px;
          border-radius: 18px;
          background: color-mix(in oklab, var(--primary-contrast) 12%, transparent);
          border: 1px solid color-mix(in oklab, var(--primary-contrast) 18%, transparent);
        }
        .authModalStats strong {
          font-size: 1rem;
        }
        .authModalStats span {
          font-size: 0.9rem;
          color: color-mix(in oklab, var(--primary-contrast) 82%, transparent);
        }
        .authModalForm {
          padding: clamp(28px, 5vw, 52px);
          display: grid;
          align-content: start;
          gap: 20px;
        }
        .authModalHeader {
          display: grid;
          gap: 10px;
        }
        .authModalEyebrow {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 0.74rem;
          font-weight: 700;
          color: var(--primary);
        }
        .authModalHeader h1 {
          margin: 0;
          font-size: clamp(28px, 3.3vw, 40px);
          line-height: 1.05;
          letter-spacing: -0.03em;
        }
        .authModalSubtitle {
          margin: 0;
          color: var(--muted);
          line-height: 1.65;
        }
        .authFormStack {
          display: grid;
          gap: 18px;
        }
        .nameRow {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .fieldError {
          margin: 6px 0 0;
          font-size: 0.78rem;
          font-weight: 600;
          color: color-mix(in oklab, var(--primary) 78%, var(--text) 22%);
        }
        .passwordToggle {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 999px;
          padding: 0;
          background: transparent;
          color: var(--muted);
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: background .15s ease, color .15s ease;
        }
        .passwordToggle:hover {
          background: color-mix(in oklab, var(--primary) 14%, transparent);
          color: var(--text);
        }
        .passwordToggle:focus-visible {
          outline: 2px solid color-mix(in oklab, var(--ring) 72%, transparent);
          outline-offset: 2px;
        }
        .formAlert,
        .infoAlert {
          margin: 0;
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 0.92rem;
          line-height: 1.5;
        }
        .formAlert {
          background: color-mix(in oklab, var(--primary) 8%, var(--bg) 92%);
          border: 1px solid color-mix(in oklab, var(--primary) 30%, var(--border));
          color: color-mix(in oklab, var(--primary) 75%, var(--text) 25%);
        }
        .infoAlert {
          background: color-mix(in oklab, #0ea5e9 10%, var(--bg) 90%);
          border: 1px solid color-mix(in oklab, #0ea5e9 28%, var(--border));
          color: color-mix(in oklab, #0ea5e9 72%, var(--text) 28%);
        }
        .fullWidth {
          width: 100%;
        }
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .dividerLine {
          flex: 1;
          height: 1px;
          background: color-mix(in oklab, var(--border) 85%, transparent);
        }
        .dividerLabel {
          font-size: 0.74rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .authAltButton {
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
        }
        .googleLabel {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
        }
        .switchCopy,
        .verifyCopy {
          margin: 0;
          color: var(--muted);
          line-height: 1.6;
        }
        .switchButton {
          border: 0;
          padding: 0;
          background: none;
          color: var(--text);
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 0.18em;
        }
        .verifyActions {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @keyframes authModalFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @media (max-width: 900px) {
          .authModalPanel {
            grid-template-columns: minmax(0, 1fr);
            width: min(520px, 100%);
          }
          .authModalBrand {
            display: none;
          }
        }
        @media (max-width: 640px) {
          .authModalBackdrop {
            align-items: start;
            padding: 10px;
            overflow-y: auto;
          }
          .authModalPanel {
            max-height: none;
            min-height: calc(100dvh - 20px);
            border-radius: 22px;
            overflow: visible;
          }
          .authModalClose {
            top: 14px;
            right: 14px;
            width: 38px;
            height: 38px;
          }
          .authModalForm {
            padding: 28px 18px max(28px, calc(env(safe-area-inset-bottom) + 28px));
            gap: 18px;
          }
          .authModalHeader {
            padding-right: 42px;
          }
          .authModalHeader h1 {
            font-size: 2rem;
            line-height: 1.12;
            letter-spacing: 0;
          }
          .authModalSubtitle {
            font-size: 0.95rem;
            line-height: 1.55;
          }
          .authFormStack {
            gap: 14px;
          }
          .nameRow,
          .verifyActions {
            grid-template-columns: minmax(0, 1fr);
          }
          .switchCopy {
            text-align: center;
          }
        }
        @media (max-width: 380px) {
          .authModalBackdrop {
            padding: 0;
          }
          .authModalPanel {
            min-height: 100dvh;
            border-radius: 0;
            border-left: 0;
            border-right: 0;
          }
        }
      `}</style>
    </div>
  );
}
