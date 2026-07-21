"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Checkin = { date: string; sleep?: number; water?: number };
type Workout = { date: string; exercises?: unknown[] };
type Food = { date: string; calories?: number; protein?: number };
type Photo = { date: string };
type Supplement = { date: string; taken?: boolean };
type Cardio = { date: string; duration?: number };

type AppState = {
  activeDate?: string;
  checkins?: Checkin[];
  workouts?: Workout[];
  nutritionEntries?: Food[];
  photos?: Photo[];
  supplements?: Supplement[];
  advanced?: { calorieTarget?: number; proteinTarget?: number; waterTarget?: number; cardioMinutes?: number };
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readLocalState(): AppState {
  return {
    activeDate: document.querySelector<HTMLElement>(".content .eyebrow")?.textContent?.match(/(\d{2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})/) ? undefined : undefined,
    checkins: readJson<Checkin[]>("atlas-checkins-v2", []),
    workouts: readJson<Workout[]>("atlas-workouts-v2", []),
    nutritionEntries: readJson<Food[]>("atlas-nutrition-v2", []),
    photos: readJson<Photo[]>("atlas-photos-v2", []),
    supplements: readJson<Supplement[]>("atlas-supplements-v1", []),
    advanced: readJson<AppState["advanced"]>("atlas-advanced-v1", {}),
  };
}

function getActiveDate(state: AppState) {
  const input = document.querySelector<HTMLInputElement>('.content input[type="date"]');
  if (input?.value) return input.value;
  if (state.activeDate) return state.activeDate;
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function readCardio(): Cardio[] {
  return readJson<Cardio[]>("atlas-cardio-v1", []);
}

function calculateScore(state: AppState) {
  const date = getActiveDate(state);
  const checkin = state.checkins?.find((item) => item.date === date);
  const workout = state.workouts?.find((item) => item.date === date);
  const foods = state.nutritionEntries?.filter((item) => item.date === date) || [];
  const photos = state.photos?.filter((item) => item.date === date) || [];
  const supplements = state.supplements?.filter((item) => item.date === date) || [];
  const cardio = readCardio().filter((item) => item.date === date);

  const calorieTarget = Number(state.advanced?.calorieTarget) || 2450;
  const proteinTarget = Number(state.advanced?.proteinTarget) || 200;
  const waterTarget = Number(state.advanced?.waterTarget) || 4;
  const cardioTarget = Number(state.advanced?.cardioMinutes) || 30;

  const calories = foods.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const protein = foods.reduce((sum, item) => sum + Number(item.protein || 0), 0);
  const cardioMinutes = cardio.reduce((sum, item) => sum + Number(item.duration || 0), 0);

  const parts = [
    { label: "Günlük check-in", points: checkin ? 20 : 0, max: 20 },
    { label: "Antrenman", points: workout && (workout.exercises?.length || 0) > 0 ? 25 : 0, max: 25 },
    { label: "Kalori hedefi", points: Math.round(Math.min(calories / calorieTarget, 1) * 15), max: 15 },
    { label: "Protein hedefi", points: Math.round(Math.min(protein / proteinTarget, 1) * 10), max: 10 },
    { label: "Kardiyo", points: Math.round(Math.min(cardioMinutes / cardioTarget, 1) * 10), max: 10 },
    { label: "Uyku", points: checkin && Number(checkin.sleep || 0) >= 7 ? 5 : 0, max: 5 },
    { label: "Su", points: checkin ? Math.round(Math.min(Number(checkin.water || 0) / waterTarget, 1) * 5) : 0, max: 5 },
    { label: "İlerleme fotoğrafı", points: photos.length > 0 ? 5 : 0, max: 5 },
    { label: "Supplement takibi", points: supplements.length > 0 && supplements.every((item) => item.taken) ? 5 : 0, max: 5 },
  ];

  return { score: parts.reduce((sum, item) => sum + item.points, 0), parts };
}

function renderScore(state: AppState) {
  const scoreBox = document.querySelector<HTMLElement>(".hero-card .score");
  const scoreValue = scoreBox?.querySelector<HTMLElement>("strong");
  if (!scoreBox || !scoreValue) return;

  const result = calculateScore(state);
  scoreValue.textContent = String(result.score);
  scoreBox.title = result.parts.map((item) => `${item.label}: ${item.points}/${item.max}`).join("\n");
  scoreBox.setAttribute("aria-label", `ATLAS günlük skoru ${result.score} / 100`);

  let detail = scoreBox.querySelector<HTMLElement>("[data-atlas-score-detail]");
  if (!detail) {
    detail = document.createElement("small");
    detail.setAttribute("data-atlas-score-detail", "true");
    detail.style.display = "block";
    detail.style.marginTop = "6px";
    detail.style.fontSize = "10px";
    detail.style.color = "var(--muted)";
    scoreBox.appendChild(detail);
  }
  detail.textContent = result.score === 100 ? "GÜN TAMAMLANDI ✓" : `${100 - result.score} PUAN KALDI`;
}

export default function AtlasDailyScoreBridge() {
  useEffect(() => {
    let disposed = false;
    let cachedState = readLocalState();
    let lastCloudRead = 0;

    const refresh = async (forceCloud = false) => {
      const title = document.querySelector<HTMLElement>(".topbar h1")?.textContent?.trim();
      if (title !== "Kontrol Merkezi" && title !== "Dashboard") return;

      const localState = readLocalState();
      cachedState = { ...cachedState, ...localState };

      const now = Date.now();
      if (forceCloud || now - lastCloudRead > 12000) {
        lastCloudRead = now;
        try {
          const supabase = getSupabaseBrowserClient();
          const { data: userData } = await supabase?.auth.getUser() || { data: { user: null } };
          const user = userData?.user;
          if (supabase && user) {
            const { data } = await supabase.from("atlas_user_state").select("app_state").eq("user_id", user.id).maybeSingle();
            if (data?.app_state && typeof data.app_state === "object") cachedState = data.app_state as AppState;
          }
        } catch (error) {
          console.warn("ATLAS günlük skor verisi okunamadı", error);
        }
      }

      if (!disposed) renderScore(cachedState);
    };

    const delayedRefresh = () => window.setTimeout(() => void refresh(true), 1100);
    void refresh(true);
    const timer = window.setInterval(() => void refresh(false), 3000);
    document.addEventListener("click", delayedRefresh);
    document.addEventListener("change", delayedRefresh);
    window.addEventListener("storage", delayedRefresh);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("click", delayedRefresh);
      document.removeEventListener("change", delayedRefresh);
      window.removeEventListener("storage", delayedRefresh);
    };
  }, []);

  return null;
}
