"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updateEmail as fbUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
  deleteUser,
  User,
} from "firebase/auth";
import type { CollectionReference, DocumentData, Query, QueryDocumentSnapshot } from "firebase/firestore";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { ref as sref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";

import ThemePicker from "@/components/theme/ThemePicker";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemeMode } from "@/components/theme/ThemeProvider";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type UserDoc = {
  uid: string;
  email: string;
  username?: string | null;
  photoURL?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  prefs?: {
    units?: "metric" | "imperial";
    theme?: ThemeMode;
    emailNotifications?: boolean;
  };
};

function slugifyUsername(v: string) {
  return v.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").replace(/\.{2,}/g, ".").slice(0, 20);
}
function validUsername(u: string) {
  return /^[a-z0-9._-]{3,20}$/.test(u);
}
function fullName(fn?: string | null, ln?: string | null) {
  const f = (fn || "").trim();
  const l = (ln || "").trim();
  return (f + " " + l).trim() || null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();

  const [authReady, setAuthReady] = useState(false);
  const [me, setMe] = useState<User | null>(null);

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [checkingUname, setCheckingUname] = useState(false);
  const [unameMsg, setUnameMsg] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busyUpload, setBusyUpload] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busySave, setBusySave] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      setMe(u || null);
      setAuthReady(true);
      if (!u) router.replace("/auth/login");
    });
    return () => stop();
  }, [router]);

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
          setFirstName("");
          setLastName("");
          setUsername("");
          setUnits("metric");
          setMode("system");
          setEmailNotifications(true);
        } else {
          const d = snap.data() as UserDoc;
          setUserDoc(d);
          setFirstName(d.firstName || "");
          setLastName(d.lastName || "");
          setUsername(d.username || "");
          setUnits(d.prefs?.units || "metric");
          setMode(d.prefs?.theme || "system");
          setEmailNotifications(d.prefs?.emailNotifications ?? true);
        }
        setNewEmail(me.email || "");
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load profile.");
      } finally {
        setLoadingDoc(false);
      }
    })();
  }, [authReady, me, setMode]);

  useEffect(() => {
    if (!username) {
      setUnameMsg(null);
      return;
    }
    const v = slugifyUsername(username);
    if (v !== username) setUsername(v);
    if (!validUsername(v)) {
      setUnameMsg("3–20 chars: a–z, 0–9, . _ -");
      return;
    }
    const id = setTimeout(async () => {
      if (!me) return;
      setCheckingUname(true);
      try {
        if (userDoc?.username === v) {
          setUnameMsg("This is your current username.");
          return;
        }
        const snap = await getDoc(doc(db, "usernames", v));
        if (snap.exists()) {
          const owner = snap.get("uid");
          if (owner === me.uid) setUnameMsg("This username is already reserved for you.");
          else setUnameMsg("That username is taken.");
        } else {
          setUnameMsg("Username is available.");
        }
      } catch {
        setUnameMsg(null);
      } finally {
        setCheckingUname(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [username, me, userDoc?.username]);

  async function uploadAvatar() {
    if (!file || !me) return;
    if (!/image\/(png|jpe?g|webp)/i.test(file.type)) {
      setErr("Please pick a PNG/JPG/WEBP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image is too large (max 5 MB).");
      return;
    }
    setErr(null);
    setMsg(null);
    setBusyUpload(true);
    try {
      const r = sref(storage, `avatars/${me.uid}/avatar.jpg`);
      // CRITICAL: pass contentType so storage.rules isImage()/isVideo() can evaluate true
      await uploadBytes(r, file, {
        contentType: file.type,
        cacheControl: "public, max-age=3600",
      });
      const url = await getDownloadURL(r);
      await updateProfile(me, { photoURL: url });
      await updateDoc(doc(db, "users", me.uid), { photoURL: url });
      setUserDoc((prev) => (prev ? { ...prev, photoURL: url } : prev));
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg("Profile photo updated!");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update avatar.");
    } finally {
      setBusyUpload(false);
    }
  }

  async function removeAvatar() {
    if (!me) return;
    setErr(null);
    setMsg(null);
    setBusyUpload(true);
    try {
      const root = sref(storage, `avatars/${me.uid}`);
      const { items, prefixes } = await listAll(root);
      await Promise.all(items.map((i) => deleteObject(i).catch(() => {})));
      await Promise.all(
        prefixes.map((p) =>
          listAll(p).then(({ items }) => Promise.all(items.map((i) => deleteObject(i).catch(() => {}))))
        )
      );
      await updateProfile(me, { photoURL: "" });
      await updateDoc(doc(db, "users", me.uid), { photoURL: null });
      setUserDoc((prev) => (prev ? { ...prev, photoURL: null } : prev));
      setMsg("Profile photo removed.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to remove avatar.");
    } finally {
      setBusyUpload(false);
    }
  }

  async function saveProfile() {
    if (!me || !userDoc) return;
    setErr(null);
    setMsg(null);
    setBusySave(true);
    const requestedUsername = slugifyUsername(username);
    const previousUsername = userDoc.username || null;
    const previousDisplayName = fullName(userDoc.firstName, userDoc.lastName);
    const previousAvatar = userDoc.photoURL ?? null;
    let appliedUsername: string | null = previousUsername;
    try {
      await runTransaction(db, async (trx) => {
        const uref = doc(db, "users", me.uid);
        const snapshot = await trx.get(uref);
        const existing = (snapshot.exists() ? snapshot.data() : {}) as { username?: string | null };
        const currentUsername = existing?.username ?? previousUsername ?? null;
        let nextUsername = currentUsername;

        if (requestedUsername && requestedUsername !== currentUsername) {
          if (!validUsername(requestedUsername)) {
            throw new Error("Username must be 3–20 characters: a–z, 0–9, . _ -");
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
          uref,
          {
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            username: nextUsername || null,
            prefs: { units, theme: mode, emailNotifications },
          },
          { merge: true }
        );
        appliedUsername = nextUsername || null;
      });

      const displayNameNext = fullName(firstName, lastName);
      await updateProfile(me, { displayName: displayNameNext || undefined });

      const avatarURL = userDoc.photoURL ?? me.photoURL ?? null;

      await setDoc(
        doc(db, "usersPublic", me.uid),
        {
          displayName: displayNameNext || null,
          username: appliedUsername,
          avatarURL,
        },
        { merge: true }
      );

      const profileChanged =
        appliedUsername !== previousUsername ||
        (displayNameNext || null) !== (previousDisplayName || null) ||
        avatarURL !== previousAvatar;

      if (profileChanged) {
        await propagateUserProfile(me.uid, {
          displayName: displayNameNext || null,
          username: appliedUsername,
          avatarURL,
        });
      }

      setMsg("Profile saved.");
      setUserDoc((prev) =>
        prev
          ? {
              ...prev,
              firstName: firstName.trim() || null,
              lastName: lastName.trim() || null,
              username: appliedUsername,
              prefs: { units, theme: mode, emailNotifications },
            }
          : prev
      );
      setUsername(appliedUsername || "");
      if (requestedUsername && requestedUsername !== previousUsername) {
        setUnameMsg("Username updated. Your content will refresh shortly.");
      } else {
        setUnameMsg(null);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save profile.");
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
      setMsg("Email updated.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update email. (Re-auth may be required)");
    } finally {
      setBusyEmail(false);
    }
  }

  async function sendVerify() {
    if (!me) return;
    try {
      await sendEmailVerification(me);
      setMsg("Verification email sent.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send verification email.");
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
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send reset email.");
    }
  }

  async function doLogout() {
    try {
      await signOut(auth);
      router.replace("/auth/login");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to log out.");
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
      try {
        const root = sref(storage, `avatars/${me.uid}`);
        const { items, prefixes } = await listAll(root);
        await Promise.all(items.map((i) => deleteObject(i).catch(() => {})));
        await Promise.all(
          prefixes.map((p) =>
            listAll(p).then(({ items }) => Promise.all(items.map((i) => deleteObject(i).catch(() => {}))))
          )
        );
      } catch {}
      await updateDoc(doc(db, "users", me.uid), { deletedAt: new Date().toISOString() }).catch(() => {});
      try {
        await deleteUser(me);
      } catch (e: any) {
        throw new Error(e?.message || "Re-authenticate then try deleting again.");
      }
      setMsg("Account deleted.");
      setShowDelete(false);
      router.replace("/auth/login");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete account.");
    } finally {
      setBusyDelete(false);
    }
  }

  const providers = useMemo(() => me?.providerData?.map((p) => p.providerId) || [], [me]);

  if (!authReady || !me) return null;

  return (
    <main className="profilePage">
      {msg && <p className="notice ok">{msg}</p>}
      {err && <p className="notice bad">{err}</p>}

      {loadingDoc ? (
        <div className="loading">Loading...</div>
      ) : userDoc ? (
        (() => {
          const heroName =
            fullName(firstName, lastName) ||
            fullName(userDoc.firstName, userDoc.lastName) ||
            userDoc.username ||
            userDoc.email ||
            "Your profile";

          return (
            <>
              <section className="profileHero">
                <div className="heroCard">
                  <div className="avatarColumn">
                    <div className="avatarWrap">
                      <img
                        src={userDoc.photoURL || "/default-avatar.png"}
                        alt="Profile avatar"
                      />
                      <button
                        type="button"
                        className="avatarTrigger"
                        onClick={() => fileRef.current?.click()}
                      >
                        Change photo
                      </button>
                    </div>
                    <div className="avatarActions">
                      <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                        Choose
                      </Button>
                      <Button onClick={uploadAvatar} disabled={!file || busyUpload}>
                        {busyUpload ? "Uploading..." : "Save"}
                      </Button>
                      <Button variant="secondary" onClick={removeAvatar} disabled={busyUpload}>
                        Remove
                      </Button>
                    </div>
                    <p className="avatarHint muted">
                      {file ? `Selected: ${file.name}` : "PNG/JPG/WEBP, up to 5 MB."}
                    </p>
                  </div>

                  <div className="heroInfo">
                    <span className="eyebrow">Account</span>
                    <h1>{heroName}</h1>
                    <p>Manage your identity, security, and preferences across Clean Kitchen.</p>
                    <div className="heroMeta">
                      <span>{userDoc.email}</span>
                      {userDoc.username ? <span>@{userDoc.username}</span> : null}
                    </div>
                    <div className="heroButtons">
                      <Button onClick={doLogout}>Log out</Button>
                    </div>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
              </section>

              <div className="profileGrid">
                <Card className="profileCard">
                  <h2 className="cardTitle">Personal details</h2>
                  <br/>
                  <p className="cardSubtitle">Update how your name and username appear to others.</p>
                  <br/>
                  <div className="grid2">
                    <Input label="First name" value={firstName} onChange={(e: any) => setFirstName(e.target.value)} />
                    <Input label="Last name" value={lastName} onChange={(e: any) => setLastName(e.target.value)} />
                    <Input label="UID" value={userDoc.uid} readOnly />
                  </div>
                  <div className="actionsRow">
                    <Button onClick={saveProfile} disabled={busySave}>
                      {busySave ? "Saving..." : "Save details"}
                    </Button>
                  </div>
                </Card>

                <Card className="profileCard">
                  <h2 className="cardTitle">Account & security</h2>
                  <br/>
                  <p className="cardSubtitle">Maintain your email address and review sign-in providers.</p>
                  <br/>
                  <div className="grid2">
                    <Input label="Current email" value={userDoc.email} readOnly />
                    <div className="field">
                      <label className="lab">New email</label>
                      <input className="inp" value={newEmail} onChange={(e) => setNewEmail(e.currentTarget.value)} />
                    </div>
                    <div className="field">
                      <label className="lab">Current password (for re-auth)</label>
                      <input
                        className="inp"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.currentTarget.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="lab">Providers</label>
                      <div className="providerRow">
                        {providers.length
                          ? providers.map((p) => (
                              <span key={p} className="providerPill">
                                {p}
                              </span>
                            ))
                          : <span className="muted">-</span>}
                      </div>
                    </div>
                  </div>
                  <br/>
                  <div className="actionsRow">
                    <Button variant="secondary" onClick={sendVerify}>
                      Send verification
                    </Button>
                    <Button variant="secondary" onClick={sendReset}>
                      Send password reset
                    </Button>
                    <Button onClick={updateEmail} disabled={busyEmail}>
                      {busyEmail ? "Updating..." : "Update email"}
                    </Button>
                  </div>
                </Card>

                <Card className="profileCard span2">
                  <h2 className="cardTitle">Preferences</h2>
                  <br/>
                  <p className="cardSubtitle">Choose how Clean Kitchen should look and notify you.</p>
                  <div className="themeBlock">
                    <ThemePicker />
                  </div>
                  <div className="grid2">
                    <div className="field">
                      <label className="lab">Units</label>
                      <div className="chips">
                        {(["metric", "imperial"] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            className={`chip ${units === u ? "on" : ""}`}
                            onClick={() => setUnits(u)}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="lab">Email notifications</label>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.currentTarget.checked)}
                        />
                        <span />
                      </label>
                    </div>
                  </div>
                  <div className="actionsRow">
                    <Button onClick={saveProfile} disabled={busySave}>
                      {busySave ? "Saving..." : "Save preferences"}
                    </Button>
                  </div>
                </Card>

                <Card className="profileCard dangerCard span2">
                  <h2 className="cardTitle">Danger zone</h2>
                  <br />
                  <p className="cardSubtitle">
                    Deleting your account removes your profile and signs you out. Usernames are retained to prevent impersonation.
                  </p>
                  <div className="actionsRow">
                    <Button variant="secondary" onClick={() => setShowDelete(true)}>
                      Delete my account...
                    </Button>
                  </div>
                </Card>
              </div>

              {showDelete ? (
                <div className="ov" role="dialog" aria-modal="true" onClick={() => setShowDelete(false)}>
                  <div className="box" onClick={(e) => e.stopPropagation()}>
                    <div className="bh">
                      <div className="bt">Confirm delete</div>
                      <button className="x" onClick={() => setShowDelete(false)}>
                        &times;
                      </button>
                    </div>
                    <div className="body">
                      <p>
                        Type <strong>DELETE</strong> to confirm. You may need to re-login if your session is old.
                      </p>
                      <input
                        className="inp"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.currentTarget.value)}
                        placeholder="DELETE"
                      />
                      <div className="actionsRow">
                        <Button variant="secondary" onClick={() => setShowDelete(false)}>
                          Cancel
                        </Button>
                        <Button onClick={doDeleteAccount} disabled={busyDelete || confirmText !== "DELETE"}>
                          {busyDelete ? "Deleting..." : "Delete account"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          );
        })()
      ) : (
        <div className="emptyState">Profile not found.</div>
      )}

      <style jsx>{`
        .profilePage {
          max-width: 1100px;
          margin: 0 auto;
          padding: 24px 0 120px;
          display: grid;
          gap: 24px;
        }
        .notice {
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 13px;
        }
        .ok {
          background: color-mix(in oklab, #10b981 18%, transparent);
          color: #065f46;
          border: 1px solid color-mix(in oklab, #10b981 35%, transparent);
        }
        .bad {
          background: color-mix(in oklab, #ef4444 18%, transparent);
          color: #7f1d1d;
          border: 1px solid color-mix(in oklab, #ef4444 35%, transparent);
        }
        .loading, .emptyState {
          text-align: center;
          padding: 48px 16px;
          border: 1px dashed var(--border);
          border-radius: 18px;
        }
        .profileHero {
          position: relative;
        }
        .heroCard {
          border-radius: 26px;
          border: 1px solid var(--border);
          background: linear-gradient(135deg, color-mix(in oklab, var(--bg2) 80%, transparent), var(--bg));
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12);
          padding: 24px;
          display: grid;
          grid-template-columns: minmax(0, 240px) 1fr;
          gap: 24px;
        }
        .avatarColumn {
          display: grid;
          gap: 12px;
          align-content: start;
        }
        .avatarWrap {
          position: relative;
          width: 140px;
          height: 140px;
          border-radius: 32px;
          overflow: hidden;
          box-shadow: 0 14px 36px rgba(15, 23, 42, 0.22);
        }
        .avatarWrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .avatarTrigger {
          position: absolute;
          inset: auto 0 0 0;
          border: none;
          background: rgba(15, 23, 42, 0.65);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 0;
          cursor: pointer;
        }
        .avatarActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .avatarHint {
          font-size: 12px;
        }
        .heroInfo {
          display: grid;
          gap: 14px;
          align-content: start;
        }
        .eyebrow {
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .heroInfo h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 36px);
          letter-spacing: -0.02em;
        }
        .heroInfo p {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          max-width: 420px;
        }
        .heroMeta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          font-size: 13px;
          color: var(--muted);
        }
        .heroMeta span {
          border: 1px solid var(--border);
          padding: 6px 10px;
          border-radius: 999px;
          background: var(--bg2);
        }
        .heroButtons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .profileGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .profileCard {
          display: grid;
          gap: 16px;
        }
        .span2 {
          grid-column: span 2;
        }
        .cardTitle {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }
        .cardSubtitle {
          margin: -8px 0 0;
          color: var(--muted);
          font-size: 13px;
        }
        .grid2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px 16px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .lab {
          font-size: 0.9rem;
          color: var(--text);
          font-weight: 600;
        }
        .inp {
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 12px;
        }
        .small {
          font-size: 12px;
        }
        .muted {
          color: var(--muted);
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
          padding: 6px 12px;
          cursor: pointer;
          font-weight: 600;
        }
        .chip.on {
          background: var(--primary);
          color: var(--primary-contrast);
          border-color: transparent;
        }
        .switch {
          position: relative;
          width: 52px;
          height: 28px;
          display: inline-block;
        }
        .switch input {
          display: none;
        }
        .switch span {
          position: absolute;
          inset: 0;
          background: var(--border);
          border-radius: 999px;
          transition: 0.2s;
        }
        .switch span:after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 22px;
          height: 22px;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 999px;
          transition: 0.2s;
        }
        .switch input:checked + span {
          background: var(--primary);
        }
        .switch input:checked + span:after {
          transform: translateX(22px);
        }
        .actionsRow {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .themeBlock {
          padding: 12px 0;
          border-bottom: 1px dashed var(--border);
        }
        .providerRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .providerPill {
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          font-size: 12px;
        }
        .dangerCard {
          border: 1px solid color-mix(in oklab, #ef4444 35%, var(--border));
          background: color-mix(in oklab, #ef4444 4%, var(--card-bg));
        }
        .ov {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 2200;
        }
        .box {
          width: 100%;
          max-width: 520px;
          background: var(--card-bg);
          border-radius: 18px;
          border: 1px solid var(--border);
          overflow: hidden;
          box-shadow: 0 40px 60px rgba(15, 23, 42, 0.35);
        }
        .bh {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          padding: 12px 16px;
        }
        .bt {
          font-weight: 800;
        }
        .x {
          border: none;
          background: transparent;
          color: var(--muted);
          font-size: 20px;
          cursor: pointer;
        }
        .body {
          padding: 16px;
          display: grid;
          gap: 12px;
        }
        @media (max-width: 900px) {
          .heroCard {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .avatarColumn {
            justify-items: center;
          }
          .heroInfo {
            text-align: center;
          }
          .heroButtons {
            justify-content: center;
          }
        }
        @media (max-width: 768px) {
          .profilePage {
            padding: 16px 0 96px;
          }
          .profileGrid {
            grid-template-columns: 1fr;
          }
          .span2 {
            grid-column: span 1;
          }
          .grid2 {
            grid-template-columns: 1fr;
          }
          .actionsRow {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}

type AuthorUpdate = {
  displayName: string | null;
  username: string | null;
  avatarURL: string | null;
};

const PROFILE_BATCH_SIZE = 200;

function buildAuthorPatch(uid: string, info: AuthorUpdate) {
  return {
    "author.uid": uid,
    "author.username": info.username ?? null,
    "author.displayName": info.displayName ?? null,
    "author.avatarURL": info.avatarURL ?? null,
    "author.name": info.displayName ?? null,
  };
}

async function updateDocsInBatches(colRef: CollectionReference<DocumentData>, uid: string, info: AuthorUpdate) {
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  const patch = buildAuthorPatch(uid, info);
  while (true) {
    const base: Query<DocumentData> = cursor
      ? query(colRef, where("uid", "==", uid), orderBy("__name__"), startAfter(cursor), limit(PROFILE_BATCH_SIZE))
      : query(colRef, where("uid", "==", uid), orderBy("__name__"), limit(PROFILE_BATCH_SIZE));
    const snap = await getDocs(base);
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      batch.set(docSnap.ref, patch, { merge: true });
    });
    await batch.commit();
    if (snap.size < PROFILE_BATCH_SIZE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

async function updateCollectionGroupInBatches(group: string, uid: string, info: AuthorUpdate) {
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  const patch = buildAuthorPatch(uid, info);
  while (true) {
    const base: Query<DocumentData> = cursor
      ? query(
          collectionGroup(db, group),
          where("uid", "==", uid),
          orderBy("__name__"),
          startAfter(cursor),
          limit(PROFILE_BATCH_SIZE)
        )
      : query(collectionGroup(db, group), where("uid", "==", uid), orderBy("__name__"), limit(PROFILE_BATCH_SIZE));
    const snap = await getDocs(base);
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      batch.set(docSnap.ref, patch, { merge: true });
    });
    await batch.commit();
    if (snap.size < PROFILE_BATCH_SIZE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

async function propagateUserProfile(uid: string, info: AuthorUpdate) {
  const postsRef = collection(db, "posts");
  const recipesRef = collection(db, "recipes");
  await updateDocsInBatches(postsRef, uid, info);
  await updateDocsInBatches(recipesRef, uid, info);
  await updateCollectionGroupInBatches("comments", uid, info);
  await updateCollectionGroupInBatches("replies", uid, info);
}
