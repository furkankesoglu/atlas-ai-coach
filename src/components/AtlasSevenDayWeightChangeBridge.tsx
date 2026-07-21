"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Checkin = { date: string; weight: number };

function readLocalCheckins(): Checkin[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("atlas-checkins-v2") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function calculateSevenDayChange(checkins: Checkin[]) {
  const valid = checkins
    .filter((item) => item && typeof item.date === "string" && Number.isFinite(Number(item.weight)))
    .map((item) => ({ date: item.date, weight: Number(item.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (valid.length === 0) return null;

  const latest = valid[valid.length - 1];
  const latestDate = new Date(`${latest.date}T00:00:00`);
  const windowStart = new Date(latestDate);
  windowStart.setDate(windowStart.getDate() - 6);

  const inWindow = valid.filter((item) => new Date(`${item.date}T00:00:00`) >= windowStart);
  const first = inWindow[0] || latest;
  return latest.weight - first.weight;
}

function updateMetric(change: number | null) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".metric-grid > *"));
  const card = cards.find((item) => /7 Günlük Ortalama|7 Günde Kilo Değişimi/i.test(item.textContent || ""));
  if (!card) return;

  const label = card.querySelector<HTMLElement>("small, span, p") || card.firstElementChild as HTMLElement | null;
  const value = card.querySelector<HTMLElement>("strong, h3, h2");
  const textNodes = Array.from(card.querySelectorAll<HTMLElement>("small, span, p"));
  const sub = textNodes.length > 1 ? textNodes[textNodes.length - 1] : null;

  if (label) label.textContent = "7 Günde Kilo Değişimi";
  if (value) {
    value.textContent = change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`;
  }
  if (sub) sub.textContent = change === null ? "Henüz veri yok" : "Son 7 gün toplam değişim";
}

export default function AtlasSevenDayWeightChangeBridge() {
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      let checkins = readLocalCheckins();

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: userData } = await supabase?.auth.getUser() || { data: { user: null } };
        const user = userData?.user;
        if (supabase && user) {
          const { data } = await supabase
            .from("atlas_user_state")
            .select("app_state")
            .eq("user_id", user.id)
            .maybeSingle();
          const state = data?.app_state && typeof data.app_state === "object" ? data.app_state as Record<string, unknown> : {};
          if (Array.isArray(state.checkins)) checkins = state.checkins as Checkin[];
        }
      } catch (error) {
        console.warn("7 günlük kilo değişimi okunamadı", error);
      }

      if (!cancelled) updateMetric(calculateSevenDayChange(checkins));
    };

    void refresh();
    const observer = new MutationObserver(() => void refresh());
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(() => void refresh(), 1500);
    window.addEventListener("storage", refresh);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return null;
}
