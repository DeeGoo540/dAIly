import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  detox: z.string().trim().min(1).max(800),
  good: z.string().trim().min(1).max(800),
  motto: z.string().trim().min(1).max(800),
});

const responseSchema = {
  type: "object",
  properties: {
    affirmation: { type: "string" },
    perspective: { type: "string" },
    tomorrowAction: { type: "string" },
  },
  required: ["affirmation", "perspective", "tomorrowAction"],
  additionalProperties: false,
} as const;

function demoReflection(good: string, motto: string) {
  const goodSummary = good.length > 45 ? `${good.slice(0, 45)}…` : good;
  const mottoSummary = motto.length > 45 ? `${motto.slice(0, 45)}…` : motto;
  return {
    affirmation: `今日のあなたは、「${goodSummary}」と自分の良さをきちんと見つけられました。うまくいかなかったことだけでなく、自分が前へ進んだ瞬間にも目を向けられるのは、静かで確かな強さです。`,
    perspective: "モヤモヤを言葉にできた時点で、もう心の整理は始まっています。全部を今日中に解決しなくても大丈夫です。感情は答えを急かすものではなく、あなたが大切にしたいことを教えてくれるサインでもあります。",
    tomorrowAction: `「${mottoSummary}」を、明日は完璧ではなく“少しだけ”試してみましょう。できたかどうかより、やってみようと思えた自分を見つけることが、次の一歩につながります。`,
    isDemo: true,
  };
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "3つの項目を入力してから、もう一度お試しください。" }, { status: 400 });
    }

    const { date, detox, good, motto } = parsed.data;
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(demoReflection(good, motto));
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      store: false,
      instructions: [
        "あなたは、1日の終わりにそっと寄り添う日本語の日記パートナーです。",
        "ユーザーの感情を否定・診断せず、具体的に認め、温かく落ち着いた言葉で返してください。",
        "DETOX、GOOD、MOTTOのすべてに触れ、過度に大げさな称賛や説教は避けてください。",
        "明日の提案は負担の少ない、現実的な行動を1つに絞ってください。",
        "医療・法律・金融上の専門的判断はせず、危機が示唆される場合は安全確保と身近な人・地域の緊急窓口への相談を優先してください。",
      ].join("\n"),
      input: `日付: ${date}\n\nDETOX:\n${detox}\n\nGOOD:\n${good}\n\nMOTTO:\n${motto}`,
      text: {
        format: {
          type: "json_schema",
          name: "daily_reflection",
          strict: true,
          schema: responseSchema,
        },
      },
    });

    const reflection = JSON.parse(response.output_text) as {
      affirmation: string;
      perspective: string;
      tomorrowAction: string;
    };
    return Response.json(reflection);
  } catch (error) {
    console.error("Reflection generation failed", error);
    return Response.json(
      { error: "今は言葉を届けられないようです。少し時間をおいて、もう一度お試しください。" },
      { status: 500 },
    );
  }
}
