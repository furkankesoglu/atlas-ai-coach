"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type CardioEntry = {
  id: string;
  date: string;
  label: string;
  duration: number;
  calories: number;
};

const LOCAL_KEY = "atlas-cardio-v1";

function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function readEntries(): CardioEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AtlasCardioDashboardBridge() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [entries, setEntries] = useState<CardioEntry[]>([]);

  useEffect(() => {
    const refresh = () => {
      setEntries(readEntries());
      const title = document.querySelector<HTMLElement>(".topbar h1")?.textContent?.trim();
      setTarget(title === "Dashboard" ? document.querySelector<HTMLElement>(".content") : null);
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { subtree: true, childList: true });
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("storage", refresh);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const summary = useMemo(() => {
    const today = localToday();
    const todayEntries = entries.filter((entry) => entry.date === today);
    const weekStart = new Date(`${today}T00:00:00`);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekEntries = entries.filter((entry) => new Date(`${entry.date}T00:00:00`) >= weekStart);

    return {
      todayCount: todayEntries.length,
      todayMinutes: todayEntries.reduce((sum, entry) => sum + Number(entry.duration || 0), 0),
      todayCalories: todayEntries.reduce((sum, entry) => sum + Number(entry.calories || 0), 0),
      weekCount: weekEntries.length,
      weekMinutes: weekEntries.reduce((sum, entry) => sum + Number(entry.duration || 0), 0),
      weekCalories: weekEntries.reduce((sum, entry) => sum + Number(entry.calories || 0), 0),
    };
  }, [entries]);

  if (!target) return null;

  return createPortal(
    <section className="atlas-cardio-dashboard">
      <div className="atlas-cardio-dashboard-heading">
        <div>
          <p className="eyebrow">CARDIO TRACKING</p>
          <h2>🏃 Kardiyo Özeti</h2>
        </div>
        <span>Son 7 gün</span>
      </div>
      <div className="atlas-cardio-dashboard-grid">
        <article><small>Bugün</small><strong>{summary.todayMinutes} dk</strong><span>{summary.todayCount} oturum</span></article>
        <article><small>Bugünkü Yakım</small><strong>{summary.todayCalories} kcal</strong><span>Tahmini enerji</span></article>
        <article><small>7 Günlük Süre</small><strong>{summary.weekMinutes} dk</strong><span>{summary.weekCount} oturum</span></article>
        <article><small>7 Günlük Yakım</small><strong>{summary.weekCalories} kcal</strong><span>Toplam tahmin</span></article>
      </div>
    </section>,
    target
  );
}
