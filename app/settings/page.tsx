"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  type User,
  updateEmail as fbUpdateEmail,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import BackgroundMotionControl from "@/components/background/BackgroundMotionControl";
import ThemePicker from "@/components/theme/ThemePicker";
import { useTheme, type ThemeMode } from "@/components/theme/ThemeProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useAuthModal } from "@/context/AuthModalContext";
import { useAuth } from "@/hooks/useAuth";
import { auth, db } from "@/lib/firebas1e";
import {
  fullName,
  getErrorMessage,
  propagateUserProfile,
  slugifyUsername,
  type UserDoc,
  validUsername,
} from "@/lib/account-profile";

export default function SettingsPage() {
  const router = useRouter();
  const { mode, setMode, palette } = useTheme();
  const { openLogin } = useAuthModal();
  const { user, loading } = useAuth();

  const [authReady, setAuthReady] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [emailNotifications, setEmailNotifications] = useState(true);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busySave, setBusySave] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    setMe(user);
    setAuthReady(!loading);
  }, [loading, user]);

  useEffect(() => {
    if (!loading && !user) {
      openLogin("/settings");
    }
  }, [loading, openLogin, user]);

  useEffect(() => {
    if (!authReady || !me) return;

    (async () => {
      setLoadingDoc(true);
      try {
        const ref = doc(db, "users", me.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          const shell: UserDoc = {
            uid: me.uid,
            email: me.email || "",
            username: null,
            photoURL: me.photoURL || null,
            firstName: null,
            lastName: null,
            prefs: { units: "metric", theme: "system", emailNotifications: true },
          };
          await setDoc(ref, shell);
          setUserDoc(shell);
          setMode("system");
          setUnits("metric");
          setEmailNotifications(true);
        } else {
          const data = snap.data() as UserDoc;
          setUserDoc(data);
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setUsername(data.username || "");
          setUnits(data.prefs?.units || "metric");
          setEmailNotifications(data.prefs?.emailNotifications ?? true);

          const docTheme = data.prefs?.theme ?? null;
          const docPalette = data.prefs?.palette ?? null;
          const storedMode =
            typeof window !== "undefined" ? (localStorage.getItem("theme.mode") as ThemeMode | null) : null;

          if (docTheme) {
            if (!storedMode || storedMode === docTheme) {
              setMode(docTheme, docTheme === "custom" && docPalette ? { palette: docPalette } : undefined);
            }
          } else if (!storedMode) {
            setMode("system");
          }
        }

        setNewEmail(me.email || "");
        setErr(null);
      } catch (error: unknown) {
        setErr(getErrorMessage(error, "Failed to load settings."));
      } finally {
        setLoadingDoc(false);
      }
    })();
  }, [authReady, me, setMode]);

  useEffect(() => {
    if (!username) {
      setUsernameMessage(null);
      return;
    }

    const normalized = slugifyUsername(username);
    if (normalized !== username) {
      setUsername(normalized);
      return;
    }

    if (!validUsername(normalized)) {
      setUsernameMessage("3-20 chars: a-z, 0-9, . _ -");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      if (!me) return;
      setCheckingUsername(true);
      try {
        if (userDoc?.username === normalized) {
          setUsernameMessage("This is your current username.");
          return;
        }
        const snap = await getDoc(doc(db, "usernames", normalized));
        if (snap.exists()) {
          const owner = snap.get("uid");
          setUsernameMessage(owner === me.uid ? "This username is reserved for you." : "That username is taken.");
        } else {
          setUsernameMessage("Username is available.");
        }
      } catch {
        setUsernameMessage(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [me, userDoc?.username, username]);

  async function saveSettings() {
    if (!me || !userDoc) return;

    setErr(null);
    setMsg(null);
    setBusySave(true);

    const requestedUsername = slugifyUsername(username);
    const previousUsername = userDoc.username || null;
    const previousDisplayName = fullName(userDoc.firstName, userDoc.lastName);
    const previousPhotoURL = userDoc.photoURL ?? null;
    let appliedUsername: string | null = previousUsername;

    try {
      await runTransaction(db, async (trx) => {
        const userRef = doc(db, "users", me.uid);
        const snapshot = await trx.get(userRef);
        const existing = (snapshot.exists() ? snapshot.data() : {}) as { username?: string | null };
        const currentUsername = existing?.username ?? previousUsername ?? null;
        let nextUsername = currentUsername;

        if (requestedUsername && requestedUsername !== currentUsername) {
          if (!validUsername(requestedUsername)) {
            throw new Error("Username must be 3-20 characters: a-z, 0-9, . _ -");
          }

          const newRef = doc(db, "usernames", requestedUsername);
          const newSnap = await trx.get(newRef);
          if (newSnap.exists() && newSnap.get("uid") !== me.uid) {
            throw new Error("That username is taken.");
          }

          trx.set(newRef, { uid: me.uid });
          nextUsername = requestedUsername;
        }

        if (currentUsername && currentUsername !== nextUsername) {
          trx.delete(doc(db, "usernames", currentUsername));
        }

        trx.set(
          userRef,
          {
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            username: nextUsername || null,
            prefs: {
              units,
              theme: mode,
              palette: mode === "custom" ? palette : null,
              emailNotifications,
            },
          },
          { merge: true }
        );

        appliedUsername = nextUsername || null;
      });

      const displayNameNext = fullName(firstName, lastName);
      await updateProfile(me, { displayName: displayNameNext || undefined });

      await setDoc(
        doc(db, "usersPublic", me.uid),
        {
          displayName: displayNameNext || null,
          username: appliedUsername,
          avatarURL: userDoc.photoURL ?? me.photoURL ?? null,
        },
        { merge: true }
      );

      const profileChanged =
        appliedUsername !== previousUsername ||
        (displayNameNext || null) !== (previousDisplayName || null) ||
        (userDoc.photoURL ?? null) !== previousPhotoURL;

      if (profileChanged) {
        await propagateUserProfile(me.uid, {
          displayName: displayNameNext || null,
          username: appliedUsername,
          photoURL: userDoc.photoURL ?? me.photoURL ?? null,
        }).catch(() => {});
      }

      setUserDoc((prev) =>
        prev
          ? {
              ...prev,
              firstName: firstName.trim() || null,
              lastName: lastName.trim() || null,
              username: appliedUsername,
              prefs: {
                units,
                theme: mode,
                palette: mode === "custom" ? palette : null,
                emailNotifications,
              },
            }
          : prev
      );
      setUsername(appliedUsername || "");
      setMsg("Settings saved.");
      setUsernameMessage(requestedUsername && requestedUsername !== previousUsername ? "Username updated." : null);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to save settings."));
    } finally {
      setBusySave(false);
    }
  }

  async function updateEmail() {
    if (!me) return;
    if (!newEmail || newEmail === me.email) {
      setMsg("Email unchanged.");
      return;
    }

    setErr(null);
    setMsg(null);
    setBusyEmail(true);

    try {
      if (currentPassword) {
        const cred = EmailAuthProvider.credential(me.email || "", currentPassword);
        await reauthenticateWithCredential(me, cred);
      }
      await fbUpdateEmail(me, newEmail);
      await updateDoc(doc(db, "users", me.uid), { email: newEmail });
      setUserDoc((prev) => (prev ? { ...prev, email: newEmail } : prev));
      setCurrentPassword("");
      setMsg("Email updated.");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to update email. Re-auth may be required."));
    } finally {
      setBusyEmail(false);
    }
  }

  async function sendVerify() {
    if (!me) return;
    try {
      await sendEmailVerification(me);
      setMsg("Verification email sent.");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to send verification email."));
    }
  }

  async function sendReset() {
    try {
      const email = auth.currentUser?.email;
      if (!email) {
        setErr("No email on account.");
        return;
      }
      await sendPasswordResetEmail(auth, email);
      setMsg("Password reset link sent.");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to send reset email."));
    }
  }

  async function doLogout() {
    try {
      await signOut(auth);
      router.replace("/auth/login");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to log out."));
    }
  }

  async function doDeleteAccount() {
    if (!me) return;
    if (confirmText !== "DELETE") {
      setErr('Type "DELETE" to confirm.');
      return;
    }

    setErr(null);
    setMsg(null);
    setBusyDelete(true);

    try {
      await updateDoc(doc(db, "users", me.uid), { deletedAt: new Date().toISOString() }).catch(() => {});
      await deleteUser(me);
      setShowDelete(false);
      router.replace("/auth/login");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to delete account."));
    } finally {
      setBusyDelete(false);
    }
  }

  const providers = useMemo(() => me?.providerData?.map((entry) => entry.providerId) || [], [me]);

  if (!authReady || !me) return null;

  return (
    <main className="settingsPage">
      {msg ? <p className="notice ok">{msg}</p> : null}
      {err ? <p className="notice bad">{err}</p> : null}

      {loadingDoc ? (
        <div className="state">Loading settings...</div>
      ) : userDoc ? (
        <>
          <section className="settingsHero">
            <div>
              <p className="eyebrow">Settings</p>
              <h1>Account and appearance</h1>
              <p className="heroText">
                Manage your theme, contact details, password recovery, and the profile information shown around Clean Kitchen.
              </p>
            </div>
            <div className="heroMeta">
              <span>{userDoc.email}</span>
              {userDoc.username ? <span>@{userDoc.username}</span> : null}
              <span>{mode}</span>
            </div>
          </section>

          <div className="settingsGrid">
            <Card className="settingsCard">
              <h2>Profile details</h2>
              <p>Account details live here now so the profile page only handles your picture.</p>
              <div className="grid2">
                <Input label="First name" value={firstName} onChange={(event) => setFirstName(event.currentTarget.value)} />
                <Input label="Last name" value={lastName} onChange={(event) => setLastName(event.currentTarget.value)} />
                <Input label="Username" value={username} onChange={(event) => setUsername(event.currentTarget.value)} />
                <Input label="UID" value={userDoc.uid} readOnly />
              </div>
              <div className="hintRow">
                <span>{checkingUsername ? "Checking username..." : usernameMessage || "Pick the name people will see in recipes and posts."}</span>
              </div>
              <div className="actionsRow">
                <Button onClick={saveSettings} disabled={busySave}>
                  {busySave ? "Saving..." : "Save details"}
                </Button>
              </div>
            </Card>

            <Card className="settingsCard">
              <h2>Security</h2>
              <p>Update your email, verify your account, or send a password reset link.</p>
              <div className="grid2">
                <Input label="Current email" value={userDoc.email} readOnly />
                <Input label="New email" value={newEmail} onChange={(event) => setNewEmail(event.currentTarget.value)} />
                <Input
                  label="Current password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                  hint="Needed for some email changes."
                />
                <div className="field">
                  <span className="fieldLabel">Providers</span>
                  <div className="providerRow">
                    {providers.length
                      ? providers.map((provider) => <span key={provider} className="providerPill">{provider}</span>)
                      : <span className="muted">No providers found.</span>}
                  </div>
                </div>
              </div>
              <div className="actionsRow">
                <Button variant="secondary" onClick={sendVerify}>Send verification</Button>
                <Button variant="secondary" onClick={sendReset}>Reset password</Button>
                <Button onClick={updateEmail} disabled={busyEmail}>
                  {busyEmail ? "Updating..." : "Update email"}
                </Button>
              </div>
            </Card>

            <Card className="settingsCard span2">
              <h2>Appearance and preferences</h2>
              <p>Theme control now lives here instead of the profile page.</p>
              <div className="themeBlock">
                <ThemePicker />
                <BackgroundMotionControl />
              </div>
              <div className="grid2">
                <div className="field">
                  <span className="fieldLabel">Units</span>
                  <div className="chips">
                    {(["metric", "imperial"] as const).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        className={`chip ${units === unit ? "on" : ""}`}
                        onClick={() => setUnits(unit)}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span className="fieldLabel">Email notifications</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(event) => setEmailNotifications(event.currentTarget.checked)}
                    />
                    <span />
                  </label>
                </div>
              </div>
              <div className="actionsRow">
                <Button onClick={saveSettings} disabled={busySave}>
                  {busySave ? "Saving..." : "Save preferences"}
                </Button>
              </div>
            </Card>

            <Card className="settingsCard dangerCard span2">
              <h2>Session and account</h2>
              <p>Log out here or permanently delete the account if you need to leave the app.</p>
              <div className="actionsRow start">
                <Button variant="secondary" onClick={doLogout}>Log out</Button>
                <Button variant="danger" onClick={() => setShowDelete(true)}>Delete account</Button>
              </div>
            </Card>
          </div>

          {showDelete ? (
            <div className="overlay" role="dialog" aria-modal="true" onClick={() => setShowDelete(false)}>
              <div className="modal" onClick={(event) => event.stopPropagation()}>
                <div className="modalHead">
                  <strong>Confirm delete</strong>
                  <button type="button" className="closeBtn" onClick={() => setShowDelete(false)}>
                    &times;
                  </button>
                </div>
                <div className="modalBody">
                  <p>Type DELETE to confirm. If your session is old, Firebase may require you to sign in again first.</p>
                  <Input value={confirmText} onChange={(event) => setConfirmText(event.currentTarget.value)} placeholder="DELETE" />
                  <div className="actionsRow">
                    <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
                    <Button variant="danger" onClick={doDeleteAccount} disabled={busyDelete || confirmText !== "DELETE"}>
                      {busyDelete ? "Deleting..." : "Delete account"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="state">Settings could not be loaded.</div>
      )}

      <style jsx>{`
        .settingsPage {
          max-width: 1120px;
          margin: 0 auto;
          padding: 28px 0 120px;
          display: grid;
          gap: 24px;
        }
        .notice {
          border-radius: 14px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 600;
        }
        .ok {
          background: color-mix(in oklab, #10b981 18%, transparent);
          color: #065f46;
          border: 1px solid color-mix(in oklab, #10b981 38%, transparent);
        }
        .bad {
          background: color-mix(in oklab, #ef4444 18%, transparent);
          color: #7f1d1d;
          border: 1px solid color-mix(in oklab, #ef4444 38%, transparent);
        }
        .state {
          text-align: center;
          padding: 52px 16px;
          border: 1px dashed var(--border);
          border-radius: 20px;
          color: var(--muted);
        }
        .settingsHero {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 28px;
          border-radius: 28px;
          border: 1px solid var(--border);
          background:
            radial-gradient(circle at top right, color-mix(in oklab, var(--primary) 16%, transparent), transparent 28%),
            linear-gradient(135deg, color-mix(in oklab, var(--bg2) 86%, transparent), var(--bg));
          box-shadow: 0 24px 50px rgba(15, 23, 42, 0.1);
          align-items: end;
        }
        .eyebrow {
          margin: 0 0 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        h1 {
          margin: 0;
          font-size: clamp(30px, 4vw, 40px);
          letter-spacing: -0.03em;
        }
        .heroText {
          max-width: 58ch;
          margin: 10px 0 0;
          font-size: 14px;
        }
        .heroMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }
        .heroMeta span {
          padding: 9px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: color-mix(in oklab, var(--bg) 75%, var(--bg2));
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
        }
        .settingsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          align-items: start;
        }
        .settingsCard {
          display: grid;
          gap: 16px;
        }
        .settingsCard :global(h2),
        .settingsCard :global(p) {
          margin: 0;
        }
        .span2 {
          grid-column: span 2;
        }
        .grid2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px 16px;
        }
        .hintRow {
          min-height: 20px;
          font-size: 12px;
          color: var(--muted);
        }
        .themeBlock {
          display: grid;
          gap: 16px;
        }
        .field {
          display: grid;
          gap: 8px;
          align-content: start;
        }
        .fieldLabel {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text);
        }
        .providerRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .providerPill {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg2);
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
        }
        .chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chip {
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          border-radius: 999px;
          padding: 7px 14px;
          cursor: pointer;
          font-weight: 700;
          text-transform: capitalize;
        }
        .chip.on {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: transparent;
        }
        .switch {
          position: relative;
          width: 54px;
          height: 30px;
          display: inline-block;
        }
        .switch input {
          display: none;
        }
        .switch span {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: var(--border);
          transition: 0.2s;
        }
        .switch span::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: var(--bg2);
          border: 1px solid var(--border);
          transition: 0.2s;
        }
        .switch input:checked + span {
          background: var(--primary);
        }
        .switch input:checked + span::after {
          transform: translateX(24px);
        }
        .actionsRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .actionsRow.start {
          justify-content: flex-start;
        }
        .dangerCard {
          border: 1px solid color-mix(in oklab, #ef4444 30%, var(--border));
          background: color-mix(in oklab, #ef4444 4%, var(--card-bg));
        }
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.56);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 100;
        }
        .modal {
          width: 100%;
          max-width: 520px;
          background: var(--card-bg);
          border-radius: 20px;
          border: 1px solid var(--border);
          box-shadow: 0 32px 80px rgba(15, 23, 42, 0.28);
        }
        .modalHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
        }
        .closeBtn {
          border: none;
          background: transparent;
          color: var(--muted);
          font-size: 22px;
          cursor: pointer;
        }
        .modalBody {
          display: grid;
          gap: 14px;
          padding: 16px;
        }
        @media (max-width: 900px) {
          .settingsHero {
            flex-direction: column;
            align-items: start;
          }
          .heroMeta {
            justify-content: flex-start;
          }
        }
        @media (max-width: 768px) {
          .settingsPage {
            padding: 18px 0 96px;
          }
          .settingsGrid,
          .grid2 {
            grid-template-columns: 1fr;
          }
          .span2 {
            grid-column: span 1;
          }
          .actionsRow {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
