"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import AuthWall from "@/components/auth/AuthWall";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (user === undefined) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  }
  if (!user) {
    return (
      <>
        <div className="p-8">
          <h1 className="mb-2 text-xl font-semibold">Profile</h1>
          <p className="text-gray-600">Sign in to view your profile.</p>
        </div>
        <AuthWall title="Sign in to see your profile" />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Your profile</h1>
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <div><span className="text-gray-500">Email:</span> {user.email}</div>
          <div><span className="text-gray-500">Display name:</span> {user.displayName ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}
