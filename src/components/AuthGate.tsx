"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AtlasDashboard from "./AtlasDashboard";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("Furkan Kesoğlu");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setChecking(false);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setChecking(false);
    });
    return () => listener.subscription.unsubscribe();
  }, [configured]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        setMessage("Kayıt oluşturuldu. E-posta doğrulaması açıksa gelen kutunu kontrol et.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
  }

  if (checking) return <div className="auth-loading">ATLAS yükleniyor...</div>;

  if (!configured) {
    return <AtlasDashboard storageMode="local" />;
  }

  if (!user) {
    return <main className="auth-page">
      <section className="auth-card">
        <img src="/atlas-logo.jpg" alt="ATLAS" />
        <p className="eyebrow">ATLAS METHOD</p>
        <h1>{mode === "login" ? "Kontrol merkezine gir" : "ATLAS hesabını oluştur"}</h1>
        <p className="auth-copy">Antrenman, beslenme, fotoğraf ve check-in verilerin kendi hesabında güvenle saklansın.</p>
        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && <label><span>Ad Soyad</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>}
          <label><span>E-posta</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label><span>Şifre</span><input type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="primary" disabled={busy}>{busy ? "İşleniyor..." : mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}</button>
        </form>
        {message && <div className="auth-message">{message}</div>}
        <button className="auth-switch" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
        </button>
      </section>
    </main>;
  }

  const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
  return <AtlasDashboard userId={user.id} userEmail={user.email ?? ""} userFullName={fullName} storageMode="cloud" onSignOut={signOut} />;
}
