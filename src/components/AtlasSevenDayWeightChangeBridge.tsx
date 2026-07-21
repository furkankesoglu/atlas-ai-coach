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

  if (valid.length < 2) return null;

  const latest = valid[valid.length - 1];
  const latestDate = new Date(`${latest.date}T00:00:00`);
  const windowStart = new Date(latestDate);
  windowStart.setDate(windowStart.getDate() - 6);

  const recordsInWindow = valid.filter(
    (item) => new Date(`${item.date}T00:00:00`) >= windowStart
  );

  if (recordsInWindow.length < 2) return null;
  return latest.weight - recordsInWindow[0].weight;
}

function renderMetric(checkins: Checkin[]) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".metric-grid > *"));
  const card = cards.find((item) => /7 Günlük Ortalama|7 Günde Kilo Değişimi/i.test(item.textContent || ""));
  if (!card) return;

  const change = calculateSevenDayChange(checkins);
  const label = card.querySelector<HTMLElement>("small, span, p") || card.firstElementChild as HTMLElement | null;
  const value = card.querySelector<HTMLElement>("strong, h3, h2");
  const textNodes = Array.from(card.querySelectorAll<HTMLElement>("small, span, p"));
  const sub = textNodes.length > 1 ? textNodes[textNodes.length - 1] : null;

  if (label && label.textContent !== "7 Günde Kilo Değişimi") label.textContent = "7 Günde Kilo Değişimi";

  const valueText = change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`;
  if (value && value.textContent !== valueText) value.textContent = valueText;

  const subText = change === null
    ? "En az 2 kayıt gerekli"
    : "Son 7 gündeki ilk ve son kayıt";
  if (sub && sub.textContent !== subText) sub.textContent = subText;
}

export default function AtlasSevenDayWeightChangeBridge() {
  useEffect(() => {
    let cancelled = false;
    let cachedCheckins = readLocalCheckins();
    let lastCloudRead = 0;

    const refresh = async () => {
      const cardExists = Array.from(document.querySelectorAll<HTMLElement>(".metric-grid > *"))
        .some((item) => /7 Günlük Ortalama|7 Günde Kilo Değişimi/i.test(item.textContent || ""));
      if (!cardExists) return;

      const localCheckins = readLocalCheckins();
      if (localCheckins.length > 0) cachedCheckins = localCheckins;

      const now = Date.now();
      if (now - lastCloudRead > 5000) {
        lastCloudRead = now;
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
            const state = data?.app_state && typeof data.app_state === "object"
              ? data.app_state as Record<string, unknown>
              : {};
            if (Array.isArray(state.checkins)) cachedCheckins = state.checkins as Checkin[];
          }
        } catch (error) {
          console.warn("7 günlük kilo değişimi okunamadı", error);
        }
      }

      if (!cancelled) renderMetric(cachedCheckins);
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    window.addEventListener("storage", refresh);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return null;
}
