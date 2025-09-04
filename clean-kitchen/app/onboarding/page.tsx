"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/button";

/** Noņem diakritiskās zīmes, liekos simbolus, atstāj a-z0-9_ . */
function slugifyName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\._]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

/** Izveido kandidātus no vārda/uzvārda + random sufiksiem */
function makeUsernameCandidates(first: string, last: string, max = 12) {
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
    const n = Math.floor(Math.random() * 9999).toString().padStart(2, "0");
    const pick = f || l || "user";
    extras.add(`${pick}${n}`);
  }

  const all = [...base, ...extras];
  return all.filter((x) => x.length >= 3 && x.length <= 20).slice(0, max);
}

/** pārbauda, vai username brīvs (usernames/{uname} neeksistē) */
async function isUsernameFree(uname: string) {
  const snap = await getDoc(doc(db, "usernames", uname));
  return !snap.exists();
}

export default function OnboardingPage() {
  const router = useRouter();
  const u = auth.currentUser;

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [username, setUsername] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  const initialisedRef = useRef(false);

  // auto-fill no localStorage/displayName
  useEffect(() => {
    if (!u) {
      router.replace("/auth/login");
      return;
    }
    if (initialisedRef.current) return;
    initialisedRef.current = true;

    try {
      const raw = localStorage.getItem("ck_pending_profile");
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.firstName) setFirst(data.firstName);
        if (data?.lastName) setLast(data.lastName);
      }
    } catch {}

    if ((!first || !last) && u.displayName) {
      const parts = u.displayName.split(" ").filter(Boolean);
      if (parts.length >= 2) {
        if (!first) setFirst(parts[0]);
        if (!last) setLast(parts.slice(1).join(" "));
      } else if (parts.length === 1 && !first) {
        setFirst(parts[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u, router]);

  // ģenerē kandidātus + atlasa pirmo brīvo
  useEffect(() => {
    const list = makeUsernameCandidates(first, last, 12);
    setSuggestions(list);

    let cancelled = false;
    async function pickFirstFree() {
      setChecking(true);
      for (const cand of list) {
        const free = await isUsernameFree(cand);
        if (cancelled) return;
        if (free) { setUsername(cand); break; }
      }
      setChecking(false);
    }
    if (first || last) pickFirstFree();
    return () => { cancelled = true; };
  }, [first, last]);

  async function shuffle() {
    const list = makeUsernameCandidates(first, last, 12);
    setSuggestions(list);
    setChecking(true);
    for (const cand of list) {
      const free = await isUsernameFree(cand);
      if (free) { setUsername(cand); break; }
    }
    setChecking(false);
  }

  async function adoptSuggestion(s: string) {
    setChecking(true);
    const free = await isUsernameFree(s);
    if (free) { setUsername(s); setErr(null); }
    else { setErr("Šis username tikko tika aizņemts. Pamēģini citu."); }
    setChecking(false);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!u) return;
    setErr(null);
    setBusy(true);
    try {
      const uname = slugifyName(username);
      if (!/^[a-z0-9_\.]{3,20}$/.test(uname)) {
        throw new Error("Username must be 3–20 chars, a-z, 0-9, _ or .");
      }

      await runTransaction(db, async (tx) => {
        const unameRef = doc(db, "usernames", uname);
        const taken = await tx.get(unameRef);
        if (taken.exists()) throw new Error("Username already taken.");

        tx.set(unameRef, { uid: u.uid, reservedAt: serverTimestamp() });

        const userRef = doc(db, "users", u.uid);
        tx.set(
          userRef,
          {
            uid: u.uid,
            email: u.email ?? null,
            firstName: first.trim(),
            lastName: last.trim(),
            username: uname,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      const displayName = uname || [first.trim(), last.trim()].filter(Boolean).join(" ");
      if (displayName) await updateProfile(u, { displayName });

      try { localStorage.removeItem("ck_pending_profile"); } catch {}
      router.replace("/dashboard");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save profile.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = useMemo(
    () => first.trim() && last.trim() && username.trim() && !checking && !busy,
    [first, last, username, checking, busy]
  );

  return (
    <AuthShell title="Complete your profile" subtitle="Choose your public username">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Vārds"
            value={first}
            onChange={(e) => setFirst((e.target as HTMLInputElement).value)}
            required
          />
          <Input
            label="Uzvārds"
            value={last}
            onChange={(e) => setLast((e.target as HTMLInputElement).value)}
            required
          />
        </div>

        <div>
          <Input
            label="Username (publiski redzams)"
            value={username}
            onChange={(e) => setUsername(slugifyName((e.target as HTMLInputElement).value))}
            placeholder="piem., janis_k"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Atļauts: a–z, 0–9, “_” un “.” (3–20 simboli). Latviešu vārds tiks pārveidots:
            “Ģirts Bērziņš” → <code>girts.berzins</code>
          </p>

          {!!suggestions.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => adoptSuggestion(s)}
                  disabled={checking || busy}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {err && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{err}</p>}

        <Button type="submit" disabled={!canSubmit}>
          {busy ? "Saving…" : "Save & continue"}
        </Button>
      </form>
    </AuthShell>
  );
}
