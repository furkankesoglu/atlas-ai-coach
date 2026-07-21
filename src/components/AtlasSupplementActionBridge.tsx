"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ParsedSupplement = {
  time: string;
  name: string;
  dose: string;
  notes?: string;
};

type SupplementAction = {
  type: "create_supplements";
  label: string;
  payload: { date: string; supplements: ParsedSupplement[] };
};

type SupplementEntry = {
  id: string;
  date: string;
  name: string;
  dose: string;
  time: string;
  taken: boolean;
  notes: string;
};

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function likelySupplementRequest(text: string) {
  const lower = text.toLocaleLowerCase("tr-TR");
  const hasProduct = /(supplement|multivitamin|omega[- ]?3|d3|b12|ester[- ]?c|bromelain|zma|kreatin|creatine|collagen|kolajen|thermo|hunger buster|greens|detox|digestion|relax|kapsül|tablet|ölçek|shaker)/i.test(lower);
  const hasPlanShape = /(\b\d{1,2}[.:]\d{2}\b|\b\d+(?:[.,]\d+)?\s*(kapsül|tablet|ölçek|g|gr|gram)\b)/i.test(lower);
  return hasProduct && hasPlanShape;
}

function conversationText(body: any) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  return messages
    .slice(-6)
    .map((message: any) => `${message?.role || "user"}: ${String(message?.content || "")}`)
    .join("\n")
    .slice(0, 7000);
}

export default function AtlasSupplementActionBridge() {
  const [pending, setPending] = useState<SupplementAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes("/api/coach") || typeof init?.body !== "string") {
        return originalFetch(input, init);
      }

      let body: any;
      try {
        body = JSON.parse(init.body);
      } catch {
        return originalFetch(input, init);
      }

      const response = await originalFetch(input, init);
      if (body?.mode !== "chat") return response;

      const text = conversationText(body);
      if (!likelySupplementRequest(text)) return response;

      try {
        const parseResponse = await originalFetch("/api/supplements/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, date: body?.activeDate }),
        });
        const parsed = await parseResponse.json();
        if (!parsed?.action) return response;

        setPending(parsed.action as SupplementAction);
        const data = await response.clone().json();
        return new Response(
          JSON.stringify({
            ...data,
            proposedAction: null,
            message: "Supplement taslağını hazırladım. Aşağıdaki onay düğmesiyle Supplement Takibi sekmesine ekleyebilirsin.",
          }),
          { status: response.status, statusText: response.statusText, headers: response.headers }
        );
      } catch (error) {
        console.warn("ATLAS supplement action bridge error:", error);
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
      const entries: SupplementEntry[] = pending.payload.supplements.map((item) => ({
        id: createId(),
        date: pending.payload.date,
        name: item.name,
        dose: item.dose,
        time: item.time,
        taken: false,
        notes: item.notes || "AI planından eklendi",
      }));

      const supabase = getSupabaseBrowserClient();
      const { data: userData } = (await supabase?.auth.getUser()) || { data: { user: null } };
      const user = userData?.user;

      if (supabase && user) {
        const { data, error } = await supabase
          .from("atlas_user_state")
          .select("app_state, full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;

        const appState = data?.app_state && typeof data.app_state === "object" ? (data.app_state as any) : {};
        const current = Array.isArray(appState.supplements) ? appState.supplements : [];

        const { error: saveError } = await supabase.from("atlas_user_state").upsert(
          {
            user_id: user.id,
            full_name: data?.full_name || user.user_metadata?.full_name || user.email || "ATLAS User",
            app_state: {
              ...appState,
              supplements: [...current, ...entries],
              activeDate: pending.payload.date,
            },
          },
          { onConflict: "user_id" }
        );
        if (saveError) throw saveError;
      } else {
        const raw = localStorage.getItem("atlas-supplements-v1");
        const current = raw ? JSON.parse(raw) : [];
        localStorage.setItem(
          "atlas-supplements-v1",
          JSON.stringify([...(Array.isArray(current) ? current : []), ...entries])
        );
      }

      setNotice(`${entries.length} supplement, Supplement Takibi sekmesine eklendi.`);
      setPending(null);
      window.setTimeout(() => window.location.reload(), 850);
    } catch (error) {
      console.error(error);
      setNotice("Supplement planı eklenemedi. Tekrar dene.");
    } finally {
      setSaving(false);
    }
  }

  if (!pending && !notice) return null;

  const grouped = pending?.payload.supplements.reduce<Record<string, ParsedSupplement[]>>((acc, item) => {
    (acc[item.time] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="atlas-supplement-action-layer" role="dialog" aria-modal="true">
      <section className="atlas-supplement-action-card">
        {pending ? (
          <>
            <div className="atlas-supplement-action-head">
              <div>
                <span>ATLAS AI SUPPLEMENT TASLAĞI</span>
                <h3>{pending.label}</h3>
              </div>
              <button onClick={() => setPending(null)} aria-label="Kapat">×</button>
            </div>

            <div className="atlas-supplement-time-list">
              {Object.entries(grouped || {}).map(([time, items]) => (
                <div className="atlas-supplement-time" key={time}>
                  <strong>{time}</strong>
                  <div>
                    {items.map((item, index) => (
                      <article key={`${item.name}-${index}`}>
                        <b>{item.name}</b>
                        <span>{item.dose}</span>
                        {item.notes && <small>{item.notes}</small>}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="atlas-supplement-action-buttons">
              <button className="ghost-button" onClick={() => setPending(null)} disabled={saving}>Vazgeç</button>
              <button className="primary" onClick={confirm} disabled={saving}>
                {saving ? "Supplementler ekleniyor..." : "Onayla ve Supplement Takibine Ekle"}
              </button>
            </div>
          </>
        ) : (
          <div className="atlas-supplement-action-notice">{notice}</div>
        )}
      </section>
    </div>
  );
}
