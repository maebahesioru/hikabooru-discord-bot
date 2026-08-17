// LLM 回答生成 (opencode-go / OpenAI互換API)
const API_BASE = process.env.LLM_API_BASE || "https://opencode.ai/zen/go/v1";
const API_KEY = process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "deepseek-v4-flash";

export async function generateReply(userText: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("LLM_API_KEY not set");
  }
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "あなたはhikabooruという画像投稿サイトの公式botです。" +
            "性格は軽妙で親しみやすく、ヒカマー語録をたまに織り交ぜます。" +
            "ユーザーのメッセージに沿って、簡潔に（2〜3文で）日本語で返答してください。" +
            "URLは含めないでください。絵文字は使ってよい。",
        },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM API error: ${res.status} ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content || "";
  return content.trim();
}
