import type { Metadata } from "next";
import "./globals.css";
import "./atlas-v6.css";
import "./atlas-memory.css";
import "./atlas-mobile-app.css";
import WorkoutNumberInputFix from "@/components/WorkoutNumberInputFix";
import AtlasWorkoutCompletionEnhancer from "@/components/AtlasWorkoutCompletionEnhancer";
import AtlasMemoryCenter from "@/components/AtlasMemoryCenter";
import AtlasMobileNavigation from "@/components/AtlasMobileNavigation";

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
      <body>
        <WorkoutNumberInputFix />
        <AtlasWorkoutCompletionEnhancer />
        <AtlasMemoryCenter />
        <AtlasMobileNavigation />
        {children}
      </body>
    </html>
  );
}
