"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthModal } from "@/context/AuthModalContext";

export default function AuthWall({
  title = "Sign in to continue",
  description = "You need an account to see this content.",
}: {
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  const { openLogin, openRegister } = useAuthModal();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
        <div className="space-y-2 border-b px-6 py-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>

        <div className="space-y-3 px-6 py-5">
          <button
            type="button"
            onClick={() => openLogin(pathname)}
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => openRegister(pathname)}
            className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Create an account
          </button>
          <button
            onClick={() => setOpen(false)}
            className="block w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
