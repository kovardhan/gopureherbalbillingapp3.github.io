/**
 * parser.js
 * Intelligent heuristic parser for vague product text with:
 * - Product Name
 * - Count (default 1 if not specified)
 * - Quantity (weight/volume/packaging e.g. 5kg, 500g, 1L, 400g)
 * - Rate (price per count)
 * - Amount = Count * Rate
 */

export const CommonUnits = [
  // Weight
  'kg', 'kgs', 'kilo', 'kilos', 'gram', 'grams', 'gm', 'gms', 'g', 'mg',
  // Volume
  'litre', 'litres', 'liter', 'liters', 'ltr', 'ltrs', 'l', 'ml',
  // Packaging / Count / Pieces
  'packet', 'packets', 'pkt', 'pkts', 'pack', 'packs', 'pouch', 'pouches',
  'piece', 'pieces', 'pc', 'pcs', 'box', 'boxes', 'bottle', 'bottles',
  'can', 'cans', 'bag', 'bags', 'sack', 'sacks', 'dozen', 'doz', 'dz',
  'pair', 'pairs', 'bundle', 'bundles', 'strip', 'strips', 'cup', 'cups',
  'plate', 'plates', 'bar', 'bars', 'tin', 'tins', 'roll', 'rolls',
  'set', 'sets', 'carton', 'cartons', 'jar', 'jars', 'tub', 'tubs', 'nos', 'no'
];

/**
 * Parses fraction strings like "1/2", "3/4", "1 1/2" to decimal numbers.
 */
function parseFraction(str) {
  if (!str) return null;
  str = str.trim();
  if (/^\d+\s+\d+\/\d+$/.test(str)) {
    const [whole, frac] = str.split(/\s+/);
    const [num, den] = frac.split('/');
    return parseFloat(whole) + parseFloat(num) / parseFloat(den);
  }
  if (/^\d+\/\d+$/.test(str)) {
    const [num, den] = str.split('/');
    return parseFloat(num) / parseFloat(den);
  }
  const val = parseFloat(str);
  return isNaN(val) ? null : val;
}

/**
 * Parses a single line into a product item.
 * Core schema: { name, count, quantity, rate, amount }
 * Count defaults to 1 if not specified.
 */
export function parseProductLine(rawLine) {
  if (!rawLine || typeof rawLine !== 'string') return null;

  let text = rawLine.trim();
  if (!text) return null;

  // 1. Remove leading list markers like "1.", "1)", "-", "*", "•", "a)"
  text = text.replace(/^[\s\d]+[\.\)\-\:\*•]+\s*/, '');
  text = text.replace(/^[•\-\*~>]\s*/, '');
  if (!text.trim()) return null;

  let count = null;
  let quantity = '';
  let rate = null;

  // 2. Check for explicit rate or total markers:
  // e.g. "@ 55", "at 55", "/-", "/="
  const explicitRateMatch = text.match(/(?:@|\bat\b|rate[:\s]*)\s*(?:₹|rs\.?|inr|\$)?\s*([\d\.]+)/i);
  if (explicitRateMatch) {
    rate = parseFloat(explicitRateMatch[1]);
    text = text.replace(explicitRateMatch[0], ' ');
  }

  // 3. Extract Quantity with attached or adjacent unit (e.g. "5kg", "500g", "1ltr", "2.5kg", "400gm", "1/2kg")
  const sortedUnits = [...CommonUnits].sort((a, b) => b.length - a.length);
  const unitsRegexStr = sortedUnits.join('|');
  const qtyWithUnitRegex = new RegExp(`\\b(\\d+(?:\\.\\d+)?(?:\\/\\d+)?)\\s*(${unitsRegexStr})\\b`, 'i');
  const qtyUnitMatch = text.match(qtyWithUnitRegex);

  if (qtyUnitMatch) {
    const qVal = qtyUnitMatch[1];
    const uVal = qtyUnitMatch[2].toLowerCase();
    quantity = `${qVal} ${uVal}`;
    text = text.replace(qtyUnitMatch[0], ' ');
  }

  // 4. Look for currency-prefixed price: e.g. "₹250", "Rs 250", "250/-", "250/="
  const currencyMatch = text.match(/(?:₹|rs\.?|inr|\$)\s*([\d\.]+)(?:\s*\/\-|\/=)?/i) ||
                        text.match(/([\d\.]+)\s*(?:\/\-|\/=)/);
  if (currencyMatch && rate === null) {
    rate = parseFloat(currencyMatch[1]);
    text = text.replace(currencyMatch[0], ' ');
  }

  // 5. Look for standalone count prefix (e.g. "2 x Rice", "3x Colgate", "count: 2", "2 nos")
  const countPrefixMatch = text.match(/^(?:count[:\s]*)?(\d+(?:\.\d+)?)\s*[xX*]\s+/i) ||
                           text.match(/^(?:count[:\s]*)?(\d+(?:\.\d+)?)\s+(?=[a-zA-Z])/);
  if (countPrefixMatch) {
    count = parseFloat(countPrefixMatch[1]);
    text = text.replace(countPrefixMatch[0], ' ');
  }

  // 6. Tokenize remaining text to identify remaining numbers and product name
  const tokens = text.split(/[\s,;]+/).filter(t => t.trim().length > 0);
  const nameParts = [];
  const numbersFound = [];

  for (const token of tokens) {
    const fracVal = parseFraction(token);
    if (fracVal !== null) {
      numbersFound.push(fracVal);
    } else {
      nameParts.push(token);
    }
  }

  // 7. Resolve remaining numbers:
  // If rate is not found yet:
  if (rate === null) {
    if (numbersFound.length >= 2) {
      // e.g. "Rice 2 250" -> 2 is count, 250 is rate
      if (count === null) {
        count = numbersFound[0];
      }
      rate = numbersFound[numbersFound.length - 1];
    } else if (numbersFound.length === 1) {
      // Only 1 number found: it's the rate
      rate = numbersFound[0];
    }
  } else {
    // Rate was already found, any remaining number is count
    if (numbersFound.length > 0 && count === null) {
      count = numbersFound[0];
    }
  }

  // 8. Count defaults to 1 if not specified (as requested!)
  if (count === null || isNaN(count) || count <= 0) {
    count = 1;
  }

  // If rate is still not found, default to 0
  if (rate === null || isNaN(rate)) {
    rate = 0;
  }

  // If quantity was not specified, default to "1 pc" or empty
  if (!quantity) {
    quantity = '1 pc';
  }

  // 9. Format Product Name
  let name = nameParts.join(' ').trim();
  name = name.replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, '');

  if (!name) {
    name = 'Product Item';
  } else {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  // 10. Amount = Count * Rate (deterministic mathematical calculation without AI)
  const amount = Math.round((count * rate) * 100) / 100;

  return {
    id: 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
    name,
    count: Math.round(count * 100) / 100, // e.g. 1, 2, 3
    quantity: quantity,                  // e.g. "5 kg", "100 g", "1 ltr", "1 pc"
    rate: Math.round(rate * 100) / 100,  // unit price
    amount: amount                       // total = count * rate
  };
}

/**
 * Parses raw vague text into an array of product rows.
 * @param {string} rawText 
 * @returns {Array<object>}
 */
export function parseVagueText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  let lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length === 1 && (lines[0].includes(',') || lines[0].includes(';'))) {
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const parts = lines[0].split(delimiter).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      lines = parts;
    }
  }

  const items = [];
  for (const line of lines) {
    const item = parseProductLine(line);
    if (item && item.name) {
      items.push(item);
    }
  }

  return items;
}
