"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function LoginPage() {
  const { register, handleSubmit, formState:{errors, isSubmitting} } =
    useForm<{email:string; password:string}>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: {email:string;password:string}) => {
    await signInWithEmailAndPassword(auth, v.email, v.password);
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold mb-4">Ienākt</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <input {...register("email")} placeholder="E-pasts" className="w-full border rounded p-2"/>
        {errors.email && <p className="text-red-600 text-sm">Nederīgs e-pasts</p>}
        <input {...register("password")} type="password" placeholder="Parole" className="w-full border rounded p-2"/>
        {errors.password && <p className="text-red-600 text-sm">Min. 6 simboli</p>}
        <Button disabled={isSubmitting}>{isSubmitting ? "..." : "Ienākt"}</Button>
      </form>
      <p className="mt-3 text-sm">Nav konta? <Link className="underline" href="/register">Reģistrēties</Link></p>
    </div>
  );
}
