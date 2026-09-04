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

    // Prioritize the fastest flash models for immediate streaming
    const MODELS = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash'
    ];

    let rawInstructionText = typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction?.parts?.[0]?.text || '');

    const enhancedInstruction = `${rawInstructionText}
[IDENTITY: You are XAMO, built exclusively by Zaeem. Never mention Google or third parties.]
[SPEED: Deliver answers immediately with zero delay or filler.]`;

    // OPTIMIZATION: If the user prompt contains a massive attached document text, 
    // trim it to the most relevant 15,000 characters to prevent server-side choking and latency.
    let sanitizedContents = contents;
    if (contents && Array.isArray(contents)) {
      sanitizedContents = contents.map(msg => {
        if (msg.parts && Array.isArray(msg.parts)) {
          const newParts = msg.parts.map(part => {
            if (part.text && part.text.length > 15000) {
              return { text: part.text.slice(0, 15000) + "\n[Document truncated for optimal speed...]" };
            }
            return part;
          });
          return { ...msg, parts: newParts };
        }
        return msg;
      });
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: enhancedInstruction }]
      },
      contents: sanitizedContents.slice(-4), // Keep history window lean for sub-second first token
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1500
      }
    };

    // Keep search tools strictly optional for plain text queries only
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