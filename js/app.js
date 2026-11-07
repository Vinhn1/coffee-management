import { CATEGORIES, SHOP_INFO } from "./data.js";
import { ICONS } from "./icons.js";
import { store } from "./store.js";

// Helper bỏ dấu tiếng Việt để tìm kiếm nhanh
function removeVietnameseTones(str) {
  if (!str) return "";
  str = str.toLowerCase();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  str = str.replace(/\u02C6|\u0306|\u031B/g, "");
  return str.trim();
}

// Helper định dạng tiền tệ
function formatMoney(amount) {
  return (amount || 0).toLocaleString("vi-VN") + "đ";
}

class CoffeeApp {
  constructor() {
    this.currentView = "viewTables";
    this.selectedCategory = "all";
    this.tableFilter = "all";
    this.searchQuery = "";
    this.editingNoteItem = null; // { itemId, currentNote }
    this.paymentMethod = "cash";
    this.customItemQty = 1;

    this.initIcons();
    this.initNavigation();
    this.initCategoryScroll();
    this.initSettingsCategories();
    this.initSearch();
    this.initEventListeners();
    this.renderAll();
  }

  // Chèn SVG icons vào DOM
  initIcons() {
    document.getElementById("headerLogo").innerHTML = ICONS.coffee;
    document.getElementById("wifiIcon").innerHTML = ICONS.wifi;
    document.getElementById("settingsIcon").innerHTML = ICONS.settings;
    document.getElementById("searchIcon").innerHTML = ICONS.search;
    document.getElementById("searchClearBtn").innerHTML = ICONS.close;
    document.getElementById("activeTableIcon").innerHTML = ICONS.coffee;
    document.getElementById("currentOrderTableIcon").innerHTML = ICONS.receipt;
    document.getElementById("orderMoreIcon").innerHTML = ICONS.plus;
    document.getElementById("checkoutIcon").innerHTML = ICONS.check;
    document.getElementById("printIcon").innerHTML = ICONS.printer;
    document.getElementById("exportIcon").innerHTML = ICONS.download;
    document.getElementById("importIcon").innerHTML = ICONS.upload;
    document.getElementById("btnCloseCheckoutModal").innerHTML = ICONS.close;
    document.getElementById("btnCloseReceiptModal").innerHTML = ICONS.close;
    document.getElementById("btnCloseTransferModal").innerHTML = ICONS.close;
    document.getElementById("btnCloseNoteModal").innerHTML = ICONS.close;
    document.getElementById("btnCloseSettingsModal").innerHTML = ICONS.close;

    const btnCloseTableNote = document.getElementById("btnCloseTableNoteModal");
    if (btnCloseTableNote) btnCloseTableNote.innerHTML = ICONS.close;

    const btnCloseCustomItem = document.getElementById("btnCloseCustomItemModal");
    if (btnCloseCustomItem) btnCloseCustomItem.innerHTML = ICONS.close;

    const tableNoteIconEl = document.getElementById("tableNoteIcon");
    if (tableNoteIconEl) tableNoteIconEl.innerHTML = ICONS.note;

    const customMenuIconEl = document.getElementById("customItemMenuIcon");
    if (customMenuIconEl) customMenuIconEl.innerHTML = ICONS.plusCircle || ICONS.plus;

    const customOrderIconEl = document.getElementById("customItemOrderIcon");
    if (customOrderIconEl) customOrderIconEl.innerHTML = ICONS.plusCircle || ICONS.plus;

    const addProductIconEl = document.getElementById("addProductIcon");
    if (addProductIconEl) addProductIconEl.innerHTML = ICONS.plus;

    // Bottom nav icons
    document.getElementById("navTablesIcon").innerHTML = ICONS.tables;
    document.getElementById("navMenuIcon").innerHTML = ICONS.menu;
    document.getElementById("navOrderIcon").innerHTML = ICONS.receipt;
    document.getElementById("navReportsIcon").innerHTML = ICONS.chart;
  }

  // Khởi tạo danh mục cho ô chọn trong cài đặt
  initSettingsCategories() {
    const select = document.getElementById("newProductCategory");
    if (!select) return;
    const cats = CATEGORIES.filter(c => c.id !== "all");
    select.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  // Điều hướng các tab chính
  initNavigation() {
    const navItems = document.querySelectorAll(".bottom-nav .nav-item");
    navItems.forEach(item => {
      item.addEventListener("click", () => {
        const viewId = item.getAttribute("data-view");
        this.switchView(viewId);
      });
    });
  }

  switchView(viewId) {
    this.currentView = viewId;
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    document.querySelectorAll(".bottom-nav .nav-item").forEach(nav => nav.classList.remove("active"));

    const targetSec = document.getElementById(viewId);
    if (targetSec) targetSec.classList.add("active");

    const targetNav = document.querySelector(`.bottom-nav [data-view="${viewId}"]`);
    if (targetNav) targetNav.classList.add("active");

    if (viewId === "viewTables") this.renderTables();
    if (viewId === "viewMenu") this.renderMenu();
    if (viewId === "viewCurrentOrder") this.renderCurrentOrder();
    if (viewId === "viewReports") this.renderReports();
  }

  // Thanh cuộn danh mục
  initCategoryScroll() {
    const container = document.getElementById("categoryScrollContainer");
    container.innerHTML = CATEGORIES.map(cat => `
      <button class="category-pill ${cat.id === this.selectedCategory ? "active" : ""}" data-category="${cat.id}">
        ${cat.name}
      </button>
    `).join("");

    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".category-pill");
      if (!btn) return;
      this.selectedCategory = btn.getAttribute("data-category");
      container.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      this.renderMenu();
    });
  }

  // Tìm kiếm tức thì không dấu
  initSearch() {
    const input = document.getElementById("menuSearchInput");
    const clearBtn = document.getElementById("searchClearBtn");

    input.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.trim();
      if (this.searchQuery) {
        clearBtn.classList.add("visible");
      } else {
        clearBtn.classList.remove("visible");
      }
      this.renderMenu();
    });

    clearBtn.addEventListener("click", () => {
      input.value = "";
      this.searchQuery = "";
      clearBtn.classList.remove("visible");
      this.renderMenu();
      input.focus();
    });
  }

  // Sự kiện chung
  initEventListeners() {
    // Filter bàn (Tất cả / Có khách / Trống)
    document.querySelectorAll(".filter-btn-group .filter-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn-group .filter-chip").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.tableFilter = btn.getAttribute("data-filter");
        this.renderTables();
      });
    });

    // Nút đổi bàn nhanh ở menu
    document.getElementById("btnQuickSwitchTable").addEventListener("click", () => {
      this.openTransferModal(true); // mode chọn bàn phục vụ
    });

    // Nút chuyển bàn ở trang chi tiết order
    document.getElementById("btnTransferTableModal").addEventListener("click", () => {
      this.openTransferModal(false); // mode chuyển/gộp bàn
    });

    // Nút xóa bàn
    document.getElementById("btnClearTableBtn").addEventListener("click", () => {
      const activeTable = store.getActiveTable();
      if (!activeTable || activeTable.orderItems.length === 0) return;
      if (confirm(`Bạn có chắc muốn hủy tất cả món của ${activeTable.name}?`)) {
        store.clearTable(activeTable.id);
        this.renderAll();
      }
    });

    // Nút Gọi món ngay khi đơn trống
    document.getElementById("btnGoToMenu").addEventListener("click", () => {
      this.switchView("viewMenu");
    });

    document.getElementById("btnOrderMore").addEventListener("click", () => {
      this.switchView("viewMenu");
    });

    // Nút mở modal thanh toán
    document.getElementById("btnOpenCheckout").addEventListener("click", () => {
      this.openCheckoutModal();
    });

    // Modal thanh toán events
    document.getElementById("btnCloseCheckoutModal").addEventListener("click", () => {
      this.closeModal("checkoutModal");
    });

    document.getElementById("btnPayMethodCash").addEventListener("click", () => {
      this.setPaymentMethod("cash");
    });

    document.getElementById("btnPayMethodQR").addEventListener("click", () => {
      this.setPaymentMethod("qr");
    });

    document.getElementById("customerCashInput").addEventListener("input", () => {
      this.calculateCashChange();
    });

    document.getElementById("btnConfirmPayment").addEventListener("click", () => {
      this.processPayment();
    });

    // Modal hóa đơn events
    document.getElementById("btnCloseReceiptModal").addEventListener("click", () => {
      this.closeModal("receiptModal");
    });

    document.getElementById("btnFinishReceiptBtn").addEventListener("click", () => {
      this.closeModal("receiptModal");
      this.switchView("viewTables");
    });

    document.getElementById("btnPrintReceiptBtn").addEventListener("click", () => {
      window.print();
    });

    // Modal ghi chú món
    document.getElementById("btnCloseNoteModal").addEventListener("click", () => {
      this.closeModal("itemNoteModal");
    });

    document.querySelectorAll(".quick-note-tag").forEach(tag => {
      tag.addEventListener("click", () => {
        const text = tag.getAttribute("data-note");
        const noteInput = document.getElementById("itemCustomNoteInput");
        noteInput.value = noteInput.value ? noteInput.value + ", " + text : text;
      });
    });

    document.getElementById("btnSaveItemNote").addEventListener("click", () => {
      if (!this.editingNoteItem) return;
      const newNote = document.getElementById("itemCustomNoteInput").value.trim();
      const activeTable = store.getActiveTable();
      const item = activeTable.orderItems.find(i => i.itemId === this.editingNoteItem.itemId && (i.note || "") === (this.editingNoteItem.currentNote || ""));
      if (item) {
        item.note = newNote;
        store.saveState();
        this.renderCurrentOrder();
      }
      this.closeModal("itemNoteModal");
    });

    // Modal chuyển bàn close
    document.getElementById("btnCloseTransferModal").addEventListener("click", () => {
      this.closeModal("transferModal");
    });

    // Mở modal thêm món ngoài menu
    const btnCustomFromMenu = document.getElementById("btnOpenCustomItemFromMenu");
    if (btnCustomFromMenu) {
      btnCustomFromMenu.addEventListener("click", () => {
        this.openCustomItemModal();
      });
    }

    const btnCustomFromOrder = document.getElementById("btnOpenCustomItemFromOrder");
    if (btnCustomFromOrder) {
      btnCustomFromOrder.addEventListener("click", () => {
        this.openCustomItemModal();
      });
    }

    const btnCustomFromEmpty = document.getElementById("btnCustomItemFromEmpty");
    if (btnCustomFromEmpty) {
      btnCustomFromEmpty.addEventListener("click", () => {
        this.openCustomItemModal();
      });
    }

    // Modal món ngoài menu events
    const btnCloseCustom = document.getElementById("btnCloseCustomItemModal");
    if (btnCloseCustom) {
      btnCloseCustom.addEventListener("click", () => {
        this.closeModal("customItemModal");
      });
    }

    // Tăng giảm số lượng món ngoài menu
    const btnCustomMinus = document.getElementById("btnCustomQtyMinus");
    const btnCustomPlus = document.getElementById("btnCustomQtyPlus");
    const customQtyVal = document.getElementById("customQtyVal");

    if (btnCustomMinus && btnCustomPlus && customQtyVal) {
      btnCustomMinus.addEventListener("click", () => {
        if (this.customItemQty > 1) {
          this.customItemQty -= 1;
          customQtyVal.textContent = this.customItemQty;
        }
      });
      btnCustomPlus.addEventListener("click", () => {
        this.customItemQty += 1;
        customQtyVal.textContent = this.customItemQty;
      });
    }

    // Gợi ý giá nhanh cho món ngoài menu
    document.querySelectorAll(".btn-quick-custom-price").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-val");
        const priceInput = document.getElementById("customItemPriceInput");
        if (priceInput) priceInput.value = val;
      });
    });

    // Gợi ý tên nhanh cho món ngoài menu
    document.querySelectorAll(".quick-custom-name-tag").forEach(tag => {
      tag.addEventListener("click", () => {
        const name = tag.getAttribute("data-name");
        const nameInput = document.getElementById("customItemNameInput");
        if (nameInput) nameInput.value = name;
      });
    });

    // Nút xác nhận thêm món ngoài menu vào bàn
    const btnConfirmCustom = document.getElementById("btnConfirmAddCustomItem");
    if (btnConfirmCustom) {
      btnConfirmCustom.addEventListener("click", () => {
        const nameInput = document.getElementById("customItemNameInput");
        const priceInput = document.getElementById("customItemPriceInput");
        const noteInput = document.getElementById("customItemNoteInput");
        const name = nameInput.value.trim();
        const price = Number(priceInput.value);

        if (!name) {
          alert("Vui lòng nhập tên món hoặc nội dung khoản thu.");
          nameInput.focus();
          return;
        }

        if (priceInput.value.trim() === "" || isNaN(price) || price < 0) {
          alert("Vui lòng nhập đơn giá hợp lệ.");
          priceInput.focus();
          return;
        }

        const activeTable = store.getActiveTable();
        store.addCustomItemToTable(activeTable.id, {
          name,
          price,
          quantity: this.customItemQty,
          note: noteInput.value.trim()
        });

        this.closeModal("customItemModal");
        this.renderAll();
      });
    }

    // Mở modal ghi chú bàn
    const btnOpenTableNote = document.getElementById("btnOpenTableNoteModal");
    if (btnOpenTableNote) {
      btnOpenTableNote.addEventListener("click", () => {
        this.openTableNoteModal();
      });
    }

    const btnCloseTableNote = document.getElementById("btnCloseTableNoteModal");
    if (btnCloseTableNote) {
      btnCloseTableNote.addEventListener("click", () => {
        this.closeModal("tableNoteModal");
      });
    }

    // Gợi ý ghi chú bàn nhanh
    document.querySelectorAll(".quick-table-note-tag").forEach(tag => {
      tag.addEventListener("click", () => {
        const text = tag.getAttribute("data-note");
        const noteInput = document.getElementById("tableNoteInput");
        if (noteInput) {
          noteInput.value = noteInput.value ? noteInput.value + ", " + text : text;
        }
      });
    });

    // Lưu ghi chú bàn
    const btnSaveTableNote = document.getElementById("btnSaveTableNote");
    if (btnSaveTableNote) {
      btnSaveTableNote.addEventListener("click", () => {
        const noteInput = document.getElementById("tableNoteInput");
        const note = noteInput ? noteInput.value.trim() : "";
        const activeTable = store.getActiveTable();
        store.updateTableNote(activeTable.id, note);
        this.closeModal("tableNoteModal");
        this.renderAll();
      });
    }

    // Xóa ghi chú bàn
    const btnClearTableNote = document.getElementById("btnClearTableNote");
    if (btnClearTableNote) {
      btnClearTableNote.addEventListener("click", () => {
        const activeTable = store.getActiveTable();
        store.updateTableNote(activeTable.id, "");
        this.closeModal("tableNoteModal");
        this.renderAll();
      });
    }

    // Thêm sản phẩm mới vào danh mục trong Cài đặt
    const btnAddNewProduct = document.getElementById("btnAddNewProduct");
    if (btnAddNewProduct) {
      btnAddNewProduct.addEventListener("click", () => {
        const nameInput = document.getElementById("newProductName");
        const priceInput = document.getElementById("newProductPrice");
        const catSelect = document.getElementById("newProductCategory");
        const name = nameInput.value.trim();
        const price = Number(priceInput.value);
        const category = catSelect.value;

        if (!name) {
          alert("Vui lòng nhập tên sản phẩm mới.");
          nameInput.focus();
          return;
        }

        if (priceInput.value.trim() === "" || isNaN(price) || price <= 0) {
          alert("Vui lòng nhập giá bán hợp lệ lớn hơn 0.");
          priceInput.focus();
          return;
        }

        store.addMenuItem({ name, price, category });
        nameInput.value = "";
        priceInput.value = "";
        this.renderSettingsCustomProducts();
        this.renderMenu();
        alert(`Đã lưu "${name}" vào danh mục thực đơn.`);
      });
    }

    // Modal Cài đặt & Sao lưu
    document.getElementById("btnOpenSettings").addEventListener("click", () => {
      this.renderSettingsCustomProducts();
      this.openModal("settingsModal");
    });

    document.getElementById("btnCloseSettingsModal").addEventListener("click", () => {
      this.closeModal("settingsModal");
    });

    document.getElementById("btnExportData").addEventListener("click", () => {
      this.exportJsonFile();
    });

    document.getElementById("fileImportInput").addEventListener("change", (e) => {
      this.importJsonFile(e);
    });

    document.getElementById("btnResetAllData").addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn đặt lại toàn bộ dữ liệu 50 bàn và lịch sử về ban đầu?")) {
        store.resetData();
        this.renderAll();
        this.closeModal("settingsModal");
        alert("Đã đặt lại dữ liệu mặc định thành công.");
      }
    });
  }

  // Render toàn bộ ứng dụng
  renderAll() {
    this.renderTables();
    this.renderMenu();
    this.renderCurrentOrder();
    this.renderReports();
    this.updateBadges();
  }

  // Cập nhật số liệu trên Header/Badge
  updateBadges() {
    const tables = store.getTables();
    const occupied = tables.filter(t => t.status === "occupied");
    const empty = tables.filter(t => t.status === "empty");
    const totalTemp = tables.reduce((s, t) => s + (t.totalAmount || 0), 0);

    const occCountEl = document.getElementById("occupiedCount");
    const empCountEl = document.getElementById("emptyCount");
    if (occCountEl) occCountEl.textContent = occupied.length;
    if (empCountEl) empCountEl.textContent = empty.length;

    const badgeEl = document.getElementById("tablesTotalRevenueBadge");
    if (badgeEl) badgeEl.textContent = "Tạm tính: " + formatMoney(totalTemp);

    const activeTable = store.getActiveTable();
    const activeTableTitle = document.getElementById("activeTableTitle");
    const currentOrderTitle = document.getElementById("currentOrderTableTitle");

    if (activeTable) {
      if (activeTableTitle) {
        activeTableTitle.textContent = `Đang phục vụ: ${activeTable.name}${activeTable.note ? ` (${activeTable.note})` : ""}`;
      }
      if (currentOrderTitle) {
        currentOrderTitle.textContent = `Chi tiết ${activeTable.name}`;
      }
    }

    // Badge số lượng món trên tab Đơn hàng
    const orderBadge = document.getElementById("navOrderBadge");
    if (orderBadge) {
      const currentItemsCount = activeTable ? activeTable.orderItems.reduce((c, i) => c + i.quantity, 0) : 0;
      if (currentItemsCount > 0) {
        orderBadge.textContent = currentItemsCount;
        orderBadge.style.display = "inline-block";
      } else {
        orderBadge.style.display = "none";
      }
    }
  }

  // 1. RENDER SƠ ĐỒ 50 BÀN
  renderTables() {
    const container = document.getElementById("tablesGridContainer");
    if (!container) return;

    let tables = store.getTables();
    if (this.tableFilter === "occupied") {
      tables = tables.filter(t => t.status === "occupied");
    } else if (this.tableFilter === "empty") {
      tables = tables.filter(t => t.status === "empty");
    }

    const activeTable = store.getActiveTable();

    container.innerHTML = tables.map(table => {
      const isCurrent = activeTable && activeTable.id === table.id;
      const totalItems = table.orderItems.reduce((acc, i) => acc + i.quantity, 0);

      return `
        <div class="table-card ${table.status} ${isCurrent ? "current-active" : ""}" data-id="${table.id}">
          <div class="table-card-top">
            <span class="table-number">${table.name}</span>
            <span class="status-dot"></span>
          </div>
          <div class="table-card-bottom">
            <div class="table-item-count">
              ${table.status === "occupied" ? `${totalItems} món` : "Trống"}
            </div>
            ${table.totalAmount > 0 ? `<div class="table-price-tag">${formatMoney(table.totalAmount)}</div>` : ""}
            ${table.note ? `
              <div class="table-card-note" title="${table.note.replace(/"/g, '&quot;')}">
                ${ICONS.note}
                <span>${table.note}</span>
              </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".table-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = Number(card.getAttribute("data-id"));
        store.setActiveTableId(id);
        const clickedTable = store.getTable(id);
        if (clickedTable.orderItems.length > 0) {
          this.switchView("viewCurrentOrder");
        } else {
          this.switchView("viewMenu");
        }
        this.renderAll();
      });
    });
  }

  // 2. RENDER THỰC ĐƠN & TÌM KIẾM NHANH
  renderMenu() {
    const container = document.getElementById("menuGridContainer");
    if (!container) return;

    let menu = store.getMenu();

    // Lọc theo danh mục
    if (this.selectedCategory !== "all") {
      menu = menu.filter(item => item.category === this.selectedCategory);
    }

    // Lọc theo tìm kiếm tức thì không dấu
    if (this.searchQuery) {
      const q = removeVietnameseTones(this.searchQuery);
      menu = menu.filter(item => {
        const nameNoTone = removeVietnameseTones(item.name);
        return nameNoTone.includes(q);
      });
    }

    if (menu.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--text-muted);">
          <p>Không tìm thấy món nước phù hợp với từ khóa "${this.searchQuery}".</p>
          <button class="btn-primary" id="btnAddSearchAsCustomItem" style="margin: 14px auto 0; max-width: 260px; height: 38px; font-size: 13px;">
            + Thêm "${this.searchQuery}" vào bàn
          </button>
        </div>
      `;
      const btnAddSearch = document.getElementById("btnAddSearchAsCustomItem");
      if (btnAddSearch) {
        btnAddSearch.addEventListener("click", () => {
          this.openCustomItemModal(this.searchQuery);
        });
      }
      return;
    }

    const catMap = {};
    CATEGORIES.forEach(c => catMap[c.id] = c.name);

    container.innerHTML = menu.map(item => `
      <div class="menu-item-card" data-id="${item.id}">
        <div class="menu-item-info">
          <div class="menu-item-name">${item.name}</div>
          <div class="menu-item-category">${catMap[item.category] || ""}</div>
          <div class="menu-item-price">${formatMoney(item.price)}</div>
        </div>
        <div class="menu-item-action">
          <button class="btn-add-item" data-add-id="${item.id}" title="Thêm vào bàn">
            ${ICONS.plus}
          </button>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".btn-add-item").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemId = btn.getAttribute("data-add-id");
        const menuItem = store.getMenu().find(m => m.id === itemId);
        if (menuItem) {
          const activeTable = store.getActiveTable();
          store.addItemToTable(activeTable.id, menuItem, 1, "");
          this.renderAll();
          // Micro animation nhẹ phản hồi chạm
          btn.style.transform = "scale(1.2)";
          setTimeout(() => btn.style.transform = "scale(1)", 150);
        }
      });
    });
  }

  // 3. RENDER CHI TIẾT ĐƠN HÀNG CỦA BÀN ĐANG CHỌN
  renderCurrentOrder() {
    const activeTable = store.getActiveTable();
    const emptyState = document.getElementById("orderEmptyState");
    const container = document.getElementById("orderItemsContainer");
    const summaryBox = document.getElementById("orderSummaryBox");
    const totalEl = document.getElementById("orderSummaryTotal");

    // Hiển thị ghi chú của bàn
    const tableNoteDisplay = document.getElementById("tableNoteDisplay");
    if (tableNoteDisplay) {
      if (activeTable && activeTable.note) {
        tableNoteDisplay.textContent = activeTable.note;
        tableNoteDisplay.classList.add("has-note");
      } else {
        tableNoteDisplay.textContent = "Chưa có ghi chú cho bàn này...";
        tableNoteDisplay.classList.remove("has-note");
      }
    }

    if (!activeTable || activeTable.orderItems.length === 0) {
      emptyState.style.display = "block";
      container.style.display = "none";
      summaryBox.style.display = "none";
      return;
    }

    emptyState.style.display = "none";
    container.style.display = "block";
    summaryBox.style.display = "block";
    totalEl.textContent = formatMoney(activeTable.totalAmount);

    container.innerHTML = activeTable.orderItems.map(item => `
      <div class="order-item-row" data-id="${item.itemId}" data-note="${item.note || ""}">
        <div class="order-item-left">
          <div class="order-item-title">
            ${item.name}
            ${item.isCustom ? `<span class="order-item-custom-badge">Món ngoài</span>` : ""}
          </div>
          <div class="order-item-sub">${formatMoney(item.price)} x ${item.quantity} = <b>${formatMoney(item.price * item.quantity)}</b></div>
          <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; color: var(--text-muted);">
              Ghi chú: ${item.note ? `<b style="color: var(--primary);">${item.note}</b>` : "Không"}
            </span>
            <button class="btn-edit-note" data-id="${item.itemId}" data-note="${item.note || ""}" style="background: none; border: none; font-size: 11px; color: var(--primary); cursor: pointer; text-decoration: underline;">Sửa</button>
          </div>
        </div>
        <div class="order-item-right">
          <div class="qty-control">
            <button class="qty-btn btn-minus" data-id="${item.itemId}" data-note="${item.note || ""}">${ICONS.minus}</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn btn-plus" data-id="${item.itemId}" data-note="${item.note || ""}">${ICONS.plus}</button>
          </div>
          <button class="qty-btn btn-del" data-id="${item.itemId}" data-note="${item.note || ""}" style="color: var(--danger);" title="Xóa món">${ICONS.trash}</button>
        </div>
      </div>
    `).join("");

    // Events tăng/giảm/xóa/ghi chú
    container.querySelectorAll(".btn-plus").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const note = btn.getAttribute("data-note");
        store.updateItemQuantity(activeTable.id, id, note, 1);
        this.renderAll();
      });
    });

    container.querySelectorAll(".btn-minus").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const note = btn.getAttribute("data-note");
        store.updateItemQuantity(activeTable.id, id, note, -1);
        this.renderAll();
      });
    });

    container.querySelectorAll(".btn-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const note = btn.getAttribute("data-note");
        store.removeItem(activeTable.id, id, note);
        this.renderAll();
      });
    });

    container.querySelectorAll(".btn-edit-note").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const note = btn.getAttribute("data-note");
        this.openItemNoteModal(id, note);
      });
    });
  }

  // 4. RENDER BÁO CÁO & LỊCH SỬ
  renderReports() {
    const stats = store.getDailyStats();

    const revEl = document.getElementById("statTodayRevenue");
    const ordEl = document.getElementById("statTodayOrders");
    if (revEl) revEl.textContent = formatMoney(stats.todayRevenue);
    if (ordEl) ordEl.textContent = stats.todayOrders;

    const topListEl = document.getElementById("topItemsList");
    if (topListEl) {
      if (stats.topItems.length === 0) {
        topListEl.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px 0;">Chưa có dữ liệu bán hôm nay.</p>`;
      } else {
        topListEl.innerHTML = stats.topItems.map((item, idx) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--border-color); font-size: 13px;">
            <span><b>#${idx + 1}</b> ${item.name}</span>
            <span><b>${item.quantity} ly</b> (${formatMoney(item.revenue)})</span>
          </div>
        `).join("");
      }
    }

    const historyEl = document.getElementById("invoicesHistoryList");
    if (historyEl) {
      if (stats.allInvoices.length === 0) {
        historyEl.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px 0;">Chưa có hóa đơn nào hoàn thành.</p>`;
      } else {
        historyEl.innerHTML = stats.allInvoices.slice(0, 15).map(inv => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-color); font-size: 13px;">
            <div>
              <div style="font-weight: 700;">${inv.tableName} <span style="font-size: 11px; font-weight: normal; color: var(--text-muted);">(${inv.id})</span></div>
              <div style="font-size: 11px; color: var(--text-muted);">${new Date(inv.paidAt).toLocaleTimeString("vi-VN")} - ${inv.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản"}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; color: var(--primary);">${formatMoney(inv.totalAmount)}</div>
              <button class="btn-view-invoice" data-inv-id="${inv.id}" style="background: none; border: none; color: var(--primary); font-size: 11px; cursor: pointer; text-decoration: underline;">Xem bill</button>
            </div>
          </div>
        `).join("");

        historyEl.querySelectorAll(".btn-view-invoice").forEach(btn => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-inv-id");
            const inv = stats.allInvoices.find(i => i.id === id);
            if (inv) this.showReceiptModal(inv);
          });
        });
      }
    }
  }

  // MODAL THANH TOÁN
  openCheckoutModal() {
    const activeTable = store.getActiveTable();
    if (!activeTable || activeTable.orderItems.length === 0) return;

    document.getElementById("checkoutModalTitle").textContent = `Thanh toán ${activeTable.name}`;
    document.getElementById("checkoutTotalAmount").textContent = formatMoney(activeTable.totalAmount);
    document.getElementById("customerCashInput").value = activeTable.totalAmount;
    document.getElementById("changeAmountText").textContent = "0đ";

    // Ghi chú bàn trong thanh toán
    let noteEl = document.getElementById("checkoutTableNoteNotice");
    if (!noteEl) {
      noteEl = document.createElement("div");
      noteEl.id = "checkoutTableNoteNotice";
      noteEl.style.cssText = "font-size: 12px; color: var(--primary); background: var(--primary-light); padding: 6px 10px; border-radius: var(--radius-sm); margin-bottom: 12px; text-align: center;";
      const amountEl = document.getElementById("checkoutTotalAmount");
      if (amountEl && amountEl.parentNode) {
        amountEl.parentNode.after(noteEl);
      }
    }
    if (activeTable.note) {
      noteEl.innerHTML = `Ghi chú bàn: <b>${activeTable.note}</b>`;
      noteEl.style.display = "block";
    } else {
      noteEl.style.display = "none";
    }

    // Nút gợi ý tiền mặt
    const quickCashContainer = document.getElementById("quickCashButtons");
    const total = activeTable.totalAmount;
    const suggestions = [total, 50000, 100000, 200000, 500000].filter((val, i, arr) => val >= total && arr.indexOf(val) === i).slice(0, 4);

    quickCashContainer.innerHTML = suggestions.map(val => `
      <button class="filter-chip btn-quick-cash" data-val="${val}">${formatMoney(val)}</button>
    `).join("");

    quickCashContainer.querySelectorAll(".btn-quick-cash").forEach(b => {
      b.addEventListener("click", () => {
        const val = Number(b.getAttribute("data-val"));
        document.getElementById("customerCashInput").value = val;
        this.calculateCashChange();
      });
    });

    // Cập nhật mã VietQR
    const qrTransferNote = `BuiCoffee ${activeTable.code}`;
    document.getElementById("qrTransferNote").textContent = qrTransferNote;
    const qrUrl = `https://api.vietqr.io/image/970422-0988888888-compact2.png?amount=${total}&addInfo=${encodeURIComponent(qrTransferNote)}&accountName=BUI%20COFFEE`;
    document.getElementById("vietQrImgContainer").innerHTML = `
      <img src="${qrUrl}" alt="VietQR" style="width: 200px; height: 200px; object-fit: contain; display: block; margin: 0 auto;" onerror="this.onerror=null;this.parentElement.innerHTML='<p style=\\'font-size:12px;padding:20px;\\'>Quét mã QR thanh toán ${formatMoney(total)}</p>'">
    `;

    this.setPaymentMethod("cash");
    this.openModal("checkoutModal");
  }

  setPaymentMethod(method) {
    this.paymentMethod = method;
    const btnCash = document.getElementById("btnPayMethodCash");
    const btnQR = document.getElementById("btnPayMethodQR");
    const cashBox = document.getElementById("cashPaymentBox");
    const qrBox = document.getElementById("qrPaymentBox");

    if (method === "cash") {
      btnCash.classList.add("active");
      btnQR.classList.remove("active");
      cashBox.style.display = "block";
      qrBox.style.display = "none";
      this.calculateCashChange();
    } else {
      btnQR.classList.add("active");
      btnCash.classList.remove("active");
      cashBox.style.display = "none";
      qrBox.style.display = "block";
    }
  }

  calculateCashChange() {
    const activeTable = store.getActiveTable();
    if (!activeTable) return;
    const total = activeTable.totalAmount;
    const cashInput = Number(document.getElementById("customerCashInput").value) || 0;
    const change = cashInput >= total ? cashInput - total : 0;
    document.getElementById("changeAmountText").textContent = formatMoney(change);
  }

  processPayment() {
    const activeTable = store.getActiveTable();
    if (!activeTable || activeTable.orderItems.length === 0) return;

    const cashInput = Number(document.getElementById("customerCashInput").value) || activeTable.totalAmount;
    const invoice = store.completePayment(activeTable.id, this.paymentMethod, cashInput);

    this.closeModal("checkoutModal");
    this.renderAll();
    if (invoice) {
      this.showReceiptModal(invoice);
    }
  }

  // MODAL HÓA ĐƠN
  showReceiptModal(invoice) {
    const container = document.getElementById("receiptContent");
    container.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-title">${SHOP_INFO.name.toUpperCase()}</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${SHOP_INFO.slogan}</div>
        <div style="font-size: 12px; margin-top: 4px;">Pass Wifi: <b>${invoice.wifiPass || SHOP_INFO.wifiPass}</b></div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Số HĐ: ${invoice.id} | Bàn: ${invoice.tableName}</div>
        ${invoice.tableNote ? `<div style="font-size: 11px; color: var(--primary); margin-top: 2px;">Ghi chú bàn: <b>${invoice.tableNote}</b></div>` : ""}
        <div style="font-size: 11px; color: var(--text-muted);">${new Date(invoice.paidAt).toLocaleString("vi-VN")}</div>
      </div>
      <div style="margin-bottom: 10px;">
        ${invoice.items.map(item => `
          <div class="receipt-row">
            <div>
              <span>${item.name}</span>
              ${item.note ? `<div style="font-size: 10px; color: var(--text-muted);">${item.note}</div>` : ""}
            </div>
            <span>${item.quantity} x ${formatMoney(item.price)}</span>
          </div>
        `).join("")}
      </div>
      <div class="receipt-total">
        <span>TỔNG TIỀN:</span>
        <span>${formatMoney(invoice.totalAmount)}</span>
      </div>
      <div class="receipt-row" style="font-size: 12px; margin-top: 4px;">
        <span>Hình thức:</span>
        <span>${invoice.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản"}</span>
      </div>
      ${invoice.paymentMethod === "cash" ? `
        <div class="receipt-row" style="font-size: 12px;">
          <span>Tiền khách đưa:</span>
          <span>${formatMoney(invoice.customerCash)}</span>
        </div>
        <div class="receipt-row" style="font-size: 12px;">
          <span>Tiền thừa:</span>
          <span>${formatMoney(invoice.changeAmount)}</span>
        </div>
      ` : ""}
      <div class="receipt-footer">
        Cảm ơn Quý Khách - Hẹn Gặp Lại!
      </div>
    `;

    this.openModal("receiptModal");
  }

  // MODAL CHUYỂN BÀN
  openTransferModal(isSwitchOnly = false) {
    const activeTable = store.getActiveTable();
    const titleEl = document.getElementById("transferModalTitle");
    const container = document.getElementById("transferTablesGrid");

    if (isSwitchOnly) {
      titleEl.textContent = "Chọn bàn phục vụ";
    } else {
      titleEl.textContent = `Chuyển/Gộp ${activeTable.name} sang bàn khác`;
    }

    const allTables = store.getTables();
    container.innerHTML = allTables.map(t => {
      const isCurrent = t.id === activeTable.id;
      return `
        <div class="table-card ${t.status} ${isCurrent ? "current-active" : ""}" data-transfer-id="${t.id}" style="min-height: 60px; padding: 8px;">
          <div class="table-card-top">
            <span class="table-number" style="font-size: 12px;">${t.name}</span>
            <span class="status-dot"></span>
          </div>
          <div style="font-size: 10px; color: var(--text-muted);">
            ${t.status === "occupied" ? `${t.orderItems.reduce((s, i) => s + i.quantity, 0)} món` : "Trống"}
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-transfer-id]").forEach(card => {
      card.addEventListener("click", () => {
        const targetId = Number(card.getAttribute("data-transfer-id"));
        if (isSwitchOnly) {
          store.setActiveTableId(targetId);
          this.closeModal("transferModal");
          this.renderAll();
        } else {
          if (targetId === activeTable.id) {
            alert("Không thể chuyển tới chính bàn này.");
            return;
          }
          const targetTable = store.getTable(targetId);
          const confirmMsg = targetTable.status === "occupied"
            ? `Bàn ${targetTable.name} đang có món. Bạn có muốn GỘP ${activeTable.name} vào ${targetTable.name}?`
            : `Chuyển toàn bộ món từ ${activeTable.name} sang ${targetTable.name}?`;

          if (confirm(confirmMsg)) {
            store.transferTable(activeTable.id, targetId);
            this.closeModal("transferModal");
            this.renderAll();
          }
        }
      });
    });

    this.openModal("transferModal");
  }

  // MODAL GHI CHÚ
  openItemNoteModal(itemId, currentNote) {
    this.editingNoteItem = { itemId, currentNote };
    const input = document.getElementById("itemCustomNoteInput");
    input.value = currentNote || "";
    this.openModal("itemNoteModal");
    setTimeout(() => input.focus(), 200);
  }

  // MODAL THÊM MÓN NGOÀI MENU / PHỤ THU
  openCustomItemModal(prefilledName = "") {
    const activeTable = store.getActiveTable();
    this.customItemQty = 1;
    const titleEl = document.getElementById("customItemModalTitle");
    if (titleEl && activeTable) {
      titleEl.textContent = `Thêm món ngoài menu - ${activeTable.name}`;
    }

    const nameInput = document.getElementById("customItemNameInput");
    const priceInput = document.getElementById("customItemPriceInput");
    const noteInput = document.getElementById("customItemNoteInput");
    const qtyVal = document.getElementById("customQtyVal");

    if (nameInput) nameInput.value = prefilledName || "";
    if (priceInput) priceInput.value = "";
    if (noteInput) noteInput.value = "";
    if (qtyVal) qtyVal.textContent = "1";

    this.openModal("customItemModal");
    setTimeout(() => {
      if (prefilledName && priceInput) {
        priceInput.focus();
      } else if (nameInput) {
        nameInput.focus();
      }
    }, 200);
  }

  // MODAL GHI CHÚ BÀN
  openTableNoteModal() {
    const activeTable = store.getActiveTable();
    if (!activeTable) return;

    const titleEl = document.getElementById("tableNoteModalTitle");
    if (titleEl) {
      titleEl.textContent = `Ghi chú cho ${activeTable.name}`;
    }

    const input = document.getElementById("tableNoteInput");
    if (input) {
      input.value = activeTable.note || "";
    }

    this.openModal("tableNoteModal");
    setTimeout(() => {
      if (input) input.focus();
    }, 200);
  }

  // RENDER DANH SÁCH MÓN TỰ THÊM TRONG CÀI ĐẶT
  renderSettingsCustomProducts() {
    const list = document.getElementById("customProductsList");
    const countEl = document.getElementById("customProductsCount");
    if (!list) return;

    const catMap = {};
    CATEGORIES.forEach(c => catMap[c.id] = c.name);

    const customItems = store.getMenu().filter(m => m.isCustomCreated);
    if (countEl) countEl.textContent = customItems.length;

    if (customItems.length === 0) {
      list.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 10px 0;">Chưa có món tự thêm nào trong thực đơn.</div>`;
      return;
    }

    list.innerHTML = customItems.map(item => `
      <div class="custom-product-item">
        <div class="custom-product-item-info">
          <div class="custom-product-item-title">${item.name}</div>
          <div class="custom-product-item-meta">${catMap[item.category] || item.category} - <b style="color: var(--primary);">${formatMoney(item.price)}</b></div>
        </div>
        <button class="btn-del-menu-item" data-del-id="${item.id}" title="Xóa món khỏi thực đơn">
          ${ICONS.trash}
        </button>
      </div>
    `).join("");

    list.querySelectorAll(".btn-del-menu-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del-id");
        const item = store.getMenu().find(m => m.id === id);
        if (item && confirm(`Bạn có chắc muốn xóa món "${item.name}" khỏi thực đơn?`)) {
          store.deleteMenuItem(id);
          this.renderSettingsCustomProducts();
          this.renderMenu();
        }
      });
    });
  }

  // SAO LƯU VÀ KHÔI PHỤC DỮ LIỆU
  exportJsonFile() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(store.exportData());
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("download", `bui_coffee_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importJsonFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const success = store.importData(e.target.result);
      if (success) {
        alert("Khôi phục dữ liệu sao lưu thành công!");
        this.renderAll();
        this.closeModal("settingsModal");
      } else {
        alert("File dữ liệu không đúng định dạng. Vui lòng kiểm tra lại.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("active");
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("active");
  }
}

// Khởi chạy ứng dụng khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", () => {
  window.coffeeApp = new CoffeeApp();
});
