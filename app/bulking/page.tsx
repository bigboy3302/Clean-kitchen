"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type Profile = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: "male" | "female";
};

function calcBmr(p: Profile) {
  return p.sex === "male"
    ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5
    : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161;
}
function tdeeFromBmr(bmr: number, activity = 1.5) {
  return Math.round(bmr * activity);
}
const BULK_MULTIPLIER = 1.1;

function splitMacros(calories: number, proteinPerKg: number, weightKg: number) {
  const protein = Math.round(proteinPerKg * weightKg);
  const proteinKcal = protein * 4;
  const fat = Math.round((calories * 0.25) / 9);
  const fatKcal = fat * 9;
  const carbs = Math.max(0, Math.round((calories - proteinKcal - fatKcal) / 4));
  return { calories, protein, carbs, fat };
}

export default function BulkingPage() {
  const [macros, setMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  useEffect(() => {
    async function run() {
      const u = auth.currentUser;
      if (!u) return;
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const p = snap.data() as Profile;
        const bmr = calcBmr(p);
        const tdee = tdeeFromBmr(bmr, 1.5);
        const bulkCals = Math.round(tdee * BULK_MULTIPLIER);
        setMacros(splitMacros(bulkCals, 2.0, p.weightKg));
      }
    }
    run();
  }, []);

  return (
    <RequireAuth>
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="mb-1 text-2xl font-semibold">Bulking</h1>
        <p className="mb-6 text-sm text-gray-600">
          PersonalizÄ“ts kaloriju mÄ“rÄ·is, balstoties uz tavu profilu.
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4 text-center">
            <div className="text-xs text-gray-500">Calories</div>
            <div className="text-2xl font-semibold">{macros.calories || "â€”"}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <div className="text-xs text-gray-500">Protein (g)</div>
            <div className="text-2xl font-semibold">{macros.protein || "â€”"}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <div className="text-xs text-gray-500">Carbs (g)</div>
            <div className="text-2xl font-semibold">{macros.carbs || "â€”"}</div>
          </div>
          <div className="rounded-2xl border bg-white p-4 text-center">
            <div className="text-xs text-gray-500">Fat (g)</div>
            <div className="text-2xl font-semibold">{macros.fat || "â€”"}</div>
          </div>
        </div>

        
      </main>
    </RequireAuth>
  );
}
