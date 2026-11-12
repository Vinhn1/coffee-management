(function (root, factory) {
  const api = factory();
  root.BuiCoffee = Object.assign(root.BuiCoffee || {}, api);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
// Dữ liệu gốc Bụi Coffee trích xuất chính xác từ bảng menu thực tế
const SHOP_INFO = {
  name: "Bụi Coffee",
  slogan: "Cà phê & Thức uống giải khát",
  wifiPass: "68686868",
  totalTables: 50,
  currency: "đ"
};

// Cấu hình các ca làm việc
const SHIFT_DEFS = {
  morning: { id: "morning", name: "Ca sáng", timeLabel: "5h30 - 11h", hours: 5.5 },
  afternoon: { id: "afternoon", name: "Ca trưa", timeLabel: "11h - 17h", hours: 6.0 },
  evening: { id: "evening", name: "Ca tối", timeLabel: "16h30 - 23h", hours: 6.5 }
};

const CATEGORIES = [
  { id: "all", name: "Tất cả" },
  { id: "coffee", name: "Coffee pha máy" },
  { id: "tea", name: "Trà trái cây" },
  { id: "juice", name: "Nước ép" },
  { id: "smoothie", name: "Sinh tố" },
  { id: "ice_blend", name: "Đá xay" },
  { id: "yaourt", name: "Yaourt trái cây" },
  { id: "bottled", name: "Thức uống đóng chai" },
  { id: "other", name: "Khác" }
];

const DRINK_CATEGORY_DEFAULT_IMAGES = {
  coffee: "assets/drinks/c1.jpg",
  tea: "assets/drinks/t4.jpg",
  yaourt: "assets/drinks/y1.jpg",
  bottled: "assets/drinks/b1.jpg",
  juice: "assets/drinks/j8.jpg",
  smoothie: "assets/drinks/s1.jpg",
  ice_blend: "assets/drinks/ib2.jpg",
  other: "assets/drinks/other.jpg"
};

const INITIAL_MENU = [
  // COFFEE PHA MÁY
  { id: "c1", name: "Cà phê đen đá", price: 18000, category: "coffee", image: "assets/drinks/c1.jpg" },
  { id: "c2", name: "Cà phê sữa đá", price: 20000, category: "coffee", image: "assets/drinks/c2.jpg" },
  { id: "c3", name: "Bạc xỉu đá", price: 24000, category: "coffee", image: "assets/drinks/c3.jpg" },
  { id: "c4", name: "Cacao sữa", price: 25000, category: "coffee", image: "assets/drinks/c4.jpg" },
  { id: "c5", name: "Cacao cà phê", price: 26000, category: "coffee", image: "assets/drinks/c5.jpg" },

  // TRÀ TRÁI CÂY
  { id: "t1", name: "Trà ô lông ổi hồng", price: 25000, category: "tea", image: "assets/drinks/t1.jpg" },
  { id: "t2", name: "Trà lipton", price: 18000, category: "tea", image: "assets/drinks/t2.jpg" },
  { id: "t3", name: "Trà lipton sữa", price: 22000, category: "tea", image: "assets/drinks/t3.jpg" },
  { id: "t4", name: "Trà đào", price: 25000, category: "tea", image: "assets/drinks/t4.jpg" },
  { id: "t5", name: "Trà đào cam xả", price: 27000, category: "tea", image: "assets/drinks/t5.jpg" },
  { id: "t6", name: "Trà dâu", price: 25000, category: "tea", image: "assets/drinks/t6.jpg" },
  { id: "t7", name: "Trà mãng cầu", price: 27000, category: "tea", image: "assets/drinks/t7.jpg" },
  { id: "t8", name: "Trà Việt Quất", price: 25000, category: "tea", image: "assets/drinks/t8.jpg" },
  { id: "t9", name: "Trà đường", price: 15000, category: "tea", image: "assets/drinks/t9.jpg" },
  { id: "t10", name: "Trà tắc", price: 20000, category: "tea", image: "assets/drinks/t10.jpg" },
  { id: "t11", name: "Trà chanh", price: 20000, category: "tea", image: "assets/drinks/t11.jpg" },

  // YAOURT TRÁI CÂY
  { id: "y1", name: "Yaourt đá", price: 20000, category: "yaourt", image: "assets/drinks/y1.jpg" },
  { id: "y2", name: "Yaourt việt quất", price: 25000, category: "yaourt", image: "assets/drinks/y2.jpg" },
  { id: "y3", name: "Yaourt dâu", price: 25000, category: "yaourt", image: "assets/drinks/y3.jpg" },
  { id: "y4", name: "Yaourt chanh dây", price: 25000, category: "yaourt", image: "assets/drinks/y4.jpg" },
  { id: "y5", name: "Yaourt đào", price: 25000, category: "yaourt", image: "assets/drinks/y5.jpg" },
  { id: "y6", name: "Yaourt hạt đác", price: 25000, category: "yaourt", image: "assets/drinks/y6.jpg" },

  // THỨC UỐNG ĐÓNG CHAI
  { id: "b1", name: "Pepsi", price: 18000, category: "bottled", image: "assets/drinks/b1.jpg" },
  { id: "b2", name: "Sting", price: 18000, category: "bottled", image: "assets/drinks/b2.jpg" },
  { id: "b3", name: "Coca-cola", price: 18000, category: "bottled", image: "assets/drinks/b3.jpg" },
  { id: "b4", name: "Suối", price: 10000, category: "bottled", image: "assets/drinks/b4.jpg" },
  { id: "b5", name: "Red Bull", price: 20000, category: "bottled", image: "assets/drinks/b5.jpg" },
  { id: "b6", name: "Olong", price: 18000, category: "bottled", image: "assets/drinks/b6.jpg" },

  // NƯỚC ÉP
  { id: "j1", name: "Nước ép Táo", price: 28000, category: "juice", image: "assets/drinks/j1.jpg" },
  { id: "j2", name: "Nước ép chanh dây", price: 28000, category: "juice", image: "assets/drinks/j2.jpg" },
  { id: "j3", name: "Nước ép ổi", price: 28000, category: "juice", image: "assets/drinks/j3.jpg" },
  { id: "j4", name: "Nước ép thơm cà rốt", price: 28000, category: "juice", image: "assets/drinks/j4.jpg" },
  { id: "j5", name: "Nước ép thơm chanh dây", price: 28000, category: "juice", image: "assets/drinks/j5.jpg" },
  { id: "j6", name: "Nước ép thơm", price: 28000, category: "juice", image: "assets/drinks/j6.jpg" },
  { id: "j7", name: "Nước ép cà rốt", price: 28000, category: "juice", image: "assets/drinks/j7.jpg" },
  { id: "j8", name: "Nước ép cam", price: 28000, category: "juice", image: "assets/drinks/j8.jpg" },
  { id: "j9", name: "Nước ép dưa hấu", price: 28000, category: "juice", image: "assets/drinks/j9.jpg" },
  { id: "j10", name: "Dừa tươi", price: 22000, category: "juice", image: "assets/drinks/j10.jpg" },
  { id: "j11", name: "Rau má dừa", price: 20000, category: "juice", image: "assets/drinks/j11.jpg" },
  { id: "j12", name: "Nước ép chanh tươi", price: 20000, category: "juice", image: "assets/drinks/j12.jpg" },
  { id: "j13", name: "Chanh muối xí muội", price: 20000, category: "juice", image: "assets/drinks/j13.jpg" },
  { id: "j14", name: "Tắc muối xí muội", price: 20000, category: "juice", image: "assets/drinks/j14.jpg" },
  { id: "j15", name: "Đá me", price: 20000, category: "juice", image: "assets/drinks/j15.jpg" },
  { id: "j16", name: "Chanh dây hạt đác", price: 32000, category: "juice", image: "assets/drinks/j16.jpg" },
  { id: "j17", name: "Đá me hạt đác", price: 25000, category: "juice", image: "assets/drinks/j17.jpg" },

  // SINH TỐ
  { id: "s1", name: "Sinh tố bơ", price: 32000, category: "smoothie", image: "assets/drinks/s1.jpg" },
  { id: "s2", name: "Sinh tố dâu", price: 32000, category: "smoothie", image: "assets/drinks/s2.jpg" },
  { id: "s3", name: "Sinh tố Saboche", price: 32000, category: "smoothie", image: "assets/drinks/s3.jpg" },
  { id: "s4", name: "Sinh tố mãng cầu", price: 32000, category: "smoothie", image: "assets/drinks/s4.jpg" },
  { id: "s5", name: "Sinh tố chanh tuyết", price: 32000, category: "smoothie", image: "assets/drinks/s5.jpg" },

  // ĐÁ XAY
  { id: "ib1", name: "Việt quất đá xay", price: 30000, category: "ice_blend", image: "assets/drinks/ib1.jpg" },
  { id: "ib2", name: "Cà phê đá xay", price: 30000, category: "ice_blend", image: "assets/drinks/ib2.jpg" },
  { id: "ib3", name: "Cacao đá xay", price: 30000, category: "ice_blend", image: "assets/drinks/ib3.jpg" },
  { id: "ib4", name: "Đá xay bốn mùa", price: 35000, category: "ice_blend", image: "assets/drinks/ib4.jpg" }
];

// Tạo 50 bàn phục vụ
const INITIAL_TABLES = Array.from({ length: 50 }, (_, i) => {
  const tableNum = i + 1;
  const code = tableNum < 10 ? `B0${tableNum}` : `B${tableNum}`;
  const name = `Bàn ${tableNum < 10 ? "0" + tableNum : tableNum}`;
  return {
    id: tableNum,
    code,
    name,
    status: "empty", // "empty" (trống), "occupied" (chưa thanh toán), "paid" (đã thanh toán chờ dọn)
    orderItems: [],  // [{ itemId, name, price, quantity, note }]
    createdAt: null,
    totalAmount: 0,
    note: ""         // Ghi chú riêng cho bàn
  };
});


// ---------------------------------------------------------------------------
// Tra cuu nhanh & Ban nhanh (quick register)
// Luu y: state.menu duoc luu day du trong localStorage, nen alias / thu hang
// duoc giu o cac map rieng (khoa theo id mon) de nguoi dung cu van nhan duoc.
// ---------------------------------------------------------------------------

// Alias tu viet tat (khong dau, chu thuong). Quy tac:
// - khong chua chu so (chu so la so luong, vd "2cfs")
// - khong bat dau bang "x"
const QUICK_ALIASES = {
  c1: ["cfd", "cfden"],
  c2: ["cfs"],
  c3: ["bx", "bacxiu"],
  c4: ["cc", "cacao"],
  c5: ["cccf", "cccp"],

  t1: ["tolh", "olong"],
  t2: ["tl"],
  t3: ["tls"],
  t4: ["td", "tdao"],
  t5: ["tdcx", "dcx"],
  t6: ["tdau"],
  t7: ["tmc"],
  t8: ["tvq"],
  t9: ["tduong", "tdg"],
  t10: ["tac", "ttac"],
  t11: ["tchanh", "tch"],

  y1: ["yd"],
  y2: ["yvq"],
  y3: ["ydau"],
  y4: ["ycd"],
  y5: ["ydao"],
  y6: ["yhd"],

  b1: ["pepsi"],
  b2: ["sting"],
  b3: ["coca", "coke"],
  b4: ["suoi", "nuocsuoi"],
  b5: ["rb", "redbull"],
  b6: ["olchai", "olongchai"],

  j1: ["tao"],
  j2: ["cd", "cday"],
  j3: ["oi"],
  j4: ["tcr"],
  j5: ["tcd"],
  j6: ["thom"],
  j7: ["cr"],
  j8: ["cam", "nec"],
  j9: ["dh"],
  j10: ["dua"],
  j11: ["rmd"],
  j12: ["ct"],
  j13: ["ctx"],
  j14: ["ttx"],
  j15: ["dm"],
  j16: ["cdhd"],
  j17: ["dmhd"],

  s1: ["stb", "bo"],
  s2: ["std"],
  s3: ["sabo"],
  s4: ["stmc"],
  s5: ["stct"],

  ib1: ["vqdx"],
  ib2: ["cfdx"],
  ib3: ["ccdx"],
  ib4: ["dxbm", "bonmua"]
};

// Mon ban chay mac dinh theo thu tu (chi so 0 la ban chay nhat).
// Day la danh sach gia dinh ban dau, se duoc uu tien theo doanh so 30 ngay thuc te.
const BEST_SELLER_IDS = ["c2", "c1", "c3", "c4", "t4", "t5", "t10", "t11", "j8", "y1", "b4", "b1"];

// So o toi da render tren luoi mon ban chay (CSS chi hien 12 o dau tren man hinh nho)
const QUICK_GRID_SIZE = 15;

// Thong tin QR thanh toan cua quan (anh cat tu quay Bui Coffee + fallback text)
const PAYMENT_QR = {
  image: "assets/qr-payment.png",
  bankBin: "970432",
  bankName: "VPBank",
  account: "AGBHENO60422091801",
  accountName: "HKD BUI COFFEE PHUONG"
};

return {
  SHOP_INFO,
  SHIFT_DEFS,
  CATEGORIES,
  DRINK_CATEGORY_DEFAULT_IMAGES,
  INITIAL_MENU,
  INITIAL_TABLES,
  QUICK_ALIASES,
  BEST_SELLER_IDS,
  QUICK_GRID_SIZE,
  PAYMENT_QR
};
});
