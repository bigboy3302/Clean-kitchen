"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AuthWall from "@/components/auth/AuthWall";

export default function RecipeDetailPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // publiski: pašu recepti var rādīt
  // bet, ja gribi rādīt autora profila info/sekot utt., tad vajag login:
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-3 text-2xl font-bold">Recipe title</h1>
      <p className="text-gray-600">Public recipe content…</p>

      {/* sekcijas, kurām vajag login */}
      {user ? (
        <div className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Author details</h2>
          <p className="text-gray-600">Only visible when signed in.</p>
        </div>
      ) : (
        <AuthWall
          title="Sign in to view the author profile"
          description="You can read recipes without an account, but author details are for signed-in users."
        />
      )}
    </div>
  );
}
