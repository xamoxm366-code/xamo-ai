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
    const { systemInstruction, contents, hasAttachment, userPromptText } = await req.json();

    // Use the absolute lightest, lowest-latency flash-lite model for instant responses
    const MODELS = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash'
    ];

    let rawInstructionText = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || '');

    const enhancedInstruction = `${rawInstructionText}
[IDENTITY: You are XAMO, built exclusively by Zaeem. Never mention Google or third parties.]
[SPEED: Stream your response immediately with zero delay.]`;

    const payload = {
      systemInstruction: {
        parts: [{ text: enhancedInstruction }]
      },
      contents: contents.slice(-4), // Keep context minimal for lightning-fast token generation
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1500
      }
    };

    // CRITICAL: Only attach Google Search tools if there are NO attachments AND the prompt explicitly requires web info.
    // This prevents heavy search tool overhead from lagging image/video/file queries.
    const queryLower = (userPromptText || "").toLowerCase();
    const needsSearch = !hasAttachment && (
      queryLower.includes('search') || 
      queryLower.includes('news') || 
      queryLower.includes('latest') || 
      queryLower.includes('2026') || 
      queryLower.includes('current') || 
      queryLower.includes('weather') ||
      queryLower.includes('live')
    );

    if (needsSearch) {
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

        // Fallback without tools if any error occurs
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