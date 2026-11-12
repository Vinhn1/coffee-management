(function (root, factory) {
  const deps = (typeof require === "function" && typeof module === "object" && module.exports)
    ? Object.assign({}, require("./data.js"), require("./icons.js"), require("./quick.js"), require("./store.js"))
    : (root.BuiCoffee || {});
  const api = factory(deps);
  root.BuiCoffee = Object.assign(root.BuiCoffee || {}, api);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
const {
  CATEGORIES,
  DRINK_CATEGORY_DEFAULT_IMAGES,
  PAYMENT_QR,
  QUICK_ALIASES,
  BEST_SELLER_IDS,
  ICONS,
  autoInitials,
  buildIndex,
  calcChange,
  formatShortPrice,
  parseMoneyInput,
  parseQuery,
  resolveInput,
  search,
  store
} = deps;

function formatMoney(amount) {
  return (amount || 0).toLocaleString("vi-VN") + "\u0111";
}

function getDrinkThumb(item) {
  if (!item) return "assets/drinks/placeholder.svg";
  if (item.image) return item.image;
  if (item.isCustomCreated) return "assets/drinks/placeholder.svg";
  const defaults = DRINK_CATEGORY_DEFAULT_IMAGES || {};
  return defaults[item.category] || "assets/drinks/placeholder.svg";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isFinePointer() {
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: fine)").matches;
}

class QuickRegister {
  constructor(app) {
    this.app = app;
    this.dest = { type: "takeaway", tableId: null };
    this.tender = { method: "cash", cash: null };
    this.index = null;
    this.indexVersion = -1;
    this.query = "";
    this.results = [];
    this.activeIdx = 0;
    this.lastInvoice = null;
    this.toastTimer = null;
    this.toastMode = "invoice";
    this.busy = false;
    this.fullMenuCategory = "all";

    this._cacheDom();
    this._ensureAuxUi();
    this._wireIcons();
    this._rebuildIndexIfNeeded();
    this._bindEvents();
  }

  _cacheDom() {
    const g = id => document.getElementById(id);
    this.dom = {
      view: g("viewQuick"),
      screen: document.querySelector("#viewQuick .ql-screen"),
      btnHeaderQuick: g("btnHeaderQuick"),
      btnMenuToQuick: g("btnMenuToQuick"),
      btnBack: g("btnQuickBack"),
      btnClear: g("btnQuickClear"),
      destGroup: g("quickDest"),
      searchInput: g("quickSearchInput"),
      searchClear: g("quickSearchClear"),
      btnFullMenu: g("btnQuickFullMenu"),
      parseChip: g("quickParseChip"),
      results: g("quickResults"),
      grid: g("quickGrid"),
      cartBackdrop: g("quickCartBackdrop"),
      cartPanel: g("quickCartPanel"),
      btnCartClose: g("btnQuickCartClose"),
      cartList: g("quickCartList"),
      orderNoteInput: g("quickOrderNoteInput"),
      dockEmpty: g("quickDockEmpty"),
      summaryRow: g("quickSummaryRow"),
      summary: g("quickSummary"),
      btnDelLast: g("btnQuickDelLast"),
      sumCount: g("quickSumCount"),
      sumList: g("quickSumList"),
      total: g("quickTotal"),
      tableInfo: g("quickTableInfo"),
      methodGroup: g("quickMethod"),
      cashSection: g("quickCashSection"),
      tenderGroup: g("quickTender"),
      customCashInput: g("quickCustomCashInput"),
      cashClearBtn: g("btnQuickCashClear"),
      actionRow: g("quickActionRow"),
      changeRow: g("quickChangeRow"),
      changeText: g("quickChange"),
      btnCustomCash: g("btnQuickCustomCash"),
      btnComplete: g("btnQuickComplete"),
      tablePanel: g("quickTablePanel"),
      btnSendToTable: g("btnQuickSendToTable"),
      btnPayTable: g("btnQuickPayTable"),
      qrSheet: g("quickQrSheet"),
      btnQrClose: g("btnQuickQrClose"),
      qrImg: g("quickQrImg"),
      toast: g("quickToast"),
      toastReceived: g("quickToastReceived"),
      toastChange: g("quickToastChange"),
      btnViewBill: g("btnQuickViewBill"),
      btnPrintBill: g("btnQuickPrintBill")
    };
  }

  // Tao nut "Hien ma QR" trong dock va sheet Thuc don day du (dung class san co trong quick.css)
  _ensureAuxUi() {
    if (this.dom.btnComplete && this.dom.btnComplete.parentNode) {
      const btnShowQr = document.createElement("button");
      btnShowQr.type = "button";
      btnShowQr.id = "btnQuickShowQr";
      btnShowQr.className = "ql-secondary";
      btnShowQr.textContent = "Hiện mã QR";
      btnShowQr.hidden = true;
      this.dom.btnComplete.parentNode.insertBefore(btnShowQr, this.dom.btnComplete);
      this.dom.btnShowQr = btnShowQr;
    }

    if (this.dom.screen) {
      const sheet = document.createElement("div");
      sheet.id = "quickFullMenuSheet";
      sheet.className = "ql-sheet";
      sheet.hidden = true;
      sheet.innerHTML = `
        <div class="ql-sheet-head">
          <div class="ql-cart-title">Toàn bộ thực đơn</div>
          <button type="button" class="ql-icon-btn" id="btnQuickFullMenuClose" aria-label="Đóng thực đơn">
            <span>${ICONS.close}</span>
          </button>
        </div>
        <div class="category-scroll" id="quickFullMenuCats" style="padding: 8px 12px 4px; margin: 0;"></div>
        <div class="ql-cart-list" id="quickFullMenuList"></div>
      `;
      this.dom.screen.appendChild(sheet);
      this.dom.fullMenuSheet = sheet;
      this.dom.btnFullMenuClose = sheet.querySelector("#btnQuickFullMenuClose");
      this.dom.fullMenuCats = sheet.querySelector("#quickFullMenuCats");
      this.dom.fullMenuList = sheet.querySelector("#quickFullMenuList");
    }
  }

  _wireIcons() {
    const map = {
      headerQuickIcon: ICONS.bolt,
      quickBackIcon: ICONS.arrowLeft,
      quickClearIcon: ICONS.trash,
      quickSearchIcon: ICONS.search,
      quickSearchClear: ICONS.close,
      quickFullMenuIcon: ICONS.menu,
      quickCartCloseIcon: ICONS.close,
      quickQrCloseIcon: ICONS.close
    };
    Object.entries(map).forEach(([id, svg]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = svg;
    });
  }

  _rebuildIndexIfNeeded() {
    if (this.index && this.indexVersion === store.menuVersion) return;
    this.index = buildIndex(store.getMenu(), {
      aliasMap: QUICK_ALIASES,
      bestSellerIds: BEST_SELLER_IDS,
      salesQty: store.getSalesQty(30)
    });
    this.indexVersion = store.menuVersion;
  }

  _bindEvents() {
    const d = this.dom;

    if (d.btnHeaderQuick) {
      d.btnHeaderQuick.addEventListener("click", () => this.open());
    }
    if (d.btnMenuToQuick) {
      d.btnMenuToQuick.addEventListener("click", () => {
        const active = store.getActiveTable();
        this.open(active ? { tableId: active.id } : {});
      });
    }
    if (d.btnBack) {
      d.btnBack.addEventListener("click", () => this.close());
    }
    if (d.btnClear) {
      d.btnClear.addEventListener("click", () => {
        if (store.getQuickCount() === 0) return;
        store.quickClear();
        this._resetTender();
        this.renderCart();
        this.renderDock();
        this.renderGrid();
      });
    }

    // Chon hinh thuc ban: Mang ve / Tai quay / Ban
    if (d.destGroup) {
      d.destGroup.addEventListener("click", e => {
        const btn = e.target.closest("[data-dest]");
        if (!btn) return;
        const type = btn.getAttribute("data-dest");
        if (type === "table") {
          this.app.openTransferModal(true, tableId => this.setTable(tableId));
          return;
        }
        this.dest = { type, tableId: null };
        this._renderDest();
        this.renderDock();
      });
    }

    // Bam o mon nhanh / bam badge de giam 1
    if (d.grid) {
      d.grid.addEventListener("click", e => {
        const badge = e.target.closest(".ql-tile-badge");
        if (badge) {
          e.stopPropagation();
          const id = badge.getAttribute("data-badge-id");
          if (id) {
            store.quickChangeQty(id, -1);
            this._onCartMutated();
          }
          return;
        }
        const tile = e.target.closest(".ql-tile");
        if (!tile) return;
        const id = tile.getAttribute("data-id");
        const entry = this.index && this.index.byId.get(id);
        if (!entry) return;
        this._addItem(entry.item, 1);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          try { navigator.vibrate(10); } catch (_) {}
        }
      });
    }

    // Tim kiem nhanh va phim tat
    if (d.searchInput) {
      d.searchInput.addEventListener("input", () => {
        this.query = d.searchInput.value;
        this.activeIdx = 0;
        this._updateSearchUi();
      });

      d.searchInput.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") {
          if (this.results.length > 0) {
            e.preventDefault();
            this.activeIdx = (this.activeIdx + 1) % this.results.length;
            this._highlightResult();
          }
          return;
        }
        if (e.key === "ArrowUp") {
          if (this.results.length > 0) {
            e.preventDefault();
            this.activeIdx = (this.activeIdx - 1 + this.results.length) % this.results.length;
            this._highlightResult();
          }
          return;
        }
        if (e.key === "Escape") {
          if (d.searchInput.value) {
            e.preventDefault();
            this._clearSearch(true);
          } else {
            d.searchInput.blur();
          }
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          this._handleSearchEnter();
        }
      });
    }

    if (d.searchClear) {
      d.searchClear.addEventListener("click", () => {
        this._clearSearch(isFinePointer());
      });
    }

    if (d.results) {
      d.results.addEventListener("click", e => {
        const customBtn = e.target.closest("#btnQuickNotFoundCustom");
        if (customBtn) {
          const raw = d.searchInput ? d.searchInput.value.trim() : "";
          this._clearSearch(false);
          this.close();
          this.app.openCustomItemModal(raw);
          return;
        }
        const row = e.target.closest(".ql-result");
        if (!row) return;
        const id = row.getAttribute("data-id");
        const entry = this.index && this.index.byId.get(id);
        if (!entry) return;
        const { segments } = parseQuery(this.query);
        const qty = segments.length === 1 ? segments[0].qty : 1;
        this._addItem(entry.item, qty);
        this._clearSearch(isFinePointer());
        if (!isFinePointer() && d.searchInput) d.searchInput.blur();
      });
    }

    // Phim tat toan man hinh Ban nhanh (chi khi khong mo modal)
    document.addEventListener("keydown", e => {
      if (!this.isOpen()) return;
      if (document.querySelector(".modal-overlay.active")) return;

      if (e.key === "Escape" && this._isSheetOpen()) {
        e.preventDefault();
        this._closeSheets();
        return;
      }

      if (this._isSheetOpen()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "/" || e.key === "F2") {
        e.preventDefault();
        if (d.searchInput) d.searchInput.focus();
        return;
      }

      const active = document.activeElement;
      const inField = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT");
      if (!inField && e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
        if (d.searchInput) d.searchInput.focus();
      }
    });

    // Dong danh sach goi y tim kiem khi cham ra ngoai
    document.addEventListener("click", e => {
      if (!this.isOpen()) return;
      if (d.results && !d.results.hidden && !e.target.closest(".ql-searchwrap")) {
        d.results.hidden = true;
        if (d.searchInput) d.searchInput.setAttribute("aria-expanded", "false");
      }
    });

    // Ngan keo gio hang & cac sheet
    if (d.summary) {
      d.summary.addEventListener("click", () => this._openCartSheet());
    }
    if (d.btnCartClose) {
      d.btnCartClose.addEventListener("click", () => this._closeSheets());
    }
    if (d.cartBackdrop) {
      d.cartBackdrop.addEventListener("click", () => this._closeSheets());
    }

    if (d.cartList) {
      d.cartList.addEventListener("click", e => {
        const btn = e.target.closest("[data-act]");
        if (!btn) return;
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        if (!id) return;
        if (act === "plus") store.quickChangeQty(id, 1);
        if (act === "minus") store.quickChangeQty(id, -1);
        if (act === "del") store.quickRemove(id);
        if (act === "note") {
          const item = store.getQuickOrder().items.find(i => i.itemId === id);
          const current = item ? (item.note || "") : "";
          const next = window.prompt("Ghi chu cho mon nay (vd: it da, khong duong...):", current);
          if (next !== null) {
            store.quickSetItemNote(id, next.trim());
            this.renderCart();
          }
          return;
        }
        this._onCartMutated();
      });
    }

    if (d.orderNoteInput) {
      d.orderNoteInput.addEventListener("input", () => {
        store.setQuickNote(d.orderNoteInput.value);
        if (d.sumList) {
          const items = store.getQuickOrder().items;
          const note = store.getQuickNote();
          const summaryList = items.map(i => `${i.quantity} ${i.name}`).join(", ");
          d.sumList.textContent = note ? `[${note}] ${summaryList}` : summaryList;
        }
      });
    }

    // Phuong thuc & tien khach dua
    if (d.methodGroup) {
      d.methodGroup.addEventListener("click", e => {
        const btn = e.target.closest("[data-method]");
        if (!btn) return;
        const method = btn.getAttribute("data-method");
        this.tender.method = method === "qr" ? "qr" : "cash";
        if (this.tender.method === "qr") {
          this.tender.cash = null;
          this.renderDock();
          this._openQrSheet();
        } else {
          this._closeSheets();
          this.renderDock();
        }
      });
    }

    if (d.btnDelLast) {
      d.btnDelLast.addEventListener("click", e => {
        e.stopPropagation();
        const items = store.getQuickOrder().items;
        if (items.length === 0) return;
        const last = items[items.length - 1];
        store.quickRemove(last.itemId);
        this._onCartMutated();
      });
    }

    if (d.tenderGroup) {
      d.tenderGroup.addEventListener("click", e => {
        const chip = e.target.closest(".ql-chip");
        if (!chip || chip.getAttribute("aria-disabled") === "true") return;
        const raw = chip.getAttribute("data-cash");
        if (raw === "exact") {
          this.tender.cash = null;
          if (d.customCashInput) d.customCashInput.value = "";
        } else {
          const val = Number(raw);
          this.tender.cash = val;
          if (d.customCashInput) {
            d.customCashInput.value = (val).toLocaleString("vi-VN");
          }
        }
        this._renderTenderAndChangeOnly();
      });
    }

    const cashRow = document.getElementById("quickCashInputRow") || (d.cashSection ? d.cashSection.querySelector(".ql-cash-input-row") : null);
    if (cashRow && d.customCashInput) {
      cashRow.addEventListener("click", e => {
        if (e.target.closest("#btnQuickCashClear")) return;
        d.customCashInput.focus();
      });
    }

    if (d.cashClearBtn) {
      d.cashClearBtn.addEventListener("click", e => {
        e.stopPropagation();
        this.tender.cash = null;
        if (d.customCashInput) {
          d.customCashInput.value = "";
          d.customCashInput.focus();
        }
        this._renderTenderAndChangeOnly();
      });
    }

    if (d.customCashInput) {
      d.customCashInput.addEventListener("focus", () => {
        if (d.customCashInput.value) {
          d.customCashInput.select();
        }
      });

      d.customCashInput.addEventListener("input", () => {
        const val = d.customCashInput.value.trim();
        if (!val) {
          this.tender.cash = null;
        } else {
          const parsed = parseMoneyInput(val);
          this.tender.cash = parsed;
        }
        this._renderTenderAndChangeOnly();
      });

      d.customCashInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          e.preventDefault();
          const total = store.getQuickTotal();
          if (total > 0 && calcChange(total, this.tender.cash).enough) {
            this.finishSale();
          }
        }
      });
    }

    if (d.btnShowQr) {
      d.btnShowQr.addEventListener("click", () => this._openQrSheet());
    }
    if (d.btnQrClose) {
      d.btnQrClose.addEventListener("click", () => this._closeSheets());
    }

    // Hoan tat thanh toan / Gui vao ban
    if (d.btnComplete) {
      d.btnComplete.addEventListener("click", () => this.finishSale());
    }
    if (d.btnSendToTable) {
      d.btnSendToTable.addEventListener("click", () => this._sendToTable());
    }
    if (d.btnPayTable) {
      d.btnPayTable.addEventListener("click", () => this._payTargetTable());
    }

    // Toast sau thanh toan
    if (d.btnViewBill) {
      d.btnViewBill.addEventListener("click", () => {
        if (this.toastMode === "table") {
          this._hideToast();
          this.close();
          this.app.switchView("viewCurrentOrder");
          return;
        }
        if (this.lastInvoice) {
          this.app.showReceiptModal(this.lastInvoice);
        }
      });
    }
    if (d.btnPrintBill) {
      d.btnPrintBill.addEventListener("click", () => {
        if (this.lastInvoice) {
          this.app.showReceiptModal(this.lastInvoice);
          window.print();
        }
      });
    }

    // Thuc don day du (fallback cho mon it ban)
    if (d.btnFullMenu) {
      d.btnFullMenu.addEventListener("click", () => this._openFullMenuSheet());
    }
    if (d.btnFullMenuClose) {
      d.btnFullMenuClose.addEventListener("click", () => this._closeSheets());
    }
    if (d.fullMenuCats) {
      d.fullMenuCats.addEventListener("click", e => {
        const pill = e.target.closest("[data-cat]");
        if (!pill) return;
        this.fullMenuCategory = pill.getAttribute("data-cat");
        this._renderFullMenuSheet();
      });
    }
    if (d.fullMenuList) {
      d.fullMenuList.addEventListener("click", e => {
        const row = e.target.closest("[data-menu-id]");
        if (!row) return;
        const id = row.getAttribute("data-menu-id");
        const entry = this.index && this.index.byId.get(id);
        if (!entry) return;
        this._addItem(entry.item, 1);
        this._closeSheets();
      });
    }

    // Dam bao luu gio hang khi chuyen tab / thoat trinh duyet
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") store.flushSave();
    });
    window.addEventListener("pagehide", () => store.flushSave());
  }

  isOpen() {
    return document.body.classList.contains("quick-mode");
  }

  open({ tableId = null } = {}) {
    this._rebuildIndexIfNeeded();
    if (tableId) {
      const t = store.getTable(tableId);
      if (t) this.dest = { type: "table", tableId: t.id };
    }
    document.body.classList.add("quick-mode");
    if (this.dom.view) this.dom.view.classList.add("active");

    this._closeSheets();
    this._renderDest();
    this.renderGrid();
    this.renderCart();
    this.renderDock();

    if (isFinePointer() && this.dom.searchInput) {
      this.dom.searchInput.focus();
    }
  }

  close() {
    this._closeSheets();
    this._hideToast();
    this._clearSearch(false);
    document.body.classList.remove("quick-mode");
    if (this.dom.view) this.dom.view.classList.remove("active");
    this.app.switchView(this.app.currentView);
    this.app.updateBadges();
  }

  setTable(tableId) {
    const t = store.getTable(tableId);
    if (!t) return;
    this.dest = { type: "table", tableId: t.id };
    this._renderDest();
    this.renderDock();
  }

  onDataChanged() {
    const prevVersion = this.indexVersion;
    this._rebuildIndexIfNeeded();
    if (this.isOpen() || prevVersion !== this.indexVersion) {
      if (this.isOpen()) {
        this._renderDest();
        this.renderGrid();
        this.renderCart();
        this.renderDock();
      }
    }
  }

  _addItem(item, qty = 1) {
    this._hideToast();
    store.quickAdd(item, qty);
    this._onCartMutated();
  }

  _onCartMutated() {
    this._resetTender();
    this.renderCart();
    this.renderDock();
    this.renderGrid();
  }

  _resetTender() {
    this.tender.cash = null;
    if (this.dom.customCashInput) {
      this.dom.customCashInput.hidden = false;
      this.dom.customCashInput.value = "";
    }
  }

  _handleSearchEnter() {
    const raw = (this.dom.searchInput ? this.dom.searchInput.value : "").trim();
    if (!raw) {
      // Chi cho phep Enter rong hoan tat khi da chon ro so tien khach dua
      if (
        this.dest.type !== "table" &&
        this.tender.method === "cash" &&
        this.tender.cash !== null &&
        store.getQuickCount() > 0 &&
        calcChange(store.getQuickTotal(), this.tender.cash).enough
      ) {
        this.finishSale();
      }
      return;
    }

    const { segments } = parseQuery(raw);
    if (segments.length > 1) {
      const resolved = resolveInput(this.index, raw);
      if (!resolved.allResolved) {
        this._renderBatchChip(resolved);
        return;
      }
      this._hideToast();
      store.quickAddBatch(resolved.lines.map(l => ({ item: l.item, qty: l.qty })));
      this._onCartMutated();
      this._clearSearch(isFinePointer());
      if (!isFinePointer() && this.dom.searchInput) this.dom.searchInput.blur();
      return;
    }

    if (this.results.length > 0) {
      const hit = this.results[this.activeIdx] || this.results[0];
      const qty = segments.length === 1 ? segments[0].qty : 1;
      this._addItem(hit.item, qty);
      this._clearSearch(isFinePointer());
      if (!isFinePointer() && this.dom.searchInput) this.dom.searchInput.blur();
    }
  }

  _clearSearch(keepFocus) {
    this.query = "";
    this.results = [];
    this.activeIdx = 0;
    if (this.dom.searchInput) {
      this.dom.searchInput.value = "";
      this.dom.searchInput.setAttribute("aria-expanded", "false");
      this.dom.searchInput.removeAttribute("aria-activedescendant");
      if (keepFocus) this.dom.searchInput.focus();
    }
    if (this.dom.searchClear) this.dom.searchClear.classList.remove("visible");
    if (this.dom.parseChip) {
      this.dom.parseChip.hidden = true;
      this.dom.parseChip.classList.remove("is-error");
    }
    if (this.dom.results) {
      this.dom.results.hidden = true;
      this.dom.results.innerHTML = "";
    }
  }

  _updateSearchUi() {
    const d = this.dom;
    const raw = this.query.trim();
    if (d.searchClear) {
      d.searchClear.classList.toggle("visible", raw.length > 0);
    }

    if (!raw) {
      this._clearSearch(false);
      return;
    }

    const { segments } = parseQuery(raw);
    if (segments.length > 1) {
      const resolved = resolveInput(this.index, raw);
      this.results = [];
      if (d.results) {
        d.results.hidden = true;
        d.results.innerHTML = "";
      }
      if (d.searchInput) d.searchInput.setAttribute("aria-expanded", "false");
      this._renderBatchChip(resolved);
      return;
    }

    const seg = segments[0] || { text: "", qty: 1, qtyExplicit: false };
    if (!seg.text) {
      this.results = [];
      if (d.results) {
        d.results.hidden = true;
        d.results.innerHTML = "";
      }
      if (d.searchInput) d.searchInput.setAttribute("aria-expanded", "false");
      if (d.parseChip) {
        d.parseChip.hidden = false;
        d.parseChip.classList.remove("is-error");
        d.parseChip.textContent = "Nhập tên món, ví dụ 2cfs";
      }
      return;
    }

    this.results = search(this.index, seg.text, 6);
    if (this.activeIdx >= this.results.length) this.activeIdx = 0;

    if (d.parseChip) {
      if (this.results.length > 0 && (seg.qtyExplicit || this.results[0].tier >= 90)) {
        const hit = this.results[this.activeIdx] || this.results[0];
        d.parseChip.hidden = false;
        d.parseChip.classList.remove("is-error");
        d.parseChip.textContent = `${seg.qty} x ${hit.item.name} = ${formatMoney(hit.item.price * seg.qty)}`;
      } else {
        d.parseChip.hidden = true;
        d.parseChip.classList.remove("is-error");
      }
    }

    this._renderResults(seg, raw);
  }

  _renderBatchChip(resolved) {
    const chip = this.dom.parseChip;
    if (!chip) return;
    chip.hidden = false;
    if (resolved.allResolved) {
      chip.classList.remove("is-error");
      const total = resolved.lines.reduce((s, l) => s + l.item.price * l.qty, 0);
      const summary = resolved.lines.map(l => `${l.qty} ${l.item.name}`).join(" + ");
      chip.textContent = `${summary} = ${formatMoney(total)} (Enter để thêm)`;
    } else {
      chip.classList.add("is-error");
      const bad = resolved.lines.filter(l => !l.item).map(l => l.text || "?").join(", ");
      chip.textContent = `Chưa rõ món: ${bad}`;
    }
  }

  _renderResults(seg, raw) {
    const box = this.dom.results;
    if (!box) return;
    box.hidden = false;
    if (this.dom.searchInput) this.dom.searchInput.setAttribute("aria-expanded", "true");

    if (this.results.length === 0) {
      box.innerHTML = `
        <div class="ql-result-empty">
          <span>Không thấy món "${escapeHtml(raw)}"</span>
          <button type="button" class="ql-link-btn" id="btnQuickNotFoundCustom">Thêm món ngoài menu</button>
        </div>
      `;
      if (this.dom.searchInput) this.dom.searchInput.removeAttribute("aria-activedescendant");
      return;
    }

    const qLen = (seg.text || "").replace(/\s+/g, "").length;
    box.innerHTML = this.results.map((r, idx) => {
      const label = r.alias || autoInitials(r.item.name) || "";
      const aliasHtml = label
        ? `<mark>${escapeHtml(label.slice(0, qLen))}</mark>${escapeHtml(label.slice(qLen))}`
        : "";
      const isAct = idx === this.activeIdx;
      const thumb = getDrinkThumb(r.item);
      return `
        <div class="ql-result ${isAct ? "active" : ""}" id="quickResOpt-${idx}" role="option" aria-selected="${isAct}" data-id="${r.item.id}">
          ${thumb ? `<img class="ql-result-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
          <span class="ql-result-alias">${aliasHtml}</span>
          <span class="ql-result-name">${escapeHtml(r.item.name)}</span>
          ${seg.qtyExplicit ? `<span class="ql-result-qty">x${seg.qty}</span>` : ""}
          <span class="ql-result-price">${formatMoney(r.item.price)}</span>
        </div>
      `;
    }).join("");

    if (this.dom.searchInput) {
      this.dom.searchInput.setAttribute("aria-activedescendant", `quickResOpt-${this.activeIdx}`);
    }
  }

  _highlightResult() {
    if (!this.dom.results) return;
    const rows = this.dom.results.querySelectorAll(".ql-result");
    rows.forEach((row, idx) => {
      const act = idx === this.activeIdx;
      row.classList.toggle("active", act);
      row.setAttribute("aria-selected", act ? "true" : "false");
    });
    if (this.dom.searchInput && rows[this.activeIdx]) {
      this.dom.searchInput.setAttribute("aria-activedescendant", `quickResOpt-${this.activeIdx}`);
    }
  }

  _renderDest() {
    const group = this.dom.destGroup;
    if (!group) return;
    const targetTable = this.dest.type === "table" && this.dest.tableId ? store.getTable(this.dest.tableId) : null;
    group.querySelectorAll("[data-dest]").forEach(btn => {
      const d = btn.getAttribute("data-dest");
      btn.classList.toggle("active", d === this.dest.type);
      if (d === "table") {
        btn.textContent = targetTable ? targetTable.name : "Bàn --";
      }
    });
  }

  renderGrid() {
    const grid = this.dom.grid;
    if (!grid) return;
    this._rebuildIndexIfNeeded();

    const qtyById = new Map();
    store.getQuickOrder().items.forEach(i => qtyById.set(i.itemId, i.quantity));

    const ids = store.getSpeedGridIds();
    grid.innerHTML = ids.map(id => {
      const entry = this.index.byId.get(id);
      if (!entry) return "";
      const item = entry.item;
      const qty = qtyById.get(id) || 0;
      const thumb = getDrinkThumb(item);
      return `
        <button type="button" class="ql-tile ${qty > 0 ? "has-qty" : ""}" data-id="${item.id}">
          <span class="ql-tile-img-box">
            ${thumb ? `<img class="ql-tile-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span class="ql-tile-placeholder"></span>`}
          </span>
          <span class="ql-tile-body">
            <span class="ql-tile-name">${escapeHtml(item.name)}</span>
            <span class="ql-tile-price">${formatShortPrice(item.price)}</span>
          </span>
          <span class="ql-tile-badge ${qty > 0 ? "is-visible" : ""}" data-badge-id="${item.id}" role="button" aria-label="Xóa hoặc giảm 1 ${escapeHtml(item.name)}" title="Bấm để xóa / giảm món">
            <span class="ql-tile-badge-icon">&minus;</span>
            <span class="ql-tile-badge-num">${qty}</span>
          </span>
        </button>
      `;
    }).join("");
  }

  renderCart() {
    const items = store.getQuickOrder().items;
    const count = store.getQuickCount();
    const total = store.getQuickTotal();
    const orderNote = store.getQuickNote ? store.getQuickNote() : "";

    if (this.dom.btnClear) {
      this.dom.btnClear.hidden = count === 0;
    }
    if (this.dom.sumCount) {
      this.dom.sumCount.textContent = `${count} món`;
    }
    if (this.dom.sumList) {
      const summaryList = items.map(i => `${i.quantity} ${i.name}`).join(", ");
      this.dom.sumList.textContent = orderNote ? `[${orderNote}] ${summaryList}` : summaryList;
    }
    if (this.dom.total) {
      this.dom.total.textContent = formatMoney(total);
    }
    if (this.dom.orderNoteInput && document.activeElement !== this.dom.orderNoteInput) {
      this.dom.orderNoteInput.value = orderNote;
    }

    if (!this.dom.cartList) return;
    if (items.length === 0) {
      this.dom.cartList.innerHTML = `<div class="ql-cart-empty">Chưa có món nào trong đơn</div>`;
      return;
    }

    this.dom.cartList.innerHTML = items.map(item => `
      <div class="ql-cart-row" data-id="${item.itemId}">
        <div class="ql-cart-info">
          <div class="ql-cart-name">${escapeHtml(item.name)}</div>
          <div class="ql-cart-sub">
            <span>${formatMoney(item.price)} x ${item.quantity}</span>
            <button type="button" class="ql-cart-btn-note ${item.note ? "has-note" : ""}" data-act="note" data-id="${item.itemId}">
              ${item.note ? "Ghi chú: " + escapeHtml(item.note) : "+ Ghi chú"}
            </button>
          </div>
          ${item.note ? `<div class="ql-cart-item-note">${escapeHtml(item.note)}</div>` : ""}
        </div>
        <div class="qty-control">
          <button type="button" class="qty-btn" data-act="minus" data-id="${item.itemId}" aria-label="Giảm">${ICONS.minus}</button>
          <span class="qty-val">${item.quantity}</span>
          <button type="button" class="qty-btn" data-act="plus" data-id="${item.itemId}" aria-label="Tăng">${ICONS.plus}</button>
        </div>
        <div class="ql-cart-line-total">${formatMoney(item.price * item.quantity)}</div>
        <button type="button" class="ql-cart-del" data-act="del" data-id="${item.itemId}" aria-label="Xoá món">${ICONS.trash}</button>
      </div>
    `).join("");
  }

  renderDock() {
    const d = this.dom;
    const count = store.getQuickCount();
    const isTable = this.dest.type === "table";
    const targetTable = isTable && this.dest.tableId ? store.getTable(this.dest.tableId) : null;
    const tableOccupied = targetTable && targetTable.orderItems.length > 0;

    if (d.tableInfo) {
      if (tableOccupied) {
        const tCount = targetTable.orderItems.reduce((s, i) => s + i.quantity, 0);
        d.tableInfo.hidden = false;
        d.tableInfo.textContent = `${targetTable.name} đang có ${tCount} món - ${formatMoney(targetTable.totalAmount)}`;
      } else {
        d.tableInfo.hidden = true;
      }
    }

    const empty = count === 0;
    if (d.dockEmpty) d.dockEmpty.hidden = !(empty && !tableOccupied);
    if (d.summaryRow) d.summaryRow.hidden = empty;
    else if (d.summary) d.summary.hidden = empty;

    if (isTable) {
      if (d.methodGroup) d.methodGroup.hidden = true;
      if (d.cashSection) d.cashSection.hidden = true;
      if (d.tenderGroup) d.tenderGroup.hidden = true;
      if (d.actionRow) d.actionRow.hidden = true;
      if (d.changeRow) d.changeRow.hidden = true;
      if (d.btnShowQr) d.btnShowQr.hidden = true;
      if (d.btnComplete) d.btnComplete.hidden = true;

      if (d.tablePanel) {
        d.tablePanel.hidden = empty && !tableOccupied;
      }
      if (d.btnSendToTable) {
        d.btnSendToTable.hidden = empty;
        d.btnSendToTable.textContent = targetTable ? `Gửi vào ${targetTable.name}` : "Gửi vào bàn";
      }
      if (d.btnPayTable) {
        d.btnPayTable.hidden = !tableOccupied;
      }
      return;
    }

    if (d.tablePanel) d.tablePanel.hidden = true;

    if (empty) {
      if (d.methodGroup) d.methodGroup.hidden = true;
      if (d.cashSection) d.cashSection.hidden = true;
      if (d.tenderGroup) d.tenderGroup.hidden = true;
      if (d.actionRow) d.actionRow.hidden = true;
      if (d.changeRow) d.changeRow.hidden = true;
      if (d.btnShowQr) d.btnShowQr.hidden = true;
      if (d.btnComplete) d.btnComplete.hidden = true;
      return;
    }

    const isCash = this.tender.method === "cash";
    if (d.methodGroup) {
      d.methodGroup.hidden = false;
      d.methodGroup.querySelectorAll("[data-method]").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-method") === this.tender.method);
      });
    }

    if (d.cashSection) d.cashSection.hidden = !isCash;
    if (d.customCashInput) d.customCashInput.hidden = false;
    if (d.tenderGroup) d.tenderGroup.hidden = !isCash;
    if (d.actionRow) d.actionRow.hidden = false;
    if (d.changeRow) d.changeRow.hidden = false;
    if (d.btnShowQr) d.btnShowQr.hidden = isCash;
    if (d.btnComplete) d.btnComplete.hidden = false;

    this._renderTenderAndChangeOnly();
  }

  _renderTenderAndChangeOnly() {
    const d = this.dom;
    const total = store.getQuickTotal();
    if (total === 0) return;

    if (this.tender.method === "qr") {
      if (d.btnComplete) {
        d.btnComplete.disabled = false;
        d.btnComplete.textContent = "Đã nhận chuyển khoản";
      }
      return;
    }

    if (d.tenderGroup) {
      d.tenderGroup.querySelectorAll(".ql-chip").forEach(chip => {
        const raw = chip.getAttribute("data-cash");
        if (raw === "exact") {
          chip.classList.toggle("selected", this.tender.cash === null);
          chip.removeAttribute("aria-disabled");
        } else {
          const val = Number(raw);
          const disabled = val < total;
          chip.setAttribute("aria-disabled", disabled ? "true" : "false");
          chip.classList.toggle("selected", this.tender.cash === val);
        }
      });
    }

    if (d.customCashInput && document.activeElement !== d.customCashInput) {
      d.customCashInput.value = this.tender.cash === null ? "" : (this.tender.cash).toLocaleString("vi-VN");
    }

    const calc = calcChange(total, this.tender.cash);
    if (d.changeText) {
      d.changeText.classList.remove("is-exact", "is-ok", "is-short");
      if (this.tender.cash === null) {
        d.changeText.classList.add("is-exact");
        d.changeText.textContent = "Khách đưa đủ";
      } else if (calc.enough) {
        d.changeText.classList.add("is-ok");
        d.changeText.textContent = `Thối: ${formatMoney(calc.change)}`;
      } else {
        d.changeText.classList.add("is-short");
        d.changeText.textContent = `Thiếu: ${formatMoney(calc.shortfall)}`;
      }
    }

    if (d.btnComplete) {
      if (!calc.enough) {
        d.btnComplete.disabled = true;
        d.btnComplete.textContent = "Chưa đủ tiền";
      } else if (this.tender.cash === null || calc.change === 0) {
        d.btnComplete.disabled = false;
        d.btnComplete.textContent = `Hoàn tất - ${formatMoney(total)}`;
      } else {
        d.btnComplete.disabled = false;
        d.btnComplete.textContent = `Hoàn tất (thối ${formatShortPrice(calc.change)})`;
      }
    }
  }

  finishSale() {
    if (this.busy || this.dest.type === "table") return;
    this.busy = true;
    try {
      const res = store.quickCheckout({
        orderType: this.dest.type,
        paymentMethod: this.tender.method,
        customerCash: this.tender.cash
      });
      if (!res.ok) return;

      this.lastInvoice = res.invoice;
      this.tender = { method: "cash", cash: null };
      if (this.dom.customCashInput) {
        this.dom.customCashInput.hidden = false;
        this.dom.customCashInput.value = "";
      }
      this._closeSheets();
      this.renderGrid();
      this.renderCart();
      this.renderDock();
      this._showInvoiceToast(res.invoice);
    } finally {
      this.busy = false;
    }
  }

  _sendToTable() {
    if (!this.dest.tableId) return;
    const res = store.quickSendToTable(this.dest.tableId);
    if (!res.ok) return;

    this._closeSheets();
    this._resetTender();
    this.renderGrid();
    this.renderCart();
    this.renderDock();
    this.app.updateBadges();
    this._showTableToast(res.table, res.count);
  }

  _payTargetTable() {
    if (!this.dest.tableId) return;
    const id = this.dest.tableId;
    store.setActiveTableId(id);
    this.close();
    this.app.switchView("viewCurrentOrder");
    this.app.openCheckoutModal();
  }

  _showInvoiceToast(invoice) {
    const d = this.dom;
    if (!d.toast) return;
    this.toastMode = "invoice";
    if (d.toastReceived) {
      d.toastReceived.textContent = invoice.paymentMethod === "qr"
        ? `Đã nhận CK ${formatMoney(invoice.totalAmount)}`
        : `Đã thu ${formatMoney(invoice.customerCash)}`;
    }
    if (d.toastChange) {
      d.toastChange.textContent = invoice.changeAmount > 0
        ? `Thối lại ${formatMoney(invoice.changeAmount)}`
        : `Thu đủ ${formatMoney(invoice.totalAmount)}`;
    }
    if (d.btnViewBill) d.btnViewBill.textContent = "Xem bill";
    if (d.btnPrintBill) d.btnPrintBill.hidden = false;
    this._revealToast();
  }

  _showTableToast(table, count) {
    const d = this.dom;
    if (!d.toast) return;
    this.toastMode = "table";
    if (d.toastReceived) d.toastReceived.textContent = `Đã gửi ${count} món vào`;
    if (d.toastChange) d.toastChange.textContent = table.name;
    if (d.btnViewBill) d.btnViewBill.textContent = "Xem đơn";
    if (d.btnPrintBill) d.btnPrintBill.hidden = true;
    this._revealToast();
  }

  _revealToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.dom.toast.hidden = false;
    this.toastTimer = setTimeout(() => this._hideToast(), 6000);
  }

  _hideToast() {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (this.dom.toast) this.dom.toast.hidden = true;
  }

  _openCartSheet() {
    if (window.matchMedia && window.matchMedia("(min-width: 900px)").matches) return;
    this._closeSheets();
    if (this.dom.cartBackdrop) this.dom.cartBackdrop.hidden = false;
    if (this.dom.cartPanel) this.dom.cartPanel.classList.add("open");
  }

  _openQrSheet() {
    const total = store.getQuickTotal();
    if (total <= 0 || !this.dom.qrSheet || !this.dom.qrImg) return;
    this._closeSheets();
    const note = this.dest.type === "counter" ? "BuiCoffee TaiQuay" : "BuiCoffee MangVe";
    this.dom.qrImg.innerHTML = `
      <div class="qr-amount-banner">Số tiền cần thu: <b>${formatMoney(total)}</b></div>
      <img src="${PAYMENT_QR.image}" alt="Mã QR Bụi Coffee" class="qr-payment-photo" onerror="this.onerror=null;this.parentElement.innerHTML='<p style=\\'font-size:13px;padding:20px;\\'>Quét mã QR thanh toán ${formatMoney(total)}</p>'">
      <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">${escapeHtml(PAYMENT_QR.accountName)} (${escapeHtml(PAYMENT_QR.bankName)}) - Nội dung: <b>${note}</b></p>
    `;
    if (this.dom.cartBackdrop) this.dom.cartBackdrop.hidden = false;
    this.dom.qrSheet.hidden = false;
  }

  _openFullMenuSheet() {
    if (!this.dom.fullMenuSheet) return;
    this._closeSheets();
    this._renderFullMenuSheet();
    if (this.dom.cartBackdrop) this.dom.cartBackdrop.hidden = false;
    this.dom.fullMenuSheet.hidden = false;
  }

  _renderFullMenuSheet() {
    if (!this.dom.fullMenuCats || !this.dom.fullMenuList) return;
    this.dom.fullMenuCats.innerHTML = CATEGORIES.map(c => `
      <button type="button" class="category-pill ${c.id === this.fullMenuCategory ? "active" : ""}" data-cat="${c.id}">
        ${escapeHtml(c.name)}
      </button>
    `).join("");

    let menu = store.getMenu();
    if (this.fullMenuCategory !== "all") {
      menu = menu.filter(m => m.category === this.fullMenuCategory);
    }

    this.dom.fullMenuList.innerHTML = menu.map(item => {
      const thumb = getDrinkThumb(item);
      return `
        <div class="ql-cart-row" data-menu-id="${item.id}" style="cursor: pointer;">
          ${thumb ? `<img class="ql-full-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
          <div class="ql-cart-info">
            <div class="ql-cart-name">${escapeHtml(item.name)}</div>
          </div>
          <div class="ql-cart-line-total" style="color: var(--primary);">${formatMoney(item.price)}</div>
        </div>
      `;
    }).join("");
  }

  _isSheetOpen() {
    const cartOpen = this.dom.cartPanel && this.dom.cartPanel.classList.contains("open");
    const qrOpen = this.dom.qrSheet && !this.dom.qrSheet.hidden;
    const menuOpen = this.dom.fullMenuSheet && !this.dom.fullMenuSheet.hidden;
    return Boolean(cartOpen || qrOpen || menuOpen);
  }

  _closeSheets() {
    if (this.dom.cartBackdrop) this.dom.cartBackdrop.hidden = true;
    if (this.dom.cartPanel) this.dom.cartPanel.classList.remove("open");
    if (this.dom.qrSheet) this.dom.qrSheet.hidden = true;
    if (this.dom.fullMenuSheet) this.dom.fullMenuSheet.hidden = true;
  }
}

return { QuickRegister };
});
