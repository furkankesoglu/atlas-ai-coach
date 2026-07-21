"use client";

import { useEffect, useState } from "react";

const COMPLETE_KEY = "atlas-completed-days-v1";

function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function readCompletedDays(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPLETE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function parseActiveDate() {
  const input = document.querySelector<HTMLInputElement>('.content input[type="date"]');
  return input?.value || localToday();
}

function updateDateCard() {
  const dateStrong = document.querySelector<HTMLElement>(".time-card strong");
  if (!dateStrong) return;

  const now = new Date();
  const weekday = now.toLocaleDateString("tr-TR", { weekday: "long" });
  const date = now.toLocaleDateString("tr-TR");
  const nextText = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} • ${date}`;

  if (dateStrong.textContent !== nextText) {
    dateStrong.textContent = nextText;
  }
}

export default function AtlasWorkoutCompletionEnhancer() {
  const [toast, setToast] = useState("");

  useEffect(() => {
    let lastPathSignature = "";

    const enhance = () => {
      updateDateCard();

      const pageTitle = document.querySelector<HTMLElement>(".topbar h1");
      const isWorkoutPage = pageTitle?.textContent?.trim() === "Antrenman";
      if (!isWorkoutPage) return;

      const panel = document.querySelector<HTMLElement>(".content > .panel");
      if (!panel || panel.querySelector("[data-atlas-workout-complete]")) return;

      const card = document.createElement("div");
      card.className = "atlas-workout-complete-card";
      card.setAttribute("data-atlas-workout-complete", "true");
      card.innerHTML = `
        <div>
          <span class="atlas-workout-complete-eyebrow">GÜNÜ TAMAMLA</span>
          <strong>Günün antrenmanını kaydet</strong>
          <small>Bu günün setlerini onaylar ve kaydı Günlük Geçmiş bölümünde tamamlandı olarak işaretler.</small>
        </div>
        <button type="button" class="primary">Antrenmanı Kaydet</button>
      `;

      const button = card.querySelector<HTMLButtonElement>("button");
      const activeDate = parseActiveDate();
      const completedDays = readCompletedDays();

      if (completedDays.includes(activeDate) && button) {
        button.textContent = "Kaydedildi ✓";
        button.disabled = true;
        card.classList.add("completed");
      }

      button?.addEventListener("click", () => {
        const date = parseActiveDate();
        const next = Array.from(new Set([...readCompletedDays(), date])).sort().reverse();
        localStorage.setItem(COMPLETE_KEY, JSON.stringify(next));
        button.textContent = "Kaydedildi ✓";
        button.disabled = true;
        card.classList.add("completed");
        setToast("Antrenman onaylandı ve Günlük Geçmiş'e kaydedildi.");
        window.setTimeout(() => setToast(""), 3000);
      });

      panel.appendChild(card);
    };

    const scheduleEnhance = () => {
      const title = document.querySelector<HTMLElement>(".topbar h1")?.textContent?.trim() || "";
      const activeDate = parseActiveDate();
      const signature = `${title}|${activeDate}`;

      if (signature === lastPathSignature && document.querySelector("[data-atlas-workout-complete]")) {
        updateDateCard();
        return;
      }

      lastPathSignature = signature;
      window.requestAnimationFrame(enhance);
    };

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
