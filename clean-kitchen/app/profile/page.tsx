"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { updateProfile, sendPasswordResetEmail, deleteUser, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type ProfileData = {
  uid: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  photoURL?: string;
  lastUsernameChange?: Timestamp; // <-- svarīgi
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [username, setUsername] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      const u = auth.currentUser;
      if (!u) return router.replace("/auth/login");

      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const d = snap.data() as ProfileData;
        setProfile(d);
        setUsername(d.username);
      }
    }
    load();
  }, [router]);

  async function updatePhoto() {
    if (!photoFile || !profile) return;
    setBusy(true);
    try {
      const storageRef = ref(storage, `avatars/${profile.uid}`);
      await uploadBytes(storageRef, photoFile);
      const url = await getDownloadURL(storageRef);
      await updateProfile(auth.currentUser!, { photoURL: url });
      await updateDoc(doc(db, "users", profile.uid), { photoURL: url });
      setProfile({ ...profile, photoURL: url });
      setMsg("Profila bilde atjaunota!");
    } catch (e: any) {
      setMsg(e.message ?? "Neizdevās atjaunot bildi.");
    } finally {
      setBusy(false);
    }
  }

  async function changeUsername() {
    if (!profile) return;
    if (username === profile.username) return;

    // 1x nedēļā
    const lastChangeSec = profile.lastUsernameChange
      ? Math.floor(profile.lastUsernameChange.toMillis() / 1000)
      : 0;
    const oneWeek = 7 * 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    if (now - lastChangeSec < oneWeek) {
      setMsg("Username var mainīt tikai 1x nedēļā.");
      return;
    }

    setBusy(true);
    try {
      await updateDoc(doc(db, "users", profile.uid), {
        username,
        lastUsernameChange: serverTimestamp(),
      });
      await updateProfile(auth.currentUser!, { displayName: username });
      setProfile({ ...profile, username, lastUsernameChange: Timestamp.fromDate(new Date()) });
      setMsg("Username veiksmīgi nomainīts!");
    } catch (e: any) {
      setMsg(e.message ?? "Neizdevās nomainīt username.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!profile?.email) return;
    try {
      await sendPasswordResetEmail(auth, profile.email);
      setMsg("Paroles maiņas links nosūtīts uz e-pastu!");
    } catch (e: any) {
      setMsg(e.message ?? "Neizdevās nosūtīt linku.");
    }
  }

  async function removeAccount() {
    if (!confirm("Vai tiešām dzēst kontu?")) return;
    try {
      await deleteUser(auth.currentUser!);
      setMsg("Konts dzēsts.");
      router.replace("/auth/register");
    } catch (e: any) {
      setMsg(e.message ?? "Neizdevās dzēst kontu.");
    }
  }

  async function logout() {
    await signOut(auth);
    router.replace("/auth/login");
  }

  if (!profile) return <div className="p-6">Loading…</div>;

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}

      {/* Profila bilde */}
      <section className="space-y-4">
        <h2 className="font-semibold">Profila bilde</h2>
        <div className="flex items-center gap-4">
          <img
            src={profile.photoURL || "/default-avatar.png"}
            alt="avatar"
            className="h-20 w-20 rounded-full border object-cover"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Upload
          </Button>
          {photoFile && (
            <Button onClick={updatePhoto} disabled={busy}>
              {busy ? "Uploading…" : "Save"}
            </Button>
          )}
        </div>
      </section>

      {/* Username */}
      <section className="space-y-4">
        <h2 className="font-semibold">Username</h2>
        <div className="flex gap-3">
          <Input value={username} onChange={(e) => setUsername((e.target as HTMLInputElement).value)} />
          <Button onClick={changeUsername} disabled={busy}>
            Change
          </Button>
        </div>
      </section>

      {/* Parole */}
      <section className="space-y-4">
        <h2 className="font-semibold">Password</h2>
        <Button variant="secondary" onClick={resetPassword}>
          Send reset link to email
        </Button>
      </section>

      {/* Settings */}
      <section className="space-y-4">
        <h2 className="font-semibold">Settings</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={logout} className="sm:flex-1">Logout</Button>
          <Button variant="danger" onClick={removeAccount}>
  Delete account
</Button>

        </div>
      </section>
    </main>
  );
}
