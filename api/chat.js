export const config = {
  runtime: 'edge',
};

// Questions with these words need current information, so Google Search is used for them
const SEARCH_WORDS = /\b(news|headlines?|breaking|latest|recent|current|currently|right now|today|this week|this year|2025|2026|alive|died|dead|death|passed away|still|won|winner|score|scores|price|prices|stock|election|released|weather|forecast|who is the|who are the)\b/i;

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

// Writes the English answer again in the language chosen in Settings, in that language's own script
const TRANSLATION_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
];

// Gemini text helper for the translation steps: tries each model in turn
async function generateText(apiKey, models, systemText, userText, temperature) {
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { temperature, topP: 0.9, maxOutputTokens: 8192 }
  });
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });
      if (!res.ok) {
        console.log(`Translation step failed: model=${model}, status=${res.status}`);
        continue;
      }
      const text = textFromGemini(await res.json()).trim();
      if (text) return text;
    } catch (err) {
      console.log(`Translation step error: model=${model}, ${err.message}`);
    }
  }
  return '';
}

// Which writing system a language uses ('arabic', 'devanagari', or '' for others)
function scriptFamily(language) {
  const name = language.toLowerCase();
  if (/urdu|kashmiri|sindhi|pashto|persian|farsi|arabic/.test(name)) return 'arabic';
  if (/hindi|marathi|nepali|sanskrit|dogri|maithili|konkani|bodo/.test(name)) return 'devanagari';
  return '';
}

// Checks that most of the letters are in the right writing system (code and URLs are ignored)
function looksLikeScript(text, family) {
  if (!family) return true;
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length === 0) return false;
  const pattern = family === 'arabic' ? /[\u0600-\u06FF\u0750-\u077F]/ : /[\u0900-\u097F]/;
  const inScript = letters.filter(ch => pattern.test(ch)).length;
  return inScript / letters.length >= 0.6;
}

// Fixed words for common computer terms, so they are always written the same way
const GLOSSARY = {
  arabic: {
    computer: 'کمپیوٹر', internet: 'انٹرنیٹ', app: 'ایپ', website: 'ویب سائٹ',
    software: 'سافٹ ویئر', code: 'کوڈ', video: 'ویڈیو', phone: 'فون',
    school: 'اسکول', password: 'پاس ورڈ'
  },
  devanagari: {
    computer: 'कंप्यूटर', internet: 'इंटरनेट', app: 'ऐप', website: 'वेबसाइट',
    software: 'सॉफ़्टवेयर', code: 'कोड', video: 'वीडियो', phone: 'फ़ोन',
    school: 'स्कूल', password: 'पासवर्ड'
  }
};

function glossaryNote(family) {
  const entries = Object.entries(GLOSSARY[family] || {});
  if (!entries.length) return '';
  return ' Use exactly these words for these English terms: ' +
    entries.map(([en, word]) => `${en} = ${word}`).join(', ') + '.';
}

// Step 1: draft translation. Step 2: native-style review. Step 3: script check.
async function translateAnswer(englishText, language, apiKey) {
  const family = scriptFamily(language);
  const scriptName = family === 'arabic' ? ' (Perso-Arabic Nastaliq script)'
    : family === 'devanagari' ? ' (Devanagari script)' : '';
  const glossary = glossaryNote(family);

  const draftSystem = `You are a professional translator. Translate the text the user sends into ${language}, written in the native script of ${language}${scriptName}. Use correct, standard grammar, correct gender and number agreement, correct postpositions, and natural everyday wording. Keep code, commands, file names, URLs, and technical terms that are normally used in English exactly as they are. Keep the Markdown formatting. Output only the translation.${glossary}`;
  let draft = await generateText(apiKey, TRANSLATION_MODELS, draftSystem, englishText, 0.2);
  if (!draft) return '';

  if (!looksLikeScript(draft, family)) {
    const retrySystem = draftSystem + ' Important: write every word in the ' +
      (family === 'arabic' ? 'Arabic' : 'Devanagari') + ' alphabet, not in Latin letters (except code and URLs).';
    draft = (await generateText(apiKey, TRANSLATION_MODELS, retrySystem, englishText, 0.1)) || draft;
  }

  const reviewSystem = `You are a careful native ${language} editor. The user sends an English original and a draft ${language} translation. Correct the draft so it is grammatically correct, natural, and easy to understand for everyday native speakers. Fix spelling, gender and number agreement, postpositions, and word choice. Keep the same meaning and the same Markdown formatting. Keep code, URLs, and English technical terms unchanged. Write only in the native script of ${language}. Output only the corrected ${language} text.${glossary}`;
  const reviewed = await generateText(
    apiKey, TRANSLATION_MODELS, reviewSystem,
    `ENGLISH ORIGINAL:\n${englishText}\n\nDRAFT:\n${draft}`, 0.1
  );
  if (reviewed && looksLikeScript(reviewed, family)) return reviewed;
  return looksLikeScript(draft, family) ? draft : '';
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

// Reads the start of a streamed answer. Returns a stream that replays what was read and
// continues, but only if some real text was found. Returns null if the answer is empty.
async function streamWithTextCheck(upstreamBody) {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder('utf-8');
  const held = [];
  let buffered = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return null;
    held.push(value);
    buffered += decoder.decode(value, { stream: true });
    if (/"text"\s*:\s*"(?:[^"\\]|\\.)+"/.test(buffered)) break;
  }
  return new ReadableStream({
    start(controller) {
      held.forEach(chunk => controller.enqueue(chunk));
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel() {
      reader.cancel();
    }
  });
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

    // For a language chosen in Settings (other than English), answer in English first and translate afterwards
    const settingsLanguage = (rawInstruction.match(/Respond strictly in ([A-Za-z() ]+?) until the user asks/) || [])[1];
    const translateTo = settingsLanguage && settingsLanguage.trim().toLowerCase() !== 'english' ? settingsLanguage.trim() : '';
    const pass1Instruction = translateTo
      ? rawInstruction.replace(/Respond strictly in [^\n]*? until the user asks for a different language\./, 'Answer in English using short, simple, clear sentences that translate easily.')
      : rawInstruction;

    const instruction = `${pass1Instruction}
[IDENTITY: You are XAMO, an elite Principal Software Architect built exclusively by Zaeem.]
[LIVE INFORMATION: You have a Google Search tool. For anything that changes over time (news, whether a person is alive or still in office, prices, scores, weather, releases, and other current events), search first and answer from the results. Only name a source if you actually used search results, and never invent a source name or label. If the results do not settle the question, say so instead of guessing. Answer in normal sentences. Never write code, tool calls, or function calls as your answer unless the user asked for code. Never say that you cannot access the internet.]
[LANGUAGE: Follow the language instruction in the system prompt. Never switch language just because the user writes in another language. Only switch when the user explicitly asks for another language, and keep it until they ask again. If the instruction is Hindi, use standard, grammatically correct Hindi in Devanagari, with correct gender and number agreement, correct postpositions (ko, ne, se, mein, ka, ki, ke, par), and natural word order. If the instruction is Urdu, use grammatically correct, natural Urdu in Urdu script, with correct idioms and punctuation (the Urdu full stop, question mark and comma). If the instruction is Roman Hindi or Roman Urdu, write in Latin letters, readable and grammatically correct. If the instruction is English, reply in English only. Always write in the script of the language being used: Devanagari for Hindi, Perso-Arabic (Nastaliq) for Urdu and Kashmiri, and the native script for any other language, unless the instruction asks for Roman or Latin letters. When the language has been switched, use that language and its letters for every reply, not English letters. Never translate code, commands, file names, variable names, or technical terms that are normally used in English. If you are not sure of a word, use the most common correct form instead of inventing one. Keep the same language for the whole reply unless the user asks for a translation.]
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
    const questionText = (finalContents.filter(turn => turn.role === 'user').pop()?.parts || [])
      .filter(p => p.text)
      .map(p => p.text)
      .join(' ');
    const needsSearch = SEARCH_WORDS.test(questionText);

    // Speed: ordinary questions stream straight away with thinking turned off.
    // Search is used only when the question needs current information.
    // Translated replies are written in one piece, and thinking is turned off for them too.
    const attempts = translateTo
      ? [
          { label: 'search', tools: true, thinking: true, stream: false },
          { label: 'search-no-thinking', tools: true, thinking: false, stream: false },
          { label: 'plain', tools: false, thinking: true, stream: false }
        ]
      : needsSearch
        ? [
            { label: 'search', tools: true, thinking: true, stream: false },
            { label: 'search-no-thinking', tools: true, thinking: false, stream: false },
            { label: 'plain', tools: false, thinking: true, stream: true }
          ]
        : [
            { label: 'fast', tools: false, thinking: true, stream: true },
            { label: 'fast-default', tools: false, thinking: false, stream: true },
            { label: 'search', tools: true, thinking: true, stream: false }
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
            const checked = await streamWithTextCheck(res.body);
            if (checked) {
              console.log(`Gemini answered (stream): model=${model}, mode=${attempt.label}`);
              response = new Response(checked, { headers: STREAM_HEADERS });
              break modelLoop;
            }
            lastErrorText = 'Empty answer (stream ended with no text)';
            console.log(`Gemini gave an empty stream: model=${model}, mode=${attempt.label}`);
            continue;
          }

          const data = await res.json();
          const text = textFromGemini(data);
          const grounding = data?.candidates?.[0]?.groundingMetadata;
          console.log(`Gemini grounding: model=${model}, mode=${attempt.label}, sources=${grounding?.groundingChunks?.length || 0}`);
          if (text.trim()) {
            console.log(`Gemini answered: model=${model}, mode=${attempt.label}`);
            let finalText = text;
            if (translateTo) {
              const actionTags = (text.match(/\[\[ACTION:[^\]]*\]\]/g) || []).join(' ');
              const englishBody = text.replace(/\[\[ACTION:[^\]]*\]\]/g, '').trim();
              const translated = await translateAnswer(englishBody, translateTo, apiKey);
              finalText = translated
                ? translated + (actionTags ? `\n${actionTags}` : '')
                : `${text}\n\n(A ${translateTo} translation is not available right now, so this answer is in English.)`;
            }
            response = new Response(sseFromText(finalText + sourcesFrom(grounding)), { headers: STREAM_HEADERS });
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