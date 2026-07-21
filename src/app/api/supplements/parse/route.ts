import { NextRequest, NextResponse } from "next/server";

type ParsedSupplement = {
  time: string;
  name: string;
  dose: string;
  notes?: string;
};

type SupplementAction = {
  type: "create_supplements";
  label: string;
  payload: {
    date: string;
    supplements: ParsedSupplement[];
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;
    const text = String(body?.text || "").trim();
    const date = String(body?.date || new Date().toISOString().slice(0, 10));

    if (!apiKey || !text) return NextResponse.json({ action: null });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        store: false,
        reasoning: { effort: "minimal" },
        max_output_tokens: 1200,
        instructions: `
Kullanıcının mesajındaki supplement/vitamin planını ayrıştır. Yalnızca geçerli JSON veya null döndür.

JSON biçimi:
{"type":"create_supplements","label":"11 supplement • 6 saat","payload":{"date":"YYYY-MM-DD","supplements":[{"time":"06:20","name":"Thermo Burner","dose":"2 kapsül","notes":"Antrenmandan 30 dk önce"}]}}

Kurallar:
- Tarih olarak ${date} kullan.
- Her ürünü ayrı supplements öğesi yap.
- Saatleri 24 saat biçiminde HH:MM olarak koru.
- Ürün adını temiz yaz; emoji ve madde işaretlerini çıkar.
- Dozu eksiksiz koru: kapsül, tablet, yumuşak kapsül, ölçek ve gram bilgileri dahil.
- Su miktarı, açlık durumu, öğünden önce/sonra, antrenmandan önce/sonra gibi ayrıntıları notes alanına yaz.
- Aynı shaker içindeki her ürünü ayrı kayıt yap; ortak shaker/su notunu her ilgili ürüne ekleyebilirsin.
- Bunları besin veya öğün olarak sınıflandırma.
- Kullanıcı yalnızca soru soruyorsa veya ortada uygulanabilir bir supplement planı yoksa null döndür.
- Markdown, açıklama ve kod bloğu kullanma.
`,
        input: text,
      }),
    });

    if (!response.ok) return NextResponse.json({ action: null });
    const data = await response.json();
    const raw = extractText(data).trim();
    if (!raw || raw === "null") return NextResponse.json({ action: null });

    const parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as SupplementAction;
    if (!isValidAction(parsed)) return NextResponse.json({ action: null });

    const supplements = parsed.payload.supplements.map((item) => ({
      time: normalizeTime(item.time),
      name: String(item.name || "Supplement").trim(),
      dose: String(item.dose || "Belirtilmedi").trim(),
      ...(item.notes ? { notes: String(item.notes).trim() } : {}),
    }));

    const timeCount = new Set(supplements.map((item) => item.time)).size;
    return NextResponse.json({
      action: {
        type: "create_supplements",
        label: `${supplements.length} supplement • ${timeCount} saat`,
        payload: { date, supplements },
      },
    });
  } catch (error) {
    console.error("ATLAS supplement parser error:", error);
    return NextResponse.json({ action: null });
  }
}

function normalizeTime(value: string) {
  const text = String(value || "Gün içinde").trim().replace(".", ":");
  const match = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return text || "Gün içinde";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function extractText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output
    .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
    .filter((item: any) => item?.type === "output_text" && typeof item?.text === "string")
    .map((item: any) => item.text)
    .join("\n");
}

function isValidAction(value: any): value is SupplementAction {
  return Boolean(
    value &&
      value.type === "create_supplements" &&
      value.payload &&
      typeof value.payload.date === "string" &&
      Array.isArray(value.payload.supplements) &&
      value.payload.supplements.length > 0 &&
      value.payload.supplements.every(
        (item: any) =>
          typeof item?.name === "string" &&
          item.name.trim() &&
          typeof item?.dose === "string" &&
          item.dose.trim()
      )
  );
}
