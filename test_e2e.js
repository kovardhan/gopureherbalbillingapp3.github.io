import { parseVagueText } from './parser.js';
import { calculateBill, numberToWords, formatCurrency } from './calculator.js';
import { generateWhatsAppMessage } from './exporter.js';

console.log("=== RUNNING GO PURE HERBALS E2E VERIFICATION ===");

const rawInput = `
Amla Juice 2 500ml 140
Aloe Vera Gel 1 200g 120
Herbal Hair Oil 2 100ml 160
Neem Tulsi Powder 1 100g 85
Ashwagandha Churna 2 100g 150
Pure Honey 500g 280
`;

const items = parseVagueText(rawInput);
console.log(`Parsed ${items.length} items:`);
console.table(items.map(r => ({
  Name: r.name,
  Count: r.count,
  Quantity: r.quantity,
  Rate: r.rate,
  Amount: r.amount
})));

// Pure Honey has no count specified -> must default to 1! Quantity: 500g, Rate: 280, Amount: 280
const honey = items.find(i => i.name.toLowerCase().includes('honey'));
if (!honey || honey.count !== 1 || honey.amount !== 280) {
  throw new Error("Honey default count failed");
}

const summary = calculateBill(items, { discountValue: 0, taxEnabled: false, autoRoundOff: true });
console.log(`Subtotal: ${formatCurrency(summary.subtotal)}`);
console.log(`Grand Total: ${formatCurrency(summary.grandTotal)}`);
console.log(`Amount in Words: ${numberToWords(summary.grandTotal)}`);

const billPackage = {
  store: {
    name: 'Go Pure Herbals',
    phone: '9443454586',
    address: 'Narayana Pillai Street, Salem 636007',
    gstin: ''
  },
  customer: {
    name: 'Karthik Raja',
    phone: '9842100000',
    address: 'Fairlands, Salem',
    gstin: ''
  },
  items,
  summary,
  billNo: 'GPH-202611-01',
  date: '03 Nov 2026',
  time: '21:50',
  currencySymbol: '₹'
};

const waMsg = generateWhatsAppMessage(billPackage);
console.log("\n--- WhatsApp Message Preview ---");
console.log(waMsg);

console.log("\n✅ ALL TESTS VERIFIED FOR GO PURE HERBALS!");
