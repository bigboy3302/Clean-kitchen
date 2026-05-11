"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebas1e";

const USERNAME_RE = /^[a-z0-9._-]{3,20}$/;

function suggestUsername(user: User): string {
  const fromEmail = (user.email ?? "").split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 20);
  return fromEmail;
}

function splitDisplayName(displayName: string | null): [string, string] {
  const parts = (displayName ?? "").trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return [first, last];
}

export default function ProfileCompletionModal() {
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");

  const [firstNameErr, setFirstNameErr] = useState<string | null>(null);
  const [lastNameErr, setLastNameErr] = useState<string | null>(null);
  const [usernameErr, setUsernameErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checkDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setPendingUser(null); return; }
      try {
        const snap = await getDoc(doc(db, "usersPublic", u.uid));
        if (snap.exists() && snap.data()?.username) {
          setPendingUser(null);
          return;
        }
      } catch {
        // if we can't read, don't block the user
        return;
      }
      const [fn, ln] = splitDisplayName(u.displayName);
      setFirstName(fn);
      setLastName(ln);
      setUsername(suggestUsername(u));
      setFirstNameErr(null);
      setLastNameErr(null);
      setUsernameErr(null);
      setSubmitErr(null);
      setPendingUser(u);
    });
    return () => unsub();
  }, []);

  // debounced username uniqueness check
  useEffect(() => {
    if (checkDebounce.current) clearTimeout(checkDebounce.current);
    const val = username.trim();
    if (!val || !USERNAME_RE.test(val)) return;
    setUsernameChecking(true);
    checkDebounce.current = setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db, "usernames", val));
        if (snap.exists() && snap.data()?.uid !== pendingUser?.uid) {
          setUsernameErr("Username is already taken.");
        } else {
          setUsernameErr((prev) => (prev === "Username is already taken." ? null : prev));
        }
      } catch {
        // ignore
      } finally {
        setUsernameChecking(false);
      }
    }, 500);
    return () => {
      if (checkDebounce.current) clearTimeout(checkDebounce.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  function validateAll(): boolean {
    let ok = true;
    if (!firstName.trim()) { setFirstNameErr("First name is required."); ok = false; }
    else setFirstNameErr(null);
    if (!lastName.trim()) { setLastNameErr("Surname is required."); ok = false; }
    else setLastNameErr(null);
    const u = username.trim();
    if (!u) { setUsernameErr("Username is required."); ok = false; }
    else if (!USERNAME_RE.test(u)) { setUsernameErr("3–20 chars, only lowercase letters, numbers, . _ -"); ok = false; }
    return ok;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pendingUser) return;
    setSubmitErr(null);
    if (!validateAll()) return;
    setBusy(true);

    const trimFirst = firstName.trim();
    const trimLast = lastName.trim();
    const trimUsername = username.trim().toLowerCase();
    const displayName = [trimFirst, trimLast].join(" ").trim() || null;

    try {
      // Final uniqueness check before writing
      const uSnap = await getDoc(doc(db, "usernames", trimUsername));
      if (uSnap.exists() && uSnap.data()?.uid !== pendingUser.uid) {
        setUsernameErr("Username is already taken.");
        setBusy(false);
        return;
      }

      await Promise.all([
        setDoc(doc(db, "usersPublic", pendingUser.uid), {
          uid: pendingUser.uid,
          username: trimUsername,
          displayName,
          firstName: trimFirst || null,
          lastName: trimLast || null,
          avatarURL: pendingUser.photoURL ?? null,
          createdAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(doc(db, "users", pendingUser.uid), {
          uid: pendingUser.uid,
          email: pendingUser.email ?? null,
          firstName: trimFirst || null,
          lastName: trimLast || null,
          displayName,
          createdAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(doc(db, "usernames", trimUsername), { uid: pendingUser.uid }),
      ]);

      setPendingUser(null);
    } catch {
      setSubmitErr("Could not save profile. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!pendingUser) return null;

  const avatar = pendingUser.photoURL;
  const usernameFormatOk = USERNAME_RE.test(username.trim());

  return (
    <div className="backdrop" role="presentation">
      <section
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pc-title"
      >
        <div className="inner">
          {/* avatar */}
          {avatar && (
            <img src={avatar} alt="" className="avatar" />
          )}
          {!avatar && (
            <div className="avatarFallback">
              {(firstName || pendingUser.email || "?")[0].toUpperCase()}
            </div>
          )}

          <p className="eyebrow">One last step</p>
          <h1 id="pc-title" className="title">Complete your profile</h1>
          <p className="subtitle">
            Choose a username and confirm your name so others can find you.
          </p>

          <form onSubmit={handleSubmit} className="form" noValidate>
            <div className="nameRow">
              <div className="field">
                <label className="label" htmlFor="pc-first">First name</label>
                <input
                  id="pc-first"
                  className={`inp ${firstNameErr ? "inp--err" : ""}`}
                  value={firstName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setFirstName(e.target.value);
                    if (firstNameErr && e.target.value.trim()) setFirstNameErr(null);
                  }}
                  placeholder="First name"
                  autoComplete="given-name"
                  disabled={busy}
                />
                {firstNameErr && <p className="err">{firstNameErr}</p>}
              </div>
              <div className="field">
                <label className="label" htmlFor="pc-last">Surname</label>
                <input
                  id="pc-last"
                  className={`inp ${lastNameErr ? "inp--err" : ""}`}
                  value={lastName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setLastName(e.target.value);
                    if (lastNameErr && e.target.value.trim()) setLastNameErr(null);
                  }}
                  placeholder="Surname"
                  autoComplete="family-name"
                  disabled={busy}
                />
                {lastNameErr && <p className="err">{lastNameErr}</p>}
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="pc-username">Username</label>
              <div className="usernameWrap">
                <span className="atSign">@</span>
                <input
                  id="pc-username"
                  className={`inp inpUsername ${usernameErr ? "inp--err" : usernameFormatOk && !usernameChecking ? "inp--ok" : ""}`}
                  value={username}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 20);
                    setUsername(val);
                    if (!val) {
                      setUsernameErr("Username is required.");
                    } else if (!USERNAME_RE.test(val)) {
                      setUsernameErr("3–20 chars, only lowercase letters, numbers, . _ -");
                    } else {
                      setUsernameErr(null);
                    }
                  }}
                  placeholder="your_username"
                  autoComplete="username"
                  spellCheck={false}
                  disabled={busy}
                />
                {usernameChecking && <span className="checking">checking…</span>}
                {!usernameChecking && usernameFormatOk && !usernameErr && (
                  <span className="checkMark">✓</span>
                )}
              </div>
              <p className="hint">Lowercase letters, numbers, . _ — and — (3–20 chars)</p>
              {usernameErr && <p className="err">{usernameErr}</p>}
            </div>

            {submitErr && (
              <p className="submitErr" role="alert">{submitErr}</p>
            )}

            <button
              type="submit"
              className="submitBtn"
              disabled={busy || usernameChecking || !!usernameErr}
            >
              {busy ? "Saving…" : "Save and continue"}
            </button>
          </form>
        </div>
      </section>

      <style jsx>{`
        .backdrop {
          position: fixed;
          inset: 0;
          z-index: 3000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(7, 10, 19, 0.65);
          backdrop-filter: blur(16px);
          animation: fadeIn 200ms ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .panel {
          width: min(460px, 100%);
          border-radius: 28px;
          border: 1px solid var(--border);
          background: var(--card-bg, var(--bg2));
          box-shadow: 0 32px 100px rgba(0,0,0,.45);
          animation: slideUp 220ms cubic-bezier(.22,1,.36,1);
        }
        @keyframes slideUp {
          from { transform: translateY(18px); opacity: 0; }
          to   { transform: none; opacity: 1; }
        }
        .inner {
          padding: clamp(28px, 6vw, 44px);
          display: grid;
          gap: 6px;
          justify-items: center;
          text-align: center;
        }
        .avatar, .avatarFallback {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          margin-bottom: 8px;
          border: 3px solid var(--border);
        }
        .avatarFallback {
          background: var(--primary);
          color: var(--primary-contrast);
          display: grid;
          place-items: center;
          font-size: 28px;
          font-weight: 800;
        }
        .eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--primary);
        }
        .title {
          margin: 4px 0 0;
          font-size: clamp(22px, 5vw, 30px);
          font-weight: 900;
          letter-spacing: -.02em;
          color: var(--text);
        }
        .subtitle {
          margin: 6px 0 0;
          font-size: 14px;
          color: var(--muted);
          line-height: 1.6;
          max-width: 32ch;
        }
        .form {
          width: 100%;
          margin-top: 20px;
          display: grid;
          gap: 16px;
          text-align: left;
        }
        .nameRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .field {
          display: grid;
          gap: 6px;
        }
        .label {
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: .07em;
        }
        .inp {
          height: 46px;
          padding: 0 14px;
          border-radius: 13px;
          border: 1.5px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-size: 15px;
          width: 100%;
          outline: none;
          transition: border-color .15s;
        }
        .inp:focus { border-color: var(--primary); }
        .inp--err  { border-color: #ef4444; }
        .inp--ok   { border-color: #22c55e; }
        .inp:disabled { opacity: .6; cursor: not-allowed; }
        .usernameWrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .atSign {
          position: absolute;
          left: 14px;
          font-size: 15px;
          color: var(--muted);
          pointer-events: none;
        }
        .inpUsername {
          padding-left: 28px;
        }
        .checking {
          position: absolute;
          right: 12px;
          font-size: 11px;
          color: var(--muted);
        }
        .checkMark {
          position: absolute;
          right: 12px;
          font-size: 14px;
          color: #22c55e;
          font-weight: 700;
        }
        .hint {
          margin: 0;
          font-size: 11px;
          color: var(--muted);
        }
        .err {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: #ef4444;
        }
        .submitErr {
          margin: 0;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px;
          background: color-mix(in oklab, #ef4444 10%, var(--bg));
          border: 1px solid color-mix(in oklab, #ef4444 30%, var(--border));
          color: #ef4444;
        }
        .submitBtn {
          height: 50px;
          border-radius: 14px;
          border: none;
          background: var(--primary);
          color: var(--primary-contrast);
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          width: 100%;
          transition: opacity .15s;
        }
        .submitBtn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }
        .submitBtn:not(:disabled):hover {
          opacity: .9;
        }
        @media (max-width: 480px) {
          .nameRow { grid-template-columns: 1fr; }
          .inner { padding: 28px 20px; }
        }
      `}</style>
    </div>
  );
}
