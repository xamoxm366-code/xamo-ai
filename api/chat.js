export const config = {
  runtime: 'edge',
};

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*'
};

// Pulls the answer text out of a non-streaming Gemini reply (thinking parts are skipped)
function textFromGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter(p => p && p.text && !p.thought).map(p => p.text).join('');
}

// Lists the web pages Google Search used for the answer (only when search actually ran)
function sourcesFrom(grounding) {
  const chunks = (grounding?.groundingChunks || []).filter(c => c.web && c.web.uri);
  if (chunks.length === 0) return '';
  const seen = new Set();
  const lines = [];
  chunks.forEach(c => {
    if (seen.has(c.web.uri) || lines.length >= 5) return;
    seen.add(c.web.uri);
    lines.push(`- ${c.web.title || 'Web source'}: ${c.web.uri}`);
  });
  return `\n\nSources:\n${lines.join('\n')}`;
}

// Wraps a full answer in the same event format the app already reads while streaming
function sseFromText(text) {
  const event = { candidates: [{ content: { role: 'model', parts: [{ text }] } }] };
  return `data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`;
}

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

    const { systemInstruction, contents, variant } = requestData;

    const rawInstruction = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || '');

    const instruction = `${rawInstruction}
[IDENTITY: You are XAMO, an elite Principal Software Architect built exclusively by Zaeem.]
[LIVE INFORMATION: You have a Google Search tool. For anything that changes over time (news, whether a person is alive or still in office, prices, scores, weather, releases, and other current events), search first and answer from the results. Only name a source if you actually used search results, and never invent a source name or label. If the results do not settle the question, say so instead of guessing. Answer in normal sentences. Never write code, tool calls, or function calls as your answer unless the user asked for code. Never say that you cannot access the internet.]
[LANGUAGE: Follow the language instruction in the system prompt. Never switch language just because the user writes in another language. Only switch when the user explicitly asks for another language, and keep it until they ask again. If the instruction is Hindi, use standard, grammatically correct Hindi in Devanagari, with correct gender and number agreement, correct postpositions (ko, ne, se, mein, ka, ki, ke, par), and natural word order. If the instruction is Urdu, use grammatically correct, natural Urdu in Urdu script, with correct idioms and punctuation (the Urdu full stop, question mark and comma). If the instruction is Roman Hindi or Roman Urdu, write in Latin letters, readable and grammatically correct. If the instruction is English, reply in English only. Never translate code, commands, file names, variable names, or technical terms that are normally used in English. If you are not sure of a word, use the most common correct form instead of inventing one. Keep the same language for the whole reply unless the user asks for a translation.]
[MEMORY: When the user asks you to remember something about them (name, projects, preferences, goals), or tells you a lasting fact about themselves, reply naturally and add [[ACTION:REMEMBER:the fact as one short plain sentence]]. Never remember passwords, card numbers, ID numbers, or other sensitive data. Use the facts listed as 'Known about the user' only when they are relevant, and do not repeat them unless asked.]
[STRICT CODING DIRECTIVES:
1. CODE CONTINUITY: When modifying, debugging, or extending existing code, ALWAYS preserve the exact project, game, and logic established in prior turns. NEVER replace the user's project with a generic or different template.
2. FULL COMPLETION: Output 100% complete, working code in one shot. Never truncate, omit functions, or write placeholders like '// rest of code here'.
3. KEYBOARD & LAPTOP COMPATIBILITY:
   - Always attach listeners to 'window' for web apps, and set canvas.tabIndex = 1 and canvas.focus() where needed.
   - For Python desktop apps (Tkinter/Pygame), call root.focus_force() and bind keys case-insensitively (.lower()).
   - Support both Arrow keys and WASD simultaneously.
4. ZERO DELIBERATION (for coding requests only): Emit code immediately on arrival. Do not deliberate internally or write preambles.]
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
          if (validRole === 'user') {
            // The earlier question got no answer, so only the newest question is sent
            cleanTurns[cleanTurns.length - 1] = { role: 'user', parts: cleanParts };
          } else {
            cleanTurns[cleanTurns.length - 1].parts.push(...cleanParts);
          }
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
      temperature: variant === 'alt' ? 0.9 : 0.0,
      topP: 0.85,
      maxOutputTokens: 8192
    };
    const searchTools = [{ google_search: {} }];

    const buildBody = (attempt) => {
      const body = { systemInstruction: systemParts, contents: finalContents };
      body.generationConfig = attempt.thinking
        ? { ...generation, thinkingConfig: { thinkingBudget: 0 } }
        : { ...generation };
      if (attempt.tools) body.tools = searchTools;
      return body;
    };

    // Tried in this order for each model. Search answers are checked for text before
    // they are sent, so an empty answer moves on to the next option instead of
    // showing a blank reply.
    const attempts = [
      { label: 'search', tools: true, thinking: true, stream: false },
      { label: 'search-no-thinking', tools: true, thinking: false, stream: false },
      { label: 'plain', tools: false, thinking: false, stream: true }
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
      const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;

      for (const attempt of attempts) {
        const url = attempt.stream
          ? `${base}:streamGenerateContent?alt=sse&key=${apiKey}`
          : `${base}:generateContent?key=${apiKey}`;

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildBody(attempt))
          });

          if (!res.ok) {
            lastErrorText = await res.text();
            console.log(`Gemini attempt failed: model=${model}, mode=${attempt.label}, status=${res.status}`);
            continue;
          }

          if (attempt.stream) {
            console.log(`Gemini answered (stream): model=${model}, mode=${attempt.label}`);
            response = new Response(res.body, { headers: STREAM_HEADERS });
            break modelLoop;
          }

          const data = await res.json();
          const text = textFromGemini(data);
          const grounding = data?.candidates?.[0]?.groundingMetadata;
          console.log(`Gemini grounding: model=${model}, mode=${attempt.label}, sources=${grounding?.groundingChunks?.length || 0}`);
          if (text.trim()) {
            console.log(`Gemini answered: model=${model}, mode=${attempt.label}`);
            response = new Response(sseFromText(text + sourcesFrom(grounding)), { headers: STREAM_HEADERS });
            break modelLoop;
          }

          const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'none';
          lastErrorText = `Empty answer (reason: ${reason})`;
          console.log(`Gemini gave an empty answer: model=${model}, mode=${attempt.label}, reason=${reason}`);
        } catch (err) {
          lastErrorText = err.message;
        }
      }
    }

    if (!response || !response.ok) {
      console.log(`All Gemini options failed: ${lastErrorText}`);
      response = new Response(
        sseFromText('I could not get an answer just now. Please tap Regenerate to try again.'),
        { headers: STREAM_HEADERS }
      );
    }

    return new Response(response.body, { headers: STREAM_HEADERS });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}