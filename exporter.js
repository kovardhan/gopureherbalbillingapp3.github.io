/**
 * exporter.js
 * Exporting, sharing, printing, and clipboard utilities for bills.
 */

import { formatCurrency, numberToWords } from './calculator.js';

/**
 * Generates clean WhatsApp formatted text.
 */
export function generateWhatsAppMessage(billData) {
  const { store, customer, items, summary, currencySymbol = '₹' } = billData;

  const dateStr = billData.date || new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const timeStr = billData.time || new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit'
  });

  const lines = [];

  // Store Header
  lines.push(`🧾 *${(store.name || 'GO PURE HERBALS').toUpperCase()}*`);
  if (store.phone) lines.push(`📞 Ph: ${store.phone}`);
  if (store.address) lines.push(`📍 ${store.address}`);
  if (store.gstin) lines.push(`📋 GSTIN: ${store.gstin}`);

  lines.push('--------------------------------');
  lines.push(`Bill No: *${billData.billNo || '001'}*`);
  lines.push(`Date: ${dateStr} ${timeStr}`);

  // Customer Info (if present)
  if (customer.name || customer.phone || customer.address || customer.gstin) {
    lines.push('--------------------------------');
    lines.push(`*Customer Details:*`);
    if (customer.name) lines.push(`👤 ${customer.name}`);
    if (customer.phone) lines.push(`📱 ${customer.phone}`);
    if (customer.address) lines.push(`🏠 ${customer.address}`);
    if (customer.gstin) lines.push(`🏛️ GSTIN: ${customer.gstin}`);
  }

  lines.push('================================');
  lines.push(`*ITEMS (Name | Qty | Count | Rate):*`);

  items.forEach((item, idx) => {
    const itemNum = idx + 1;
    const qtyPart = item.quantity && item.quantity !== '1 pc' ? ` [${item.quantity}]` : '';
    const countPart = item.count > 1 ? ` (Qty: ${item.count})` : '';
    const ratePart = `@ ${currencySymbol}${item.rate.toFixed(2)}`;
    const amountPart = `${currencySymbol}${item.amount.toFixed(2)}`;

    lines.push(`${itemNum}. *${item.name}*${qtyPart}${countPart}`);
    lines.push(`   ${ratePart} × ${item.count} = *${amountPart}*`);
  });

  lines.push('================================');
  lines.push(`Subtotal: ${currencySymbol}${summary.subtotal.toFixed(2)}`);

  if (summary.discountAmount > 0) {
    const discLabel = summary.discountType === 'percent' ? `Discount (${summary.discountValue}%):` : 'Discount:';
    lines.push(`${discLabel} -${currencySymbol}${summary.discountAmount.toFixed(2)}`);
  }

  if (summary.taxEnabled && summary.taxAmount > 0) {
    lines.push(`GST (${summary.taxRate}%): ${currencySymbol}${summary.taxAmount.toFixed(2)}`);
  }

  if (summary.roundOff !== 0) {
    lines.push(`Round Off: ${summary.roundOff > 0 ? '+' : ''}${currencySymbol}${summary.roundOff.toFixed(2)}`);
  }

  lines.push(`*GRAND TOTAL: ${currencySymbol}${summary.grandTotal.toFixed(2)}*`);
  lines.push(`_(${numberToWords(summary.grandTotal)})_`);

  lines.push('--------------------------------');
  lines.push(store.footerNote || 'Thank you for choosing Go Pure Herbals! Stay Healthy, Stay Natural 🌿');

  return lines.join('\n');
}

/**
 * Shares bill via WhatsApp directly to customer phone or general share.
 */
export function shareToWhatsApp(billData) {
  const message = generateWhatsAppMessage(billData);
  const encoded = encodeURIComponent(message);
  
  let rawPhone = (billData.customer?.phone || '').replace(/[^0-9]/g, '');
  
  let url = '';
  if (rawPhone.length >= 10) {
    if (rawPhone.length === 10) {
      rawPhone = '91' + rawPhone;
    }
    url = `https://wa.me/${rawPhone}?text=${encoded}`;
  } else {
    url = `https://wa.me/?text=${encoded}`;
  }

  window.open(url, '_blank');
}

/**
 * Copies the formatted bill text to the clipboard.
 */
export async function copyBillToClipboard(billData) {
  const text = generateWhatsAppMessage(billData);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Native print trigger
 */
export function printReceipt() {
  window.print();
}
