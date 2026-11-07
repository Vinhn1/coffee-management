// Dữ liệu gốc Bụi Coffee trích xuất chính xác từ bảng menu thực tế
export const SHOP_INFO = {
  name: "Bụi Coffee",
  slogan: "Cà phê & Thức uống giải khát",
  wifiPass: "68686868",
  totalTables: 50,
  currency: "đ"
};

// Cấu hình các ca làm việc
export const SHIFT_DEFS = {
  morning: { id: "morning", name: "Ca sáng", timeLabel: "5h30 - 11h", hours: 5.5 },
  afternoon: { id: "afternoon", name: "Ca trưa", timeLabel: "11h - 17h", hours: 6.0 },
  evening: { id: "evening", name: "Ca tối", timeLabel: "16h30 - 23h", hours: 6.5 }
};

export const CATEGORIES = [
  { id: "all", name: "Tất cả" },
  { id: "coffee", name: "Coffee pha máy" },
  { id: "tea", name: "Trà trái cây" },
  { id: "juice", name: "Nước ép" },
  { id: "smoothie", name: "Sinh tố" },
  { id: "ice_blend", name: "Đá xay" },
  { id: "yaourt", name: "Yaourt trái cây" },
  { id: "bottled", name: "Thức uống đóng chai" }
];

export const INITIAL_MENU = [
  // COFFEE PHA MÁY
  { id: "c1", name: "Cà phê đen đá", price: 18000, category: "coffee" },
  { id: "c2", name: "Cà phê sữa đá", price: 20000, category: "coffee" },
  { id: "c3", name: "Bạc xỉu đá", price: 24000, category: "coffee" },
  { id: "c4", name: "Cacao sữa", price: 25000, category: "coffee" },

  // TRÀ TRÁI CÂY
  { id: "t1", name: "Trà ô lông ổi hồng", price: 25000, category: "tea" },
  { id: "t2", name: "Trà lipton", price: 18000, category: "tea" },
  { id: "t3", name: "Trà lipton sữa", price: 22000, category: "tea" },
  { id: "t4", name: "Trà đào", price: 25000, category: "tea" },
  { id: "t5", name: "Trà đào cam xả", price: 27000, category: "tea" },
  { id: "t6", name: "Trà dâu", price: 25000, category: "tea" },
  { id: "t7", name: "Trà mãng cầu", price: 27000, category: "tea" },
  { id: "t8", name: "Trà Việt Quất", price: 25000, category: "tea" },
  { id: "t9", name: "Trà đường", price: 15000, category: "tea" },
  { id: "t10", name: "Trà tắc", price: 20000, category: "tea" },
  { id: "t11", name: "Trà chanh", price: 20000, category: "tea" },

  // YAOURT TRÁI CÂY
  { id: "y1", name: "Yaourt đá", price: 20000, category: "yaourt" },
  { id: "y2", name: "Yaourt việt quất", price: 25000, category: "yaourt" },
  { id: "y3", name: "Yaourt dâu", price: 25000, category: "yaourt" },
  { id: "y4", name: "Yaourt chanh dây", price: 25000, category: "yaourt" },
  { id: "y5", name: "Yaourt đào", price: 25000, category: "yaourt" },

  // THỨC UỐNG ĐÓNG CHAI
  { id: "b1", name: "Pepsi", price: 18000, category: "bottled" },
  { id: "b2", name: "Sting", price: 18000, category: "bottled" },
  { id: "b3", name: "Coca-cola", price: 18000, category: "bottled" },
  { id: "b4", name: "Suối", price: 10000, category: "bottled" },
  { id: "b5", name: "Red Bull", price: 20000, category: "bottled" },

  // NƯỚC ÉP
  { id: "j1", name: "Nước ép Táo", price: 28000, category: "juice" },
  { id: "j2", name: "Nước ép chanh dây", price: 28000, category: "juice" },
  { id: "j3", name: "Nước ép ổi", price: 28000, category: "juice" },
  { id: "j4", name: "Nước ép thơm cà rốt", price: 28000, category: "juice" },
  { id: "j5", name: "Nước ép thơm chanh dây", price: 28000, category: "juice" },
  { id: "j6", name: "Nước ép thơm", price: 28000, category: "juice" },
  { id: "j7", name: "Nước ép cà rốt", price: 28000, category: "juice" },
  { id: "j8", name: "Nước ép cam", price: 28000, category: "juice" },
  { id: "j9", name: "Nước ép dưa hấu", price: 28000, category: "juice" },
  { id: "j10", name: "Dừa tươi", price: 22000, category: "juice" },
  { id: "j11", name: "Rau má dừa", price: 20000, category: "juice" },
  { id: "j12", name: "Nước ép chanh tươi", price: 20000, category: "juice" },
  { id: "j13", name: "Chanh muối xí muội", price: 20000, category: "juice" },
  { id: "j14", name: "Tắc muối xí muội", price: 20000, category: "juice" },
  { id: "j15", name: "Đá me", price: 20000, category: "juice" },

  // SINH TỐ
  { id: "s1", name: "Sinh tố bơ", price: 32000, category: "smoothie" },
  { id: "s2", name: "Sinh tố dâu", price: 32000, category: "smoothie" },
  { id: "s3", name: "Sinh tố Saboche", price: 32000, category: "smoothie" },
  { id: "s4", name: "Sinh tố mãng cầu", price: 32000, category: "smoothie" },
  { id: "s5", name: "Sinh tố chanh tuyết", price: 32000, category: "smoothie" },

  // ĐÁ XAY
  { id: "ib1", name: "Việt quất đá xay", price: 30000, category: "ice_blend" },
  { id: "ib2", name: "Cà phê đá xay", price: 30000, category: "ice_blend" },
  { id: "ib3", name: "Cacao đá xay", price: 30000, category: "ice_blend" },
  { id: "ib4", name: "Đá xay bốn mùa", price: 35000, category: "ice_blend" }
];

// Tạo 50 bàn phục vụ
export const INITIAL_TABLES = Array.from({ length: 50 }, (_, i) => {
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
