"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Checkin = {
  date: string;
  sleep?: number;
  sleepQuality?: number;
  energy?: number;
  soreness?: number;
  stress?: number;
  water?: number;
  nutrition?: number;
  pain?: boolean;
};
type WorkoutSet = { weight?: number; reps?: number; rir?: number };
type Workout = { date: string; exercises?: Array<{ sets?: WorkoutSet[] }> };
type Food = { date: string; calories?: number; protein?: number };
type Supplement = { date: string; taken?: boolean };
type Cardio = { date: string; duration?: number };

type AppState = {
  activeDate?: string;
  checkins?: Checkin[];
  workouts?: Workout[];
  nutritionEntries?: Food[];
  supplements?: Supplement[];
  advanced?: {
    calorieTarget?: number;
    proteinTarget?: number;
    waterTarget?: number;
    cardioMinutes?: number;
  };
};

type DayScores = {
  atlas: number;
  training: number;
  nutrition: number;
  recovery: number;
  discipline: number;
  disciplineGrade: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function ratioScore(value: number, target: number, tolerance = 0.15) {
  if (value <= 0 || target <= 0) return 0;
  const ratio = value / target;
  if (ratio >= 1 - tolerance && ratio <= 1 + tolerance) return 100;
  if (ratio < 1 - tolerance) return clamp((ratio / (1 - tolerance)) * 100);
  return clamp(100 - ((ratio - (1 + tolerance)) / 0.75) * 100);
}

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
    checkins: readJson<Checkin[]>("atlas-checkins-v2", []),
    workouts: readJson<Workout[]>("atlas-workouts-v2", []),
    nutritionEntries: readJson<Food[]>("atlas-nutrition-v2", []),
    supplements: readJson<Supplement[]>("atlas-supplements-v1", []),
    advanced: readJson<AppState["advanced"]>("atlas-advanced-v1", {}),
  };
}

function readCardio(): Cardio[] {
  return readJson<Cardio[]>("atlas-cardio-v1", []);
}

function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function getActiveDate(state: AppState) {
  const dashboardDate = document.querySelector<HTMLInputElement>('.content input[type="date"]');
  return dashboardDate?.value || state.activeDate || localToday();
}

function gradeFor(score: number) {
  if (score >= 97) return "S+";
  if (score >= 93) return "S";
  if (score >= 88) return "A+";
  if (score >= 82) return "A";
  if (score >= 72) return "B";
  if (score >= 60) return "C";
  return "D";
}

function calculateDay(state: AppState, date: string, cardioEntries: Cardio[]): DayScores {
  const checkin = state.checkins?.find((item) => item.date === date);
  const workout = state.workouts?.find((item) => item.date === date);
  const foods = state.nutritionEntries?.filter((item) => item.date === date) || [];
  const supplements = state.supplements?.filter((item) => item.date === date) || [];
  const cardio = cardioEntries.filter((item) => item.date === date);

  const calorieTarget = Number(state.advanced?.calorieTarget) || 2450;
  const proteinTarget = Number(state.advanced?.proteinTarget) || 200;
  const waterTarget = Number(state.advanced?.waterTarget) || 4;
  const cardioTarget = Number(state.advanced?.cardioMinutes) || 30;

  const calories = foods.reduce((sum, item) => sum + Number(item.calories || 0), 0);
  const protein = foods.reduce((sum, item) => sum + Number(item.protein || 0), 0);
  const cardioMinutes = cardio.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const exerciseCount = workout?.exercises?.length || 0;
  const totalSets = workout?.exercises?.reduce((sum, exercise) => sum + (exercise.sets?.length || 0), 0) || 0;
  const completedSets = workout?.exercises?.reduce(
    (sum, exercise) => sum + (exercise.sets?.filter((set) => Number(set.reps || 0) > 0).length || 0),
    0,
  ) || 0;

  const training = workout
    ? clamp((exerciseCount > 0 ? 35 : 0) + (totalSets > 0 ? Math.min((completedSets / totalSets) * 55, 55) : 0) + (cardioMinutes > 0 ? Math.min((cardioMinutes / cardioTarget) * 10, 10) : 0))
    : cardioMinutes > 0
      ? clamp(Math.min((cardioMinutes / cardioTarget) * 45, 45))
      : 0;

  const nutritionEntryScore = foods.length > 0 ? 10 : 0;
  const nutrition = clamp(
    nutritionEntryScore +
    ratioScore(calories, calorieTarget, 0.15) * 0.42 +
    ratioScore(protein, proteinTarget, 0.1) * 0.38 +
    clamp(Number(checkin?.nutrition || 0)) * 0.1,
  );

  const sleepDuration = clamp((Number(checkin?.sleep || 0) / 8) * 100);
  const sleepQuality = clamp(Number(checkin?.sleepQuality || 0) * 10);
  const energy = clamp(Number(checkin?.energy || 0) * 10);
  const soreness = clamp((10 - Number(checkin?.soreness || 0)) * 10);
  const stress = clamp((10 - Number(checkin?.stress || 0)) * 10);
  const recovery = checkin
    ? clamp(sleepDuration * 0.28 + sleepQuality * 0.24 + energy * 0.2 + soreness * 0.14 + stress * 0.14 - (checkin.pain ? 12 : 0))
    : 0;

  const supplementScore = supplements.length > 0
    ? (supplements.every((item) => item.taken) ? 100 : (supplements.filter((item) => item.taken).length / supplements.length) * 100)
    : 0;
  const waterScore = checkin ? clamp((Number(checkin.water || 0) / waterTarget) * 100) : 0;
  const cardioScore = clamp((cardioMinutes / cardioTarget) * 100);
  const discipline = clamp(
    (checkin ? 20 : 0) +
    (workout ? 25 : 0) +
    (foods.length > 0 ? 20 : 0) +
    cardioScore * 0.1 +
    waterScore * 0.1 +
    supplementScore * 0.15,
  );

  const atlas = clamp(training * 0.3 + nutrition * 0.3 + recovery * 0.25 + discipline * 0.15);
  return { atlas, training, nutrition, recovery, discipline, disciplineGrade: gradeFor(discipline) };
}

function allActivityDates(state: AppState, cardio: Cardio[]) {
  const dates = new Set<string>();
  state.checkins?.forEach((item) => dates.add(item.date));
  state.workouts?.forEach((item) => dates.add(item.date));
  state.nutritionEntries?.forEach((item) => dates.add(item.date));
  state.supplements?.forEach((item) => dates.add(item.date));
  cardio.forEach((item) => dates.add(item.date));
  return [...dates].sort();
}

function calculateProgress(state: AppState, cardio: Cardio[]) {
  const dates = allActivityDates(state, cardio);
  let xp = 0;
  dates.forEach((date) => {
    if (state.checkins?.some((item) => item.date === date)) xp += 20;
    if (state.workouts?.some((item) => item.date === date)) xp += 50;
    if (state.nutritionEntries?.some((item) => item.date === date)) xp += 40;
    if (cardio.some((item) => item.date === date)) xp += 20;
    if (state.supplements?.some((item) => item.date === date && item.taken)) xp += 10;
  });

  let streak = 0;
  const cursor = new Date(`${localToday()}T12:00:00`);
  for (let index = 0; index < 366; index += 1) {
    const date = cursor.toISOString().slice(0, 10);
    const day = calculateDay(state, date, cardio);
    const hasActivity = dates.includes(date);
    if (!hasActivity || day.atlas < 45) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { level: Math.max(1, Math.floor(xp / 500) + 1), xp, streak };
}

function metricCard(label: string, value: string, hint: string, key: string) {
  return `<article class="atlas-score-v2-card" data-atlas-stat="${key}"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`;
}

function renderScore(state: AppState) {
  const scoreBox = document.querySelector<HTMLElement>(".hero-card .score");
  const scoreValue = scoreBox?.querySelector<HTMLElement>("strong");
  const hero = document.querySelector<HTMLElement>(".hero-card");
  if (!scoreBox || !scoreValue || !hero) return;

  const cardio = readCardio();
  const date = getActiveDate(state);
  const scores = calculateDay(state, date, cardio);
  const progress = calculateProgress(state, cardio);

  scoreValue.textContent = String(scores.atlas);
  scoreBox.setAttribute("aria-label", `ATLAS skoru ${scores.atlas} / 100`);
  scoreBox.title = `Training ${scores.training} · Nutrition ${scores.nutrition} · Recovery ${scores.recovery} · Discipline ${scores.discipline}`;

  let detail = scoreBox.querySelector<HTMLElement>("[data-atlas-score-detail]");
  if (!detail) {
    detail = document.createElement("small");
    detail.setAttribute("data-atlas-score-detail", "true");
    scoreBox.appendChild(detail);
  }
  detail.textContent = scores.atlas >= 90 ? "ELİT GÜN" : scores.atlas >= 75 ? "GÜÇLÜ İLERLEME" : scores.atlas >= 50 ? "DEVAM ET" : "KAYIT BEKLİYOR";

  let grid = document.querySelector<HTMLElement>("[data-atlas-score-v2-grid]");
  if (!grid) {
    grid = document.createElement("section");
    grid.setAttribute("data-atlas-score-v2-grid", "true");
    grid.className = "atlas-score-v2-grid";
    hero.insertAdjacentElement("afterend", grid);
  }

  grid.innerHTML = [
    metricCard("LEVEL", String(progress.level), `${progress.xp} XP`, "level"),
    metricCard("STREAK", `${progress.streak} gün`, "Kesintisiz disiplin", "streak"),
    metricCard("DISCIPLINE", scores.disciplineGrade, `${scores.discipline}/100`, "discipline"),
    metricCard("RECOVERY", String(scores.recovery), "Uyku ve toparlanma", "recovery"),
    metricCard("NUTRITION", String(scores.nutrition), "Günlük hedef uyumu", "nutrition"),
    metricCard("TRAINING", String(scores.training), "Antrenman performansı", "training"),
  ].join("");
}

export default function AtlasDailyScoreBridge() {
  useEffect(() => {
    let disposed = false;
    let cachedState = readLocalState();
    let lastCloudRead = 0;

    const refresh = async (forceCloud = false) => {
      const title = document.querySelector<HTMLElement>(".topbar h1")?.textContent?.trim();
      if (title !== "Kontrol Merkezi" && title !== "Dashboard") return;

      cachedState = { ...cachedState, ...readLocalState() };
      const now = Date.now();
      if (forceCloud || now - lastCloudRead > 5000) {
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
          console.warn("ATLAS skor verisi okunamadı", error);
        }
      }

      if (!disposed) renderScore(cachedState);
    };

    const scheduleRefresh = () => {
      window.setTimeout(() => void refresh(false), 100);
      window.setTimeout(() => void refresh(true), 1700);
    };

    void refresh(true);
    const timer = window.setInterval(() => void refresh(false), 2000);
    const observer = new MutationObserver(() => void refresh(false));
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", scheduleRefresh);
    document.addEventListener("change", scheduleRefresh);
    document.addEventListener("submit", scheduleRefresh);
    window.addEventListener("storage", scheduleRefresh);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("click", scheduleRefresh);
      document.removeEventListener("change", scheduleRefresh);
      document.removeEventListener("submit", scheduleRefresh);
      window.removeEventListener("storage", scheduleRefresh);
    };
  }, []);

  return null;
}
