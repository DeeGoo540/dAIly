import OpenAI from "openai";
import { z } from "zod";

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  detox: z.string().trim().min(1).max(800),
  good: z.string().trim().min(1).max(800),
  motto: z.string().trim().min(1).max(800),
});

const requestSchema = z.object({
  entries: z.array(entrySchema).min(3).max(30),
});

const insightSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    evidence: { type: "string" },
  },
  required: ["title", "evidence"],
  additionalProperties: false,
} as const;

const responseSchema = {
  type: "object",
  properties: {
    overview: { type: "string" },
    strengths: { type: "array", items: insightSchema },
    changes: { type: "array", items: insightSchema },
    recurringTheme: { type: "string" },
    nextStep: { type: "string" },
  },
  required: ["overview", "strengths", "changes", "recurringTheme", "nextStep"],
  additionalProperties: false,
} as const;

function demoReport(entries: z.infer<typeof entrySchema>[]) {
  const first = entries[0];
  const latest = entries.at(-1) ?? first;
  return {
    overview: `${entries.length}日分の記録には、揺れる気持ちをそのままにせず、言葉にして次の一歩へつなげようとする姿勢が一貫して表れています。まだ短い期間ですが、自分を観察する習慣そのものが、すでに大切な変化の始まりです。`,
    strengths: [
      { title: "自分を見つめる誠実さ", evidence: `${first.date}から、気持ちの良い面だけでなくモヤモヤにも丁寧に向き合っています。` },
      { title: "小さな良さを拾う力", evidence: `GOODには「${latest.good.slice(0, 38)}${latest.good.length > 38 ? "…" : ""}」と、行動を具体的に認める言葉があります。` },
    ],
    changes: [
      { title: "気持ちから行動へ", evidence: `最新のMOTTOでは「${latest.motto.slice(0, 42)}${latest.motto.length > 42 ? "…" : ""}」と、明日の行動へ視線を移せています。` },
      { title: "振り返りの継続", evidence: `${first.date}から${latest.date}まで、自分の状態を立ち止まって記録できています。` },
    ],
    recurringTheme: "自分に求める水準と、実際にできたことの間で揺れながらも、前へ進む方法を探していることが共通しています。",
    nextStep: "次の1週間は、MOTTOをさらに小さくして『5分でできる一歩』にしてみましょう。次の日のGOODで、その一歩を試せたかを優しく確認してください。",
    isDemo: true,
  };
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "成長を振り返るには、3日分以上の記録が必要です。" }, { status: 400 });
    }

    const entries = [...parsed.data.entries].sort((a, b) => a.date.localeCompare(b.date));
    if (!process.env.OPENAI_API_KEY) return Response.json(demoReport(entries));

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      store: false,
      instructions: [
        "あなたは、複数の日記を時系列で比較する日本語の振り返りパートナーです。",
        "記録に明示された事実だけを根拠にし、成長や因果関係を捏造しないでください。",
        "具体的な日付・言葉・行動を短く引用または要約し、変化が不明な場合は正直にそう伝えてください。",
        "医療的な診断や断定はせず、評価より観察を優先してください。",
        "strengthsとchangesはそれぞれ2〜3件にし、温かく落ち着いた日本語で書いてください。",
        "nextStepは負担が少なく、1週間ほど試せる行動を1つ提案してください。",
      ].join("\n"),
      input: `以下は古い順に並んだ日記です。\n\n${JSON.stringify(entries, null, 2)}`,
      text: {
        format: {
          type: "json_schema",
          name: "growth_report",
          strict: true,
          schema: responseSchema,
        },
      },
    });

    return Response.json(JSON.parse(response.output_text));
  } catch (error) {
    console.error("Growth report generation failed", error);
    return Response.json(
      { error: "今は成長レポートを作成できないようです。少し時間をおいてお試しください。" },
      { status: 500 },
    );
  }
}
