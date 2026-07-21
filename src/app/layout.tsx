import type { Metadata } from "next";
import "./globals.css";
import "./atlas-v6.css";
import WorkoutNumberInputFix from "@/components/WorkoutNumberInputFix";
import AtlasWorkoutCompletionEnhancer from "@/components/AtlasWorkoutCompletionEnhancer";

export const metadata: Metadata = {
  title: "ATLAS AI Coach",
  description: "Kişisel antrenman, beslenme ve gelişim takip sistemi",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>
        <WorkoutNumberInputFix />
        <AtlasWorkoutCompletionEnhancer />
        {children}
      </body>
    </html>
  );
}
