# ⚡ QuickBill - Mobile Bill Generator

A mobile-first billing generator web application. Paste unstructured/vague text containing product information, and QuickBill automatically parses it into editable rows, calculates totals mathematically (100% deterministic, zero AI intervention), and generates a clean, minimal bill.

---

## 🎯 Core Information Structure

The parser and editable table are tailored around the 4 core product attributes:
1. **Name of the product** (e.g. `Rice`, `Sugar`, `Sunflower oil`, `Colgate`)
2. **Count** (e.g. `1`, `2`, `4` — **defaults to `1` if not specified in text**)
3. **Quantity** (e.g. `5kg`, `2kg`, `1ltr`, `100g`, `400g`, `1 pc`)
4. **Rate** (Unit price / rate per count)

### 🧮 Deterministic Math:
- **`Amount = Count × Rate`** (automatically computed)
- Editing `Count` or `Rate` recalculates `Amount = Count × Rate`
- Editing `Amount` directly recalculates `Rate = Amount ÷ Count`
- Grand Total = `Subtotal - Discount + Tax ± Round Off` (computed without AI hallucination)

---

## 📱 Mobile-First Features

- **Messy & Vague Text Parser**: Paste raw text from WhatsApp messages, notes, SMS, or informal lists:
  ```
  Rice 1 5kg 250
  Sugar 2kg 90
  Sunflower oil 2 1ltr 160
  Colgate 100g 55
  Bread 2 400g 45
  Maggie 4 14
  ```
- **Editable Product Cards**: Touch-optimized rows for **Name**, **Count**, **Quantity**, **Rate**, and **Total Amount**.
- **Optional Details (GSTIN, Phone, Address)**:
  - **General Cash Memo**: When GSTIN is left blank, generates a clean general bill with no tax columns or blank placeholders.
  - **Tax Invoice**: When GSTIN is provided, automatically upgrades to a formal Tax Invoice showing GSTIN and CGST/SGST breakdowns.
- **Two Bill View Styles**:
  1. **📄 Modern Clean Bill**: Minimalist card style.
  2. **🧾 Thermal POS Receipt**: Monospace 58mm/80mm supermarket receipt style.
- **1-Tap Mobile Actions**:
  - **🟢 WhatsApp Share**: Formats the bill and opens directly to chat with the customer.
  - **🖨️ Print / Save PDF**: Dedicated `@media print` stylesheet prints clean receipts.
  - **📋 Copy Text**: Instant clipboard copy.
- **Offline & PWA Ready**: Installable to home screen on iOS and Android.

---

## 🚀 How to Run

### Option 1: Open Directly in Browser
Open [`index.html`](file:///C:/Users/Admin/.gemini\antigravity\scratch\mobile-bill-generator\index.html) directly in any browser.

### Option 2: Test on Your Mobile Phone via Local Wi-Fi
1. Run in PowerShell:
   ```bash
   node server.js
   ```
2. Open the displayed URL (`http://<your-ip>:3000`) on your mobile phone connected to the same Wi-Fi.
