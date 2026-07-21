"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ParsedFood = {
  time: string;
  name: string;
  grams: number;
  quantity?: number;
  unitLabel?: string;
};

type NutritionAction = {
  type: "create_nutrition";
  label: string;
  payload: { date: string; meals: ParsedFood[] };
};

type NutritionEntry = {
  id: string;
  date: string;
  source: string;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity?: number;
  unitLabel?: string;
};

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function likelyNutritionRequest(text: string) {
  const lower = text.toLocaleLowerCase("tr-TR");
  const hasFood = /(tavuk|pirinç|yulaf|yumurta|muz|zeytinyağı|öğün|beslenme|kalori|makro|gram|\bg\b)/i.test(lower);
  const hasPlanShape = /(\b\d{1,2}[.:]\d{2}\b|\b\d+\s*(g|gr|gram|adet)\b)/i.test(lower);
  const hasIntent = /(ekle|kaydet|uygula|aktif|öğün|plan|devam et|onay)/i.test(lower);
  return hasFood && hasPlanShape && hasIntent;
}

function conversationText(body: any) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  return messages
    .slice(-6)
    .map((message: any) => `${message?.role || "user"}: ${String(message?.content || "")}`)
    .join("\n")
    .slice(0, 6000);
}

export default function AtlasNutritionActionBridge() {
  const [pending, setPending] = useState<NutritionAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes("/api/coach") || typeof init?.body !== "string") {
        return originalFetch(input, init);
      }

      let body: any = null;
      try {
        body = JSON.parse(init.body);
      } catch {
        return originalFetch(input, init);
      }

      const response = await originalFetch(input, init);
      if (body?.mode !== "chat") return response;

      const text = conversationText(body);
      if (!likelyNutritionRequest(text)) return response;

      try {
        const parseResponse = await originalFetch("/api/nutrition/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, date: body?.activeDate }),
        });
        const parsed = await parseResponse.json();
        if (!parsed?.action) return response;

        setPending(parsed.action as NutritionAction);
        const data = await response.clone().json();
        return new Response(
          JSON.stringify({
            ...data,
            proposedAction: null,
            message: "Beslenme taslağını hazırladım. Aşağıdaki onay düğmesiyle aktif güne ekleyebilirsin.",
          }),
          { status: response.status, statusText: response.statusText, headers: response.headers }
        );
      } catch (error) {
        console.warn("ATLAS nutrition action bridge error:", error);
        return response;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  async function confirm() {
    if (!pending || saving) return;
    setSaving(true);
    setNotice("");

    try {
      const entries: NutritionEntry[] = [];
      for (const meal of pending.payload.meals) {
        let nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, name: meal.name };
        try {
          const response = await fetch("/api/nutrition/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              foodName: meal.quantity && meal.unitLabel
                ? `${meal.name}, ${meal.quantity} ${meal.unitLabel}`
                : meal.name,
              grams: meal.grams,
            }),
          });
          const data = await response.json();
          if (response.ok && data?.nutrition) nutrition = data.nutrition;
        } catch {
          // Besin bulunamazsa sıfır makroyla kayda devam et; kullanıcı sonradan düzenleyebilir.
        }

        entries.push({
          id: createId(),
          date: pending.payload.date,
          source: "ai",
          name: `${meal.time} • ${nutrition.name || meal.name}`,
          grams: meal.grams,
          calories: Number(nutrition.calories) || 0,
          protein: Number(nutrition.protein) || 0,
          carbs: Number(nutrition.carbs) || 0,
          fat: Number(nutrition.fat) || 0,
          ...(meal.quantity ? { quantity: meal.quantity } : {}),
          ...(meal.unitLabel ? { unitLabel: meal.unitLabel } : {}),
        });
      }

      const supabase = getSupabaseBrowserClient();
      const { data: userData } = await supabase?.auth.getUser() || { data: { user: null } };
      const user = userData?.user;

      if (supabase && user) {
        const { data, error } = await supabase
          .from("atlas_user_state")
          .select("app_state, full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;

        const appState = (data?.app_state && typeof data.app_state === "object") ? data.app_state as any : {};
        const current = Array.isArray(appState.nutritionEntries) ? appState.nutritionEntries : [];
        const next = [...current, ...entries];

        const { error: saveError } = await supabase.from("atlas_user_state").upsert({
          user_id: user.id,
          full_name: data?.full_name || user.user_metadata?.full_name || user.email || "ATLAS User",
          app_state: { ...appState, nutritionEntries: next, activeDate: pending.payload.date },
        }, { onConflict: "user_id" });
        if (saveError) throw saveError;
      } else {
        const raw = localStorage.getItem("atlas-nutrition-v2");
        const current = raw ? JSON.parse(raw) : [];
        localStorage.setItem("atlas-nutrition-v2", JSON.stringify([...(Array.isArray(current) ? current : []), ...entries]));
      }

      setNotice(`${entries.length} besin aktif beslenmeye eklendi.`);
      setPending(null);
      window.setTimeout(() => window.location.reload(), 850);
    } catch (error) {
      console.error(error);
      setNotice("Beslenme kaydı eklenemedi. Tekrar dene.");
    } finally {
      setSaving(false);
    }
  }

  if (!pending && !notice) return null;

  return (
    <div className="atlas-nutrition-action-layer" role="dialog" aria-modal="true">
      <section className="atlas-nutrition-action-card">
        {pending ? (
          <>
            <div className="atlas-nutrition-action-head">
              <div>
                <span>ATLAS AI BESLENME TASLAĞI</span>
                <h3>{pending.label}</h3>
              </div>
              <button onClick={() => setPending(null)} aria-label="Kapat">×</button>
            </div>
            <div className="atlas-nutrition-meal-list">
              {Object.entries(
                pending.payload.meals.reduce<Record<string, ParsedFood[]>>((groups, meal) => {
                  (groups[meal.time] ||= []).push(meal);
                  return groups;
                }, {})
              ).map(([time, foods]) => (
                <div className="atlas-nutrition-meal" key={time}>
                  <strong>{time}</strong>
                  <div>
                    {foods.map((food, index) => (
                      <span key={`${food.name}-${index}`}>
                        {food.quantity && food.unitLabel
                          ? `${food.quantity} ${food.unitLabel} ${food.name}`
                          : `${food.grams} g ${food.name}`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="atlas-nutrition-action-buttons">
              <button className="ghost-button" onClick={() => setPending(null)} disabled={saving}>Vazgeç</button>
              <button className="primary" onClick={confirm} disabled={saving}>
                {saving ? "Besinler hesaplanıyor..." : "Onayla ve Beslenmeye Ekle"}
              </button>
            </div>
          </>
        ) : (
          <div className="atlas-nutrition-action-notice">{notice}</div>
        )}
      </section>
    </div>
  );
}
