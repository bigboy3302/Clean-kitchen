
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
import { doc, getDoc, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import { ref as sref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";

import ThemePicker from "@/components/theme/ThemePicker";
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
    theme?: "system" | "light" | "dark";
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
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
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
          setTheme("system");
          setEmailNotifications(true);
        } else {
          const d = snap.data() as UserDoc;
          setUserDoc(d);
          setFirstName(d.firstName || "");
          setLastName(d.lastName || "");
          setUsername(d.username || "");
          setUnits(d.prefs?.units || "metric");
          setTheme(d.prefs?.theme || "system");
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
  }, [authReady, me]);


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
          setUnameMsg("Current username ✔");
          return;
        }
        const snap = await getDoc(doc(db, "usernames", v));
        setUnameMsg(snap.exists() ? "Taken ✖" : "Available ✔");
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
      await uploadBytes(r, file);
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
    const uname = slugifyUsername(username);
    try {
      await runTransaction(db, async (trx) => {
        const uref = doc(db, "users", me.uid);
        
        if (uname && uname !== userDoc.username) {
          if (!validUsername(uname)) throw new Error("Username must be 3–20 characters: a–z, 0–9, . _ -");
          const nref = doc(db, "usernames", uname);
          const nsnap = await trx.get(nref);
          if (nsnap.exists()) throw new Error("That username is taken.");
          trx.set(nref, { uid: me.uid });
          trx.update(uref, { username: uname });
        }
        trx.set(
          uref,
          {
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            ...(uname || userDoc.username ? { username: uname || userDoc.username } : {}),
            prefs: { units, theme, emailNotifications },
          },
          { merge: true }
        );
      });
      await updateProfile(me, { displayName: fullName(firstName, lastName) || undefined });
      setMsg("Profile saved.");
      setUserDoc((prev) =>
        prev
          ? {
              ...prev,
              firstName: firstName.trim() || null,
              lastName: lastName.trim() || null,
              username: slugifyUsername(username) || prev.username || null,
              prefs: { units, theme, emailNotifications },
            }
          : prev
      );
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
    <main className="wrap">
      <div className="headerRow">
        <h1 className="title">My profile</h1>
        <div className="right">
          <Button variant="secondary" onClick={doLogout}>
            Log out
          </Button>
        </div>
      </div>

      {msg && <p className="ok">{msg}</p>}
      {err && <p className="bad">{err}</p>}

      {loadingDoc ? (
        <div className="p">Loading…</div>
      ) : userDoc ? (
        <>
         
          <Card className="section">
            <h2 className="h2">Avatar</h2>
            <div className="row aic">
             
              <img src={userDoc.photoURL || "/default-avatar.png"} alt="avatar" className="avatar" />
              <div className="col">
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <div className="actions">
                  <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                    Choose
                  </Button>
                  <Button onClick={uploadAvatar} disabled={!file || busyUpload}>
                    {busyUpload ? "Uploading…" : "Save"}
                  </Button>
                  <Button variant="secondary" onClick={removeAvatar} disabled={busyUpload}>
                    Remove
                  </Button>
                </div>
                {file ? <div className="muted small">Selected: {file.name}</div> : null}
              </div>
            </div>
          </Card>

    
          <Card className="section">
            <h2 className="h2">Details</h2>
            <div className="grid">
              <Input label="First name" value={firstName} onChange={(e: any) => setFirstName(e.target.value)} />
              <Input label="Last name" value={lastName} onChange={(e: any) => setLastName(e.target.value)} />
              <div className="field">
                <label className="lab">Username</label>
                <input className="inp" value={username} onChange={(e) => setUsername(e.currentTarget.value)} placeholder="yourname" />
                <div className="muted small">{checkingUname ? "Checking…" : unameMsg ?? "3–20 chars: a–z, 0–9, . _ -"}</div>
              </div>
              <Input label="UID" value={userDoc.uid} readOnly />
            </div>
            <div className="actions">
              <Button onClick={saveProfile} disabled={busySave}>
                {busySave ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </Card>

      
          <Card className="section">
            <h2 className="h2">Account</h2>
            <div className="grid">
              <Input label="Current email" value={userDoc.email} readOnly />
              <div className="field">
                <label className="lab">New email</label>
                <input className="inp" value={newEmail} onChange={(e) => setNewEmail(e.currentTarget.value)} />
              </div>
              <div className="field">
                <label className="lab">Current password (for re-auth)</label>
                <input className="inp" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.currentTarget.value)} />
              </div>
              <div className="field">
                <label className="lab">Providers</label>
                <div className="muted">{providers.join(", ") || "—"}</div>
              </div>
            </div>
            <div className="actions">
              <Button variant="secondary" onClick={sendVerify}>
                Send verification
              </Button>
              <Button variant="secondary" onClick={sendReset}>
                Send password reset
              </Button>
              <Button onClick={updateEmail} disabled={busyEmail}>
                {busyEmail ? "Updating…" : "Update email"}
              </Button>
            </div>
          </Card>

       
          <Card className="section">
            <h2 className="h2">Preferences</h2>

            <ThemePicker />

            <div className="grid">
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

            <div className="actions">
              <Button onClick={saveProfile} disabled={busySave}>
                {busySave ? "Saving…" : "Save preferences"}
              </Button>
            </div>
          </Card>

          <Card className="section danger">
            <h2 className="h2">Danger zone</h2>
            <p className="muted small">
              Deleting your account removes your profile and signs you out. (Username reservation is kept to prevent impersonation.)
            </p>
            <div className="actions">
              <Button variant="secondary" onClick={() => setShowDelete(true)}>
                Delete my account…
              </Button>
            </div>
          </Card>

          {showDelete ? (
            <div className="ov" role="dialog" aria-modal="true" onClick={() => setShowDelete(false)}>
              <div className="box" onClick={(e) => e.stopPropagation()}>
                <div className="bh">
                  <div className="bt">Confirm delete</div>
                  <button className="x" onClick={() => setShowDelete(false)}>
                    ✕
                  </button>
                </div>
                <div className="body">
                  <p>
                    Type <strong>DELETE</strong> to confirm. You may need to re-login if your session is old.
                  </p>
                  <input className="inp" value={confirmText} onChange={(e) => setConfirmText(e.currentTarget.value)} placeholder="DELETE" />
                  <div className="actions">
                    <Button variant="secondary" onClick={() => setShowDelete(false)}>
                      Cancel
                    </Button>
                    <Button onClick={doDeleteAccount} disabled={busyDelete || confirmText !== "DELETE"}>
                      {busyDelete ? "Deleting…" : "Delete account"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="p">Profile not found.</div>
      )}


      <style jsx>{`
        .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
        .headerRow { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .title { font-size: 28px; font-weight: 800; margin: 0 0 12px; }

        .section { margin-bottom: 18px; }
        .h2 { font-size: 18px; font-weight: 700; margin: 0 0 10px; }

        .row { display: flex; gap: 16px; }
        .aic{ align-items: center; }
        .col { display: flex; flex-direction: column; gap: 10px; }
        .actions { display: flex; gap: 10px; justify-content:flex-end; margin-top: 8px; }

        .avatar { width: 96px; height: 96px; border-radius: 999px; object-fit: cover; border: 1px solid var(--border); }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
        @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } .row{flex-direction:column; align-items:flex-start;} }

        .ok { background: color-mix(in oklab, #10b981 15%, transparent); color: #065f46; border: 1px solid color-mix(in oklab, #10b981 35%, transparent); border-radius: 8px; padding: 8px 10px; font-size: 13px; margin: 8px 0; }
        .bad { background: color-mix(in oklab, #ef4444 15%, transparent); color: #7f1d1d; border: 1px solid color-mix(in oklab, #ef4444 35%, transparent); border-radius: 8px; padding: 8px 10px; font-size: 13px; margin: 8px 0; }

        .muted { color: var(--muted); }
        .small { font-size:12px; }

        .field{ display:flex; flex-direction:column; gap:6px; }
        .lab{ font-size:.9rem; color:var(--text); font-weight:600; }
        .inp{ border:1px solid var(--border); background:var(--bg2); color:var(--text); border-radius:12px; padding:10px 12px; }

        .chips{display:flex;gap:8px;flex-wrap:wrap}
        .chip{border:1px solid var(--border);background:var(--bg2);color:var(--text);border-radius:999px;padding:6px 10px;cursor:pointer}
        .chip.on{background:var(--primary);color:var(--primary-contrast);border-color:transparent}

        .switch{position:relative;width:48px;height:28px;display:inline-block}
        .switch input{display:none}
        .switch span{position:absolute;inset:0;background:var(--border);border-radius:999px;transition:.2s}
        .switch span:after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;background:var(--bg2);border:1px solid var(--border);border-radius:999px;transition:.2s}
        .switch input:checked + span{background:var(--primary)}
        .switch input:checked + span:after{transform:translateX(20px)}

        .danger{border:1px solid color-mix(in oklab, #ef4444 35%, var(--border));background:var(--card-bg)}

        /* Overlay */
        .ov{position:fixed;inset:0;background:rgba(2,6,23,.55);display:grid;place-items:center;padding:16px;z-index:2200}
        .box{width:100%;max-width:520px;background:var(--card-bg);border-radius:16px;border:1px solid var(--border);overflow:hidden}
        .bh{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding:10px 12px}
        .bt{font-weight:800}
        .x{border:none;background:var(--primary);color:var(--primary-contrast);border-radius:10px;padding:4px 10px;cursor:pointer}
        .body{padding:12px}
      `}</style>
    </main>
  );
}