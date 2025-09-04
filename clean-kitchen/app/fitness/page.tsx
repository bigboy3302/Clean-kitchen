"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type FitnessProfile = {
  uid: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: "bulk" | "cut" | "maintain";
  updatedAt?: any;
};

export default function FitnessPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<FitnessProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form state
  const [age, setAge] = useState<number>(18);
  const [heightCm, setHeightCm] = useState<number>(170);
  const [weightKg, setWeightKg] = useState<number>(65);
  const [goal, setGoal] = useState<FitnessProfile["goal"]>("bulk");

  // 1) Wait for auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (user) setUid(user.uid);
      else setUid(null);
    });
    return () => unsub();
  }, []);

  // 2) Load profile if logged in
  useEffect(() => {
    if (!authReady) return;
    if (!uid) {
      setProfile(null);
      return;
    }
    const ref = doc(db, "fitnessProfiles", uid);
    const unsub = onSnapshot(ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as FitnessProfile;
          setProfile(data);
          // Fill form with existing data
          setAge(data.age ?? 18);
          setHeightCm(data.heightCm ?? 170);
          setWeightKg(data.weightKg ?? 65);
          setGoal(data.goal ?? "bulk");
        } else {
          setProfile(null);
        }
      },
      (e) => {
        console.error(e);
        setErr("Cannot read your fitness profile (permissions). Make sure you are logged in and rules are deployed.");
      }
    );
    return () => unsub();
  }, [authReady, uid]);

  async function saveNew() {
    if (!uid) return;
    setErr(null);
    setBusy(true);
    try {
      const ref = doc(db, "fitnessProfiles", uid);
      await setDoc(ref, {
        uid,
        age: Number(age),
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        goal,
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      setErr(e.message ?? "Failed to save profile");
    } finally {
      setBusy(false);
    }
  }

  async function updateExisting() {
    if (!uid) return;
    setErr(null);
    setBusy(true);
    try {
      const ref = doc(db, "fitnessProfiles", uid);
      await updateDoc(ref, {
        age: Number(age),
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        goal,
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      setErr(e.message ?? "Failed to update profile");
    } finally {
      setBusy(false);
    }
  }

  // Simple suggestion block
  const suggestion = useMemo(() => {
    // super simple TDEE-ish baseline (not medical advice)
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5; // Mifflin-St Jeor male-ish
    let calories = Math.round(bmr * 1.4); // light activity
    if (goal === "bulk") calories += 300;
    if (goal === "cut")  calories -= 300;
    const protein = Math.round(weightKg * 1.8);
    return { calories, protein };
  }, [age, heightCm, weightKg, goal]);

  return (
    <div className="container" style={{ padding: "24px 0" }}>
      <h1>Fitness</h1>

      {!authReady ? (
        <p style={{ marginTop: 12 }}>Loading…</p>
      ) : !uid ? (
        <Card><p>You need to sign in to create your fitness profile.</p></Card>
      ) : (
        <>
          {err && <p className="alert-error" style={{ marginTop: 12 }}>{err}</p>}

          <Card>
            <h2 style={{ marginBottom: 12 }}>{profile ? "Update your data" : "Create your fitness profile"}</h2>
            <div className="grid grid-2">
              <Input label="Age" type="number" min={10} max={100}
                     value={age}
                     onChange={(e) => setAge(Number((e.target as HTMLInputElement).value))} />
              <Input label="Height (cm)" type="number" min={120} max={230}
                     value={heightCm}
                     onChange={(e) => setHeightCm(Number((e.target as HTMLInputElement).value))} />
              <Input label="Weight (kg)" type="number" min={30} max={250}
                     value={weightKg}
                     onChange={(e) => setWeightKg(Number((e.target as HTMLInputElement).value))} />

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-800">Goal</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as FitnessProfile["goal"])}
                  style={{
                    width: "100%", borderRadius: 12, border: "1px solid var(--border)",
                    padding: "10px 12px", background: "#fff"
                  }}
                >
                  <option value="bulk">Bulk (gain)</option>
                  <option value="cut">Cut (lose)</option>
                  <option value="maintain">Maintain</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              {profile ? (
                <Button onClick={updateExisting} disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              ) : (
                <Button onClick={saveNew} disabled={busy}>
                  {busy ? "Creating…" : "Create profile"}
                </Button>
              )}
            </div>
          </Card>

          {profile && (
            <div style={{ marginTop: 16 }}>
              <Card>
                <h2 style={{ marginBottom: 8 }}>Suggested daily target</h2>
                <p className="badge" style={{ marginRight: 8 }}>
                  {suggestion.calories} kcal
                </p>
                <p className="badge">{suggestion.protein} g protein</p>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
