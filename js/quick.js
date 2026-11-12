(function (root, factory) {
  const api = factory();
  root.BuiCoffee = Object.assign(root.BuiCoffee || {}, api);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
// Bo may tra cuu nhanh & tinh tien cho Ban nhanh.
// Module thuan logic: khong dung DOM, khong import store. Co the kiem thu bang `node --test`.

const TENDER_DENOMS = [20000, 50000, 100000, 200000, 500000];

const FILLER_TOKENS = new Set(["ep", "tuoi"]);
const MAX_QTY = 99;

// Chuan hoa: chu thuong, bo dau tieng Viet, d-stroke -> d, gop khoang trang
function foldText(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(folded) {
  return folded.split(/[^a-z0-9]+/).filter(Boolean);
}

// Tao viet tat tu ten mon: "Ca phe sua da" -> "cfs", "Bac xiu da" -> "bx", "Tra dao" -> "td"
function autoInitials(name) {
  const folded = foldText(name).replace(/\bca phe\b/g, "cf");
  let tokens = tokenize(folded);

  // Bo cac tu thua (ep, tuoi) chi khi van con it nhat 2 tu
  const withoutFiller = tokens.filter(t => !FILLER_TOKENS.has(t));
  if (withoutFiller.length >= 2) tokens = withoutFiller;

  // Bo "da" o cuoi chi khi con tu 3 tu tro len ("Yaourt da" van la "yd")
  if (tokens.length >= 3 && tokens[tokens.length - 1] === "da") {
    tokens = tokens.slice(0, -1);
  }

  return tokens.map(t => (t === "cf" ? "cf" : t[0])).join("");
}

// Xay dung chi muc tim kiem tu menu
// opts: { aliasMap, extraAliases, salesQty (Map id -> qty), bestSellerIds }
function buildIndex(menu, opts = {}) {
  const aliasMap = opts.aliasMap || {};
  const extraAliases = opts.extraAliases || {};
  const bestSellerIds = opts.bestSellerIds || [];
  const salesQty = opts.salesQty instanceof Map ? opts.salesQty : new Map();

  // Thu hang theo doanh so (uu tien cao hon thu hang mac dinh)
  const salesOrder = [...salesQty.entries()]
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const entries = (menu || []).map((item, order) => {
    const norm = foldText(item.name);
    const explicit = new Set(
      [...(aliasMap[item.id] || []), ...(extraAliases[item.id] || [])]
        .map(a => foldText(a).replace(/\s+/g, ""))
        .filter(Boolean)
    );
    const initials = autoInitials(item.name);
    const auto = new Set(initials ? [initials] : []);

    const salesPos = salesOrder.indexOf(item.id);
    const bestIdx = bestSellerIds.indexOf(item.id);
    const salesBoost = salesPos > -1 ? 100 + Math.max(0, 50 - salesPos) : 0;
    const staticBoost = bestIdx > -1 ? Math.max(0, 12 - bestIdx) : 0;

    return {
      item,
      order,
      norm,
      compact: norm.replace(/\s+/g, ""),
      tokens: tokenize(norm),
      explicit,
      auto,
      boost: salesBoost + staticBoost
    };
  });

  const byId = new Map(entries.map(e => [e.item.id, e]));
  return { entries, byId };
}

// Tach chuoi nhap thanh cac doan { text, qty, qtyExplicit }
// Ho tro: "2cfs", "2 cfs", "2x cfs", "2*cfs", "cfs 2", "cfs*2", va gom nhieu mon bang + , ;
function parseQuery(raw) {
  const folded = foldText(raw);
  if (!folded) return { segments: [] };

  const segments = folded
    .split(/[+,;]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(seg => {
      let text = seg;
      let qty = 1;
      let qtyExplicit = false;

      const pre = seg.match(/^(\d{1,2})(?!\d)(?:\s*\*\s*|x\s*|\s+)?(.*)$/);
      if (pre) {
        qty = Number(pre[1]);
        text = pre[2].trim();
        qtyExplicit = true;
      } else {
        const suf = seg.match(/^(.+?)\s*\*\s*(\d{1,2})$/) || seg.match(/^(.+?)\s+(\d{1,2})$/);
        if (suf) {
          text = suf[1].trim();
          qty = Number(suf[2]);
          qtyExplicit = true;
        }
      }

      qty = Math.min(MAX_QTY, Math.max(1, qty));
      return { text, qty, qtyExplicit };
    });

  return { segments };
}

// Cham diem 1 muc menu voi chuoi tim da chuan hoa
function scoreEntry(entry, q, qCompact, qWords) {
  if (entry.explicit.has(qCompact)) return { tier: 100, alias: qCompact };
  if (entry.auto.has(qCompact)) return { tier: 90, alias: qCompact };

  for (const a of entry.explicit) {
    if (a.startsWith(qCompact)) return { tier: 80, alias: a };
  }
  for (const a of entry.auto) {
    if (a.startsWith(qCompact)) return { tier: 70, alias: a };
  }

  if (qWords.every(w => entry.tokens.some(t => t.startsWith(w)))) {
    return { tier: 60, alias: null };
  }
  if (entry.compact.includes(qCompact)) return { tier: 40, alias: null };
  return null;
}

// Tim kiem: tra ve [{ item, tier, boost, alias }] da sap xep
function search(index, text, limit = 6) {
  const q = foldText(text);
  if (!q || !index) return [];
  const qCompact = q.replace(/\s+/g, "");
  const qWords = q.split(" ");

  const hits = [];
  index.entries.forEach(entry => {
    const s = scoreEntry(entry, q, qCompact, qWords);
    if (s) hits.push({ item: entry.item, tier: s.tier, boost: entry.boost, alias: s.alias, order: entry.order });
  });

  hits.sort((a, b) => b.tier - a.tier || b.boost - a.boost || a.order - b.order);
  return hits.slice(0, limit).map(({ item, tier, boost, alias }) => ({ item, tier, boost, alias }));
}

// Phan giai toan bo chuoi nhap thanh danh sach dong mon
function resolveInput(index, raw) {
  const { segments } = parseQuery(raw);
  const lines = segments.map(seg => {
    const top = seg.text ? search(index, seg.text, 1)[0] : null;
    return { item: top ? top.item : null, qty: seg.qty, text: seg.text, qtyExplicit: seg.qtyExplicit };
  });
  return { lines, allResolved: lines.length > 0 && lines.every(l => l.item) };
}

// Danh sach id cho luoi mon ban nhanh
// pinned (chu quan ghim) > doanh so 30 ngay > danh sach mac dinh > thu tu menu
function buildSpeedGrid({ menu = [], salesQty, pinned = [], defaults = [], size = 15 } = {}) {
  const menuIds = new Set(menu.map(m => m.id));
  const list = [];
  const seen = new Set();
  const push = id => {
    if (list.length >= size || seen.has(id) || !menuIds.has(id)) return;
    seen.add(id);
    list.push(id);
  };

  const validPinned = (pinned || []).filter(id => menuIds.has(id));
  if (validPinned.length > 0) {
    validPinned.forEach(push);
  } else if (salesQty instanceof Map) {
    const orderOf = new Map(menu.map((m, i) => [m.id, i]));
    [...salesQty.entries()]
      .filter(([id, qty]) => qty > 0 && menuIds.has(id))
      .sort((a, b) => b[1] - a[1] || orderOf.get(a[0]) - orderOf.get(b[0]))
      .forEach(([id]) => push(id));
  }

  defaults.forEach(push);
  menu.forEach(m => push(m.id));
  return list;
}

// Tinh tien thoi: cash null/undefined nghia la khach dua du (thanh toan dung so tien)
function calcChange(total, cash) {
  const t = Math.max(0, Math.round(Number(total) || 0));
  if (cash === null || cash === undefined) {
    return { received: t, change: 0, shortfall: 0, enough: true, exact: true };
  }
  const c = Math.max(0, Math.round(Number(cash) || 0));
  return {
    received: c,
    change: Math.max(0, c - t),
    shortfall: Math.max(0, t - c),
    enough: c >= t,
    exact: c === t
  };
}

// Doc so tien nhap tay: chi lay chu so; gia tri < 1000 hieu la nghin dong ("70" = 70.000)
function parseMoneyInput(str) {
  const digits = String(str === null || str === undefined ? "" : str).replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!n) return null;
  return n < 1000 ? n * 1000 : n;
}

function groupThousands(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// 20000 -> "20k"; 27500 -> "27.500d"
function formatShortPrice(n) {
  const v = Math.round(Number(n) || 0);
  if (v % 1000 === 0) return `${v / 1000}k`;
  return `${groupThousands(v)}\u0111`;
}

return {
  TENDER_DENOMS,
  foldText,
  autoInitials,
  buildIndex,
  parseQuery,
  search,
  resolveInput,
  buildSpeedGrid,
  calcChange,
  parseMoneyInput,
  formatShortPrice
};
});
