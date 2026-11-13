'use strict';

/**
 * اختبارات fixLineParts — parts.test.mjs
 * إصلاح سطر مع تتبع الأنماط (ألوان التيرمنال) عبر إعادة الترتيب البصري.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { fixLineParts, fixLine } from '../index.js';

test('جزء واحد = نفس ناتج fixLine تمامًا', () => {
  const r = fixLineParts([{ text: 'مرحبا كيفك؟' }]);
  assert.deepEqual(r.map((p) => p.text).join(''), fixLine('مرحبا كيفك؟'));
  assert.deepEqual(r, [{ text: fixLine('مرحبا كيفك؟'), meta: undefined }]);
});

test('عربي مقسوم على جزأين: الترتيب البصري يعكس المقاطع مع meta', () => {
  // 'مر' (a) + 'حبا' (b): البصري = 'حبا' المعكوسة ثم 'مر' المعكوسة
  const r = fixLineParts([
    { text: 'مر', meta: 'a' },
    { text: 'حبا', meta: 'b' },
  ]);
  assert.deepEqual(r, [
    { text: '\uFE8E\uFE92\uFEA3', meta: 'b' }, // ا ب ح (من 'حبا')
    { text: '\uFEAE\uFEE3', meta: 'a' },       // ر م (من 'مر')
  ]);
});

test('عربي + لاتيني: اللاتيني يبقى بنمطه والعربي بنمطه', () => {
  const r = fixLineParts([
    { text: 'مرحبا', meta: 'red' },
    { text: ' world', meta: 'blue' },
  ]);
  assert.deepEqual(r, [
    { text: 'world ', meta: 'blue' },          // الفراغ يندمج مع world (نفس meta)
    { text: '\uFE8E\uFE92\uFEA3\uFEAE\uFEE3', meta: 'red' },
  ]);
});

test('الأرقام بين عربيين تحفظ نمطها وترتيبها', () => {
  const r = fixLineParts([
    { text: 'سعر ', meta: 'x' },
    { text: '45', meta: 'y' },
    { text: ' ريال', meta: 'z' },
  ]);
  // البصري: ريال (z) ثم الفراغ+45+فراغ؟ — الفواصل تتوزع حسب جوارها
  // نبني التوقع من fixLine للنص الكامل ونفحص أن meta بترتيب صحيح
  assert.equal(r.map((p) => p.text).join(''), fixLine('سعر 45 ريال'));
  // أول مقطع بصري هو 'ريال' بنمط z
  assert.equal(r[0].meta, 'z');
});

test('ال merging: المقاطع المتجاورة بنفس مرجع meta تُدمج', () => {
  const style = { fg: 1 };
  const r = fixLineParts([
    { text: 'ab', meta: style },
    { text: 'cd', meta: style },
  ]);
  assert.deepEqual(r, [{ text: 'abcd', meta: style }]);
});

test('لا عربية: المقاطع تُعاد كما هي (مع تنظيف المحارف الخفية)', () => {
  const r = fixLineParts([
    { text: 'hello', meta: 1 },
    { text: 'world', meta: 2 },
  ]);
  assert.deepEqual(r, [
    { text: 'hello', meta: 1 },
    { text: 'world', meta: 2 },
  ]);
  // LRM تُحذف حتى بلا عربية
  assert.deepEqual(fixLineParts([{ text: 'abc\u200E', meta: 1 }]), [
    { text: 'abc', meta: 1 },
  ]);
});

test('خيار stripTashkeel يعمل على المقاطع', () => {
  const r = fixLineParts([
    { text: '\u0645\u064F\u062D\u064E\u0645\u0651\u064E\u062F', meta: 'm' },
  ], { stripTashkeel: true });
  assert.deepEqual(r, [{ text: '\uFEAA\uFEE4\uFEA4\uFEE3', meta: 'm' }]);
});

test('fixLineParts يرمي TypeError للمدخلات غير الصحيحة', () => {
  assert.throws(() => fixLineParts('not array'), TypeError);
  assert.throws(() => fixLineParts(null), TypeError);
  assert.throws(() => fixLineParts([{ text: 123 }]), TypeError);
  assert.throws(() => fixLineParts(['plain string']), TypeError);
});

test('أقواس معكوسة عبر حدود المقاطع تبقى متناسقة', () => {
  const r = fixLineParts([{ text: '(مرحبا)', meta: 'p' }]);
  assert.equal(r[0].text, '(\uFE8E\uFE92\uFEA3\uFEAE\uFEE3)');
});
