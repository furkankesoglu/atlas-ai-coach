"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Checkin = { date: string; sleep: number };

function readLocalCheckins(): Checkin[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("atlas-checkins-v2") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function activeDateFromPage() {
  const eyebrow = document.querySelector<HTMLElement>(".topbar .eyebrow")?.textContent || "";
  const match = eyebrow.match(/(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/);
  if (!match) return null;
  const months: Record<string, string> = {
    ocak: "01", şubat: "02", mart: "03", nisan: "04", mayıs: "05", haziran: "06",
    temmuz: "07", ağustos: "08", eylül: "09", ekim: "10", kasım: "11", aralık: "12",
  };
  const month = months[match[2].toLocaleLowerCase("tr-TR")];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

function updateSleepSuggestion(checkins: Checkin[]) {
  const title = document.querySelector<HTMLElement>(".topbar h1")?.textContent?.trim();
  if (title !== "Kontrol Merkezi" && title !== "Dashboard") return;

  const activeDate = activeDateFromPage();
  const checkin = activeDate
    ? checkins.find((item) => item.date === activeDate)
    : [...checkins].sort((a, b) => a.date.localeCompare(b.date)).at(-1);

  const firstSuggestion = document.querySelector<HTMLElement>(".suggestion-list .suggestion-item");
  if (!firstSuggestion || !checkin || !Number.isFinite(Number(checkin.sleep))) return;

  const sleep = Number(checkin.sleep);
  const nextText = sleep < 7
    ? `Uyku ${sleep.toFixed(1)} saat. Toparlanmayı bugün önceliklendir.`
    : sleep < 8
      ? `Uyku ${sleep.toFixed(1)} saat. Hedefe yakın; performansını koruyabilirsin.`
      : `Uyku ${sleep.toFixed(1)} saat. Toparlanma için güçlü bir gece; antrenman performansını değerlendirebilirsin.`;

  if (firstSuggestion.textContent !== nextText) firstSuggestion.textContent = nextText;
}

export default function AtlasSuggestionFreshnessBridge() {
  useEffect(() => {
    let cached = readLocalCheckins();
    let requestInFlight = false;

    const refresh = async () => {
      updateSleepSuggestion(cached);
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: userData } = await supabase?.auth.getUser() || { data: { user: null } };
        const user = userData?.user;
        if (supabase && user) {
          const { data } = await supabase.from("atlas_user_state").select("app_state").eq("user_id", user.id).maybeSingle();
          const state = data?.app_state && typeof data.app_state === "object" ? data.app_state as Record<string, unknown> : {};
          if (Array.isArray(state.checkins)) cached = state.checkins as Checkin[];
        }
        updateSleepSuggestion(cached);
      } catch (error) {
        console.warn("ATLAS önerileri güncellenemedi", error);
      } finally {
        requestInFlight = false;
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const text = target?.textContent?.trim() || "";
      if (/Kontrol Merkezi|Check-in kaydet/.test(text)) window.setTimeout(() => void refresh(), 250);
    };

    const onStorage = () => {
      cached = readLocalCheckins();
      updateSleepSuggestion(cached);
    };

    void refresh();
    document.addEventListener("click", onClick, true);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
