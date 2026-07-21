"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type WorkoutSession = {
  id: string;
  date: string;
  title: string;
  split: string;
  summary: string;
  savedAt: string;
};

const SESSION_KEY = "atlas-workout-sessions-v2";

function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function createId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readSessions(): WorkoutSession[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseActiveDate() {
  const input = document.querySelector<HTMLInputElement>('.content input[type="date"]');
  return input?.value || localToday();
}

function textValue(element: Element | null) {
  if (!element) return "";
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value.trim();
  }
  return element.textContent?.trim() || "";
}

function captureWorkout(): WorkoutSession {
  const panel = document.querySelector<HTMLElement>(".content > .panel");
  const allInputs = panel ? Array.from(panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")) : [];
  const titleInput = allInputs.find((item) => /antrenman adı|program adı/i.test(item.getAttribute("placeholder") || ""));
  const title = textValue(titleInput) || textValue(panel?.querySelector("h2, h3")) || "Antrenman";
  const splitSelect = allInputs.find((item) => item instanceof HTMLSelectElement && /push|pull|legs|other/i.test(item.value));
  const split = textValue(splitSelect) || "Other";

  const exerciseNames = Array.from(panel?.querySelectorAll<HTMLInputElement>("input") || [])
    .map((input) => input.value.trim())
    .filter((value) => value && !/^\d+(?:[.,]\d+)?$/.test(value) && value !== title)
    .slice(0, 20);

  const numericValues = allInputs
    .filter((item) => item instanceof HTMLInputElement && item.type === "number")
    .map((item) => item.value)
    .filter(Boolean);

  const summary = exerciseNames.length > 0
    ? `${exerciseNames.length} hareket • ${Math.floor(numericValues.length / 3)} set`
    : "Antrenman kaydı";

  return {
    id: createId(),
    date: parseActiveDate(),
    title,
    split,
    summary,
    savedAt: new Date().toISOString(),
  };
}

async function persistSession(session: WorkoutSession) {
  const localSessions = [...readSessions(), session];
  localStorage.setItem(SESSION_KEY, JSON.stringify(localSessions));

  const supabase = getSupabaseBrowserClient();
  const { data: userData } = await supabase?.auth.getUser() || { data: { user: null } };
  const user = userData?.user;
  if (!supabase || !user) return;

  const { data, error } = await supabase
    .from("atlas_user_state")
    .select("app_state, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  const appState = data?.app_state && typeof data.app_state === "object" ? data.app_state as Record<string, unknown> : {};
  const current = Array.isArray(appState.workoutSessions) ? appState.workoutSessions : [];

  const { error: saveError } = await supabase.from("atlas_user_state").upsert({
    user_id: user.id,
    full_name: data?.full_name || user.user_metadata?.full_name || user.email || "ATLAS User",
    app_state: { ...appState, workoutSessions: [...current, session] },
  }, { onConflict: "user_id" });
  if (saveError) throw saveError;
}

function updateDateCard() {
  const dateStrong = document.querySelector<HTMLElement>(".time-card strong");
  if (!dateStrong) return;
  const now = new Date();
  const weekday = now.toLocaleDateString("tr-TR", { weekday: "long" });
  const date = now.toLocaleDateString("tr-TR");
  dateStrong.textContent = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} • ${date}`;
}

export default function AtlasWorkoutCompletionEnhancer() {
  const [toast, setToast] = useState("");

  useEffect(() => {
    let saving = false;

    const enhance = () => {
      updateDateCard();
      const pageTitle = document.querySelector<HTMLElement>(".topbar h1");
      if (pageTitle?.textContent?.trim() !== "Antrenman") return;

      const panel = document.querySelector<HTMLElement>(".content > .panel");
      if (!panel || panel.querySelector("[data-atlas-workout-complete]")) return;

      const card = document.createElement("div");
      card.className = "atlas-workout-complete-card";
      card.setAttribute("data-atlas-workout-complete", "true");
      card.innerHTML = `
        <div>
          <span class="atlas-workout-complete-eyebrow">ANTRENMANI TAMAMLA</span>
          <strong>Bu antrenmanı ayrı kayıt olarak kaydet</strong>
          <small>Aynı gün içinde istediğin kadar farklı antrenman kaydedebilirsin.</small>
        </div>
        <button type="button" class="primary">Antrenmanı Kaydet</button>
      `;

      const button = card.querySelector<HTMLButtonElement>("button");
      button?.addEventListener("click", async () => {
        if (!button || saving) return;
        saving = true;
        button.disabled = true;
        button.textContent = "Kaydediliyor...";

        try {
          const session = captureWorkout();
          await persistSession(session);
          button.textContent = "Kaydedildi ✓";
          card.classList.add("completed");
          setToast(`${session.title} ayrı antrenman kaydı olarak eklendi.`);
          window.setTimeout(() => {
            button.textContent = "Yeni Antrenmanı Kaydet";
            button.disabled = false;
            card.classList.remove("completed");
            saving = false;
          }, 1200);
          window.setTimeout(() => setToast(""), 3000);
        } catch (error) {
          console.error(error);
          button.textContent = "Tekrar Dene";
          button.disabled = false;
          saving = false;
          setToast("Antrenman kaydedilemedi.");
          window.setTimeout(() => setToast(""), 3000);
        }
      });

      panel.appendChild(card);
    };

    const scheduleEnhance = () => window.requestAnimationFrame(enhance);
    scheduleEnhance();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { subtree: true, childList: true });
    const timer = window.setInterval(updateDateCard, 60_000);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return toast ? <div className="atlas-toast">{toast}</div> : null;
}
