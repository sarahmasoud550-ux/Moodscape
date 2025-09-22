// /api/ai.js  — Vercel Serverless Function (Node.js)
// Runs on Vercel automatically when your site calls /api/ai

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { moods = [], story = "" } = req.body || {};

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
            content:
        `You classify emotions from free text and write one short, supportive message.
        Valid categories (comma-separated): sad, anxious, stressed, overwhelmed, angry, frustrated, lonely, burned out, tired, worried.
        If you cannot confidently map the input, return "unclear" as the ONLY category on the first line, and on the second line ask ONE specific clarifying question (e.g., "Could you share what's been weighing on you most — sleep, studies, or relationships?").`
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

    const data = await openaiRes.json();
    if (!openaiRes.ok) {
      console.error("OpenAI error:", data);
      return res.status(500).json({ error: "AI request failed" });
    }

    const raw = data.choices?.[0]?.message?.content || "";
    const [firstLine = "", ...rest] = raw.split("\n");
    const inferred = firstLine
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    const aiText = rest.join("\n").trim() || "Thanks for sharing. Could you say a bit more?";

    return res.status(200).json({
      inferredMoods: inferred,
      aiText
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
