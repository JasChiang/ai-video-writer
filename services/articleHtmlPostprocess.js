/**
 * HTML post-processing for Gemini article output.
 *
 * Gemini doesn't always follow the HTML template exactly.
 * Three fixes applied in order:
 *   1. fixInvalidStyleColors  — LLM pastes href fragments into color values
 *   2. normalizeH2Ids         — add/deduplicate id attributes on h2 elements
 *   3. fixBrokenTocAnchors    — patch TOC href values that point nowhere
 */

/**
 * Fix style attributes where Gemini put a non-color value in the color property.
 * e.g. style="color: #section-2; font-size: 1.1em;"
 *   → style="color: #1f2937; font-size: 1.1em;"
 *
 * A valid CSS color starts with # followed by 3/4/6/8 hex digits, or is a
 * named color keyword. Anything else (like "#section-2") is replaced with
 * the fallback.
 */
export function fixInvalidStyleColors(html, fallbackColor = '#1f2937') {
  return html.replace(
    /(\bcolor\s*:\s*)(#[^;'"}\s]+)/g,
    (match, prefix, value) => {
      // Valid hex color: # followed by exactly 3, 4, 6, or 8 hex digits
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
        return match;
      }
      return `${prefix}${fallbackColor}`;
    }
  );
}

/**
 * Ensure every h2 has a unique id="section-N" attribute.
 * - h2 elements without an id get one assigned by position.
 * - h2 elements with duplicate ids get renumbered.
 */
export function normalizeH2Ids(html) {
  const seen = new Set();
  let counter = 0;

  return html.replace(/<h2([^>]*)>/gi, (match, attrs) => {
    counter++;
    const idMatch = attrs.match(/\bid\s*=\s*["']([^"']*)["']/i);
    const existingId = idMatch ? idMatch[1].trim() : null;

    if (existingId && !seen.has(existingId)) {
      seen.add(existingId);
      return match; // keep as-is
    }

    // No id or duplicate — assign section-N
    const newId = `section-${counter}`;
    seen.add(newId);

    if (existingId) {
      // Replace existing id
      return `<h2${attrs.replace(/\bid\s*=\s*["'][^"']*["']/i, `id="${newId}"`)}>`;
    }
    // Prepend id attribute
    return `<h2 id="${newId}"${attrs}>`;
  });
}

/**
 * Fix broken TOC anchor hrefs.
 * Collects all h2 ids present in the document, then for each TOC anchor
 * whose href points to a non-existent id, tries to find the right target:
 *   a) numeric mapping: href="#section-2" → find h2 with id="section-2"
 *   b) if still missing, map by TOC order (anchor N → h2 N)
 *   c) if still no match, strip the href entirely (remove the # link)
 *
 * TOC anchors are detected as <a href="#..."> inside a div that contains
 * "本文目錄" text, OR any <a href="#section-"> pattern.
 */
export function fixBrokenTocAnchors(html) {
  // Collect all h2 ids in document order
  const h2Ids = [];
  const h2IdRe = /<h2[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = h2IdRe.exec(html)) !== null) {
    h2Ids.push(m[1]);
  }

  if (h2Ids.length === 0) return html;

  const idSet = new Set(h2Ids);
  let tocLinkIndex = 0;

  return html.replace(/<a\s([^>]*href\s*=\s*["']#([^"']+)["'][^>]*)>/gi, (match, attrsBody, targetId) => {
    if (idSet.has(targetId)) return match; // valid — leave alone

    // Try to map section-N numeric index
    const numMatch = targetId.match(/^section-(\d+)$/i);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < h2Ids.length) {
        return match.replace(`#${targetId}`, `#${h2Ids[idx]}`);
      }
    }

    // Fall back to TOC order
    tocLinkIndex++;
    const fallbackIdx = tocLinkIndex - 1;
    if (fallbackIdx < h2Ids.length) {
      return match.replace(`#${targetId}`, `#${h2Ids[fallbackIdx]}`);
    }

    // No match — strip the href so it doesn't break
    return match.replace(/href\s*=\s*["']#[^"']*["']/, '');
  });
}

/**
 * Run all three fixes in order.
 * Safe to call even when article is Markdown (non-HTML) — the regexes
 * won't match anything meaningful and return the string unchanged.
 */
export function postprocessArticleHtml(html) {
  if (!html || typeof html !== 'string') return html;
  let out = fixInvalidStyleColors(html);
  out = normalizeH2Ids(out);
  out = fixBrokenTocAnchors(out);
  return out;
}
