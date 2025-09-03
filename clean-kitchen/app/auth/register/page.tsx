"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const schema = z.object({
  displayName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export default function RegisterPage() {
  const { register, handleSubmit, formState:{errors, isSubmitting} } =
    useForm<{displayName:string; email:string; password:string}>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: {displayName:string; email:string; password:string}) => {
    const cred = await createUserWithEmailAndPassword(auth, v.email, v.password);
    await updateProfile(cred.user, { displayName: v.displayName });
    await setDoc(doc(db, "users", cred.user.uid), {
      id: cred.user.uid,
      displayName: v.displayName,
      email: v.email,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-4">Reģistrācija</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <input {...register("displayName")} placeholder="Vārds" className="w-full border rounded p-2"/>
        {errors.displayName && <p className="text-red-600 text-sm">Min. 2 simboli</p>}
        <input {...register("email")} placeholder="E-pasts" className="w-full border rounded p-2"/>
        {errors.email && <p className="text-red-600 text-sm">Nederīgs e-pasts</p>}
        <input {...register("password")} type="password" placeholder="Parole" className="w-full border rounded p-2"/>
        {errors.password && <p className="text-red-600 text-sm">Min. 6 simboli</p>}
        <Button disabled={isSubmitting}>{isSubmitting ? "..." : "Izveidot kontu"}</Button>
      </form>
      <p className="mt-3 text-sm">Jau ir konts? <Link className="underline" href="/login">Ienākt</Link></p>
    </div>
  );
}
