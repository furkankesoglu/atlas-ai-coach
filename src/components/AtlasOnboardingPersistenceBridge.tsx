"use client";

import { useEffect } from "react";

const ONBOARDING_KEY = "atlas-onboarding-complete-v1";
const ADVANCED_KEY = "atlas-advanced-v1";
const ROOT_CLASS = "atlas-onboarding-complete";

function hasCompletedOnboarding(): boolean {
  try {
    if (localStorage.getItem(ONBOARDING_KEY) === "1") return true;
    const savedAdvanced = JSON.parse(localStorage.getItem(ADVANCED_KEY) || "null");
    return savedAdvanced?.onboardingComplete === true;
  } catch {
    return false;
  }
}

function persistCompletion() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // The UI can still stay hidden for the current session.
  }
  document.documentElement.classList.add(ROOT_CLASS);
}

export default function AtlasOnboardingPersistenceBridge() {
  useEffect(() => {
    if (hasCompletedOnboarding()) {
      document.documentElement.classList.add(ROOT_CLASS);
      return;
    }

    let sawOverlay = Boolean(document.querySelector(".onboarding-overlay"));

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!target) return;
      if (/ATLAS.?ı Başlat/i.test(target.textContent || "")) persistCompletion();
    };

    document.addEventListener("click", handleClick, true);

    const observer = new MutationObserver(() => {
      const overlayExists = Boolean(document.querySelector(".onboarding-overlay"));
      if (overlayExists) {
        sawOverlay = true;
        return;
      }

      // Cloud state has loaded and React removed the completed onboarding modal.
      if (sawOverlay) {
        persistCompletion();
        observer.disconnect();
        document.removeEventListener("click", handleClick, true);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}
