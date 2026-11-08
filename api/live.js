// api/live.js: free live information for XAMO (no API keys, no billing)
// Put this file inside your project's "api" folder, next to chat.js.

const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function readTag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return '';
  return decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
}

async function getNews(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, { headers: { 'User-Agent': 'XAMO-AI/1.0' } });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, 8).map(item => {
    const rawTitle = readTag(item, 'title');
    const source = readTag(item, 'source');
    // Google appends " - Source Name" to every headline; remove it, the source is listed separately
    const title = source && rawTitle.endsWith(' - ' + source)
      ? rawTitle.slice(0, -(source.length + 3))
      : rawTitle;
    return { title, source, link: readTag(item, 'link'), published: readTag(item, 'pubDate') };
  });
}

async function getWeather(place) {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`);
  const geo = await geoRes.json();
  const hit = geo.results && geo.results[0];
  if (!hit) return null;

  const fcRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`
  );
  const fc = await fcRes.json();
  const c = fc.current || {};
  const u = fc.current_units || {};
  return {
    place: [hit.name, hit.admin1, hit.country].filter(Boolean).join(', '),
    temperature: c.temperature_2m,
    temperatureUnit: u.temperature_2m || '°C',
    humidity: c.relative_humidity_2m,
    wind: c.wind_speed_10m,
    windUnit: u.wind_speed_10m || 'km/h',
    observed: c.time
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const q = String(req.query?.q || '').trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: 'Missing question' });

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return res.status(200).json(cached.data);

  try {
    const stamp = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'short' });
    const wantsWeather = /\b(weather|forecast)\b/i.test(q);
    const wantsNews = /\b(news|headlines?|breaking|happening|latest|recent|current|right now|this week|today|update)\b/i.test(q);

    const lines = [];

    if (wantsWeather) {
      const placeMatch = q.match(/\b(?:weather|forecast)\s+(?:in|at|for)\s+([a-z][a-z .,'-]{1,60})/i);
      if (placeMatch) {
        const weather = await getWeather(placeMatch[1].trim());
        if (weather) {
          lines.push(
            `Weather now in ${weather.place}: ${weather.temperature} ${weather.temperatureUnit}, ` +
            `humidity ${weather.humidity}%, wind ${weather.wind} ${weather.windUnit} ` +
            `(observed ${weather.observed}, source: Open-Meteo).`
          );
        }
      }
    }

    if (wantsNews || !wantsWeather) {
      const news = await getNews(q);
      if (news.length) {
        lines.push('Recent news headlines (source: Google News):');
        news.forEach((n, i) => {
          lines.push(`${i + 1}. ${n.title} | ${n.source || 'unknown source'} | ${n.published} | ${n.link}`);
        });
      }
    }

    if (lines.length === 0) {
      const empty = { context: '', fetchedAt: stamp };
      cache.set(cacheKey, { at: Date.now(), data: empty });
      return res.status(200).json(empty);
    }

    const data = {
      context:
        `LIVE WEB CONTEXT (fetched just now, ${stamp} UTC). Use it to answer the user's latest question. ` +
        `Name the sources and include their links. If this context does not cover the question, say so instead of guessing.\n` +
        lines.join('\n') +
        `\n--- END OF LIVE WEB CONTEXT ---`,
      fetchedAt: stamp
    };
    cache.set(cacheKey, { at: Date.now(), data });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(200).json({ context: '', error: 'Live sources are unavailable right now' });
  }
}