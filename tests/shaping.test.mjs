'use strict';

/**
 * اختبارات التشكيل السياقي — shaping.test.mjs
 * أهم اختبار: round-trip NFKC لكل حرف عرضي في الجداول،
 * فلا يمكن الوثوق بجدول Unicode من الذاكرة وحدها.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeArabic, ARABIC_FORMS, LAM_ALEF_FORMS } from '../index.js';

// ---------------------------------------------------------------------------
// Round-trip NFKC: كل صورة عرضية تعود إلى حرفها الأساسي
// ---------------------------------------------------------------------------

test('كل صور ARABIC_FORMS ترجع بـ NFKC إلى الحرف الأساسي', () => {
  for (const [base, forms] of ARABIC_FORMS) {
    for (const form of forms) {
      assert.equal(
        form.normalize('NFKC'),
        base,
        `فشل round-trip: U+${form.codePointAt(0).toString(16).toUpperCase()} → "${base}"`
      );
    }
  }
});

test('كل صور LAM_ALEF_FORMS ترجع بـ NFKC إلى "ل" + نوع الألف', () => {
  for (const [alef, forms] of LAM_ALEF_FORMS) {
    for (const form of forms) {
      assert.equal(
        form.normalize('NFKC'),
        '\u0644' + alef,
        `فشل round-trip لام-ألف: U+${form.codePointAt(0).toString(16).toUpperCase()}`
      );
    }
  }
});

test('الجدول لا يحتوي صورًا تتطابق مع أساس مختلف', () => {
  // التطابق يجب أن يكون فرديًا: أساس واحد لكل مجموعة صور
  const seen = new Map();
  for (const [base, forms] of ARABIC_FORMS) {
    for (const form of forms) {
      const prev = seen.get(form);
      assert.ok(prev === undefined || prev === base, `صورة مكررة بين "${base}" و "${prev}"`);
      seen.set(form, base);
    }
  }
});

// ---------------------------------------------------------------------------
// أمثلة محسوبة يدويًا من الجدول (ترتيب [معزولة، نهائية، مبتدئة، وسطية])
// ---------------------------------------------------------------------------

test('shapeArabic("مرحبا")', () => {
  // م مبتدئة FEE3، ر نهائية FEAE، ح مبتدئة FEA3، ب وسطية FE92، ا نهائية FE8E
  assert.equal(shapeArabic('مرحبا'), '\uFEE3\uFEAE\uFEA3\uFE92\uFE8E');
});

test('shapeArabic("السلام")', () => {
  // ا معزولة \uFE8D، ل مبتدئة \uFEDF، س وسطية \uFEB4، لا نهائية \uFEFC، م نهائية \uFEE1
  assert.equal(shapeArabic('السلام'), '\uFE8D\uFEDF\uFEB4\uFEFC\uFEE1');
});

test('shapeArabic("لا") = لام-ألف معزولة', () => {
  assert.equal(shapeArabic('لا'), '\uFEFB');
});

test('shapeArabic("بلا") = ب مبتدئة + لام-ألف نهائية', () => {
  assert.equal(shapeArabic('بلا'), '\uFE91\uFEFC');
});

test('shapeArabic("لأ") و "لإ" و "لآ"', () => {
  assert.equal(shapeArabic('لأ'), '\uFEF7');
  assert.equal(shapeArabic('لإ'), '\uFEF9');
  assert.equal(shapeArabic('لآ'), '\uFEF5');
});

test('التطويل (ـ) حرف رباعي الوصل بشكله نفسه', () => {
  // ه مبتدئة FEEB، ـ ـ، ذ نهائية FEAC، ا معزولة FE8D (ذ لا تتصل بما بعدها)
  assert.equal(shapeArabic('ه\u0640ذا'), '\uFEEB\u0640\uFEAC\uFE8D');
});

test('التشكيل يبقى بعد حرفه الأساسي داخل العنقود', () => {
  // مدخل صريح: م ُ ح َ م ّ َ د (الشدّة قبل الفتحة — الترتيب الكتابي المعتاد)
  // م مبتدئة FEE3 + ُ، ح وسطية FEA4 + َ، م وسطية FEE4 + ّ + َ، د نهائية FEAA
  const input = '\u0645\u064F\u062D\u064E\u0645\u0651\u064E\u062F';
  assert.equal(shapeArabic(input), '\uFEE3\u064F\uFEA4\u064E\uFEE4\u0651\u064E\uFEAA');
});

test('الفراغ يقطع الوصل بين الكلمتين', () => {
  // "ب ب": الأولى معزولة، الثانية معزولة
  assert.equal(shapeArabic('ب ب'), '\uFE8F \uFE8F');
});

test('الحروف غير العربية لا تتغير', () => {
  assert.equal(shapeArabic('abc 123'), 'abc 123');
});

test('نص غير عربي يعود كما هو', () => {
  assert.equal(shapeArabic('hello world'), 'hello world');
});

test('نص فارغ', () => {
  assert.equal(shapeArabic(''), '');
});
