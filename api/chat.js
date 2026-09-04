export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured in Vercel.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const { systemInstruction, contents } = await req.json();

    const rawInstruction = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || '');

    const instruction = `${rawInstruction}
[IDENTITY: You are XAMO, built exclusively by Zaeem.]
[SPEED DIRECTIVE: Answer directly and concisely. Zero preamble, zero filler. Output token 1 immediately.]
[AUTONOMOUS CONTROL: Append exact action tags when requested:
- Persona: [[ACTION:SET_PERSONA:Coder|Default]]
- Theme: [[ACTION:SET_THEME:sky|dark|mirror|default]]
- Nickname: [[ACTION:SET_NICKNAME:name]]
- Clock: [[ACTION:SET_CLOCK:12|24]]
- Pin Note: [[ACTION:PIN_NOTE:note text]]
- Convert / Export Chat to PDF: [[ACTION:EXPORT_PDF:true]]
- Clear Chat: [[ACTION:CLEAR_CHAT:true]]
- New Chat: [[ACTION:NEW_CHAT:true]]]`;

    // Multi-turn cleanup
    const cleanTurns = [];
    (contents || []).forEach(msg => {
      const validRole = msg.role === 'model' ? 'model' : 'user';
      const cleanParts = [];

      (msg.parts || []).forEach(part => {
        if (part.inline_data) {
          cleanParts.push({
            inlineData: {
              mimeType: part.inline_data.mime_type || part.inline_data.mimeType,
              data: part.inline_data.data
            }
          });
        } else if (part.text && part.text.trim().length > 0) {
          cleanParts.push({ text: part.text.slice(0, 3000) });
        }
      });

      if (cleanParts.length > 0) {
        if (cleanTurns.length > 0 && cleanTurns[cleanTurns.length - 1].role === validRole) {
          cleanTurns[cleanTurns.length - 1].parts.push(...cleanParts);
        } else {
          cleanTurns.push({ role: validRole, parts: cleanParts });
        }
      }
    });

    while (cleanTurns.length > 0 && cleanTurns[0].role !== 'user') {
      cleanTurns.shift();
    }

    const payload = {
      systemInstruction: { parts: [{ text: instruction }] },
      contents: cleanTurns.slice(-3),
      generationConfig: {
        temperature: 0.0,
        topP: 0.8,
        maxOutputTokens: 1024
      }
    };

    const MODELS = [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash'
    ];

    const abortControllers = MODELS.map(() => new AbortController());

    // Parallel hot-swap race: query both models at the exact same millisecond
    const fetchPromises = MODELS.map(async (model, idx) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortControllers[idx].signal
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${model} failed: ${err}`);
      }
      return { res, idx };
    });

    // Promise.any resolves immediately with the first successful 200 OK stream
    const { res: winnerRes, idx: winnerIdx } = await Promise.any(fetchPromises);

    // Cancel the slower connection
    abortControllers.forEach((ctrl, idx) => {
      if (idx !== winnerIdx) ctrl.abort();
    });

    return new Response(winnerRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'All models busy or unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}