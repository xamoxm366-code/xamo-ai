export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });
  }

  try {
    const { systemInstruction, contents, hasAttachment } = req.body;

    // Direct Gemini 3.5 Flash-Lite Endpoint
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`;

    const sendRequest = async (useSearchTool = false) => {
      const payload = {
        systemInstruction,
        contents,
        generationConfig: {
          thinkingConfig: {
            thinkingBudget: 0 // Completely disables reasoning latency for sub-second generation
          },
          temperature: 0.3,
          topP: 0.85,
          maxOutputTokens: 2048
        }
      };

      // Only attach Google Search if NO local file/document is attached
      if (useSearchTool && !hasAttachment) {
        payload.tools = [{ google_search: {} }];
      }

      return await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    };

    // If a document or photo is attached, skip web search completely for instant ~1-2s analysis
    let response = await sendRequest(!hasAttachment);

    if (response.status === 429 || !response.ok) {
      response = await sendRequest(false);
    }

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API Error: ${errText}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }

    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}