export const config = {
  runtime: 'edge', // Instant edge worker execution
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
    const { systemInstruction, contents, hasAttachment, userPromptText } = await req.json();

    // Strictly Gemini 3 and 3.5 series
    const MODELS = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3-flash'
    ];

    let rawInstructionText = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || 'You are XAMO AI created by Zaeem.');

    const enhancedInstruction = `${rawInstructionText}
[Search Grounding Directive: Real-time Google Search is enabled. The current year is 2026. For any queries regarding current events, news, live updates, dates, or recent facts, you must execute Google Search to deliver accurate, up-to-date information.]`;

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

    // Attach Google Search Grounding for real-time browsing
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

        // Fallback retry without search tools if the grounding quota fails
        if (payload.tools && response.status !== 429) {
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