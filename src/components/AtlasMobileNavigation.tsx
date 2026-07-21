"use client";

import { useEffect, useMemo, useState } from "react";

type MobileItem = {
  label: string;
  short: string;
  icon: string;
};

const PRIMARY_ITEMS: MobileItem[] = [
  { label: "Kontrol Merkezi", short: "Ana Sayfa", icon: "⌂" },
  { label: "Antrenman", short: "Antrenman", icon: "↟" },
  { label: "Beslenme", short: "Beslenme", icon: "◉" },
  { label: "ATLAS AI Sohbet", short: "AI Koç", icon: "A" },
];

const ALL_ITEMS: MobileItem[] = [
  ...PRIMARY_ITEMS,
  { label: "Günlük Check-in", short: "Check-in", icon: "✓" },
  { label: "Öneri Antrenmanı", short: "AI Program", icon: "✦" },
  { label: "Supplement Takibi", short: "Supplement", icon: "+" },
  { label: "Gelişim Merkezi", short: "Gelişim", icon: "↗" },
  { label: "Günlük Geçmiş", short: "Geçmiş", icon: "◷" },
  { label: "Fotoğraflar", short: "Fotoğraflar", icon: "▣" },
  { label: "Profil", short: "Profil", icon: "●" },
];

function clickDesktopNav(label: string) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".sidebar .nav-item"));
  const button = buttons.find((item) => item.textContent?.trim() === label);
  button?.click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export default function AtlasMobileNavigation() {
  const [activeLabel, setActiveLabel] = useState("Kontrol Merkezi");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const active = document.querySelector<HTMLButtonElement>(".sidebar .nav-item.active");
      if (active?.textContent) setActiveLabel(active.textContent.trim());
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const primaryLabels = useMemo(() => PRIMARY_ITEMS.map((item) => item.label), []);
  const activeInPrimary = primaryLabels.includes(activeLabel);

  const select = (label: string) => {
    clickDesktopNav(label);
    setOpen(false);
  };

  return (
    <>
      <nav className="atlas-mobile-nav" aria-label="Mobil navigasyon">
        {PRIMARY_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            className={activeLabel === item.label ? "active" : ""}
            onClick={() => select(item.label)}
          >
            <span className="atlas-mobile-nav-icon">{item.icon}</span>
            <small>{item.short}</small>
          </button>
        ))}
        <button type="button" className={!activeInPrimary ? "active" : ""} onClick={() => setOpen(true)}>
          <span className="atlas-mobile-nav-icon">•••</span>
          <small>Diğer</small>
        </button>
      </nav>

      {open && (
        <div className="atlas-mobile-sheet-backdrop" onClick={() => setOpen(false)}>
          <section className="atlas-mobile-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="atlas-mobile-sheet-handle" />
            <div className="atlas-mobile-sheet-head">
              <div>
                <span>ATLAS MENÜ</span>
                <strong>Tüm bölümler</strong>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Menüyü kapat">×</button>
            </div>
            <div className="atlas-mobile-sheet-grid">
              {ALL_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={activeLabel === item.label ? "active" : ""}
                  onClick={() => select(item.label)}
                >
                  <span>{item.icon}</span>
                  <strong>{item.short}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
