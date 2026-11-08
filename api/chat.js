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
[IDENTITY: You are XAMO, an elite Principal Software Architect built exclusively by Zaeem.]
[LIVE INFORMATION: You have a Google Search tool. For anything that changes over time (news, whether a person is alive or still in office, prices, scores, weather, releases, and other current events), search first and answer from the results. Name the sources you used. If the results do not settle the question, say so instead of guessing. Never say that you cannot access the internet.]
[STRICT CODING DIRECTIVES:
1. CODE CONTINUITY: When modifying, debugging, or extending existing code, ALWAYS preserve the exact project, game, and logic established in prior turns. NEVER replace the user's project with a generic or different template.
2. FULL COMPLETION: Output 100% complete, working code in one shot. Never truncate, omit functions, or write placeholders like '// rest of code here'.
3. KEYBOARD & LAPTOP COMPATIBILITY:
   - Always attach listeners to 'window' for web apps, and set canvas.tabIndex = 1 and canvas.focus() where needed.
   - For Python desktop apps (Tkinter/Pygame), call root.focus_force() and bind keys case-insensitively (.lower()).
   - Support both Arrow keys and WASD simultaneously.
4. ZERO DELIBERATION: Emit code immediately on arrival. Do not deliberate internally or write preambles.]
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
          // Retain up to 40,000 characters per turn so full scripts are never cut in half
          cleanParts.push({ text: part.text.slice(0, 40000) });
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

    const finalContents = cleanTurns.slice(-8);
    const systemParts = { parts: [{ text: instruction }] };

    const generation = {
      temperature: 0.0,
      topP: 0.85,
      maxOutputTokens: 8192
    };
    const searchTools = [{ google_search: {} }];

    // Tried in this order for each model. If one fails, the next is tried,
    // so a search problem or a daily search limit still returns an answer.
    const attempts = [
      {
        label: 'search',
        body: {
          systemInstruction: systemParts,
          contents: finalContents,
          generationConfig: { ...generation, thinkingConfig: { thinkingBudget: 0 } },
          tools: searchTools
        }
      },
      {
        label: 'search-no-thinking',
        body: {
          systemInstruction: systemParts,
          contents: finalContents,
          generationConfig: generation,
          tools: searchTools
        }
      },
      {
        label: 'plain',
        body: {
          systemInstruction: systemParts,
          contents: finalContents,
          generationConfig: generation
        }
      }
    ];

    const MODELS = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash'
    ];

    let response = null;
    let lastErrorText = '';

    modelLoop:
    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

      for (const attempt of attempts) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attempt.body)
          });

          if (res.ok) {
            console.log(`Gemini answered: model=${model}, mode=${attempt.label}`);
            response = res;
            break modelLoop;
          }

          lastErrorText = await res.text();
          console.log(`Gemini attempt failed: model=${model}, mode=${attempt.label}, status=${res.status}`);
        } catch (err) {
          lastErrorText = err.message;
        }
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