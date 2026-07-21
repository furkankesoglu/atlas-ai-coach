"use client";

import { useEffect, useMemo, useState } from "react";

type MemoryCategory = "injury" | "preference" | "goal" | "habit" | "performance" | "other";

type MemoryItem = {
  id: string;
  category: MemoryCategory;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type MemoryProposal = {
  category: MemoryCategory;
  content: string;
};

const STORAGE_KEY = "atlas-ai-memory-v1";
const MEMORY_EVENT = "atlas-memory-updated";

const categoryLabels: Record<MemoryCategory, string> = {
  injury: "Ağrı / Sakatlık",
  preference: "Tercih",
  goal: "Hedef",
  habit: "Alışkanlık",
  performance: "Performans",
  other: "Diğer",
};

function createId() {
  return `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readMemories(): MemoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistMemories(memories: MemoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  window.dispatchEvent(new CustomEvent(MEMORY_EVENT, { detail: memories }));
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function detectMemoryProposal(text: string): MemoryProposal | null {
  const clean = normalizeText(text);
  const lower = clean.toLocaleLowerCase("tr-TR");

  if (clean.length < 8 || clean.length > 280) return null;

  if (/\b(ağrıyor|ağrım var|sakatlandım|sakatlık|incindi|rahatsız ediyor|ameliyat|fıtık)\b/i.test(lower)) {
    return { category: "injury", content: clean };
  }

  if (/\b(hedefim|amacım|ulaşmak istiyorum|kilo olmak istiyorum|yağ oranı|kas kazanmak)\b/i.test(lower)) {
    return { category: "goal", content: clean };
  }

  if (/\b(sevmiyorum|istemiyorum|tercih ederim|tercihim|hoşlanmıyorum|bana iyi geliyor|bana uymuyor)\b/i.test(lower)) {
    return { category: "preference", content: clean };
  }

  if (/\b(her gün|her sabah|her akşam|haftada|genelde|alışkanlığım|rutinim)\b/i.test(lower)) {
    return { category: "habit", content: clean };
  }

  if (/\b(en iyi|rekorum|maksimum|pr yaptım|zorlanıyorum|ilerleyemiyorum|plato)\b/i.test(lower)) {
    return { category: "performance", content: clean };
  }

  return null;
}

function getLatestUserMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return "";
  const latest = [...messages]
    .reverse()
    .find((item) => item && typeof item === "object" && (item as { role?: string }).role === "user");
  return latest && typeof (latest as { content?: unknown }).content === "string"
    ? String((latest as { content: string }).content)
    : "";
}

export default function AtlasMemoryCenter() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [proposal, setProposal] = useState<MemoryProposal | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("other");

  useEffect(() => {
    setMemories(readMemories());

    const sync = () => setMemories(readMemories());
    window.addEventListener("storage", sync);
    window.addEventListener(MEMORY_EVENT, sync);

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      let nextInit = init;

      if (url.includes("/api/coach") && init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body);
          const currentMemories = readMemories();
          const latestUserMessage = getLatestUserMessage(body);
          const detected = detectMemoryProposal(latestUserMessage);

          body.context = {
            ...(body.context || {}),
            atlasMemory: currentMemories.map((item) => ({
              category: item.category,
              content: item.content,
              updatedAt: item.updatedAt,
            })),
          };

          nextInit = { ...init, body: JSON.stringify(body) };

          if (detected) {
            const duplicate = currentMemories.some(
              (item) => item.content.toLocaleLowerCase("tr-TR") === detected.content.toLocaleLowerCase("tr-TR")
            );
            if (!duplicate) window.setTimeout(() => setProposal(detected), 0);
          }
        } catch {
          // Keep the original request unchanged if the body is not JSON.
        }
      }

      return originalFetch(input, nextInit);
    };

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("storage", sync);
      window.removeEventListener(MEMORY_EVENT, sync);
    };
  }, []);

  const groupedCount = useMemo(() => {
    return memories.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});
  }, [memories]);

  function saveMemory(next: MemoryProposal) {
    const now = new Date().toISOString();
    const item: MemoryItem = {
      id: createId(),
      category: next.category,
      content: normalizeText(next.content),
      createdAt: now,
      updatedAt: now,
    };
    const updated = [item, ...readMemories()];
    persistMemories(updated);
    setMemories(updated);
    setProposal(null);
  }

  function addManualMemory() {
    const content = normalizeText(draft);
    if (!content) return;
    saveMemory({ category, content });
    setDraft("");
  }

  function updateMemory(id: string, content: string) {
    const updated = readMemories().map((item) =>
      item.id === id ? { ...item, content: normalizeText(content), updatedAt: new Date().toISOString() } : item
    );
    persistMemories(updated);
    setMemories(updated);
  }

  function removeMemory(id: string) {
    const updated = readMemories().filter((item) => item.id !== id);
    persistMemories(updated);
    setMemories(updated);
  }

  function clearAll() {
    if (!window.confirm("ATLAS AI hafızasındaki tüm kayıtlar silinsin mi?")) return;
    persistMemories([]);
    setMemories([]);
  }

  return (
    <>
      <button className="atlas-memory-fab" type="button" onClick={() => setOpen(true)}>
        <span>🧠</span>
        <b>AI Hafıza</b>
        {memories.length > 0 && <i>{memories.length}</i>}
      </button>

      {proposal && (
        <div className="atlas-memory-proposal">
          <div>
            <span>ATLAS AI HAFIZA ÖNERİSİ</span>
            <strong>{categoryLabels[proposal.category]}</strong>
            <p>{proposal.content}</p>
          </div>
          <div className="atlas-memory-proposal-actions">
            <button className="primary" type="button" onClick={() => saveMemory(proposal)}>Hafızaya Kaydet</button>
            <button className="ghost-button danger" type="button" onClick={() => setProposal(null)}>Geç</button>
          </div>
        </div>
      )}

      {open && (
        <div className="atlas-memory-overlay" role="dialog" aria-modal="true" aria-label="ATLAS AI Hafıza">
          <section className="atlas-memory-panel">
            <header>
              <div>
                <p className="eyebrow">ATLAS AI MEMORY</p>
                <h2>Seni tanıyan koç hafızası</h2>
                <small>Yalnızca onayladığın kalıcı bilgiler sonraki AI konuşmalarında kullanılır.</small>
              </div>
              <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Kapat</button>
            </header>

            <div className="atlas-memory-stats">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <div key={key}><span>{label}</span><strong>{groupedCount[key] || 0}</strong></div>
              ))}
            </div>

            <div className="atlas-memory-add">
              <select value={category} onChange={(event) => setCategory(event.target.value as MemoryCategory)}>
                {Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ör. Sağ omzum overhead press sırasında hassaslaşıyor."
                onKeyDown={(event) => { if (event.key === "Enter") addManualMemory(); }}
              />
              <button className="primary" type="button" onClick={addManualMemory}>Ekle</button>
            </div>

            <div className="atlas-memory-list">
              {memories.length === 0 ? (
                <div className="empty-state"><p>Henüz kayıtlı hafıza yok. Sohbette kalıcı bir bilgi verdiğinde ATLAS önce senden onay isteyecek.</p></div>
              ) : memories.map((item) => (
                <article key={item.id} className="atlas-memory-item">
                  <div className="atlas-memory-item-head">
                    <span>{categoryLabels[item.category]}</span>
                    <small>{new Date(item.updatedAt).toLocaleDateString("tr-TR")}</small>
                  </div>
                  <textarea
                    defaultValue={item.content}
                    onBlur={(event) => updateMemory(item.id, event.target.value)}
                    aria-label={`${categoryLabels[item.category]} hafıza kaydı`}
                  />
                  <button className="ghost-button danger" type="button" onClick={() => removeMemory(item.id)}>Sil</button>
                </article>
              ))}
            </div>

            {memories.length > 0 && <button className="ghost-button danger atlas-memory-clear" type="button" onClick={clearAll}>Tüm hafızayı temizle</button>}
          </section>
        </div>
      )}
    </>
  );
}
