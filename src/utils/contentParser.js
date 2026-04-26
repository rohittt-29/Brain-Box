// src/utils/contentParser.js
//
// Strategy:
// ─ PDF:   text is extracted in the BROWSER (pdfExtractor.js) and sent as
//          the `pdfContent` FormData field. The server never touches pdf-parse.
//          This field is handled directly in itemController.js.
//
// ─ Links: Use a multi-layer approach that works even from datacenter IPs:
//          1. jsonlink.io  – free public OG/meta API, no key required
//          2. OpenGraph.io – free public meta API, no key required
//          3. Direct lightweight HEAD-only title scrape with strict user-agent
//          4. Silent fail → empty string (item still saved without parsed content)
//
const axios = require('axios');
const cheerio = require('cheerio');

const MAX_LENGTH = 2500;

// ── Strategy 1: jsonlink.io (free, no key) ───────────────────────────────────
async function tryJsonLink(url) {
  try {
    const endpoint = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;
    const res = await axios.get(endpoint, { timeout: 7000 });
    const d = res.data;
    const parts = [d?.title, d?.description, (d?.images || []).join(' ')].filter(Boolean);
    const text = parts.join('. ');
    if (text.length > 20) {
      console.log('[ContentParser] jsonlink.io success');
      return text.substring(0, MAX_LENGTH);
    }
  } catch (e) {
    console.warn('[ContentParser] jsonlink.io failed:', e.message);
  }
  return '';
}

// ── Strategy 2: opengraph.io (free endpoint, no auth for basic) ──────────────
async function tryOpenGraph(url) {
  try {
    const endpoint = `https://opengraph.io/api/1.1/site/${encodeURIComponent(url)}?accept_lang=auto`;
    const res = await axios.get(endpoint, { timeout: 7000 });
    const og = res.data?.openGraph || res.data?.hybridGraph || {};
    const parts = [og.title, og.description, og.site_name].filter(Boolean);
    const text = parts.join('. ');
    if (text.length > 20) {
      console.log('[ContentParser] opengraph.io success');
      return text.substring(0, MAX_LENGTH);
    }
  } catch (e) {
    console.warn('[ContentParser] opengraph.io failed:', e.message);
  }
  return '';
}

// ── Strategy 3: lightweight direct fetch (title + meta only) ─────────────────
// Only grabs the <head> section by requesting with Range header or parsing HTML
// Uses a browser-like User-Agent to reduce bot detection
async function tryDirectMeta(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 8000,
      maxContentLength: 200 * 1024, // Only read first 200KB — enough for <head>
      responseType: 'text',
    });

    const html = typeof res.data === 'string' ? res.data : '';
    // Only parse the <head> portion for speed
    const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
    const fragment = headMatch ? headMatch[0] : html.substring(0, 5000);
    const $ = cheerio.load(fragment);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      '';

    const desc =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      '';

    const combined = [title, desc].filter(Boolean).join('. ').trim();
    if (combined.length > 10) {
      console.log('[ContentParser] directMeta success');
      return combined.substring(0, MAX_LENGTH);
    }
  } catch (e) {
    console.warn('[ContentParser] directMeta failed:', e.message);
  }
  return '';
}

// ── YouTube: use free oEmbed API (no scraping, no bot detection) ─────────────
async function parseYoutube(url) {
  try {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await axios.get(oEmbedUrl, { timeout: 6000 });
    const title = res.data?.title || '';
    const author = res.data?.author_name || '';
    const combined = [title, author ? `by ${author}` : ''].filter(Boolean).join(' ');
    if (combined) {
      console.log('[ContentParser] YouTube oEmbed success');
      return combined.substring(0, MAX_LENGTH);
    }
  } catch (e) {
    console.warn('[ContentParser] YouTube oEmbed failed:', e.message);
  }
  return '';
}

// ── Main multi-strategy link parser ──────────────────────────────────────────
async function parseLink(url) {
  // YouTube gets its own dedicated path (oEmbed is always public)
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return parseYoutube(url);
  }

  // Try each strategy in order; return on first non-empty result
  const strategies = [tryJsonLink, tryDirectMeta, tryOpenGraph];
  for (const strategy of strategies) {
    const result = await strategy(url);
    if (result) return result;
  }

  console.warn('[ContentParser] All link strategies failed for:', url);
  return '';
}

// ── Main delegator ────────────────────────────────────────────────────────────
// NOTE: `pdfContent` (from browser extraction) is NOT handled here —
// itemController.js reads req.body.pdfContent directly before calling this.
async function extractContentFromItem(type, url) {
  try {
    if ((type === 'video' || type === 'link') && url) {
      return await parseLink(url);
    }
    // 'document' type: content comes from pdfContent sent by the browser
    // 'note' type: user types the content manually
  } catch (e) {
    console.warn(`[ContentParser] Failed for ${type}: ${e.message}`);
  }
  return '';
}

module.exports = { extractContentFromItem };
