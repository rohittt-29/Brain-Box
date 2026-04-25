// src/utils/contentParser.js
const pdfParse = require('pdf-parse'); // v1.1.1 — exports directly as a function
const cheerio = require('cheerio');
const axios = require('axios');

// Limit the extracted content to 2500 characters to map successfully into our local embeddings
const MAX_LENGTH = 2500;

async function parsePDF(buffer) {
  try {
    if (!pdfParse) {
      console.warn('[ContentParser] pdf-parse not available (export issue), skipping PDF extraction');
      return '';
    }
    const data = await pdfParse(buffer);
    if (data && data.text) {
      return data.text.substring(0, MAX_LENGTH).replace(/\n/g, ' ').trim();
    }
    return '';
  } catch (error) {
    console.error('Error parsing PDF:', error.message);
    return '';
  }
}

// Scrapes YouTube page HTML to extract video description and title from meta tags
// No API key needed — uses public YouTube page metadata
async function parseYoutube(url) {
  try {
    // 1. Get video title + description from YouTube's free oEmbed API
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    let oEmbedTitle = '';
    try {
      const oEmbedRes = await axios.get(oEmbedUrl, { timeout: 5000 });
      oEmbedTitle = oEmbedRes.data?.title || '';
    } catch (_) {}

    // 2. Scrape the YouTube page HTML for the meta description
    const pageRes = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const $ = cheerio.load(pageRes.data);

    // Extract meta description tag — YouTube puts the video description here
    const metaDesc =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    // Combine title + description into one rich content string
    const combined = [oEmbedTitle, metaDesc].filter(Boolean).join('. ');
    if (combined) {
      console.log('[ContentParser] YouTube metadata scraped successfully');
      return combined.substring(0, MAX_LENGTH).trim();
    }
    return '';
  } catch (error) {
    console.error('Error scraping YouTube page:', error.message);
    return '';
  }
}

async function parseWebpage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 6000 // 6 seconds timeout
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, noscript, nav, footer, header').remove();
    
    // Extract text from paragraphs and headings mainly
    let content = '';
    $('p, h1, h2, h3, h4, h5, h6, article, section').each((i, el) => {
      let text = $(el).text().trim();
      if (text) {
        content += text + ' ';
      }
    });

    // Clean up excessive whitespace
    content = content.replace(/\s+/g, ' ').trim();
    return content.substring(0, MAX_LENGTH);
  } catch (error) {
    console.error('Error parsing Webpage:', error.message);
    return '';
  }
}

// Main delegator function
async function extractContentFromItem(type, url, fileBuffer) {
  let extractedContent = '';
  try {
    if (type === 'document' && fileBuffer) {
      extractedContent = await parsePDF(fileBuffer);
      console.log(`[ContentParser] Extracted ${extractedContent.length} chars from PDF`);
    } else if ((type === 'video' || type === 'link') && url) {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        extractedContent = await parseYoutube(url);
        console.log(`[ContentParser] Extracted ${extractedContent.length} chars from YouTube`);
      } else {
        extractedContent = await parseWebpage(url);
        console.log(`[ContentParser] Extracted ${extractedContent.length} chars from Web HTML`);
      }
    }
  } catch (e) {
    console.warn(`[ContentParser] Failed to extract from ${type}: ${e.message}`);
  }
  return extractedContent;
}

module.exports = {
  extractContentFromItem
};
