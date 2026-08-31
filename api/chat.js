export const config = {
  runtime: 'edge', // Zero-latency instant token streaming
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

    // Priority order: Gemini 3.5 Flash-Lite first, with stable 3.x fallbacks
    const MODELS = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite'
    ];

    // Extract raw text or use object format
    let rawInstructionText = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || 'You are XAMO AI.');

    // Enforce live Google search behavior
    const enhancedInstruction = `${rawInstructionText}
[Search Grounding Directive: You have full access to real-time Google Search. When the user asks about current news, recent events, weather, live info, or anything after 2024, execute Google Search queries immediately and provide the latest information.]`;

    const payload = {
      systemInstruction: {
        parts: [{ text: enhancedInstruction }]
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2500
      }
    };

    // Attach Google Search Grounding when no heavy file attachments are present
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

        // If search tool fails on a model, retry once without tools
        if (!response.ok && !hasAttachment && response.status !== 429) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.tools;
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload)
          });
        }

        if (response.ok) {
          break; // Connected successfully to the active model
        } else {
          lastError = await response.text();
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!response || !response.ok) {
      return new Response(JSON.stringify({ error: `API Error: ${lastError}` }), {
        status: response ? response.status : 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Direct stream pipe to client
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