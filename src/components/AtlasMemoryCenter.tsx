"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type MemoryCategory = "injury" | "preference" | "goal" | "habit" | "performance" | "nutrition" | "recovery" | "other";
type SyncState = "loading" | "cloud" | "local" | "saving" | "error";

type MemoryItem = {
  id: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  archived: boolean;
};

type MemoryProposal = {
  category: MemoryCategory;
  content: string;
  importance: number;
  confidence: number;
};

type MemoryRow = {
  id: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  confidence: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  archived: boolean;
};

const STORAGE_KEY = "atlas-ai-memory-v2";
const LEGACY_KEY = "atlas-ai-memory-v1";
const MEMORY_EVENT = "atlas-memory-updated";

const categoryLabels: Record<MemoryCategory, string> = {
  injury: "Ağrı / Sakatlık",
  preference: "Tercih",
  goal: "Hedef",
  habit: "Alışkanlık",
  performance: "Performans",
  nutrition: "Beslenme",
  recovery: "Toparlanma",
  other: "Diğer",
};

function createId() {
  return `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampScore(value: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function readLocalMemories(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }

    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
    if (!Array.isArray(legacy)) return [];
    const migrated = legacy.map((item: any): MemoryItem => ({
      id: String(item.id || createId()),
      category: (item.category || "other") as MemoryCategory,
      content: normalizeText(String(item.content || item.text || "")),
      importance: item.category === "injury" ? 90 : item.category === "goal" ? 80 : 60,
      confidence: 100,
      createdAt: String(item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
      lastUsedAt: null,
      archived: false,
    })).filter((item: MemoryItem) => item.content);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

function persistLocalMemories(memories: MemoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  window.dispatchEvent(new CustomEvent(MEMORY_EVENT, { detail: memories }));
}

function rowToMemory(row: MemoryRow): MemoryItem {
  return {
    id: row.id,
    category: row.category,
    content: row.content,
    importance: clampScore(row.importance, 60),
    confidence: clampScore(row.confidence, 100),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    archived: Boolean(row.archived),
  };
}

function detectMemoryProposal(text: string): MemoryProposal | null {
  const clean = normalizeText(text);
  const lower = clean.toLocaleLowerCase("tr-TR");
  if (clean.length < 8 || clean.length > 360) return null;

  if (/\b(ağrıyor|ağrım var|sakatlandım|sakatlık|incindi|rahatsız ediyor|ameliyat|fıtık|tendon|bağ yırtığı)\b/i.test(lower)) {
    return { category: "injury", content: clean, importance: 95, confidence: 92 };
  }
  if (/\b(uykusuz|uyku.*kötü|çok yorgun|toparlanamadım|halsiz|enerjim düşük|dinlenemiyorum)\b/i.test(lower)) {
    return { category: "recovery", content: clean, importance: 78, confidence: 88 };
  }
  if (/\b(hedefim|amacım|ulaşmak istiyorum|kilo olmak istiyorum|yağ oranı|kas kazanmak|hedef kilom)\b/i.test(lower)) {
    return { category: "goal", content: clean, importance: 88, confidence: 94 };
  }
  if (/\b(cheat|öğün|beslenme|yemek|protein|kalori|pirinç|tavuk|yumurta|whey)\b/i.test(lower) && /\b(sevmiyorum|istemiyorum|tercih ederim|her gün|genelde|kullanmıyorum)\b/i.test(lower)) {
    return { category: "nutrition", content: clean, importance: 76, confidence: 87 };
  }
  if (/\b(sevmiyorum|istemiyorum|tercih ederim|tercihim|hoşlanmıyorum|bana iyi geliyor|bana uymuyor)\b/i.test(lower)) {
    return { category: "preference", content: clean, importance: 70, confidence: 90 };
  }
  if (/\b(her gün|her sabah|her akşam|haftada|genelde|alışkanlığım|rutinim)\b/i.test(lower)) {
    return { category: "habit", content: clean, importance: 62, confidence: 82 };
  }
  if (/\b(en iyi|rekorum|maksimum|pr yaptım|zorlanıyorum|ilerleyemiyorum|plato)\b/i.test(lower)) {
    return { category: "performance", content: clean, importance: 68, confidence: 84 };
  }
  return null;
}

function getLatestUserMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return "";
  const latest = [...messages].reverse().find((item) => item && typeof item === "object" && (item as { role?: string }).role === "user");
  return latest && typeof (latest as { content?: unknown }).content === "string" ? String((latest as { content: string }).content) : "";
}

function buildRelevantMemory(memories: MemoryItem[], query: string) {
  const words = new Set(normalizeText(query).toLocaleLowerCase("tr-TR").split(/\s+/).filter((word) => word.length > 3));
  return memories
    .filter((item) => !item.archived)
    .map((item) => {
      const content = item.content.toLocaleLowerCase("tr-TR");
      const overlap = [...words].filter((word) => content.includes(word)).length;
      const categoryBoost = item.category === "injury" ? 30 : item.category === "goal" ? 15 : 0;
      return { item, score: item.importance + overlap * 18 + categoryBoost };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ item }) => ({
      id: item.id,
      category: item.category,
      content: item.content,
      importance: item.importance,
      confidence: item.confidence,
      updatedAt: item.updatedAt,
    }));
}

export default function AtlasMemoryCenter() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [proposal, setProposal] = useState<MemoryProposal | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("other");
  const [importance, setImportance] = useState(60);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    async function load() {
      const local = readLocalMemories();
      setMemories(local);
      if (!supabase) {
        setSyncState("local");
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id || null;
      if (cancelled) return;
      setUserId(uid);
      if (!uid) {
        setSyncState("local");
        return;
      }

      const { data, error } = await supabase
        .from("atlas_memory")
        .select("id,category,content,importance,confidence,created_at,updated_at,last_used_at,archived")
        .eq("user_id", uid)
        .order("importance", { ascending: false })
        .order("updated_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("ATLAS memory cloud load error:", error);
        setSyncState("error");
        return;
      }

      let cloud = (data || []).map((row) => rowToMemory(row as MemoryRow));
      if (cloud.length === 0 && local.length > 0) {
        const rows = local.map((item) => ({
          id: item.id,
          user_id: uid,
          category: item.category,
          content: item.content,
          importance: item.importance,
          confidence: item.confidence,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
          last_used_at: item.lastUsedAt,
          archived: item.archived,
        }));
        const { error: migrationError } = await supabase.from("atlas_memory").upsert(rows, { onConflict: "id" });
        if (!migrationError) cloud = local;
      }

      setMemories(cloud);
      persistLocalMemories(cloud);
      setSyncState("cloud");
    }

    load();
    const sync = () => setMemories(readLocalMemories());
    window.addEventListener("storage", sync);
    window.addEventListener(MEMORY_EVENT, sync);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", sync);
      window.removeEventListener(MEMORY_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      let nextInit = init;

      if (url.includes("/api/coach") && init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body);
          const latestUserMessage = getLatestUserMessage(body) || String(body.userMessage || "");
          const currentMemories = readLocalMemories();
          const relevant = buildRelevantMemory(currentMemories, latestUserMessage);
          const detected = detectMemoryProposal(latestUserMessage);

          body.context = { ...(body.context || {}), atlasMemory: relevant };
          nextInit = { ...init, body: JSON.stringify(body) };

          if (detected) {
            const duplicate = currentMemories.some((item) => item.content.toLocaleLowerCase("tr-TR") === detected.content.toLocaleLowerCase("tr-TR"));
            if (!duplicate) window.setTimeout(() => setProposal(detected), 0);
          }
        } catch {
          // Keep the original request unchanged if the body is not JSON.
        }
      }

      return originalFetch(input, nextInit);
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  const groupedCount = useMemo(() => memories.filter((item) => !item.archived).reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {}), [memories]);

  async function writeCloud(item: MemoryItem) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) return false;
    setSyncState("saving");
    const { error } = await supabase.from("atlas_memory").upsert({
      id: item.id,
      user_id: userId,
      category: item.category,
      content: item.content,
      importance: item.importance,
      confidence: item.confidence,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      last_used_at: item.lastUsedAt,
      archived: item.archived,
    }, { onConflict: "id" });
    setSyncState(error ? "error" : "cloud");
    if (error) console.error("ATLAS memory cloud save error:", error);
    return !error;
  }

  async function saveMemory(next: MemoryProposal) {
    const now = new Date().toISOString();
    const item: MemoryItem = {
      id: createId(), category: next.category, content: normalizeText(next.content),
      importance: clampScore(next.importance, 60), confidence: clampScore(next.confidence, 100),
      createdAt: now, updatedAt: now, lastUsedAt: null, archived: false,
    };
    const updated = [item, ...memories];
    setMemories(updated);
    persistLocalMemories(updated);
    setProposal(null);
    await writeCloud(item);
  }

  async function addManualMemory() {
    const content = normalizeText(draft);
    if (!content) return;
    await saveMemory({ category, content, importance, confidence: 100 });
    setDraft("");
  }

  async function patchMemory(id: string, patch: Partial<MemoryItem>) {
    const now = new Date().toISOString();
    const updated = memories.map((item) => item.id === id ? { ...item, ...patch, updatedAt: now } : item);
    const changed = updated.find((item) => item.id === id);
    setMemories(updated);
    persistLocalMemories(updated);
    if (changed) await writeCloud(changed);
  }

  async function removeMemory(id: string) {
    const updated = memories.filter((item) => item.id !== id);
    setMemories(updated);
    persistLocalMemories(updated);
    const supabase = getSupabaseBrowserClient();
    if (supabase && userId) {
      setSyncState("saving");
      const { error } = await supabase.from("atlas_memory").delete().eq("id", id).eq("user_id", userId);
      setSyncState(error ? "error" : "cloud");
    }
  }

  async function clearAll() {
    if (!window.confirm("ATLAS AI hafızasındaki tüm kayıtlar silinsin mi?")) return;
    setMemories([]);
    persistLocalMemories([]);
    const supabase = getSupabaseBrowserClient();
    if (supabase && userId) {
      setSyncState("saving");
      const { error } = await supabase.from("atlas_memory").delete().eq("user_id", userId);
      setSyncState(error ? "error" : "cloud");
    }
  }

  const activeMemories = memories.filter((item) => !item.archived);

  return (
    <>
      <button className="atlas-memory-fab" type="button" onClick={() => setOpen(true)}>
        <span>🧠</span><b>AI Hafıza</b>{activeMemories.length > 0 && <i>{activeMemories.length}</i>}
      </button>

      {proposal && (
        <div className="atlas-memory-proposal">
          <div><span>ATLAS AI HAFIZA ÖNERİSİ</span><strong>{categoryLabels[proposal.category]}</strong><p>{proposal.content}</p><small>Önem {proposal.importance}/100 • Güven {proposal.confidence}/100</small></div>
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
              <div><p className="eyebrow">ATLAS AI MEMORY V2</p><h2>Hesabına bağlı koç hafızası</h2><small>İlgili bilgiler sohbet sırasında seçilerek kullanılır. {syncState === "cloud" ? "Supabase ile senkron." : syncState === "saving" ? "Kaydediliyor..." : syncState === "error" ? "Bulut bağlantısı kurulamadı; yerel kopya aktif." : "Yerel hafıza aktif."}</small></div>
              <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Kapat</button>
            </header>

            <div className="atlas-memory-stats">
              {Object.entries(categoryLabels).map(([key, label]) => <div key={key}><span>{label}</span><strong>{groupedCount[key] || 0}</strong></div>)}
            </div>

            <div className="atlas-memory-add">
              <select value={category} onChange={(event) => setCategory(event.target.value as MemoryCategory)}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ör. Sağ omzum overhead press sırasında hassaslaşıyor." onKeyDown={(event) => { if (event.key === "Enter") addManualMemory(); }} />
              <input type="number" min="0" max="100" value={importance} onChange={(event) => setImportance(clampScore(Number(event.target.value), 60))} aria-label="Önem puanı" />
              <button className="primary" type="button" onClick={addManualMemory}>Ekle</button>
            </div>

            <div className="atlas-memory-list">
              {activeMemories.length === 0 ? <div className="empty-state"><p>Henüz kayıtlı hafıza yok. Sohbette kalıcı bir bilgi verdiğinde ATLAS önce senden onay isteyecek.</p></div> : activeMemories.map((item) => (
                <article key={item.id} className="atlas-memory-item">
                  <div className="atlas-memory-item-head"><span>{categoryLabels[item.category]}</span><small>Önem {item.importance} • Güven {item.confidence} • {new Date(item.updatedAt).toLocaleDateString("tr-TR")}</small></div>
                  <textarea defaultValue={item.content} onBlur={(event) => patchMemory(item.id, { content: normalizeText(event.target.value) })} aria-label={`${categoryLabels[item.category]} hafıza kaydı`} />
                  <div className="atlas-memory-item-actions">
                    <label>Önem <input type="range" min="0" max="100" defaultValue={item.importance} onMouseUp={(event) => patchMemory(item.id, { importance: Number((event.target as HTMLInputElement).value) })} onTouchEnd={(event) => patchMemory(item.id, { importance: Number((event.target as HTMLInputElement).value) })} /></label>
                    <button className="ghost-button" type="button" onClick={() => patchMemory(item.id, { archived: true })}>Arşivle</button>
                    <button className="ghost-button danger" type="button" onClick={() => removeMemory(item.id)}>Sil</button>
                  </div>
                </article>
              ))}
            </div>

            {activeMemories.length > 0 && <button className="ghost-button danger atlas-memory-clear" type="button" onClick={clearAll}>Tüm hafızayı temizle</button>}
          </section>
        </div>
      )}
    </>
  );
}
