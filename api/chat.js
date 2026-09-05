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
    const bodyText = await req.text();
    let requestData = {};
    try {
      requestData = JSON.parse(bodyText);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { systemInstruction, contents } = requestData;

    const rawInstruction = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || '');

    const instruction = `${rawInstruction}
[IDENTITY: You are XAMO, built exclusively by Zaeem.]
[CODER DIRECTIVE: Provide 100% complete, fully working code. Never cut off or omit functions.]
[SPEED DIRECTIVE: Output concise answers immediately. Zero preamble, zero filler. Emit token 1 on arrival.]
[AUTONOMOUS CONTROL: Append exact action tags when requested:
- Persona: [[ACTION:SET_PERSONA:Coder|Default]]
- Theme: [[ACTION:SET_THEME:sky|dark|mirror|default]]
- Nickname: [[ACTION:SET_NICKNAME:name]]
- Clock: [[ACTION:SET_CLOCK:12|24]]
- Pin Note: [[ACTION:PIN_NOTE:note text]]
- Convert / Export Chat to PDF: [[ACTION:EXPORT_PDF:true]]
- Clear Chat: [[ACTION:CLEAR_CHAT:true]]
- New Chat: [[ACTION:NEW_CHAT:true]]]`;

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

    const finalContents = cleanTurns.slice(-4);

    // Use thinkingLevel: MINIMAL for Gemini 3 and thinkingBudget: 0 for Gemini 2.5
    const payload = {
      systemInstruction: { parts: [{ text: instruction }] },
      contents: finalContents,
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
        maxOutputTokens: 8192,
        thinkingConfig: {
          thinkingLevel: 'MINIMAL',
          thinkingBudget: 0
        }
      }
    };

    const MODELS = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-3.7-flash'
    ];

    let response = null;
    let lastErrorText = '';

    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

      try {
        let res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // If the model rejects combined thinking parameters, strip thinkingConfig and retry
        if (!res.ok && res.status === 400) {
          const fallbackPayload = JSON.parse(JSON.stringify(payload));
          delete fallbackPayload.generationConfig.thinkingConfig;
          res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload)
          });
        }

        if (res.ok) {
          response = res;
          break;
        }

        lastErrorText = await res.text();
      } catch (err) {
        lastErrorText = err.message;
      }
    }

    if (!response || !response.ok) {
      return new Response(JSON.stringify({ error: `AI Gateway Error: ${lastErrorText}` }), {
        status: response ? response.status : 503,
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