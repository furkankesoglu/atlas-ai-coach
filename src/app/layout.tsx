import type { Metadata } from "next";
import "./globals.css";
import "./atlas-v6.css";
import "./atlas-memory.css";
import "./atlas-mobile-app.css";
import "./atlas-nutrition-action.css";
import "./atlas-supplement-action.css";
import "./atlas-cardio.css";
import "./atlas-cardio-dashboard.css";
import "./atlas-sidebar-scroll.css";
import "./atlas-japanese-dragon.css";
import "./atlas-onboarding-persistence.css";
import WorkoutNumberInputFix from "@/components/WorkoutNumberInputFix";
import AtlasWorkoutCompletionEnhancer from "@/components/AtlasWorkoutCompletionEnhancer";
import AtlasMemoryCenter from "@/components/AtlasMemoryCenter";
import AtlasMobileNavigation from "@/components/AtlasMobileNavigation";
import AtlasNutritionActionBridge from "@/components/AtlasNutritionActionBridge";
import AtlasSupplementActionBridge from "@/components/AtlasSupplementActionBridge";
import AtlasCardioTracker from "@/components/AtlasCardioTracker";
import AtlasCardioDashboardBridge from "@/components/AtlasCardioDashboardBridge";
import AtlasSevenDayWeightChangeBridge from "@/components/AtlasSevenDayWeightChangeBridge";
import AtlasSuggestionFreshnessBridge from "@/components/AtlasSuggestionFreshnessBridge";
import AtlasDailyScoreBridge from "@/components/AtlasDailyScoreBridge";
import AtlasOnboardingPersistenceBridge from "@/components/AtlasOnboardingPersistenceBridge";

const onboardingBootstrap = `
(() => {
  try {
    const completed = localStorage.getItem("atlas-onboarding-complete-v1") === "1";
    const advanced = JSON.parse(localStorage.getItem("atlas-advanced-v1") || "null");
    if (completed || advanced?.onboardingComplete === true) {
      document.documentElement.classList.add("atlas-onboarding-complete");
    }
  } catch {}
})();
`;

// Deployment retry marker: 2026-07-21T10:00+03:00
export const metadata: Metadata = {
  title: "ATLAS AI Coach",
  description: "Kişisel antrenman, beslenme ve gelişim takip sistemi",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: onboardingBootstrap }} />
      </head>
      <body>
        <WorkoutNumberInputFix />
        <AtlasWorkoutCompletionEnhancer />
        <AtlasMemoryCenter />
        <AtlasMobileNavigation />
        <AtlasNutritionActionBridge />
        <AtlasSupplementActionBridge />
        <AtlasCardioTracker />
        <AtlasCardioDashboardBridge />
        <AtlasSevenDayWeightChangeBridge />
        <AtlasSuggestionFreshnessBridge />
        <AtlasDailyScoreBridge />
        <AtlasOnboardingPersistenceBridge />
        {children}
      </body>
    </html>
  );
}
