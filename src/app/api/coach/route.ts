import { NextRequest, NextResponse } from "next/server";

type OpenAIContentItem = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAIContentItem[];
};

type OpenAIIncompleteDetails = {
  reason?: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
  status?: string;
  incomplete_details?: OpenAIIncompleteDetails;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          message:
            "OpenAI API anahtarı bulunamadı. .env.local dosyasındaki OPENAI_API_KEY satırını kontrol et.",
          demo: true,
        },
        { status: 500 }
      );
    }

    const isChatMode = body?.mode === "chat";

    const instructions = isChatMode
      ? `
Sen ATLAS AI Coach'sun.

Ana kural:
Kullanıcının yalnızca sorduğu konuya cevap ver.

Sohbet kuralları:
- Kullanıcı selam verirse yalnızca kısa ve doğal biçimde selam ver.
- Basit sorulara 1-3 kısa cümleyle cevap ver.
- Kullanıcı istemedikçe genel analiz yapma.
- Kullanıcı istemedikçe kilo, uyku, kalori, makro, supplement, fotoğraf ve antrenman verilerini birlikte sıralama.
- Kullanıcı verilerini yalnızca sorusuyla doğrudan ilgiliyse kullan.
- Detay istenmedikçe 70 kelimeyi geçme.
- Gereksiz madde listesi oluşturma.
- Her cevabın sonunda soru sorma.
- Ek hizmet teklif etme.
- "İstersen" şeklinde bitirme.
- Kullanıcının söylemediği bilgileri uydurma.
- Türkçe, doğal ve samimi konuş.

Örnekler:

Kullanıcı:
Selam hocam

Cevap:
Selam hocam.

Kullanıcı:
Bugünkü proteinim yeterli mi?

Cevap:
Yalnızca kullanıcının bugünkü protein miktarını hedefiyle karşılaştır ve kısa cevap ver.

Kullanıcı açıkça "detaylı analiz et", "program yaz", "tüm verilerimi değerlendir" veya benzeri bir talepte bulunursa daha ayrıntılı cevap verebilirsin.
`
      : `
Sen ATLAS AI Coach'sun.

Kullanıcının check-in, kilo, bel çevresi, uyku, enerji, stres, beslenme, makro, supplement, antrenman ve ilerleme kayıtlarını değerlendir.

Kurallar:
- Türkçe, net, motive edici ve gerçekçi konuş.
- Tek günlük kilo değişimine göre sert karar verme.
- Mümkün olduğunda 7 ve 14 günlük trendi dikkate al.
- Beslenme uyumunu, toparlanmayı ve antrenman performansını birlikte değerlendir.
- Eksik bilgileri uydurma.
- Tıbbi teşhis koyma.
- İlaç veya doz önerme.
- Kesin olmayan şeyleri kesinmiş gibi söyleme.
- Gereksiz uzun açıklama yapma.
- En fazla 250 kelime kullan.

Yanıt biçimi:

Durum:
Kısa genel değerlendirme.

Karar:
Bugün uygulanacak karar.

Odak:
Kullanıcının tek ana odak noktası.
`;

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
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

          reasoning: {
            effort: isChatMode ? "minimal" : "low",
          },

          max_output_tokens: isChatMode ? 500 : 1200,
        }),
      }
    );

    const rawResponseText = await openAIResponse.text();

    if (!openAIResponse.ok) {
      console.error(
        "OpenAI API error:",
        openAIResponse.status,
        rawResponseText
      );

      return NextResponse.json(
        {
          message: createReadableError(
            openAIResponse.status,
            rawResponseText
          ),
          demo: true,
        },
        { status: openAIResponse.status }
      );
    }

    let data: OpenAIResponse;

    try {
      data = JSON.parse(rawResponseText) as OpenAIResponse;
    } catch {
      console.error(
        "OpenAI response JSON parse error:",
        rawResponseText
      );

      return NextResponse.json(
        {
          message:
            "OpenAI cevap verdi ancak yanıt biçimi okunamadı.",
          demo: true,
        },
        { status: 500 }
      );
    }

    const message = extractResponseText(data);

    if (!message) {
      console.error(
        "OpenAI response contained no visible text:",
        JSON.stringify(data, null, 2)
      );

      if (
        data.status === "incomplete" &&
        data.incomplete_details?.reason ===
          "max_output_tokens"
      ) {
        return NextResponse.json(
          {
            message:
              "OpenAI cevabı token sınırında tamamlanamadı. Lütfen mesajı tekrar gönder.",
            demo: true,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          message:
            "OpenAI yanıt üretti ancak görünür metin alınamadı. CMD ekranındaki hata detayını kontrol et.",
          demo: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message,
      demo: false,
    });
  } catch (error) {
    console.error("ATLAS coach route error:", error);

    return NextResponse.json(
      {
        message:
          "Yapay zekâ isteği işlenirken teknik bir hata oluştu. CMD ekranındaki hata detayını kontrol et.",
        demo: true,
      },
      { status: 500 }
    );
  }
}

function extractResponseText(
  data: OpenAIResponse
): string | null {
  if (
    typeof data.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) {
    return null;
  }

  const texts: string[] = [];

  for (const outputItem of data.output) {
    if (!Array.isArray(outputItem.content)) {
      continue;
    }

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

  const combinedText = texts.join("\n").trim();

  return combinedText || null;
}

function createReadableError(
  status: number,
  errorText: string
): string {
  const apiMessage = extractErrorMessage(errorText);

  if (status === 400) {
    return `OpenAI isteği geçersiz bulundu: ${apiMessage}`;
  }

  if (status === 401) {
    return "OpenAI API anahtarı geçersiz veya eksik. .env.local dosyasındaki OPENAI_API_KEY değerini kontrol et.";
  }

  if (status === 403) {
    return `OpenAI erişim izni hatası: ${apiMessage}`;
  }

  if (status === 404) {
    return "Seçilen OpenAI modeli bulunamadı veya hesabının bu modele erişimi yok. .env.local içindeki OPENAI_MODEL değerini kontrol et.";
  }

  if (status === 429) {
    return "OpenAI API bakiyesi veya kullanım kotası yetersiz. OpenAI Platform Billing ve Usage bölümlerini kontrol et.";
  }

  if (status >= 500) {
    return "OpenAI sunucusunda geçici bir hata oluştu. Biraz sonra tekrar dene.";
  }

  return `OpenAI bağlantı hatası. Kod: ${status}. Detay: ${apiMessage}`;
}

function extractErrorMessage(
  errorText: string
): string {
  if (!errorText) {
    return "Teknik detay bulunamadı.";
  }

  try {
    const parsed = JSON.parse(errorText);

    const message =
      parsed?.error?.message ??
      parsed?.message ??
      errorText;

    return String(message).slice(0, 500);
  } catch {
    return errorText.slice(0, 500);
  }
}