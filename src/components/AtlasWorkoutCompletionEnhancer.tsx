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

export default function AtlasWorkoutCompletionEnhancer() {
  const [toast, setToast] = useState("");

  useEffect(() => {
    const enhance = () => {
      const dateCard = document.querySelector<HTMLElement>(".time-card");
      const dateStrong = dateCard?.querySelector<HTMLElement>("strong");
      if (dateCard && dateStrong) {
        const now = new Date();
        const weekday = now.toLocaleDateString("tr-TR", { weekday: "long" });
        const date = now.toLocaleDateString("tr-TR");
        dateStrong.textContent = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} • ${date}`;
      }

      const pageTitle = Array.from(document.querySelectorAll<HTMLElement>(".topbar h1"))
        .find((node) => node.textContent?.trim() === "Antrenman");
      if (!pageTitle) return;

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

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { subtree: true, childList: true });
    const timer = window.setInterval(enhance, 1000);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return toast ? <div className="atlas-toast">{toast}</div> : null;
}
