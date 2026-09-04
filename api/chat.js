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

    let rawInstruction = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || '');

    const instruction = `${rawInstruction}
[IDENTITY: You are XAMO, built exclusively by Zaeem.]
[OUTPUT: Start responding immediately on token 1. Be concise, direct, and fast.]
[AUTONOMOUS CONTROL: You have direct autonomous control over XAMO. When the user naturally asks to perform any of the following tasks in conversation, confirm warmly and APPEND the exact tag at the end of your response:
- Persona: [[ACTION:SET_PERSONA:Coder|Default]]
- Theme: [[ACTION:SET_THEME:sky|dark|mirror|default]]
- Nickname: [[ACTION:SET_NICKNAME:name]]
- Clock: [[ACTION:SET_CLOCK:12|24]]
- Pin Note: [[ACTION:PIN_NOTE:note content to pin]]
- Convert / Export Chat to PDF: [[ACTION:EXPORT_PDF:true]]
- Clear Current Chat: [[ACTION:CLEAR_CHAT:true]]
- Start New Chat: [[ACTION:NEW_CHAT:true]]]`;

    const sanitizedContents = (contents || []).slice(-3).map(msg => ({
      role: msg.role,
      parts: (msg.parts || []).map(part => {
        if (part.text && part.text.length > 8000) {
          return { text: part.text.slice(0, 8000) + "\n[Content truncated for instant response]" };
        }
        return part;
      })
    }));

    const payload = {
      systemInstruction: { parts: [{ text: instruction }] },
      contents: sanitizedContents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `API Error: ${errText}` }), {
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