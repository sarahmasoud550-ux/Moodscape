// /api/ai.js — Vercel Serverless Function (Node.js)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1) Ensure the API key exists
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is missing in Vercel env" });
  }

  // 2) Robust JSON parsing (req.body might be a string)
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { moods = [], story = "" } = body;

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            You classify emotions from free text and return EXACTLY two lines.

            VALID CATEGORIES (comma-separated): sad, anxious, stressed, overwhelmed, angry, frustrated, lonely, burned out, tired, worried.

            OUTPUT FORMAT:
            Line 1: either one or more categories (comma-separated) OR the exact word "unclear".
            Line 2:
            - If Line 1 == "unclear": write ONE short clarifying question and NOTHING else.
            - Otherwise (confident): write ONE short, supportive statement with NO questions and NO question marks.

            RULES:
            - Only output "unclear" if you truly cannot confidently map the input to the categories above.
            - When confident, do NOT include any question marks or requests for more info.
            - Keep Line 2 to ~20 words max.
            `
          },
          {
            role: "user",
            content:
`User feelings picked: ${moods.join(", ") || "(none)"}.
User text: """${story}""".

Output format:
1) First line: categories only (comma-separated, lower-case). Use EXACTLY "unclear" if you aren't sure.
2) Second line: a brief, kind response (1–2 sentences). If first line is "unclear", include ONE clarifying question.`
          }
        ],
        temperature: 0.2
      })
    });

    // 3) Bubble up useful error detail to the client
    const data = await openaiRes.json().catch(() => ({}));
    if (!openaiRes.ok) {
      console.error("OpenAI error:", data);
      const detail = data?.error?.message || JSON.stringify(data);
      return res.status(openaiRes.status).json({ error: "OpenAI error", detail });
    }

    // 4) Parse the model's 2-line output
    const raw = data.choices?.[0]?.message?.content || "";
    const [firstLine = "", ...rest] = raw.split("\n");
    const inferred = firstLine.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const aiText = rest.join("\n").trim() || "Thanks for sharing. Could you say a bit more?";

    return res.status(200).json({ inferredMoods: inferred, aiText });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
