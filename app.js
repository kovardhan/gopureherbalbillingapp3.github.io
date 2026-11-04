/**
 * app.js
 * Main controller and reactive state manager for QuickBill Mobile.
 * Core Item Structure: Name, Count (default 1), Quantity, Rate -> Amount = Count * Rate
 */

import { parseVagueText } from './parser.js';
import { calculateBill, calculateRowAmount, calculateRowRate, formatCurrency, numberToWords } from './calculator.js';
import { Presets } from './presets.js';
import { shareToWhatsApp, copyBillToClipboard, printReceipt } from './exporter.js';

class QuickBillApp {
  constructor() {
    const savedName = localStorage.getItem('qb_store_name');
    const storeName = (!savedName || savedName === 'Quick Mart') ? 'Go Pure Herbals' : savedName;
    const storePhone = localStorage.getItem('qb_store_phone') || '9443454586';
    const storeAddress = localStorage.getItem('qb_store_address') || 'Narayana Pillai Street, Salem 636007';

    this.state = {
      activeTab: 'pane-input',
      currency: localStorage.getItem('qb_currency') || '₹',
      theme: localStorage.getItem('qb_theme') || 'light',
      billStyle: 'paper', // 'paper' | 'thermal'
      items: [],
      store: {
        name: storeName,
        phone: storePhone,
        address: storeAddress,
        gstin: localStorage.getItem('qb_store_gstin') || ''
      },
      customer: {
        name: '',
        phone: '',
        address: '',
        gstin: ''
      },
      billNo: this.generateBillNo(),
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      discountValue: 0,
      discountType: 'flat',
      taxRate: 0,
      taxEnabled: false,
      autoRoundOff: true
    };

    this.initDOM();
    this.bindEvents();
    this.renderPresets();
    this.applyTheme(this.state.theme);
    this.applyCurrency(this.state.currency);
    this.restoreStoreInputs();
    this.updateCalculation();
  }

  generateBillNo() {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return 'BILL-' + randomSuffix;
  }

  initDOM() {
    // Navigation
    this.tabBtns = document.querySelectorAll('.step-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane');
    
    // Step 1: Input
    this.rawTextInput = document.getElementById('raw-text-input');
    this.btnParse = document.getElementById('btn-parse-text');
    this.presetsContainer = document.getElementById('presets-container');
    
    // Step 2: Items View
    this.itemsContainer = document.getElementById('items-container');
    this.itemCountBadge = document.getElementById('item-count-badge');
    this.btnAddItem = document.getElementById('btn-add-item');
    this.btnClearItems = document.getElementById('btn-clear-items');
    this.btnGenerateBill = document.getElementById('btn-generate-bill');

    // Optional Details Accordion
    this.accordionToggle = document.getElementById('accordion-toggle');
    this.accordion = document.getElementById('optional-accordion');
    this.optionalBadge = document.getElementById('optional-status-badge');
    this.storeNameInput = document.getElementById('store-name');
    this.storePhoneInput = document.getElementById('store-phone');
    this.storeGstinInput = document.getElementById('store-gstin');
    this.storeAddressInput = document.getElementById('store-address');
    this.customerNameInput = document.getElementById('customer-name');
    this.customerPhoneInput = document.getElementById('customer-phone');
    this.customerGstinInput = document.getElementById('customer-gstin');
    this.customerAddressInput = document.getElementById('customer-address');
    this.billNumberInput = document.getElementById('bill-number');

    // Discounts & Taxes
    this.discountValInput = document.getElementById('discount-val');
    this.discountTypeSelect = document.getElementById('discount-type');
    this.taxRateSelect = document.getElementById('tax-rate-select');
    this.roundOffToggle = document.getElementById('round-off-toggle');

    // Summary in Step 2
    this.summarySubtotal = document.getElementById('summary-subtotal');
    this.summaryDiscountRow = document.getElementById('summary-discount-row');
    this.summaryDiscount = document.getElementById('summary-discount');
    this.summaryTaxRow = document.getElementById('summary-tax-row');
    this.summaryTaxLabel = document.getElementById('summary-tax-label');
    this.summaryTax = document.getElementById('summary-tax');
    this.summaryRoundoffRow = document.getElementById('summary-roundoff-row');
    this.summaryRoundoff = document.getElementById('summary-roundoff');
    this.summaryGrandTotal = document.getElementById('summary-grandtotal');

    // Sticky Bottom Bar
    this.barTotalAmount = document.getElementById('bar-total-amount');
    this.btnBarAction = document.getElementById('btn-bar-action');

    // Step 3: Bill View
    this.billWrap = document.getElementById('bill-container-wrap');
    this.billCard = document.getElementById('bill-render-card');
    this.btnStylePaper = document.getElementById('btn-style-paper');
    this.btnStyleThermal = document.getElementById('btn-style-thermal');
    this.btnShareWhatsApp = document.getElementById('btn-share-whatsapp');
    this.btnPrintBill = document.getElementById('btn-print-bill');
    this.btnCopyBill = document.getElementById('btn-copy-bill');
    this.btnEditItemsBack = document.getElementById('btn-edit-items-back');
    this.btnResetAll = document.getElementById('btn-reset-all');

    // Theme & Currency
    this.currencySelect = document.getElementById('currency-select');
    this.themeToggle = document.getElementById('theme-toggle');
    this.toast = document.getElementById('toast');
    this.toastText = document.getElementById('toast-text');
  }

  bindEvents() {
    // Step Navigation
    this.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Parse button
    this.btnParse.addEventListener('click', () => this.handleParseText());

    // Item List Actions
    this.btnAddItem.addEventListener('click', () => this.addNewEmptyItem());
    this.btnClearItems.addEventListener('click', () => {
      if (confirm('Clear all items?')) {
        this.state.items = [];
        this.renderItemsList();
        this.updateCalculation();
        this.showToast('All items cleared');
      }
    });

    // Generate Bill
    this.btnGenerateBill.addEventListener('click', () => {
      if (this.state.items.length === 0) {
        this.showToast('Please add at least one product');
        return;
      }
      this.renderBillView();
      this.switchTab('pane-bill');
    });

    // Accordion Toggle
    this.accordionToggle.addEventListener('click', () => {
      this.accordion.classList.toggle('open');
    });

    // Store & Customer Inputs
    const syncOptional = () => {
      this.state.store.name = this.storeNameInput.value.trim() || 'Go Pure Herbals';
      this.state.store.phone = this.storePhoneInput.value.trim() || '9443454586';
      this.state.store.gstin = this.storeGstinInput.value.trim().toUpperCase();
      this.state.store.address = this.storeAddressInput.value.trim() || 'Narayana Pillai Street, Salem 636007';

      this.state.customer.name = this.customerNameInput.value.trim();
      this.state.customer.phone = this.customerPhoneInput.value.trim();
      this.state.customer.gstin = this.customerGstinInput.value.trim().toUpperCase();
      this.state.customer.address = this.customerAddressInput.value.trim();
      this.state.billNo = this.billNumberInput.value.trim() || this.generateBillNo();

      // Persist store settings
      localStorage.setItem('qb_store_name', this.state.store.name);
      localStorage.setItem('qb_store_phone', this.state.store.phone);
      localStorage.setItem('qb_store_gstin', this.state.store.gstin);
      localStorage.setItem('qb_store_address', this.state.store.address);

      // Check if GST is entered
      const hasGstin = Boolean(this.state.store.gstin || this.state.customer.gstin);
      if (hasGstin) {
        this.optionalBadge.textContent = 'Tax Invoice (GST)';
        this.optionalBadge.style.color = 'var(--primary)';
        this.optionalBadge.style.background = 'var(--primary-light)';
        if (this.taxRateSelect.value === '0') {
          this.taxRateSelect.value = '5';
          this.state.taxRate = 5;
          this.state.taxEnabled = true;
        }
      } else {
        this.optionalBadge.textContent = 'General Bill';
        this.optionalBadge.style.color = 'var(--text-muted)';
        this.optionalBadge.style.background = 'var(--bg-muted)';
      }

      this.updateCalculation();
    };

    [this.storeNameInput, this.storePhoneInput, this.storeGstinInput, this.storeAddressInput,
     this.customerNameInput, this.customerPhoneInput, this.customerGstinInput, this.customerAddressInput,
     this.billNumberInput].forEach(inp => {
      inp.addEventListener('input', syncOptional);
    });

    // Discount & Tax Inputs
    this.discountValInput.addEventListener('input', () => {
      this.state.discountValue = parseFloat(this.discountValInput.value) || 0;
      this.updateCalculation();
    });

    this.discountTypeSelect.addEventListener('change', () => {
      this.state.discountType = this.discountTypeSelect.value;
      this.updateCalculation();
    });

    this.taxRateSelect.addEventListener('change', () => {
      const rate = parseFloat(this.taxRateSelect.value) || 0;
      this.state.taxRate = rate;
      this.state.taxEnabled = rate > 0;
      this.updateCalculation();
    });

    this.roundOffToggle.addEventListener('change', () => {
      this.state.autoRoundOff = this.roundOffToggle.checked;
      this.updateCalculation();
    });

    // Bottom Bar Action
    this.btnBarAction.addEventListener('click', () => {
      if (this.state.activeTab === 'pane-input') {
        this.handleParseText();
      } else if (this.state.activeTab === 'pane-items') {
        if (this.state.items.length === 0) {
          this.showToast('Please add or parse items first');
          return;
        }
        this.renderBillView();
        this.switchTab('pane-bill');
      } else {
        this.switchTab('pane-items');
      }
    });

    // Bill Styles & Export Actions
    this.btnStylePaper.addEventListener('click', () => {
      this.btnStylePaper.classList.add('active');
      this.btnStyleThermal.classList.remove('active');
      this.billWrap.classList.remove('thermal-mode');
    });

    this.btnStyleThermal.addEventListener('click', () => {
      this.btnStyleThermal.classList.add('active');
      this.btnStylePaper.classList.remove('active');
      this.billWrap.classList.add('thermal-mode');
    });

    this.btnShareWhatsApp.addEventListener('click', () => {
      const billData = this.getBillDataPackage();
      shareToWhatsApp(billData);
    });

    this.btnPrintBill.addEventListener('click', () => {
      printReceipt();
    });

    this.btnCopyBill.addEventListener('click', async () => {
      const billData = this.getBillDataPackage();
      const ok = await copyBillToClipboard(billData);
      if (ok) {
        this.showToast('Bill copied to clipboard! 📋');
      } else {
        this.showToast('Failed to copy bill');
      }
    });

    this.btnEditItemsBack.addEventListener('click', () => {
      this.switchTab('pane-items');
    });

    this.btnResetAll.addEventListener('click', () => {
      if (confirm('Start a new bill? Current items will be reset.')) {
        this.resetBill();
      }
    });

    // Currency Switcher
    this.currencySelect.addEventListener('change', () => {
      this.state.currency = this.currencySelect.value;
      localStorage.setItem('qb_currency', this.state.currency);
      this.applyCurrency(this.state.currency);
      this.renderItemsList();
      this.updateCalculation();
      if (this.state.activeTab === 'pane-bill') {
        this.renderBillView();
      }
      this.showToast(`Currency set to ${this.state.currency}`);
    });

    // Theme Switcher
    this.themeToggle.addEventListener('click', () => {
      this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('qb_theme', this.state.theme);
      this.applyTheme(this.state.theme);
    });
  }

  restoreStoreInputs() {
    this.storeNameInput.value = this.state.store.name;
    this.storePhoneInput.value = this.state.store.phone;
    this.storeAddressInput.value = this.state.store.address;
    this.storeGstinInput.value = this.state.store.gstin;
    this.billNumberInput.value = this.state.billNo;
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  applyCurrency(curr) {
    this.currencySelect.value = curr;
    const discLabel = document.querySelector('#discount-type option[value="flat"]');
    if (discLabel) discLabel.textContent = `${curr} Flat`;
  }

  renderPresets() {
    this.presetsContainer.innerHTML = '';
    Presets.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.innerHTML = preset.name;
      btn.title = preset.description;
      btn.addEventListener('click', () => {
        this.rawTextInput.value = preset.text;
        this.showToast(`Loaded "${preset.name.replace(/[^a-zA-Z\s]/g, '').trim()}"`);
        this.rawTextInput.focus();
      });
      this.presetsContainer.appendChild(btn);
    });
  }

  switchTab(tabId) {
    this.state.activeTab = tabId;
    this.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
    this.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'pane-input') {
      this.btnBarAction.textContent = 'Parse into Bill →';
    } else if (tabId === 'pane-items') {
      this.btnBarAction.textContent = 'View Minimal Bill 🧾 →';
    } else if (tabId === 'pane-bill') {
      this.btnBarAction.textContent = 'Edit Products ✏️';
    }
  }

  handleParseText() {
    const raw = this.rawTextInput.value.trim();
    if (!raw) {
      this.showToast('Please paste or type text first');
      this.rawTextInput.focus();
      return;
    }

    const parsed = parseVagueText(raw);
    if (parsed.length === 0) {
      this.showToast('Could not find products in text. Try sample presets!');
      return;
    }

    this.state.items = parsed;
    this.renderItemsList();
    this.updateCalculation();
    this.switchTab('pane-items');
    this.showToast(`Extracted ${parsed.length} products! ⚡`);
  }

  renderItemsList() {
    this.itemsContainer.innerHTML = '';
    this.itemCountBadge.textContent = this.state.items.length;

    if (this.state.items.length === 0) {
      this.itemsContainer.innerHTML = `
        <div style="text-align: center; padding: 24px 12px; color: var(--text-muted);">
          <p style="font-weight: 600; margin-bottom: 4px;">No products added yet</p>
          <p style="font-size: 12px;">Paste text in Step 1 or click "+ Add Product Row" below.</p>
        </div>
      `;
      return;
    }

    this.state.items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.setAttribute('data-id', item.id);

      card.innerHTML = `
        <div class="item-header">
          <span class="item-num-badge">${index + 1}</span>
          <input 
            type="text" 
            class="form-control item-name-input" 
            placeholder="Product name (e.g. Rice, Colgate)" 
            value="${this.escapeHtml(item.name)}" 
            data-field="name"
          >
          <button type="button" class="item-delete-btn" title="Delete product" aria-label="Delete product">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
        <div class="item-grid">
          <div class="item-field">
            <label class="item-field-label">Count</label>
            <input 
              type="number" 
              class="form-control" 
              value="${item.count || 1}" 
              step="any" 
              min="1" 
              inputmode="decimal"
              title="Count (defaults to 1)"
              data-field="count"
            >
          </div>
          <div class="item-field">
            <label class="item-field-label">Quantity</label>
            <input 
              type="text" 
              class="form-control text-left" 
              value="${this.escapeHtml(item.quantity || '1 pc')}" 
              placeholder="e.g. 5kg, 100g" 
              data-field="quantity"
            >
          </div>
          <div class="item-field">
            <label class="item-field-label">Rate (${this.state.currency})</label>
            <input 
              type="number" 
              class="form-control" 
              value="${item.rate}" 
              step="any" 
              min="0" 
              inputmode="decimal"
              data-field="rate"
            >
          </div>
          <div class="item-field">
            <label class="item-field-label">Total (${this.state.currency})</label>
            <input 
              type="number" 
              class="form-control item-amount-input" 
              value="${item.amount.toFixed(2)}" 
              step="any" 
              min="0" 
              inputmode="decimal"
              data-field="amount"
            >
          </div>
        </div>
      `;

      // Form Controls
      const nameInp = card.querySelector('[data-field="name"]');
      const countInp = card.querySelector('[data-field="count"]');
      const quantityInp = card.querySelector('[data-field="quantity"]');
      const rateInp = card.querySelector('[data-field="rate"]');
      const amountInp = card.querySelector('[data-field="amount"]');
      const deleteBtn = card.querySelector('.item-delete-btn');

      nameInp.addEventListener('input', (e) => {
        item.name = e.target.value;
      });

      quantityInp.addEventListener('input', (e) => {
        item.quantity = e.target.value;
      });

      // Deterministic math calculation: Amount = Count * Rate
      const onCountOrRateChange = () => {
        const c = parseFloat(countInp.value) || 1;
        const r = parseFloat(rateInp.value) || 0;
        item.count = c;
        item.rate = r;
        item.amount = calculateRowAmount(c, r);
        amountInp.value = item.amount.toFixed(2);
        this.updateCalculation();
      };

      countInp.addEventListener('input', onCountOrRateChange);
      rateInp.addEventListener('input', onCountOrRateChange);

      // Editing Amount directly recalculates Rate = Amount / Count
      amountInp.addEventListener('input', () => {
        const amt = parseFloat(amountInp.value) || 0;
        item.amount = amt;
        item.rate = calculateRowRate(item.count || 1, amt);
        rateInp.value = item.rate;
        this.updateCalculation();
      });

      // Delete Row
      deleteBtn.addEventListener('click', () => {
        this.state.items = this.state.items.filter(i => i.id !== item.id);
        this.renderItemsList();
        this.updateCalculation();
      });

      this.itemsContainer.appendChild(card);
    });
  }

  addNewEmptyItem() {
    const newItem = {
      id: 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
      name: '',
      count: 1,
      quantity: '1 pc',
      rate: 0,
      amount: 0
    };
    this.state.items.push(newItem);
    this.renderItemsList();
    this.updateCalculation();

    const lastCard = this.itemsContainer.lastElementChild;
    if (lastCard) {
      const nameInp = lastCard.querySelector('[data-field="name"]');
      if (nameInp) nameInp.focus();
    }
  }

  updateCalculation() {
    const settings = {
      discountType: this.state.discountType,
      discountValue: this.state.discountValue,
      taxEnabled: this.state.taxEnabled,
      taxRate: this.state.taxRate,
      autoRoundOff: this.state.autoRoundOff,
      customerGstin: this.state.customer.gstin,
      storeGstin: this.state.store.gstin
    };

    const summary = calculateBill(this.state.items, settings);
    this.state.summary = summary;

    const curr = this.state.currency;

    // Step 2 Summary Card
    this.summarySubtotal.textContent = formatCurrency(summary.subtotal, curr);

    if (summary.discountAmount > 0) {
      this.summaryDiscountRow.style.display = 'flex';
      const label = summary.discountType === 'percent' ? `Discount (${summary.discountValue}%):` : 'Discount:';
      this.summaryDiscountRow.firstElementChild.textContent = label;
      this.summaryDiscount.textContent = `-${formatCurrency(summary.discountAmount, curr)}`;
    } else {
      this.summaryDiscountRow.style.display = 'none';
    }

    if (summary.taxEnabled && summary.taxAmount > 0) {
      this.summaryTaxRow.style.display = 'flex';
      this.summaryTaxLabel.textContent = `GST (${summary.taxRate}%):`;
      this.summaryTax.textContent = `+${formatCurrency(summary.taxAmount, curr)}`;
    } else {
      this.summaryTaxRow.style.display = 'none';
    }

    if (summary.roundOff !== 0) {
      this.summaryRoundoffRow.style.display = 'flex';
      this.summaryRoundoff.textContent = `${summary.roundOff > 0 ? '+' : ''}${formatCurrency(summary.roundOff, curr)}`;
    } else {
      this.summaryRoundoffRow.style.display = 'none';
    }

    this.summaryGrandTotal.textContent = formatCurrency(summary.grandTotal, curr);

    // Sticky Bottom Bar
    this.barTotalAmount.textContent = formatCurrency(summary.grandTotal, curr);
  }

  renderBillView() {
    this.updateCalculation();
    const { store, customer, summary, items, currency } = this.state;

    // Store Info
    document.getElementById('bill-out-store-name').textContent = (store.name || 'GO PURE HERBALS').toUpperCase();
    
    const storeAddrElem = document.getElementById('bill-out-store-address');
    if (store.address) {
      storeAddrElem.textContent = store.address;
      storeAddrElem.style.display = 'block';
    } else {
      storeAddrElem.style.display = 'none';
    }

    const storePhoneElem = document.getElementById('bill-out-store-phone');
    if (store.phone) {
      storePhoneElem.textContent = `Ph: ${store.phone}`;
      storePhoneElem.style.display = 'block';
    } else {
      storePhoneElem.style.display = 'none';
    }

    const storeGstinElem = document.getElementById('bill-out-store-gstin');
    if (store.gstin) {
      storeGstinElem.textContent = `GSTIN: ${store.gstin}`;
      storeGstinElem.style.display = 'block';
    } else {
      storeGstinElem.style.display = 'none';
    }

    // Badge Title: TAX INVOICE vs CASH MEMO
    const badgeElem = document.getElementById('bill-out-title-badge');
    if (summary.isTaxInvoice) {
      badgeElem.textContent = 'TAX INVOICE';
      badgeElem.style.background = '#e0f2fe';
      badgeElem.style.color = '#0369a1';
      badgeElem.style.borderColor = '#bae6fd';
    } else {
      badgeElem.textContent = 'CASH MEMO';
      badgeElem.style.background = '#f1f5f9';
      badgeElem.style.color = '#334155';
      badgeElem.style.borderColor = '#cbd5e1';
    }

    // Bill Meta
    document.getElementById('bill-out-no').textContent = this.state.billNo;
    document.getElementById('bill-out-date').textContent = `${this.state.date} ${this.state.time}`;

    // Customer Box (Hidden cleanly if optional fields were left blank)
    const custBox = document.getElementById('bill-out-customer-box');
    const hasCustInfo = Boolean(customer.name || customer.phone || customer.address || customer.gstin);
    if (hasCustInfo) {
      custBox.style.display = 'block';
      document.getElementById('bill-out-cust-name').textContent = customer.name || 'Valued Customer';
      
      const phoneEl = document.getElementById('bill-out-cust-phone');
      if (customer.phone) {
        phoneEl.textContent = `Phone: ${customer.phone}`;
        phoneEl.style.display = 'block';
      } else {
        phoneEl.style.display = 'none';
      }

      const addrEl = document.getElementById('bill-out-cust-address');
      if (customer.address) {
        addrEl.textContent = `Address: ${customer.address}`;
        addrEl.style.display = 'block';
      } else {
        addrEl.style.display = 'none';
      }

      const gstinEl = document.getElementById('bill-out-cust-gstin');
      if (customer.gstin) {
        gstinEl.textContent = `Customer GSTIN: ${customer.gstin}`;
        gstinEl.style.display = 'block';
      } else {
        gstinEl.style.display = 'none';
      }
    } else {
      custBox.style.display = 'none';
    }

    // Render Items Table Rows
    const tbody = document.getElementById('bill-out-table-body');
    tbody.innerHTML = '';

    items.forEach((item, idx) => {
      const tr = document.createElement('tr');
      const qtyBadge = item.quantity && item.quantity !== '1 pc' ? `<span class="bill-item-sub"> (${item.quantity})</span>` : '';
      
      tr.innerHTML = `
        <td style="color: #64748b;">${idx + 1}</td>
        <td>
          <div class="bill-item-name">${this.escapeHtml(item.name || 'Item')}${qtyBadge}</div>
        </td>
        <td class="text-center" style="font-weight: 600;">${item.count}</td>
        <td class="text-right">${currency}${item.rate.toFixed(2)}</td>
        <td class="text-right" style="font-weight: 700;">${currency}${item.amount.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Bill Totals
    document.getElementById('bill-out-subtotal').textContent = formatCurrency(summary.subtotal, currency);

    // Discount
    const discRow = document.getElementById('bill-out-disc-row');
    if (summary.discountAmount > 0) {
      discRow.style.display = 'flex';
      const discLbl = summary.discountType === 'percent' ? `Discount (${summary.discountValue}%):` : 'Discount:';
      document.getElementById('bill-out-disc-label').textContent = discLbl;
      document.getElementById('bill-out-discount').textContent = `-${formatCurrency(summary.discountAmount, currency)}`;
    } else {
      discRow.style.display = 'none';
    }

    // Taxes (CGST & SGST if tax enabled)
    const cgstRow = document.getElementById('bill-out-cgst-row');
    const sgstRow = document.getElementById('bill-out-sgst-row');

    if (summary.taxEnabled && summary.taxAmount > 0) {
      const halfRate = (summary.taxRate / 2).toFixed(1);
      cgstRow.style.display = 'flex';
      sgstRow.style.display = 'flex';
      document.getElementById('bill-out-cgst-label').textContent = `CGST (${halfRate}%):`;
      document.getElementById('bill-out-cgst').textContent = formatCurrency(summary.cgst, currency);
      document.getElementById('bill-out-sgst-label').textContent = `SGST (${halfRate}%):`;
      document.getElementById('bill-out-sgst').textContent = formatCurrency(summary.sgst, currency);
    } else {
      cgstRow.style.display = 'none';
      sgstRow.style.display = 'none';
    }

    // Round Off
    const roundRow = document.getElementById('bill-out-roundoff-row');
    if (summary.roundOff !== 0) {
      roundRow.style.display = 'flex';
      roundRow.lastElementChild.textContent = `${summary.roundOff > 0 ? '+' : ''}${formatCurrency(summary.roundOff, currency)}`;
    } else {
      roundRow.style.display = 'none';
    }

    // Grand Total & Words
    document.getElementById('bill-out-grandtotal').textContent = formatCurrency(summary.grandTotal, currency);
    document.getElementById('bill-out-words').textContent = numberToWords(summary.grandTotal);
  }

  getBillDataPackage() {
    return {
      store: this.state.store,
      customer: this.state.customer,
      items: this.state.items,
      summary: this.state.summary,
      billNo: this.state.billNo,
      date: this.state.date,
      time: this.state.time,
      currencySymbol: this.state.currency
    };
  }

  resetBill() {
    this.state.items = [];
    this.state.customer = { name: '', phone: '', address: '', gstin: '' };
    this.state.billNo = this.generateBillNo();
    this.state.discountValue = 0;
    this.state.taxRate = 0;
    this.state.taxEnabled = false;

    this.rawTextInput.value = '';
    this.customerNameInput.value = '';
    this.customerPhoneInput.value = '';
    this.customerGstinInput.value = '';
    this.customerAddressInput.value = '';
    this.billNumberInput.value = this.state.billNo;
    this.discountValInput.value = '';
    this.taxRateSelect.value = '0';

    this.renderItemsList();
    this.updateCalculation();
    this.switchTab('pane-input');
    this.showToast('Started fresh bill ✨');
  }

  showToast(message) {
    this.toastText.textContent = message;
    this.toast.classList.add('show');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2400);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.quickBill = new QuickBillApp();
});
