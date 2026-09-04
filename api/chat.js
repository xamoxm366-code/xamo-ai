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
[SPEED DIRECTIVE: Zero preamble, zero internal reasoning, zero greetings. Emit token 1 instantly.]
[AUTONOMOUS CONTROL: Append exact action tags when requested:
- Persona: [[ACTION:SET_PERSONA:Coder|Default]]
- Theme: [[ACTION:SET_THEME:sky|dark|mirror|default]]
- Nickname: [[ACTION:SET_NICKNAME:name]]
- Clock: [[ACTION:SET_CLOCK:12|24]]
- Pin Note: [[ACTION:PIN_NOTE:note text]]
- Convert / Export Chat to PDF: [[ACTION:EXPORT_PDF:true]]
- Clear Chat: [[ACTION:CLEAR_CHAT:true]]
- New Chat: [[ACTION:NEW_CHAT:true]]]`;

    // Strict multi-turn normalization: eliminates alternating-role validation stalls
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
          // Lean slice prevents heavy context evaluation lag
          cleanParts.push({ text: part.text.slice(0, 4000) });
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

    // Keep history lean (last 3 turns) for sub-second generation
    const finalContents = cleanTurns.slice(-3);

    const payload = {
      systemInstruction: {
        parts: [{ text: instruction }]
      },
      contents: finalContents,
      generationConfig: {
        temperature: 0.0, // Greedy decoding: selects top token instantly with zero sampling hesitation
        topP: 0.8,
        maxOutputTokens: 1024
      }
    };

    // Direct single-shot route: no loop, no retry penalty
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      const lastError = await response.text();
      return new Response(JSON.stringify({ error: `AI Service Error: ${lastError}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}