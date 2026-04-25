"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { auth, db } from "@/lib/firebas1e";

const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

function slugifyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

function makeUsernameCandidates(first: string, last: string, max = 12): string[] {
  const f = slugifyName(first);
  const l = slugifyName(last);

  const base: string[] = [];
  if (f && l) {
    base.push(`${f}.${l}`, `${f}_${l}`, `${f}${l}`, `${f}${l[0]}`, `${f[0]}${l}`, `${l}.${f}`);
  } else if (f) {
    base.push(f, `${f}1`, `${f}01`);
  } else if (l) {
    base.push(l, `${l}1`, `${l}01`);
  }

  const extras = new Set<string>();
  while (extras.size < max) {
    const n = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(2, "0");
    const pick = f || l || "user";
    extras.add(`${pick}${n}`);
  }

  const all = [...base, ...extras];
  return all.filter((candidate) => candidate.length >= 3 && candidate.length <= 20).slice(0, max);
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

async function isUsernameFree(uname: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "usernames", uname));
  return !snap.exists();
}

export default function OnboardingPage() {
  const router = useRouter();
  const user = auth.currentUser;

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [username, setUsername] = useState("");

  const [weightKg, setWeightKg] = useState<number | "">("");
  const [heightCm, setHeightCm] = useState<number | "">("");
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<"male" | "female" | "">("");

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  const initialisedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (initialisedRef.current) return;
    initialisedRef.current = true;

    try {
      const raw = localStorage.getItem("ck_pending_profile");
      if (raw) {
        const data = JSON.parse(raw) as { firstName?: string; lastName?: string } | null;
        if (data?.firstName) {
          setFirst((prev) => prev || data.firstName!);
        }
        if (data?.lastName) {
          setLast((prev) => prev || data.lastName!);
        }
      }
    } catch {
      // ignore storage parsing issues
    }

    if (user.displayName) {
      const parts = user.displayName.split(" ").filter(Boolean);
      if (parts.length >= 2) {
        const [firstName, ...rest] = parts;
        setFirst((prev) => prev || firstName);
        setLast((prev) => prev || rest.join(" "));
      } else if (parts.length === 1) {
        setFirst((prev) => prev || parts[0]);
      }
    }
  }, [router, user]);

  useEffect(() => {
    const list = makeUsernameCandidates(first, last, 12);
    setSuggestions(list);

    if (!list.length) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    const pickFirstFree = async () => {
      setChecking(true);
      for (const candidate of list) {
        const free = await isUsernameFree(candidate);
        if (cancelled) return;
        if (free) {
          setUsername(candidate);
          break;
        }
      }
      if (!cancelled) setChecking(false);
    };

    pickFirstFree();

    return () => {
      cancelled = true;
    };
  }, [first, last]);

  async function adoptSuggestion(value: string) {
    setChecking(true);
    const free = await isUsernameFree(value);
    if (free) {
      setUsername(value);
      setErr(null);
    } else {
      setErr("That username was just claimed. Please try another option.");
    }
    setChecking(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setErr(null);
    setBusy(true);

    try {
      const uname = slugifyName(username);
      if (!USERNAME_PATTERN.test(uname)) {
        throw new Error("Username must be 3-20 characters using a-z, 0-9, _ or .");
      }

      const weight = typeof weightKg === "number" ? weightKg : NaN;
      const height = typeof heightCm === "number" ? heightCm : NaN;
      const years = typeof age === "number" ? age : NaN;

      if (!Number.isFinite(weight) || !Number.isFinite(height) || !Number.isFinite(years) || !sex) {
        throw new Error("Please provide weight, height, age, and gender.");
      }

      await runTransaction(db, async (tx) => {
        const unameRef = doc(db, "usernames", uname);
        const taken = await tx.get(unameRef);
        if (taken.exists()) throw new Error("Username already taken.");

        tx.set(unameRef, { uid: currentUser.uid, reservedAt: serverTimestamp() });

        const userRef = doc(db, "users", currentUser.uid);
        tx.set(
          userRef,
          {
            uid: currentUser.uid,
            email: currentUser.email ?? null,
            firstName: first.trim(),
            lastName: last.trim(),
            username: uname,
            weightKg: weight,
            heightCm: height,
            age: years,
            sex,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      const displayName = [first.trim(), last.trim()].filter(Boolean).join(" ") || uname;
      if (displayName) {
        await updateProfile(currentUser, { displayName });
      }

      try {
        localStorage.removeItem("ck_pending_profile");
      } catch {
        // ignore storage issues
      }

      router.replace("/dashboard");
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to save profile."));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = useMemo(() => {
    return (
      Boolean(first.trim()) &&
      Boolean(last.trim()) &&
      Boolean(username.trim()) &&
      weightKg !== "" &&
      heightCm !== "" &&
      age !== "" &&
      Boolean(sex)
    );
  }, [age, first, heightCm, last, sex, username, weightKg]);

  return (
    <main className="onboardingPage">
      <div className="onboardingGlow" aria-hidden />

      <section className="onboardingShell">
        <header className="heroCard">
          <div className="heroTop">
            <span className="heroBadge">Clean Kitchen</span>
            <div className="heroStats">
              <span>{checking ? "Checking names" : "Profile setup"}</span>
              <span>{username ? `@${username}` : "Choose your username"}</span>
            </div>
          </div>

          <div className="heroBody">
            <p className="heroEyebrow">Almost ready</p>
            <h1>Build your profile.</h1>
            <p className="heroCopy">
              Pick how you appear in the app and add a few basics so your account feels complete
              from the first screen.
            </p>
          </div>
        </header>

        <form onSubmit={save} className="onboardingForm" noValidate>
          <section className="formCard">
            <div className="sectionTitle">
              <h2>Identity</h2>
              <p>Your display details for the app and community.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="First name"
                value={first}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFirst(event.target.value)}
                required
              />
              <Input
                label="Last name"
                value={last}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setLast(event.target.value)}
                required
              />
            </div>

            <div className="usernameBlock">
              <Input
                label="Username"
                value={username}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setUsername(slugifyName(event.target.value))
                }
                placeholder="e.g. janis_k"
                required
              />
              <p className="helperText">
                Use `a-z`, `0-9`, `_` and `.`. Keep it between 3 and 20 characters.
              </p>

              {suggestions.length > 0 ? (
                <div className="suggestionWrap">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => adoptSuggestion(suggestion)}
                      disabled={checking || busy}
                      className={`suggestionBtn ${username === suggestion ? "active" : ""}`}
                    >
                      @{suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="formCard">
            <div className="sectionTitle">
              <h2>Basics</h2>
              <p>Simple details for better recommendations later.</p>
            </div>

            <div className="statsGrid">
              <Input
                label="Weight (kg)"
                type="number"
                min={30}
                max={400}
                value={weightKg}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setWeightKg(event.target.value === "" ? "" : Number(event.target.value))
                }
                required
              />
              <Input
                label="Height (cm)"
                type="number"
                min={120}
                max={250}
                value={heightCm}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setHeightCm(event.target.value === "" ? "" : Number(event.target.value))
                }
                required
              />
              <Input
                label="Age"
                type="number"
                min={10}
                max={100}
                value={age}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setAge(event.target.value === "" ? "" : Number(event.target.value))
                }
                required
              />
            </div>

            <div className="genderBlock">
              <label className="genderLabel">Gender</label>
              <div className="genderOptions">
                <label className={`genderOption ${sex === "male" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="sex"
                    checked={sex === "male"}
                    onChange={() => setSex("male")}
                    className="genderInput"
                    required
                  />
                  <span>Male</span>
                </label>
                <label className={`genderOption ${sex === "female" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="sex"
                    checked={sex === "female"}
                    onChange={() => setSex("female")}
                    className="genderInput"
                  />
                  <span>Female</span>
                </label>
              </div>
            </div>
          </section>

          {err ? <p className="formError">{err}</p> : null}

          <div className="actionBar">
            <p className="actionHint">You can change these details later in your profile settings.</p>
            <Button type="submit" disabled={!canSubmit || busy} className="actionButton">
              {busy ? "Saving..." : "Save & continue"}
            </Button>
          </div>
        </form>
      </section>

      <style jsx>{`
        .onboardingPage {
          position: relative;
          min-height: 100dvh;
          padding: clamp(18px, 4vw, 48px);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .onboardingGlow {
          position: absolute;
          inset: -20%;
          background:
            radial-gradient(circle at top left, color-mix(in oklab, var(--primary) 24%, transparent), transparent 34%),
            radial-gradient(circle at bottom right, color-mix(in oklab, var(--ring) 22%, transparent), transparent 34%);
          filter: blur(110px);
          opacity: 0.8;
          pointer-events: none;
        }
        .onboardingShell {
          position: relative;
          width: min(860px, 100%);
          display: grid;
          gap: 20px;
        }
        .heroCard,
        .formCard {
          border-radius: 28px;
          border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
          background:
            radial-gradient(140% 140% at 0% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 50%),
            linear-gradient(145deg, color-mix(in oklab, var(--bg2) 96%, transparent), color-mix(in oklab, var(--bg) 88%, var(--primary) 12%));
          box-shadow: 0 30px 80px rgba(7, 10, 19, 0.34);
          backdrop-filter: blur(18px);
        }
        .heroCard {
          padding: clamp(22px, 4vw, 34px);
          display: grid;
          gap: 26px;
        }
        .heroTop {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 16px;
        }
        .heroBadge {
          display: inline-flex;
          align-items: center;
          padding: 7px 12px;
          border-radius: 999px;
          background: color-mix(in oklab, var(--primary) 16%, transparent);
          border: 1px solid color-mix(in oklab, var(--primary) 28%, var(--border));
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--text);
        }
        .heroStats {
          display: grid;
          justify-items: end;
          gap: 4px;
          text-align: right;
        }
        .heroStats span:first-child {
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .heroStats span:last-child {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
        }
        .heroBody {
          display: grid;
          gap: 10px;
        }
        .heroEyebrow {
          margin: 0;
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--primary);
        }
        .heroBody h1 {
          margin: 0;
          font-size: clamp(2rem, 5vw, 3.3rem);
          line-height: 0.96;
          letter-spacing: -0.05em;
        }
        .heroCopy {
          margin: 0;
          max-width: 50ch;
          color: var(--muted);
          line-height: 1.7;
        }
        .onboardingForm {
          display: grid;
          gap: 18px;
        }
        .formCard {
          display: grid;
          gap: 18px;
          padding: clamp(20px, 4vw, 28px);
        }
        .sectionTitle {
          display: grid;
          gap: 6px;
        }
        .sectionTitle h2 {
          margin: 0;
          font-size: 1.15rem;
        }
        .sectionTitle p {
          margin: 0;
          color: var(--muted);
          line-height: 1.55;
        }
        .usernameBlock,
        .genderBlock {
          display: grid;
          gap: 12px;
        }
        .helperText {
          margin: 0;
          font-size: 0.8rem;
          color: var(--muted);
        }
        .suggestionWrap {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .suggestionBtn {
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          color: var(--text);
          padding: 8px 14px;
          font-size: 0.84rem;
          font-weight: 700;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease, color 0.15s ease;
        }
        .suggestionBtn:hover:not(:disabled) {
          background: color-mix(in oklab, var(--bg2) 88%, var(--primary) 12%);
          border-color: color-mix(in oklab, var(--primary) 36%, var(--border));
          transform: translateY(-1px);
        }
        .suggestionBtn.active {
          background: linear-gradient(135deg, color-mix(in oklab, var(--primary) 92%, transparent), color-mix(in oklab, var(--primary) 72%, var(--bg2) 28%));
          border-color: transparent;
          color: var(--primary-contrast);
        }
        .suggestionBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .statsGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .genderLabel {
          display: block;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text);
        }
        .genderOptions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .genderOption {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 54px;
          border-radius: 18px;
          border: 1px solid color-mix(in oklab, var(--border) 82%, transparent);
          padding: 10px 14px;
          font-size: 0.92rem;
          font-weight: 700;
          color: var(--text);
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
          cursor: pointer;
        }
        .genderOption:hover {
          border-color: color-mix(in oklab, var(--primary) 32%, var(--border));
          background: color-mix(in oklab, var(--bg2) 88%, var(--primary) 12%);
          transform: translateY(-1px);
        }
        .genderOption.active {
          border-color: color-mix(in oklab, var(--primary) 40%, var(--border));
          background: color-mix(in oklab, var(--bg2) 78%, var(--primary) 22%);
        }
        .genderInput {
          accent-color: var(--primary);
        }
        .formError {
          margin: 0;
          border-radius: 16px;
          padding: 12px 14px;
          font-size: 0.9rem;
          background: color-mix(in oklab, var(--primary) 10%, var(--bg) 90%);
          border: 1px solid color-mix(in oklab, var(--primary) 32%, var(--border));
          color: color-mix(in oklab, var(--primary) 75%, var(--text) 25%);
        }
        .actionBar {
          display: grid;
          gap: 12px;
        }
        .actionHint {
          margin: 0;
          color: var(--muted);
          font-size: 0.9rem;
          line-height: 1.6;
        }
        .actionButton {
          width: 100%;
        }
        @media (max-width: 720px) {
          .heroTop {
            flex-direction: column;
            align-items: start;
          }
          .heroStats {
            justify-items: start;
            text-align: left;
          }
          .statsGrid,
          .genderOptions {
            grid-template-columns: minmax(0, 1fr);
          }
        }
        @media (max-width: 540px) {
          .onboardingPage {
            padding: 10px;
            align-items: start;
          }
          .heroCard,
          .formCard {
            border-radius: 22px;
          }
          .heroBody h1 {
            font-size: 2.2rem;
            line-height: 1.02;
          }
        }
      `}</style>
    </main>
  );
}
