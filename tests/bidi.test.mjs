'use strict';

/**
 * اختبارات الترتيب البصري (BiDi) — bidi.test.mjs
 * عبر fixLine (التشكيل + الترتيب معًا)؛ القيم المتوقعة محسوبة يدويًا
 * من جداول الوصل وتتبع خوارزمية إعادة الترتيب.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { fixLine, bidiReorder, shapeArabic } from '../index.js';

test('كلمة عربية واحدة: تُشكَّل ثم تُعكس', () => {
  // مرحبا: مبتدئة→وسطية→... معكوسة بصريًا تبدأ بـ ا النهائية
  assert.equal(fixLine('مرحبا'), '\uFE8E\uFE92\uFEA3\uFEAE\uFEE3');
});

test('جملتان مع علامة استفهام: كل شيء يسير يمينًا', () => {
  // ك النهائية = FEDA (وليس FEDC الوسطية — الترتيب [معزولة، نهائية، مبتدئة، وسطية])
  assert.equal(
    fixLine('مرحبا كيفك؟'),
    '\u061F\uFEDA\uFED4\uFEF4\uFEDB \uFE8E\uFE92\uFEA3\uFEAE\uFEE3'
  );
});

test('عربي + إنجليزي + أرقام: كل مقطع في مكانه الصحيح', () => {
  // سطر يبدأ بعربي (P=R): الترتيب البصري: الأرقام ثم "في" ثم claude ثم العربية
  assert.equal(
    fixLine('استخدم claude في 2026'),
    '2026 \uFEF2\uFED3 claude \uFEE1\uFEAA\uFEA8\uFE98\uFEB3\uFE8D'
  );
});

test('الأقواس تت_mirror حول النص العربي', () => {
  assert.equal(fixLine('(مرحبا)'), '(\uFE8E\uFE92\uFEA3\uFEAE\uFEE3)');
});

test('سطر يبدأ بإنجليزي (P=L): العربية في وسطه تُعكس فقط', () => {
  assert.equal(
    fixLine('hello مرحبا world'),
    'hello \uFE8E\uFE92\uFEA3\uFEAE\uFEE3 world'
  );
});

test('الأرقام العربية-الهندية تحفظ ترتيبها الداخلي', () => {
  // ع الوسطية = FECC (وليس FECB المبتدئة)
  assert.equal(
    fixLine('سعر ٤٥ ريال'),
    '\uFEDD\uFE8E\uFEF3\uFEAD ٤٥ \uFEAE\uFECC\uFEB3'
  );
});

test('التشكيل يبقى بعد حرفه عند العكس (عناقيد)', () => {
  // م ُ ح َ م ّ َ د: العنقود معكوس كوحدة — التشكيل يبقى بعد أساسه بترتيبه المنطقي
  assert.equal(fixLine('\u0645\u064F\u062D\u064E\u0645\u0651\u064E\u062F'), '\uFEAA\uFEE4\u0651\u064E\uFEA4\u064E\uFEE3\u064F');
});

test('رموز ANSI تبقى حرفيًا حول النص المصلح', () => {
  assert.equal(
    fixLine('\x1b[31mمرحبا\x1b[0m'),
    '\x1b[31m\uFE8E\uFE92\uFEA3\uFEAE\uFEE3\x1b[0m'
  );
});

test('أسطر بلا عربية تُعاد كما هي بايتيًا', () => {
  assert.equal(fixLine('hello world'), 'hello world');
  assert.equal(fixLine(''), '');
  assert.equal(fixLine('123 - 456.78'), '123 - 456.78');
});

test('تاريخ بين عربيين: CS بين الأرقام يمتص داخل المقطع الرقمي', () => {
  assert.equal(
    fixLine('في 2026-11-12 يوم'),
    '\uFEE1\uFEEE\uFEF3 2026-11-12 \uFEF2\uFED3'
  );
});

test('خيار stripTashkeel يحذف التشكيل قبل التشكيل السياقي', () => {
  assert.equal(
    fixLine('مُحَمَّد', { stripTashkeel: true }),
    '\uFEAA\uFEE4\uFEA4\uFEE3'
  );
});

test('خيار dir يفرض اتجاه الفقرة', () => {
  // auto هنا يعطي P=L (أول حرف قوي إنجليزي) → الإنجليزية في مواضعها
  assert.equal(fixLine('ab في cd'), 'ab \uFEF2\uFED3 cd');
  // dir=rtl يفرض P=R → ترتيب المقاطع معكوس بالكامل
  assert.equal(fixLine('ab في cd', { dir: 'rtl' }), 'cd \uFEF2\uFED3 ab');
});

test('fixLine يرمي TypeError لغير النصوص', () => {
  assert.throws(() => fixLine(123), TypeError);
  assert.throws(() => fixLine(null), TypeError);
});

test('المحارف الخفية (BiDi controls) تُحذف دائمًا', () => {
  // RLM/LRM وعلامات الاتجاه تكسر العرض في التيرمنالات الغبية
  assert.equal(fixLine('مر\u200Fحبا'), fixLine('مرحبا'));
  assert.equal(fixLine('hello\u200E'), 'hello');
});

// ---------------------------------------------------------------------------
// اختبارات وحدية إضافية على الدالتين المنفصلتين
// ---------------------------------------------------------------------------

test('shapeArabic يعمل بالترتيب المنطقي (لا يعكس)', () => {
  assert.equal(shapeArabic('مرحبا'), '\uFEE3\uFEAE\uFEA3\uFE92\uFE8E');
});

test('bidiReorder على نص مشكَّل سابقًا', () => {
  assert.equal(
    bidiReorder('\uFEE3\uFEAE\uFEA3\uFE92\uFE8E'),
    '\uFE8E\uFE92\uFEA3\uFEAE\uFEE3'
  );
});
