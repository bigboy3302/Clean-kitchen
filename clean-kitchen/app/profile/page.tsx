// app/profile/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
};

export default function ProfilePage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [me, setMe] = useState<User | null>(null);

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busyUpload, setBusyUpload] = useState(false);

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
        const snap = await getDoc(doc(db, "users", me.uid));
        if (snap.exists()) {
          const data = snap.data() as UserDoc;
          setUserDoc({
            uid: me.uid,
            email: me.email || data.email || "",
            username: data.username ?? null,
            photoURL: data.photoURL ?? me.photoURL ?? null,
            firstName: data.firstName ?? null,
            lastName: data.lastName ?? null,
          });
        } else {
          const shell: UserDoc = {
            uid: me.uid,
            email: me.email || "",
            username: null,
            photoURL: me.photoURL || null,
            firstName: null,
            lastName: null,
          };
          await setDoc(doc(db, "users", me.uid), shell);
          setUserDoc(shell);
        }
        setErr(null);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load profile.");
      } finally {
        setLoadingDoc(false);
      }
    })();
  }, [authReady, me]);

  async function uploadAvatar() {
    if (!file || !me) return;
    setErr(null);
    setMsg(null);
    setBusyUpload(true);
    try {
      // store under avatars/{uid}/avatar.jpg (or keep original filename)
      const sref = ref(storage, `avatars/${me.uid}/avatar.jpg`);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);

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

  async function sendReset() {
    setErr(null);
    setMsg(null);
    try {
      const email = auth.currentUser?.email;
      if (!email) { setErr("No email on account."); return; }
      await sendPasswordResetEmail(auth, email);
      setMsg("Password reset link sent to your email.");
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

  if (!authReady || !me) return null;

  return (
    <main className="wrap">
      <div className="headerRow">
        <h1 className="title">My Profile</h1>
        <Button variant="secondary" onClick={doLogout}>Log out</Button>
      </div>

      {msg && <p className="ok">{msg}</p>}
      {err && <p className="bad">{err}</p>}

      {loadingDoc ? (
        <div className="p">Loading…</div>
      ) : userDoc ? (
        <>
          <Card className="section">
            <h2 className="h2">Avatar</h2>
            <div className="row">
              <img
                src={userDoc.photoURL || "/default-avatar.png"}
                alt="avatar"
                className="avatar"
              />
              <div className="col">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div className="actions">
                  <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                    Choose
                  </Button>
                  <Button onClick={uploadAvatar} disabled={!file || busyUpload}>
                    {busyUpload ? "Uploading…" : "Save"}
                  </Button>
                </div>
                {file ? <div className="muted">Selected: {file.name}</div> : null}
              </div>
            </div>
          </Card>

          <Card className="section">
            <h2 className="h2">Account</h2>
            <div className="grid">
              <Input label="Email" value={userDoc.email} readOnly />
              <Input label="Username" value={userDoc.username || ""} readOnly />
            </div>
            <div className="actions">
              <Button variant="secondary" onClick={sendReset}>
                Send password reset email
              </Button>
            </div>
          </Card>
        </>
      ) : (
        <div className="p">Profile not found.</div>
      )}

      <style jsx>{`
        .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
        .headerRow { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .title { font-size: 28px; font-weight: 700; margin: 0 0 16px; }
        .section { margin-bottom: 20px; }
        .h2 { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
        .row { display: flex; align-items: center; gap: 16px; }
        .col { display: flex; flex-direction: column; gap: 10px; }
        .actions { display: flex; gap: 10px; }
        .avatar { width: 96px; height: 96px; border-radius: 999px; object-fit: cover; border: 1px solid #e5e7eb; }
        .p { padding: 16px; }
        .ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 10px; font-size: 13px; margin: 10px 0; }
        .bad { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; font-size: 13px; margin: 10px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
        @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
        .muted { color:#6b7280; font-size:12px; }
      `}</style>
    </main>
  );
}
