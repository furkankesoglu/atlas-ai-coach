import { NextRequest, NextResponse } from "next/server";

type OpenAIContentItem = { type?: string; text?: string };
type OpenAIOutputItem = { type?: string; content?: OpenAIContentItem[] };
type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
  status?: string;
  incomplete_details?: { reason?: string };
};

type WorkoutSet = { weight: number; reps: number; rir: number };
type WorkoutExercise = { name: string; sets: WorkoutSet[] };
type ProposedWorkoutAction = {
  type: "create_workout";
  label: string;
  payload: {
    date: string;
    split: string;
    name: string;
    exercises: WorkoutExercise[];
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { message: "OpenAI API anahtarı bulunamadı.", demo: true },
        { status: 500 }
      );
    }

    const isChatMode = body?.mode === "chat";
    const previousAction = findActionInConversation(body?.messages);
    const latestUserMessage = getLatestUserMessage(body?.messages);

    if (isChatMode && previousAction && isApprovalMessage(latestUserMessage)) {
      return NextResponse.json({
        message: "Antrenman taslağı hazır. Aşağıdaki düğmeye basınca sisteme eklenecek.",
        proposedAction: previousAction,
        demo: false,
      });
    }

    const instructions = isChatMode
      ? buildChatInstructions()
      : buildAnalysisInstructions();

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        store: false,
        instructions,
        input: JSON.stringify(body),
        truncation: "auto",
        reasoning: { effort: isChatMode ? "minimal" : "low" },
        max_output_tokens: isChatMode ? 1800 : 1200,
      }),
    });

    const rawResponseText = await openAIResponse.text();

    if (!openAIResponse.ok) {
      return NextResponse.json(
        {
          message: createReadableError(openAIResponse.status, rawResponseText),
          demo: true,
        },
        { status: openAIResponse.status }
      );
    }

    let data: OpenAIResponse;
    try {
      data = JSON.parse(rawResponseText) as OpenAIResponse;
    } catch {
      return NextResponse.json(
        { message: "OpenAI cevap verdi ancak yanıt biçimi okunamadı.", demo: true },
        { status: 500 }
      );
    }

    const rawMessage = extractResponseText(data);

    if (!rawMessage) {
      const tokenLimit =
        data.status === "incomplete" &&
        data.incomplete_details?.reason === "max_output_tokens";

      return NextResponse.json(
        {
          message: tokenLimit
            ? "Antrenman çok uzun olduğu için taslak tamamlanamadı. Daha kısa bölümler halinde gönder."
            : "OpenAI yanıt üretti ancak görünür metin alınamadı.",
          demo: true,
        },
        { status: 500 }
      );
    }

    const { message, proposedAction } = extractAtlasAction(rawMessage);

    return NextResponse.json({ message, proposedAction, demo: false });
  } catch (error) {
    console.error("ATLAS coach route error:", error);
    return NextResponse.json(
      { message: "Yapay zekâ isteği işlenirken teknik bir hata oluştu.", demo: true },
      { status: 500 }
    );
  }
}

function buildChatInstructions() {
  return `
Sen ATLAS AI Coach'sun.

Genel kurallar:
- Türkçe, doğal, kısa ve net konuş.
- Kullanıcının yalnızca sorduğu konuya cevap ver.
- Kullanıcı istemedikçe genel analiz yapma.
- Kullanıcının söylemediği bilgileri uydurma.
- Her cevabın sonunda soru sorma.
- Kullanıcıya aynı onay sorusunu tekrar tekrar sorma.

Antrenman taslağı kuralı:
- Mesajda hareket adlarıyla birlikte set, kilogram ve tekrar bilgileri varsa bunu antrenman taslağı olarak algıla.
- Kullanıcıdan metinle "onaylıyorum" yazmasını isteme.
- Görünür cevap yalnızca şu olsun: "Antrenman taslağını hazırladım. Aşağıdaki düğmeden onaylayıp sisteme ekleyebilirsin."
- Görünür cevabın sonuna mutlaka tek satır halinde şu etiketi ekle:
<ATLAS_ACTION>{"type":"create_workout","label":"PULL DAY 2 • 8 hareket • 24 set","payload":{"date":"YYYY-MM-DD","split":"Pull","name":"PULL DAY 2","exercises":[{"name":"Wide Grip Lat Pulldown","sets":[{"weight":16.5,"reps":12,"rir":2}]}]}}</ATLAS_ACTION>
- Etiket içindeki JSON geçerli olmalı; markdown kod bloğu kullanma.
- Tarih için context.activeDate değerini kullan.
- Split yalnızca Push, Pull, Legs veya Other olsun.
- RIR belirtilmediyse 2 kullan.
- Bütün hareketleri ve bütün setleri eksiksiz aktar.
- label içinde toplam hareket ve toplam set sayısını doğru yaz.
`;
}

function buildAnalysisInstructions() {
  return `
Sen ATLAS AI Coach'sun.
Kullanıcının check-in, beslenme, supplement, antrenman ve ilerleme kayıtlarını değerlendir.
Türkçe, net, motive edici ve gerçekçi konuş.
Eksik bilgileri uydurma, tıbbi teşhis koyma, ilaç veya doz önerme.
En fazla 250 kelime kullan.

Yanıt biçimi:
Durum:
Kısa genel değerlendirme.

Karar:
Bugün uygulanacak karar.

Odak:
Tek ana odak noktası.
`;
}

function extractResponseText(data: OpenAIResponse): string | null {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) return null;

  const texts: string[] = [];
  for (const outputItem of data.output) {
    if (!Array.isArray(outputItem.content)) continue;
    for (const contentItem of outputItem.content) {
      if (
        contentItem.type === "output_text" &&
        typeof contentItem.text === "string" &&
        contentItem.text.trim()
      ) {
        texts.push(contentItem.text.trim());
      }
    }
  }

  return texts.join("\n").trim() || null;
}

function extractAtlasAction(rawMessage: string): {
  message: string;
  proposedAction: ProposedWorkoutAction | null;
} {
  const tagged = rawMessage.match(/<ATLAS_ACTION>\s*([\s\S]*?)\s*<\/ATLAS_ACTION>/i);
  const taggedJson = tagged?.[1]?.trim();
  const fallbackJson = taggedJson ? null : findWorkoutJson(rawMessage);
  const jsonText = taggedJson || fallbackJson;

  if (!jsonText) {
    return {
      message: stripLeakedActionData(rawMessage),
      proposedAction: null,
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as ProposedWorkoutAction;
    if (!isValidWorkoutAction(parsed)) {
      return { message: stripLeakedActionData(rawMessage), proposedAction: null };
    }

    return {
      message:
        "Antrenman taslağını hazırladım. Aşağıdaki düğmeden onaylayıp sisteme ekleyebilirsin.",
      proposedAction: normaliseAction(parsed),
    };
  } catch (error) {
    console.error("ATLAS action parse error:", error);
    return { message: stripLeakedActionData(rawMessage), proposedAction: null };
  }
}

function findWorkoutJson(text: string): string | null {
  const typeIndex = text.search(/"type"\s*:\s*"create_workout"/i);
  if (typeIndex < 0) return null;

  const start = text.lastIndexOf("{", typeIndex);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

function stripLeakedActionData(text: string): string {
  const withoutTags = text
    .replace(/<ATLAS_ACTION>[\s\S]*?(?:<\/ATLAS_ACTION>|$)/gi, "")
    .replace(/```(?:json)?[\s\S]*?```/gi, "")
    .trim();

  const json = findWorkoutJson(withoutTags);
  const cleaned = json ? withoutTags.replace(json, "").trim() : withoutTags;

  if (/"exercises"\s*:|"sets"\s*:|"payload"\s*:/i.test(cleaned)) {
    return "Antrenman verisini okudum ancak taslak kartı oluşturulamadı. Mesajı tekrar gönder.";
  }

  return cleaned || "Antrenman verisini okudum ancak taslak kartı oluşturulamadı. Mesajı tekrar gönder.";
}

function normaliseAction(action: ProposedWorkoutAction): ProposedWorkoutAction {
  const exercises = action.payload.exercises.map((exercise) => ({
    name: exercise.name.trim(),
    sets: exercise.sets.map((set) => ({
      weight: Number(set.weight) || 0,
      reps: Number(set.reps) || 1,
      rir: Number.isFinite(Number(set.rir)) ? Number(set.rir) : 2,
    })),
  }));

  const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  return {
    type: "create_workout",
    label: `${action.payload.name} • ${exercises.length} hareket • ${setCount} set`,
    payload: { ...action.payload, exercises },
  };
}

function isValidWorkoutAction(value: unknown): value is ProposedWorkoutAction {
  if (!value || typeof value !== "object") return false;
  const action = value as ProposedWorkoutAction;

  return (
    action.type === "create_workout" &&
    typeof action.label === "string" &&
    Boolean(action.payload) &&
    typeof action.payload.date === "string" &&
    typeof action.payload.split === "string" &&
    typeof action.payload.name === "string" &&
    Array.isArray(action.payload.exercises) &&
    action.payload.exercises.length > 0 &&
    action.payload.exercises.every(
      (exercise) =>
        typeof exercise?.name === "string" &&
        exercise.name.trim().length > 0 &&
        Array.isArray(exercise.sets) &&
        exercise.sets.length > 0 &&
        exercise.sets.every(
          (set) =>
            Number.isFinite(Number(set.weight)) &&
            Number.isFinite(Number(set.reps))
        )
    )
  );
}

function getLatestUserMessage(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  const latest = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && typeof message?.content === "string");
  return latest?.content?.trim() || "";
}

function findActionInConversation(messages: unknown): ProposedWorkoutAction | null {
  if (!Array.isArray(messages)) return null;

  for (const message of [...messages].reverse()) {
    if (typeof message?.content !== "string") continue;
    const json = findWorkoutJson(message.content);
    if (!json) continue;

    try {
      const parsed = JSON.parse(json) as ProposedWorkoutAction;
      if (isValidWorkoutAction(parsed)) return normaliseAction(parsed);
    } catch {
      continue;
    }
  }

  return null;
}

function isApprovalMessage(message: string): boolean {
  return /^(onay|onaylıyorum|onayliyorum|ekle|ekle hocam|kaydet|tamam|uygula)[.!\s]*$/i.test(
    message
  );
}

function createReadableError(status: number, errorText: string): string {
  const apiMessage = extractErrorMessage(errorText);
  if (status === 400) return `OpenAI isteği geçersiz bulundu: ${apiMessage}`;
  if (status === 401) return "OpenAI API anahtarı geçersiz veya eksik.";
  if (status === 403) return `OpenAI erişim izni hatası: ${apiMessage}`;
  if (status === 404) return "Seçilen OpenAI modeli bulunamadı.";
  if (status === 429) return "OpenAI API bakiyesi veya kullanım kotası yetersiz.";
  if (status >= 500) return "OpenAI sunucusunda geçici bir hata oluştu.";
  return `OpenAI bağlantı hatası. Kod: ${status}. Detay: ${apiMessage}`;
}

function extractErrorMessage(errorText: string): string {
  if (!errorText) return "Teknik detay bulunamadı.";

  try {
    const parsed = JSON.parse(errorText);
    return String(parsed?.error?.message ?? parsed?.message ?? errorText).slice(0, 500);
  } catch {
    return errorText.slice(0, 500);
  }
}
