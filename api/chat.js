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
    const { systemInstruction, contents, hasAttachment } = await req.json();

    // Fastest low-latency flash models prioritized for immediate 1-sec responses
    const MODELS = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash'
    ];

    let rawInstructionText = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || '');

    const enhancedInstruction = `${rawInstructionText}
[IDENTITY DIRECTIVE: You are XAMO, an authentic, ultra-fast AI assistant created exclusively by Zaeem. Never mention Google, Gemini, or third parties.]
[SPEED DIRECTIVE: Deliver concise, lightning-fast responses immediately without unnecessary filler.]`;

    const payload = {
      systemInstruction: {
        parts: [{ text: enhancedInstruction }]
      },
      contents: contents.slice(-4), // Truncate history window for instantaneous token processing
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        maxOutputTokens: 2000 // Optimized token budget for sub-second streaming response
      }
    };

    // Enable Google Search grounding only for text queries to preserve speed on attachments
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

        // Immediate fallback retry without search tools if quota or latency limits trigger
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