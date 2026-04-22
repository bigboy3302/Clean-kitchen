"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut, updateProfile, type User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, listAll, ref as sref, uploadBytesResumable } from "firebase/storage";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useAuthModal } from "@/context/AuthModalContext";
import { useAuth } from "@/hooks/useAuth";
import { auth, db, storage } from "@/lib/firebas1e";
import { fullName, getErrorMessage, propagateUserProfile, type UserDoc } from "@/lib/account-profile";

export default function ProfilePage() {
  const router = useRouter();
  const { openLogin } = useAuthModal();
  const { user, loading } = useAuth();

  const [authReady, setAuthReady] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busyUpload, setBusyUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMe(user);
    setAuthReady(!loading);
  }, [loading, user]);

  useEffect(() => {
    if (!loading && !user) {
      openLogin("/profile");
    }
  }, [loading, openLogin, user]);

  useEffect(() => {
    if (!authReady || !me) return;

    (async () => {
      setLoadingDoc(true);
      try {
        const userRef = doc(db, "users", me.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          const shell: UserDoc = {
            uid: me.uid,
            email: me.email || "",
            photoURL: me.photoURL || null,
            username: null,
            firstName: null,
            lastName: null,
            prefs: { units: "metric", theme: "system", emailNotifications: true },
          };
          await setDoc(userRef, shell);
          setUserDoc(shell);
        } else {
          setUserDoc(snap.data() as UserDoc);
        }
        setErr(null);
      } catch (error: unknown) {
        setErr(getErrorMessage(error, "Failed to load profile."));
      } finally {
        setLoadingDoc(false);
      }
    })();
  }, [authReady, me]);

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.currentTarget.files?.[0] ?? null;
    setFile(nextFile);
    setUploadProgress(null);
    setErr(null);
    setMsg(null);
  };

  async function uploadAvatar() {
    if (!file || !me || !userDoc) return;
    if (!/image\/(png|jpe?g|webp)/i.test(file.type)) {
      setErr("Please pick a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image is too large. Max size is 5 MB.");
      return;
    }

    setErr(null);
    setMsg(null);
    setBusyUpload(true);
    setUploadProgress(0);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const uploadRef = sref(storage, `avatars/${me.uid}/avatar-${Date.now()}.${ext}`);
      const task = uploadBytesResumable(uploadRef, file, {
        contentType: file.type,
        cacheControl: "public,max-age=86400",
      });

      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            }
          },
          reject,
          () => resolve()
        );
      });

      const url = await getDownloadURL(task.snapshot.ref);
      await updateProfile(me, { photoURL: url });
      await updateDoc(doc(db, "users", me.uid), { photoURL: url });
      await setDoc(
        doc(db, "usersPublic", me.uid),
        {
          avatarURL: url,
          photoURL: url,
        },
        { merge: true }
      );

      const nextDoc = { ...userDoc, photoURL: url };
      setUserDoc(nextDoc);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";

      await propagateUserProfile(me.uid, {
        displayName: fullName(nextDoc.firstName, nextDoc.lastName),
        username: nextDoc.username || null,
        photoURL: url,
      }).catch(() => {});

      setMsg("Profile photo updated.");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to update avatar."));
    } finally {
      setBusyUpload(false);
      setUploadProgress(null);
    }
  }

  async function removeAvatar() {
    if (!me || !userDoc) return;

    setErr(null);
    setMsg(null);
    setBusyUpload(true);

    try {
      const root = sref(storage, `avatars/${me.uid}`);
      const { items, prefixes } = await listAll(root);
      await Promise.all(items.map((item) => deleteObject(item).catch(() => {})));
      await Promise.all(
        prefixes.map((prefix) =>
          listAll(prefix).then(({ items: nestedItems }) =>
            Promise.all(nestedItems.map((item) => deleteObject(item).catch(() => {})))
          )
        )
      );

      await updateProfile(me, { photoURL: "" });
      await updateDoc(doc(db, "users", me.uid), { photoURL: null });
      await setDoc(
        doc(db, "usersPublic", me.uid),
        {
          avatarURL: null,
          photoURL: null,
        },
        { merge: true }
      );

      const nextDoc = { ...userDoc, photoURL: null };
      setUserDoc(nextDoc);
      if (fileRef.current) fileRef.current.value = "";
      setFile(null);

      await propagateUserProfile(me.uid, {
        displayName: fullName(nextDoc.firstName, nextDoc.lastName),
        username: nextDoc.username || null,
        photoURL: null,
      }).catch(() => {});

      setMsg("Profile photo removed.");
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to remove avatar."));
    } finally {
      setBusyUpload(false);
      setUploadProgress(null);
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

  if (!authReady || !me) return null;

  const heroName =
    fullName(userDoc?.firstName, userDoc?.lastName) ||
    userDoc?.username ||
    userDoc?.email ||
    me.email ||
    "Your profile";

  return (
    <main className="profilePage">
      {msg ? <p className="notice ok">{msg}</p> : null}
      {err ? <p className="notice bad">{err}</p> : null}

      {loadingDoc ? (
        <div className="state">Loading profile...</div>
      ) : userDoc ? (
        <>
          <section className="profileHero">
            <div className="avatarShell">
              <div className="avatarFrame">
                <Image
                  src={userDoc.photoURL || "/default-avatar.png"}
                  alt="Profile avatar"
                  fill
                  sizes="160px"
                  className="avatarImg"
                />
                <button type="button" className="avatarOverlay" onClick={() => fileRef.current?.click()}>
                  Change photo
                </button>
              </div>
            </div>
            <div className="heroInfo">
              <p className="eyebrow">Profile</p>
              <h1>{heroName}</h1>
              <p className="heroText">Your profile page now only handles your photo and quick account access.</p>
              <div className="heroMeta">
                <span>{userDoc.email}</span>
                {userDoc.username ? <span>@{userDoc.username}</span> : null}
              </div>
              <div className="heroActions">
                <Button onClick={doLogout}>Log out</Button>
                <Link href="/settings" className="settingsLink">Open settings</Link>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              style={{ display: "none" }}
            />
          </section>

          <div className="profileGrid">
            <Card className="profileCard">
              <h2>Profile picture</h2>
              <p>Upload a new photo, save it, or remove it from your account.</p>
              <div className="actionsRow start">
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>Choose image</Button>
                <Button onClick={uploadAvatar} disabled={!file || busyUpload}>
                  {busyUpload
                    ? typeof uploadProgress === "number"
                      ? `Uploading... ${uploadProgress}%`
                      : "Uploading..."
                    : "Save photo"}
                </Button>
                <Button variant="secondary" onClick={removeAvatar} disabled={busyUpload}>Remove photo</Button>
              </div>
              <p className="fileHint">
                {file ? `Selected: ${file.name}` : "PNG, JPG, or WEBP up to 5 MB."}
              </p>
            </Card>

            <Card className="profileCard">
              <h2>Account access</h2>
              <p>For theme, email, password, and account management, use the settings page.</p>
              <div className="actionsRow start">
                <Link href="/settings" className="settingsCta">Go to settings</Link>
                <Button variant="secondary" onClick={doLogout}>Log out</Button>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <div className="state">Profile not found.</div>
      )}

      <style jsx>{`
        .profilePage {
          max-width: 960px;
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
        .profileHero {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 24px;
          align-items: center;
          padding: 28px;
          border-radius: 28px;
          border: 1px solid var(--border);
          background:
            radial-gradient(circle at top left, color-mix(in oklab, var(--primary) 16%, transparent), transparent 30%),
            linear-gradient(135deg, color-mix(in oklab, var(--bg2) 88%, transparent), var(--bg));
          box-shadow: 0 24px 50px rgba(15, 23, 42, 0.1);
        }
        .avatarShell {
          display: flex;
          justify-content: center;
        }
        .avatarFrame {
          position: relative;
          width: 160px;
          height: 160px;
          border-radius: 36px;
          overflow: hidden;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.2);
        }
        .avatarImg {
          object-fit: cover;
        }
        .avatarOverlay {
          position: absolute;
          inset: auto 0 0 0;
          border: none;
          background: rgba(15, 23, 42, 0.68);
          color: #fff;
          padding: 10px 0;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .heroInfo {
          display: grid;
          gap: 12px;
        }
        .eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .heroText {
          margin: 0;
          max-width: 48ch;
          font-size: 14px;
        }
        .heroMeta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .heroMeta span {
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: color-mix(in oklab, var(--bg) 74%, var(--bg2));
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
        }
        .heroActions,
        .actionsRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .profileGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .profileCard {
          display: grid;
          gap: 14px;
        }
        .start {
          justify-content: flex-start;
        }
        .fileHint {
          margin: 0;
          font-size: 12px;
          color: var(--muted);
        }
        .settingsLink,
        .settingsCta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg2);
          color: var(--text);
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
        }
        .settingsLink:hover,
        .settingsCta:hover {
          text-decoration: none;
          border-color: color-mix(in oklab, var(--primary) 30%, var(--border));
        }
        @media (max-width: 768px) {
          .profilePage {
            padding: 18px 0 96px;
          }
          .profileHero,
          .profileGrid {
            grid-template-columns: 1fr;
          }
          .avatarShell {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
