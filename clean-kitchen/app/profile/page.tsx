"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type UserDoc = {
  uid: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace("/auth/login"); return; }
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        setUserDoc(snap.data() as UserDoc);
      } else {
        // ja nav user dokuments, aizved uz onboarding vai dashboard
        setUserDoc({
          uid: u.uid,
          email: u.email || "",
          photoURL: u.photoURL || undefined,
        });
      }
      setLoading(false);
    });
    return () => stop();
  }, [router]);

  async function uploadAvatar() {
    if (!file || !userDoc) return;
    setBusy(true);
    setErr(null); setMsg(null);
    try {
      const u = auth.currentUser!;
      const storageRef = ref(storage, `avatars/${u.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await updateProfile(u, { photoURL: url });
      await updateDoc(doc(db, "users", u.uid), { photoURL: url });

      setUserDoc({ ...userDoc, photoURL: url });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg("Profile photo updated!");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update avatar.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setErr(null); setMsg(null);
    try {
      const email = auth.currentUser?.email;
      if (!email) { setErr("No email on account."); return; }
      await sendPasswordResetEmail(auth, email);
      setMsg("Password reset link sent to email.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send reset email.");
    }
  }

  if (loading) return <div className="p">Loading…</div>;
  if (!userDoc) return null;

  return (
    <main className="wrap">
      <h1 className="title">My Profile</h1>

      {msg && <p className="ok">{msg}</p>}
      {err && <p className="bad">{err}</p>}

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
              <Button onClick={uploadAvatar} disabled={!file || busy}>
                {busy ? "Uploading…" : "Save"}
              </Button>
            </div>
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
          <Button variant="secondary" onClick={sendReset}>Send password reset email</Button>
        </div>
      </Card>

      <style jsx>{`
        .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
        .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
        .section { margin-bottom: 20px; }
        .h2 { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
        .row { display: flex; align-items: center; gap: 16px; }
        .col { display: flex; flex-direction: column; gap: 10px; }
        .actions { display: flex; gap: 10px; }
        .avatar { width: 96px; height: 96px; border-radius: 999px; object-fit: cover; border: 1px solid #e5e7eb; }
        .p { padding: 16px; }
        .ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 10px; }
        .bad { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 10px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
        @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}
