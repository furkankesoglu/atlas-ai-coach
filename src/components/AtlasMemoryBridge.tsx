"use client";

import { useEffect } from "react";

type MemoryItem = {
  id: string;
  text: string;
  createdAt: string;
  category: "pain" | "recovery" | "preference" | "note";
};

const MEMORY_KEY = "atlas-ai-memory-v1";

function readMemory(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}

function writeMemory(items: MemoryItem[]) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(items.slice(-30)));
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function detectMemory(text: string): Omit<MemoryItem, "id" | "createdAt"> | null {
  const clean = normalizeText(text);
  if (!clean || clean.length < 5) return null;

  const lower = clean.toLocaleLowerCase("tr-TR");

  if (/(ağrı|ağrıyor|acı|sakat|sakatlık|incin|omuzum|dizim|belim|dirseğim|bileğim)/i.test(lower)) {
    return { text: clean.slice(0, 280), category: "pain" };
  }

  if (/(uykusuz|uyku.*kötü|çok yorgun|toparlanamadım|halsiz|enerjim düşük)/i.test(lower)) {
    return { text: clean.slice(0, 280), category: "recovery" };
  }

  if (/(sevmiyorum|istemiyorum|tercih ediyorum|bana iyi geliyor|bana uygun|yapmak istemem)/i.test(lower)) {
    return { text: clean.slice(0, 280), category: "preference" };
  }

  return null;
}

function extractLatestUserText(body: any): string {
  if (!Array.isArray(body?.messages)) return "";
  const latest = [...body.messages].reverse().find((item: any) => item?.role === "user");
  return typeof latest?.content === "string" ? latest.content : "";
}

export default function AtlasMemoryBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (!url.includes("/api/coach") || !init?.body || typeof init.body !== "string") {
        return originalFetch(input, init);
      }

      try {
        const body = JSON.parse(init.body);
        const latestText = extractLatestUserText(body);
        const detected = detectMemory(latestText);
        let memory = readMemory();

        if (detected && !memory.some((item) => item.text.toLocaleLowerCase("tr-TR") === detected.text.toLocaleLowerCase("tr-TR"))) {
          memory = [
            ...memory,
            {
              ...detected,
              id: Math.random().toString(36).slice(2, 10),
              createdAt: new Date().toISOString(),
            },
          ];
          writeMemory(memory);
        }

        const nextBody = {
          ...body,
          context: {
            ...(body.context || {}),
            aiMemory: memory.map((item) => ({
              text: item.text,
              category: item.category,
              createdAt: item.createdAt,
            })),
          },
        };

        return originalFetch(input, { ...init, body: JSON.stringify(nextBody) });
      } catch {
        return originalFetch(input, init);
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
