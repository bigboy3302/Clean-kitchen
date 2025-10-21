"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { auth, db } from "@/lib/firebas1e";
import ThemePicker from "@/components/theme/ThemePicker";

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
    <AuthShell
      title="Complete your profile"
      subtitle="Choose your public username and health basics"
    >
      <div className="themeChooser">
        <ThemePicker />
      </div>

      <form onSubmit={save} className="onboardingForm">
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

        <div>
          <Input
            label="Username (public view)"
            value={username}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setUsername(slugifyName(event.target.value))
            }
            placeholder="e.g., janis_k"
            required
          />
          <p className="helperText">
            Allowed: a-z, 0-9, &quot;_&quot; and &quot;.&quot; (3-20 symbols). Example: <code>name.surname</code>
          </p>

          {suggestions.length > 0 ? (
            <div className="suggestionWrap">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => adoptSuggestion(suggestion)}
                  disabled={checking || busy}
                  className="suggestionBtn"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

        <div>
          <label className="genderLabel">
            Gender
          </label>
          <div className="genderOptions">
            <label className="genderOption">
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
            <label className="genderOption">
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

        {err ? <p className="formError">{err}</p> : null}

        <Button type="submit" disabled={!canSubmit || busy} className="fullWidth">
          {busy ? "Saving..." : "Save & continue"}
        </Button>
      </form>

      <style jsx>{`
        .themeChooser {
          margin-bottom: 24px;
        }
        .themeChooser :global(.panel) {
          max-width: 560px;
        }
        .onboardingForm {
          display: grid;
          gap: 20px;
        }
        .helperText {
          margin-top: 6px;
          font-size: 0.78rem;
          color: var(--muted);
        }
        .suggestionWrap {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .suggestionBtn {
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 80%, transparent);
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          color: var(--text);
          padding: 6px 14px;
          font-size: 0.85rem;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
        }
        .suggestionBtn:hover:not(:disabled) {
          background: color-mix(in oklab, var(--bg2) 90%, var(--primary) 10%);
          border-color: color-mix(in oklab, var(--primary) 35%, var(--border));
        }
        .suggestionBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .genderLabel {
          display: block;
          margin-bottom: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text);
        }
        .genderOptions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .genderOption {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--border) 82%, transparent);
          padding: 8px 14px;
          font-size: 0.85rem;
          color: var(--text);
          background: color-mix(in oklab, var(--bg2) 96%, transparent);
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .genderOption:hover {
          border-color: color-mix(in oklab, var(--primary) 32%, var(--border));
          background: color-mix(in oklab, var(--bg2) 88%, var(--primary) 12%);
        }
        .genderInput {
          accent-color: var(--primary);
        }
        .formError {
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 0.9rem;
          background: color-mix(in oklab, var(--primary) 10%, var(--bg) 90%);
          border: 1px solid color-mix(in oklab, var(--primary) 32%, var(--border));
          color: color-mix(in oklab, var(--primary) 75%, var(--text) 25%);
        }
        .fullWidth {
          width: 100%;
        }
        @media (max-width: 640px) {
          .themeChooser :global(.panel) {
            max-width: 100%;
          }
        }
      `}</style>
    </AuthShell>
  );
}
