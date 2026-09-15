"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Snowflake, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter(); const params = useSearchParams();
  const [u, setU] = useState("menaxher"); const [p, setP] = useState("frigocold"); const [err, setErr] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (u.trim() === "menaxher" && p === "frigocold") {
      document.cookie = "fc_session=1; path=/; max-age=43200; samesite=lax";
      router.replace(params.get("next") || "/dashboard");
    } else setErr("Përdoruesi ose fjalëkalimi është i gabuar.");
  };
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div><Label htmlFor="u">Përdoruesi</Label><Input id="u" value={u} onChange={e => setU(e.target.value)} autoComplete="username" /></div>
      <div><Label htmlFor="p">Fjalëkalimi</Label><Input id="p" type="password" value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" /></div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <Button type="submit" variant="entry" size="lg" className="w-full"><LogIn /> Hyr në sistem</Button>
      <p className="text-center text-xs text-muted-foreground">Demo: <span className="font-mono">menaxher</span> / <span className="font-mono">frigocold</span></p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-entry text-entry-foreground"><Snowflake className="h-7 w-7" /></div>
        <h1 className="text-2xl font-semibold tracking-tight">FrigoCold WMS</h1>
        <p className="mb-8 mt-1 text-sm text-muted-foreground">Magazina frigoriferike · Frigo ALBA, Kashar</p>
        <Suspense><LoginForm /></Suspense>
      </div>
    </main>
  );
}
