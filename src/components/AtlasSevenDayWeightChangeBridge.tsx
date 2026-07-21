"use client";

import { useEffect } from "react";

type Checkin = { date: string; weight: number };

function readCheckins(): Checkin[] {
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
  const first = valid.find((item) => new Date(`${item.date}T00:00:00`) >= windowStart) || latest;
  return latest.weight - first.weight;
}

function updateMetric() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".metric-grid > *"));
  const card = cards.find((item) => /7 Günlük Ortalama|7 Günde Kilo Değişimi/i.test(item.textContent || ""));
  if (!card) return;

  const change = calculateSevenDayChange(readCheckins());
  const label = card.querySelector<HTMLElement>("small, span, p") || card.firstElementChild as HTMLElement | null;
  const value = card.querySelector<HTMLElement>("strong, h3, h2");
  const textNodes = Array.from(card.querySelectorAll<HTMLElement>("small, span, p"));
  const sub = textNodes.length > 1 ? textNodes[textNodes.length - 1] : null;

  if (label && label.textContent !== "7 Günde Kilo Değişimi") label.textContent = "7 Günde Kilo Değişimi";
  const valueText = change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`;
  if (value && value.textContent !== valueText) value.textContent = valueText;
  const subText = change === null ? "Henüz veri yok" : "Son 7 gün toplam değişim";
  if (sub && sub.textContent !== subText) sub.textContent = subText;
}

export default function AtlasSevenDayWeightChangeBridge() {
  useEffect(() => {
    updateMetric();
    const timer = window.setInterval(updateMetric, 1200);
    window.addEventListener("storage", updateMetric);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", updateMetric);
    };
  }, []);

  return null;
}
