import { NextRequest, NextResponse } from "next/server";

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
  payload: {
    date: string;
    meals: ParsedFood[];
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;
    const text = String(body?.text || "").trim();
    const date = String(body?.date || new Date().toISOString().slice(0, 10));

    if (!apiKey || !text) {
      return NextResponse.json({ action: null });
    }

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
        max_output_tokens: 1000,
        instructions: `
Kullanıcının mesajında aktif beslenme planına eklenmesi istenen net öğünler varsa yalnızca geçerli JSON döndür.
Beslenme kaydı yoksa yalnızca null döndür.

JSON biçimi:
{"type":"create_nutrition","label":"3 öğün • 8 besin","payload":{"date":"YYYY-MM-DD","meals":[{"time":"12:00","name":"Yulaf","grams":100},{"time":"12:00","name":"Yumurta","grams":200,"quantity":4,"unitLabel":"adet"}]}}

Kurallar:
- Tarih olarak ${date} kullan.
- Her besini ayrı bir meals öğesi yap.
- Saat belirtilmişse koru, belirtilmemişse "Öğün" yaz.
- Gram açıkça verilmişse grams alanına yaz.
- Adet verilen yumurta, muz, elma gibi ürünlerde makul ortalama gram kullan ve quantity/unitLabel alanlarını da ekle.
- "Flavor powder", greens, superfoods gibi gramı belirtilmeyen ürünlerde grams 1 kullan.
- Kullanıcı yalnızca soru soruyorsa veya planı kaydetmek istemiyorsa null döndür.
- Markdown, açıklama ve kod bloğu kullanma.
`,
        input: text,
      }),
    });

    if (!response.ok) return NextResponse.json({ action: null });
    const data = await response.json();
    const raw = extractText(data).trim();
    if (!raw || raw === "null") return NextResponse.json({ action: null });

    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as NutritionAction;

    if (!isValidAction(parsed)) return NextResponse.json({ action: null });

    const meals = parsed.payload.meals.map((meal) => ({
      time: String(meal.time || "Öğün").trim(),
      name: String(meal.name || "Besin").trim(),
      grams: Math.max(1, Number(meal.grams) || 1),
      ...(meal.quantity ? { quantity: Math.max(1, Number(meal.quantity)) } : {}),
      ...(meal.unitLabel ? { unitLabel: String(meal.unitLabel) } : {}),
    }));

    const mealCount = new Set(meals.map((meal) => meal.time)).size;
    return NextResponse.json({
      action: {
        type: "create_nutrition",
        label: `${mealCount} öğün • ${meals.length} besin`,
        payload: { date, meals },
      },
    });
  } catch (error) {
    console.error("ATLAS nutrition parser error:", error);
    return NextResponse.json({ action: null });
  }
}

function extractText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((item: any) => item?.type === "output_text" && typeof item?.text === "string")
    .map((item: any) => item.text)
    .join("\n");
}

function isValidAction(value: any): value is NutritionAction {
  return Boolean(
    value &&
      value.type === "create_nutrition" &&
      value.payload &&
      typeof value.payload.date === "string" &&
      Array.isArray(value.payload.meals) &&
      value.payload.meals.length > 0 &&
      value.payload.meals.every(
        (meal: any) =>
          typeof meal?.name === "string" &&
          meal.name.trim() &&
          Number.isFinite(Number(meal?.grams))
      )
  );
}
