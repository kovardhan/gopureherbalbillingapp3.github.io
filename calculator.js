/**
 * calculator.js
 * Deterministic mathematical calculation engine for bills and receipts.
 * 100% deterministic calculation with zero AI hallucination.
 * 
 * Each row: Amount = Count * Rate
 * Default Count = 1 if not specified.
 */

/**
 * Calculates a single row's total amount from count and unit rate.
 */
export function calculateRowAmount(count, rate) {
  const c = parseFloat(count) || 0;
  const r = parseFloat(rate) || 0;
  return Math.round(c * r * 100) / 100;
}

/**
 * Calculates a single row's unit rate from count and total amount.
 */
export function calculateRowRate(count, amount) {
  const c = parseFloat(count) || 0;
  const a = parseFloat(amount) || 0;
  if (c <= 0) return a;
  return Math.round((a / c) * 100) / 100;
}

/**
 * Computes all bill totals including subtotal, discounts, taxes (GST), and round-off.
 * 
 * @param {Array<object>} items Array of { count, quantity, rate, amount }
 * @param {object} settings Bill configuration settings
 * @returns {object} Summary object
 */
export function calculateBill(items, settings = {}) {
  const validItems = Array.isArray(items) ? items : [];

  // 1. Calculate raw Subtotal from each item's amount (count * rate)
  const subtotal = validItems.reduce((acc, item) => {
    const amt = parseFloat(item.amount) || 0;
    return acc + amt;
  }, 0);
  const roundedSubtotal = Math.round(subtotal * 100) / 100;

  // 2. Calculate Discount
  const discountType = settings.discountType || 'flat';
  const discountValue = parseFloat(settings.discountValue) || 0;
  let discountAmount = 0;

  if (discountValue > 0) {
    if (discountType === 'percent') {
      discountAmount = Math.round(roundedSubtotal * (discountValue / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(roundedSubtotal, discountValue);
    }
  }

  const netAfterDiscount = Math.max(0, Math.round((roundedSubtotal - discountAmount) * 100) / 100);

  // 3. Tax / GST Calculation
  const hasGSTIN = Boolean(settings.customerGstin?.trim() || settings.storeGstin?.trim());
  const applyTax = Boolean(settings.taxEnabled);
  const taxRate = applyTax ? (parseFloat(settings.taxRate) || 0) : 0;

  let taxAmount = 0;
  let cgst = 0;
  let sgst = 0;

  if (applyTax && taxRate > 0) {
    taxAmount = Math.round(netAfterDiscount * (taxRate / 100) * 100) / 100;
    cgst = Math.round((taxAmount / 2) * 100) / 100;
    sgst = Math.round((taxAmount - cgst) * 100) / 100;
  }

  // 4. Round-off
  const exactTotal = netAfterDiscount + taxAmount;
  let grandTotal = exactTotal;
  let roundOff = 0;

  if (settings.autoRoundOff) {
    grandTotal = Math.round(exactTotal);
    roundOff = Math.round((grandTotal - exactTotal) * 100) / 100;
  } else {
    grandTotal = Math.round(exactTotal * 100) / 100;
  }

  return {
    itemCount: validItems.length,
    totalCount: validItems.reduce((acc, i) => acc + (parseFloat(i.count) || 1), 0),
    subtotal: roundedSubtotal,
    discountType,
    discountValue,
    discountAmount,
    netAfterDiscount,
    taxEnabled: applyTax,
    taxRate,
    taxAmount,
    cgst,
    sgst,
    roundOff,
    grandTotal,
    hasGSTIN,
    isTaxInvoice: applyTax || hasGSTIN
  };
}

/**
 * Converts a positive number to English words.
 */
export function numberToWords(num, currencyName = 'Rupees') {
  const n = Math.round(num);
  if (isNaN(n) || n <= 0) return 'Zero ' + currencyName + ' Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tensDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(val) {
    if (val < 10) return singleDigits[val];
    if (val < 20) return teenDigits[val - 10];
    const ten = Math.floor(val / 10);
    const unit = val % 10;
    return tensDigits[ten] + (unit ? ' ' + singleDigits[unit] : '');
  }

  function convertThreeDigits(val) {
    const hundred = Math.floor(val / 100);
    const rem = val % 100;
    let res = '';
    if (hundred > 0) {
      res += singleDigits[hundred] + ' Hundred';
    }
    if (rem > 0) {
      if (res) res += ' ';
      res += convertTwoDigits(rem);
    }
    return res;
  }

  let words = '';
  let crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  let lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  let thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  let rest = rem;

  if (crore > 0) {
    words += convertTwoDigits(crore) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertTwoDigits(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertTwoDigits(thousand) + ' Thousand ';
  }
  if (rest > 0) {
    words += convertThreeDigits(rest) + ' ';
  }

  words = words.trim();
  return words ? words + ' ' + currencyName + ' Only' : 'Zero ' + currencyName + ' Only';
}

/**
 * Formats a number as a localized currency string.
 */
export function formatCurrency(amount, currencySymbol = '₹') {
  const val = parseFloat(amount) || 0;
  const formatted = val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${currencySymbol}${formatted}`;
}
