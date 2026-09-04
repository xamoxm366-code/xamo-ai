export const config = {
  runtime: 'edge', // Ultra-fast edge worker execution
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
    const { systemInstruction, contents, hasAttachment } = await req.json();

    // STRICTLY Gemini 3.5 and 3 series endpoints only
    const MODELS = [
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-pro'
    ];

    let rawInstructionText = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || '');

    const enhancedInstruction = `${rawInstructionText}
[IDENTITY DIRECTIVE: You are XAMO, an authentic, fast, and helpful AI assistant created exclusively by Zaeem. You are powered by XAMO's proprietary neural engine. You must NEVER claim or imply that you are built by Google, Gemini, OpenAI, or any third party. If asked who you are, state proudly that you are XAMO created by Zaeem.]

[SEARCH GROUNDING DIRECTIVE: Live real-time Google Search is enabled. The current year is 2026. Whenever the user asks about current facts, events, dates, live news, or real-time information, execute search to give accurate, grounded answers.]

[AUTONOMOUS APP CONTROL DIRECTIVE: You possess direct autonomous control over the user's preferences. Whenever the user naturally asks to change settings, themes, formats, languages, or manage accounts in plain conversation, warmly confirm the change and APPEND the corresponding action tag at the very end of your response:
- Change Nickname: [[ACTION:SET_NICKNAME:newName]]
- Change Theme: [[ACTION:SET_THEME:sky|dark|mirror|default]]
- Change Clock: [[ACTION:SET_CLOCK:12|24]]
- Change Language: [[ACTION:SET_LANG:languageName]]
- Switch Account: [[ACTION:SWITCH_ACCOUNT:userEmail]]
- Remove Account: [[ACTION:REMOVE_ACCOUNT:userEmail]]
- Clear / New Chat: [[ACTION:NEW_CHAT:true]]]`;

    const payload = {
      systemInstruction: {
        parts: [{ text: enhancedInstruction }]
      },
      contents: contents.slice(-6),
      generationConfig: {
        temperature: 0.6,
        topP: 0.95,
        maxOutputTokens: 2500
      }
    };

    // Attach real-time Google Search grounding
    if (!hasAttachment) {
      payload.tools = [{ googleSearch: {} }];
    }

    let response = null;
    let lastError = '';

    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) break;

        // Fallback retry without search tools if the search grounding tool triggers an API quota limit
        if (payload.tools) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.tools;
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload)
          });
          if (response.ok) break;
        }

        lastError = await response.text();
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!response || !response.ok) {
      return new Response(JSON.stringify({ error: `AI Service Error: ${lastError}` }), {
        status: response ? response.status : 500,
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