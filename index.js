'use strict';

/**
 * arafix — إصلاح عرض النص العربي في التيرمنال
 * Zero-dependency Arabic terminal display fixer: contextual shaping to
 * Arabic Presentation Forms + simplified Unicode BiDi reordering, so Arabic
 * reads correctly in terminals without RTL support (works on Windows too).
 *
 * @license MIT
 * @author Rasheed (shadow1t)
 * @see https://github.com/shadow1t/arafix
 */

// ---------------------------------------------------------------------------
// Shaping tables — every entry is verified by an NFKC round-trip test.
// Forms order: [isolated, final, initial, medial]; right-joining letters have
// only [isolated, final].
// ---------------------------------------------------------------------------

const ARABIC_FORMS = new Map([
  ['\u0622', ['\uFE81', '\uFE82']],                         // آ
  ['\u0623', ['\uFE83', '\uFE84']],                         // أ
  ['\u0624', ['\uFE85', '\uFE86']],                         // ؤ
  ['\u0625', ['\uFE87', '\uFE88']],                         // إ
  ['\u0626', ['\uFE89', '\uFE8A', '\uFE8B', '\uFE8C']],     // ئ
  ['\u0627', ['\uFE8D', '\uFE8E']],                         // ا
  ['\u0628', ['\uFE8F', '\uFE90', '\uFE91', '\uFE92']],     // ب
  ['\u0629', ['\uFE93', '\uFE94']],                         // ة
  ['\u062A', ['\uFE95', '\uFE96', '\uFE97', '\uFE98']],     // ت
  ['\u062B', ['\uFE99', '\uFE9A', '\uFE9B', '\uFE9C']],     // ث
  ['\u062C', ['\uFE9D', '\uFE9E', '\uFE9F', '\uFEA0']],     // ج
  ['\u062D', ['\uFEA1', '\uFEA2', '\uFEA3', '\uFEA4']],     // ح
  ['\u062E', ['\uFEA5', '\uFEA6', '\uFEA7', '\uFEA8']],     // خ
  ['\u062F', ['\uFEA9', '\uFEAA']],                         // د
  ['\u0630', ['\uFEAB', '\uFEAC']],                         // ذ
  ['\u0631', ['\uFEAD', '\uFEAE']],                         // ر
  ['\u0632', ['\uFEAF', '\uFEB0']],                         // ز
  ['\u0633', ['\uFEB1', '\uFEB2', '\uFEB3', '\uFEB4']],     // س
  ['\u0634', ['\uFEB5', '\uFEB6', '\uFEB7', '\uFEB8']],     // ش
  ['\u0635', ['\uFEB9', '\uFEBA', '\uFEBB', '\uFEBC']],     // ص
  ['\u0636', ['\uFEBD', '\uFEBE', '\uFEBF', '\uFEC0']],     // ض
  ['\u0637', ['\uFEC1', '\uFEC2', '\uFEC3', '\uFEC4']],     // ط
  ['\u0638', ['\uFEC5', '\uFEC6', '\uFEC7', '\uFEC8']],     // ظ
  ['\u0639', ['\uFEC9', '\uFECA', '\uFECB', '\uFECC']],     // ع
  ['\u063A', ['\uFECD', '\uFECE', '\uFECF', '\uFED0']],     // غ
  ['\u0640', ['\u0640', '\u0640', '\u0640', '\u0640']],     // ـ tatweel (joins both ways)
  ['\u0641', ['\uFED1', '\uFED2', '\uFED3', '\uFED4']],     // ف
  ['\u0642', ['\uFED5', '\uFED6', '\uFED7', '\uFED8']],     // ق
  ['\u0643', ['\uFED9', '\uFEDA', '\uFEDB', '\uFEDC']],     // ك
  ['\u0644', ['\uFEDD', '\uFEDE', '\uFEDF', '\uFEE0']],     // ل
  ['\u0645', ['\uFEE1', '\uFEE2', '\uFEE3', '\uFEE4']],     // م
  ['\u0646', ['\uFEE5', '\uFEE6', '\uFEE7', '\uFEE8']],     // ن
  ['\u0647', ['\uFEE9', '\uFEEA', '\uFEEB', '\uFEEC']],     // ه
  ['\u0648', ['\uFEED', '\uFEEE']],                         // و
  ['\u0649', ['\uFEEF', '\uFEF0']],                         // ى
  ['\u064A', ['\uFEF1', '\uFEF2', '\uFEF3', '\uFEF4']],     // ي
]);

/** حروف لام-ألف المركّبة: مفتاح = نوع الألف، قيمة = [معزولة، نهائية]. */
const LAM_ALEF_FORMS = new Map([
  ['\u0622', ['\uFEF5', '\uFEF6']], // لآ
  ['\u0623', ['\uFEF7', '\uFEF8']], // لأ
  ['\u0625', ['\uFEF9', '\uFEFA']], // لإ
  ['\u0627', ['\uFEFB', '\uFEFC']], // لا
]);

/** الحروف المزدوجة الوصل (تتصل بما قبلها وبما بعدها). */
const DUAL_JOINING = new Set(
  '\u0626\u0628\u062A\u062B\u062C\u062D\u062E\u0633\u0634\u0635\u0636\u0637\u0638\u0639\u063A\u0640\u0641\u0642\u0643\u0644\u0645\u0646\u0647\u064A'
);

/**
 * مرايا الأقواس عند عكس المقطع — نعكس الأقواس الشائعة فقط،
 * لا نعكس < و > كي لا تتكسر مقتطفات الكود في مخرجات الـ AI.
 */
const MIRROR = {
  '(': ')', ')': '(',
  '[': ']', ']': '[',
  '{': '}', '}': '{',
};

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

const IS_MARK = /\p{M}/u;
const INVISIBLE_RE = /[\u061C\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const TASHKEEL_RE = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;
const ARABIC_LETTER_RE = /[\u0621-\u064A\u0671-\u06D3\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ANSI_SPLIT_RE = /(\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\)))/g;

/** هل يحتوي النص على حروف عربية (يستخدم لتخطي الأسطر غير العربية فورًا). */
export function containsArabic(text) {
  return ARABIC_LETTER_RE.test(text);
}

/** إزالة التشكيل (تُستخدم عند تفعيل --strip-tashkeel). */
export function stripTashkeel(text) {
  return text.replace(TASHKEEL_RE, '');
}

// ---------------------------------------------------------------------------
// Clusters: base character + its combining marks (harakat stay with base)
// ---------------------------------------------------------------------------

/**
 * تقسيم النص إلى عناقيد: الحرف الأساسي مع علاماته المركّبة.
 * عكس العناقيد في الترتيب البصري يحافظ على التصاق التشكيل بحرفه.
 */
export function splitClusters(text) {
  const clusters = [];
  for (const ch of text) {
    if (clusters.length > 0 && IS_MARK.test(ch)) {
      clusters[clusters.length - 1].rest += ch;
    } else {
      clusters.push({ base: ch, rest: '' });
    }
  }
  return clusters;
}

// ---------------------------------------------------------------------------
// Contextual shaping (تشكيل الحروف حسب موقعها في الكلمة)
// ---------------------------------------------------------------------------

/**
 * التشكيل على مستوى العناقيد — كل عنقود {base, rest, meta?}:
 * نفس خوارزمية shapeArabic لكنها تحافظ على meta المرافق لكل عنقود
 * (تستخدمها fixLineParts لتتبع الأنماط/الألوان أثناء الترتيب البصري).
 */
export function shapeClusters(clusters) {
  const out = [];
  let prevBase = null; // آخر حرف قابل للوصل بما بعده

  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const base = c.base;
    const next = i + 1 < clusters.length ? clusters[i + 1] : null;
    const nb = next ? next.base : null;

    // لام-ألف: حرف مركّب واحد (يأخذ meta الخاص باللام)
    if (base === '\u0644' && nb !== null && LAM_ALEF_FORMS.has(nb)) {
      const connectPrev = prevBase !== null && DUAL_JOINING.has(prevBase);
      out.push({
        base: LAM_ALEF_FORMS.get(nb)[connectPrev ? 1 : 0],
        rest: c.rest + next.rest,
        meta: c.meta,
      });
      i++; // الألف استُهلكت داخل المركّب
      prevBase = nb; // الألف لا تتصل بما بعدها
      continue;
    }

    if (ARABIC_FORMS.has(base)) {
      const connectPrev = prevBase !== null && DUAL_JOINING.has(prevBase);
      const connectNext =
        DUAL_JOINING.has(base) && nb !== null && ARABIC_FORMS.has(nb);
      const idx = (connectNext ? 2 : 0) + (connectPrev ? 1 : 0);
      out.push({ base: ARABIC_FORMS.get(base)[idx], rest: c.rest, meta: c.meta });
      prevBase = base;
    } else {
      out.push({ base, rest: c.rest, meta: c.meta });
      prevBase = null; // الفراغ واللاتيني وغيره يقطعان الوصل
    }
  }
  return out;
}

/**
 * تحويل الحروف العربية إلى صورها العرضية السياقية (Presentation Forms)
 * بالترتيب المنطقي نفسه: مبتدئة/وسطية/نهائية/معزولة + حروف لام-ألف المركّبة.
 */
export function shapeArabic(text) {
  const clusters = shapeClusters(splitClusters(text));
  let out = '';
  for (const c of clusters) out += c.base + c.rest;
  return out;
}

// ---------------------------------------------------------------------------
// Simplified BiDi reordering (ترتيب بصري مبسّط وفق UAX #9)
// ---------------------------------------------------------------------------

function classifyChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x30 && cp <= 0x39) return 'EN';
  if ((cp >= 0x0660 && cp <= 0x0669) || (cp >= 0x06F0 && cp <= 0x06F9)) return 'AN';
  if (
    (cp >= 0x0621 && cp <= 0x064A) ||
    (cp >= 0x0671 && cp <= 0x06D3) ||
    (cp >= 0xFB50 && cp <= 0xFDFF) ||
    (cp >= 0xFE70 && cp <= 0xFEFF)
  ) return 'R';
  if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A)) return 'L';
  if (cp >= 0xC0 && cp <= 0x24F && cp !== 0xD7 && cp !== 0xF7) return 'L';
  if (cp === 0x2C || cp === 0x2E || cp === 0x2D || cp === 0x2F || cp === 0x3A) return 'CS';
  if (cp === 0x25 || cp === 0x066A) return 'ET';
  if (/\s/.test(ch)) return 'WS';
  return 'ON';
}

/**
 * إعادة الترتيب على مستوى العناقيد: نفس خوارزمية bidiReorder لكنها
 * تعيد عناقيد {base, rest, meta} في الترتيب البصري مع مرآة الأقواس،
 * ويحافظ على meta (تستخدمها fixLineParts).
 */
export function reorderClusters(clusters, dir = 'auto') {
  if (clusters.length === 0) return [];
  const classes = clusters.map((c) => classifyChar(c.base));

  let P;
  if (dir === 'rtl' || dir === 'R') P = 'R';
  else if (dir === 'ltr' || dir === 'L') P = 'L';
  else {
    P = 'R';
    for (const c of classes) {
      if (c === 'R' || c === 'L') { P = c; break; }
    }
  }

  // بناء المقاطع: R / L / N (أرقام) / O (محايد)
  const runs = [];
  let i = 0;
  while (i < clusters.length) {
    const c = classes[i];
    if (c === 'EN' || c === 'AN') {
      let j = i + 1;
      while (j < clusters.length) {
        const cj = classes[j];
        if (cj === 'EN' || cj === 'AN') { j++; continue; }
        // فواصل وعلامات بين/بجوار الأرقام تبقى داخل المقطع الرقمي
        if ((cj === 'CS' || cj === 'ET') && j + 1 < clusters.length &&
            (classes[j + 1] === 'EN' || classes[j + 1] === 'AN')) { j++; continue; }
        break;
      }
      runs.push({ kind: 'N', from: i, to: j });
      i = j;
    } else if (c === 'R' || c === 'L') {
      let j = i + 1;
      while (j < clusters.length && classes[j] === c) j++;
      runs.push({ kind: c, from: i, to: j });
      i = j;
    } else {
      let j = i + 1;
      while (j < clusters.length && classes[j] !== 'R' && classes[j] !== 'L' &&
             classes[j] !== 'EN' && classes[j] !== 'AN') j++;
      runs.push({ kind: 'O', from: i, to: j });
      i = j;
    }
  }

  // حل اتجاه المحايد والأرقام لأغراض الموضع
  const pos = runs.map((r, k) => {
    if (r.kind === 'R' || r.kind === 'L') return r.kind;
    const prev = k > 0 ? runs[k - 1].kind : null;
    const next = k < runs.length - 1 ? runs[k + 1].kind : null;
    const pv = prev && prev !== 'O' ? prev : null;
    const nx = next && next !== 'O' ? next : null;
    if (pv && nx) return pv === nx ? pv : P;
    if (pv) return pv;
    if (nx) return nx;
    return P;
  });

  // الترتيب البصري
  const order = runs.map((_, k) => k);
  if (P === 'R') order.reverse();

  const out = [];
  for (const k of order) {
    const r = runs[k];
    if (pos[k] !== 'R' || r.kind === 'N') {
      // LTR موضعيًا أو مقطع رقمي: يبقى ترتيبه الداخلي كما هو
      for (let idx = r.from; idx < r.to; idx++) out.push(clusters[idx]);
    } else {
      // مقطع RTL: اعكس العناقيد مع مرآة الأقواس
      for (let idx = r.to - 1; idx >= r.from; idx--) {
        const c = clusters[idx];
        const m = MIRROR[c.base];
        out.push(m !== undefined ? { ...c, base: m } : c);
      }
    }
  }
  return out;
}

/**
 * إعادة ترتيب النص (بعد التشكيل) إلى الترتيب البصري الصحيح.
 * dir: 'auto' (افتراضي: أول حرف قوي، وإلا RTL) أو 'rtl' أو 'ltr'.
 */
export function bidiReorder(text, dir = 'auto') {
  const clusters = reorderClusters(splitClusters(text), dir);
  if (clusters.length === 0) return text;
  let out = '';
  for (const c of clusters) out += c.base + c.rest;
  return out;
}

// ---------------------------------------------------------------------------
// fixLine — the main entry point
// ---------------------------------------------------------------------------

/**
 * إصلاح سطر واحد للعرض في التيرمنال: تشكيل + ترتيب بصري،
 * مع الحفاظ الحرفي على رموز ANSI (الألوان) وتخطي الأسطر غير العربية.
 */
export function fixLine(line, options = {}) {
  if (typeof line !== 'string') {
    throw new TypeError(`fixLine: expected a string, got ${line === null ? 'null' : typeof line}`);
  }

  // المحارف الخفية تُحذف دائمًا حتى من الأسطر غير العربية:
  // علامات الاتجاه (RLM/LRM/RLO...) تكسر العرض في التيرمنالات الغبية.
  let s = line.replace(INVISIBLE_RE, '');
  if (!containsArabic(s)) return s;

  if (options.stripTashkeel) s = s.replace(TASHKEEL_RE, '');
  if (!containsArabic(s)) return s;

  const parts = s.split(ANSI_SPLIT_RE);
  let out = '';
  for (let k = 0; k < parts.length; k++) {
    if (k % 2 === 1) { out += parts[k]; continue; } // مقطع ANSI — يبقى كما هو
    if (parts[k] === '') continue;
    out += bidiReorder(shapeArabic(parts[k]), options.dir || 'auto');
  }
  return out;
}

/**
 * إصلاح سطر مقسوم إلى مقاطع منمّطة (نص + meta لكل مقطع) — مصممة لراسمات
 * التيرمنال: تعيد مقاطع بالترتيب البصري الصحيح مع التصاق النمط (اللون)
 * بنصه أثناء إعادة الترتيب. تُدمج المقاطع المتجاورة ذات الـ meta نفسه
 * (المقارنة بـ ===، فمرّر نفس مرجع الكائن للنمط الواحد).
 *
 * مثال: fixLineParts([{ text: 'مرحبا', meta: styleRed }, { text: ' world', meta: styleBlue }])
 */
export function fixLineParts(parts, options = {}) {
  if (!Array.isArray(parts)) {
    throw new TypeError(`fixLineParts: expected an array of parts, got ${parts === null ? 'null' : typeof parts}`);
  }

  // تنظيف النصوص (محارف خفية دائمًا + تشكيل عند الطلب) مع الحفاظ على meta
  const clean = [];
  let hasArabic = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (typeof p !== 'object' || p === null || typeof p.text !== 'string') {
      throw new TypeError(`fixLineParts: parts[${i}] must be { text: string, meta }`);
    }
    let s = p.text.replace(INVISIBLE_RE, '');
    if (options.stripTashkeel) s = s.replace(TASHKEEL_RE, '');
    hasArabic = hasArabic || containsArabic(s);
    if (s !== '') clean.push({ text: s, meta: p.meta });
  }
  if (!hasArabic) {
    // لا عربية: المقاطع كما هي (منظفة) مع دمج المتجاورة بنفس meta
    const flat = [];
    for (const p of clean) {
      const last = flat[flat.length - 1];
      if (last && last.meta === p.meta) last.text += p.text;
      else flat.push({ text: p.text, meta: p.meta });
    }
    return flat;
  }

  // عناقيد تحمل meta → تشكيل → ترتيب بصري
  const clusters = [];
  for (const p of clean) {
    for (const c of splitClusters(p.text)) {
      clusters.push({ base: c.base, rest: c.rest, meta: p.meta });
    }
  }
  const visual = reorderClusters(shapeClusters(clusters), options.dir || 'auto');

  // دمج المتجاورين بنفس meta وإخراج المقاطع النهائية
  const out = [];
  for (const c of visual) {
    const last = out[out.length - 1];
    if (last && last.meta === c.meta) last.text += c.base + c.rest;
    else out.push({ text: c.base + c.rest, meta: c.meta });
  }
  return out;
}

export { ARABIC_FORMS, LAM_ALEF_FORMS, DUAL_JOINING };
