import { NextRequest, NextResponse } from "next/server";

type NutritionResult = {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  sourceNote?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { foodName, grams } = await request.json();
    const cleanName = String(foodName || "").trim();
    const cleanGrams = Number(grams);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ message: "OpenAI API anahtarı bulunamadı." }, { status: 500 });
    }

    if (!cleanName || !Number.isFinite(cleanGrams) || cleanGrams <= 0 || cleanGrams > 5000) {
      return NextResponse.json({ message: "Geçerli bir besin adı ve gramaj gir." }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_NUTRITION_MODEL || "gpt-4.1-mini",
        store: false,
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "auto",
        instructions: `
Bir beslenme veri araştırmacısısın.
Kullanıcının yazdığı besini web üzerinden araştır.
Öncelik sırası:
1. Resmi üretici besin etiketi
2. Güvenilir gıda veri tabanı
3. Yaygın standart tarif değeri

Pişmiş/çiğ durumu, marka veya tarif belirsizse en makul yaygın varsayımı kullan ve sourceNote alanında belirt.
100 gram başına kalori, protein, karbonhidrat ve yağ değerlerini üret.
Yalnızca JSON döndür. Markdown veya açıklama ekleme.
`,
        input: `Besin adı: ${cleanName}\n100 gram başına enerji ve makroları araştır ve şu yapıda JSON döndür:\n{"name":"","caloriesPer100g":0,"proteinPer100g":0,"carbsPer100g":0,"fatPer100g":0,"sourceNote":""}`,
        text: {
          format: {
            type: "json_schema",
            name: "nutrition_lookup",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                caloriesPer100g: { type: "number" },
                proteinPer100g: { type: "number" },
                carbsPer100g: { type: "number" },
                fatPer100g: { type: "number" },
                sourceNote: { type: "string" },
              },
              required: [
                "name",
                "caloriesPer100g",
                "proteinPer100g",
                "carbsPer100g",
                "fatPer100g",
                "sourceNote",
              ],
            },
          },
        },
        max_output_tokens: 900,
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      console.error("Nutrition lookup OpenAI error", response.status, raw);
      return NextResponse.json(
        { message: createReadableError(response.status, raw) },
        { status: response.status }
      );
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json({ message: "OpenAI yanıtı okunamadı." }, { status: 500 });
    }

    const outputText = extractResponseText(data);
    if (!outputText) {
      console.error("Nutrition lookup returned no output text", raw);
      return NextResponse.json({ message: "Besin bilgisi bulunamadı." }, { status: 500 });
    }

    let parsed: NutritionResult;
    try {
      parsed = JSON.parse(outputText) as NutritionResult;
    } catch {
      return NextResponse.json({ message: "Besin bilgisi geçerli biçimde alınamadı." }, { status: 500 });
    }

    const values = [
      Number(parsed.caloriesPer100g),
      Number(parsed.proteinPer100g),
      Number(parsed.carbsPer100g),
      Number(parsed.fatPer100g),
    ];

    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ message: "Bulunan makro değerleri doğrulanamadı." }, { status: 500 });
    }

    const factor = cleanGrams / 100;

    return NextResponse.json({
      nutrition: {
        name: parsed.name || cleanName,
        grams: cleanGrams,
        calories: round1(values[0] * factor),
        protein: round1(values[1] * factor),
        carbs: round1(values[2] * factor),
        fat: round1(values[3] * factor),
        per100g: {
          calories: round1(values[0]),
          protein: round1(values[1]),
          carbs: round1(values[2]),
          fat: round1(values[3]),
        },
        sourceNote: parsed.sourceNote || "Web araştırmasıyla yaklaşık değer hesaplandı.",
      },
    });
  } catch (error) {
    console.error("Nutrition lookup route error", error);
    return NextResponse.json(
      { message: "Besin araştırılırken teknik bir hata oluştu." },
      { status: 500 }
    );
  }
}

function extractResponseText(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const texts = Array.isArray(data?.output)
    ? data.output
        .flatMap((item: any) => item?.content ?? [])
        .filter(
          (item: any) =>
            item?.type === "output_text" && typeof item?.text === "string"
        )
        .map((item: any) => item.text.trim())
        .filter(Boolean)
    : [];

  return texts.join("\n").trim() || null;
}

function createReadableError(status: number, raw: string): string {
  const detail = extractErrorMessage(raw);

  if (status === 400) {
    return `Besin araştırma isteği geçersiz bulundu: ${detail}`;
  }
  if (status === 401) {
    return "OpenAI API anahtarı geçersiz.";
  }
  if (status === 404) {
    return "Besin araştırma modeli bulunamadı veya hesaba açık değil.";
  }
  if (status === 429) {
    return "OpenAI kullanım kotası veya bakiyesi yetersiz.";
  }
  if (status >= 500) {
    return "OpenAI tarafında geçici hata oluştu.";
  }
  return `Besin araştırma isteği başarısız oldu (${status}): ${detail}`;
}

function extractErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.error?.message || parsed?.message || raw).slice(0, 350);
  } catch {
    return raw.slice(0, 350);
  }
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
