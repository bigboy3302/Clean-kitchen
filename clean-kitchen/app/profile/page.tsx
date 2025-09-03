"use client";

import AuthGate from "@/components/auth-gate";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ProfilePage() {
  async function doSignOut() {
    await signOut(auth);
  }

  return (
    <AuthGate>
      <section className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Profile</h1>
        <button
          onClick={doSignOut}
          className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:opacity-80"
        >
          Sign out
        </button>
      </section>
    </AuthGate>
  );
}
