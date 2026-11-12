'use strict';

/**
 * اختبارات واجهة سطر الأوامر — cli.test.mjs
 * تشغّل bin/arafix.js كعملية حقيقية عبر spawnSync.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fixLine } from '../index.js';

const binPath = new URL('../bin/arafix.js', import.meta.url).pathname;

function run(args, options = {}) {
  return spawnSync(process.execPath, [binPath, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

// ---------------------------------------------------------------------------
// وضع الفلتر: stdin → stdout
// ---------------------------------------------------------------------------

test('فلتر: سطر عربي يُصلح ويُطبع', () => {
  const r = run([], { input: 'مرحبا\n' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, fixLine('مرحبا') + '\n');
  // القيمة الثابتة (لا نعتمد على المكتبة وحدها):
  assert.equal(r.stdout, '\uFE8E\uFE92\uFEA3\uFEAE\uFEE3\n');
});

test('فلتر: سطر إنجليزي يمر كما هو', () => {
  const r = run([], { input: 'hello world\n' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'hello world\n');
});

test('فلتر: عدة أسطر تُصلح سطرًا سطرًا', () => {
  const r = run([], { input: 'hello\nمرحبا\n42\n' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'hello\n' + fixLine('مرحبا') + '\n42\n');
});

test('فلتر: آخر سطر بلا سطر-جديد يُصلح أيضًا', () => {
  const r = run([], { input: 'مرحبا' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, fixLine('مرحبا'));
  assert.ok(!r.stdout.endsWith('\n'));
});

test('فلتر: فواصل أسطر ويندوز (CRLF) تُحفظ', () => {
  const r = run([], { input: 'مرحبا\r\nhello\r\n' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, fixLine('مرحبا') + '\r\nhello\r\n');
});

test('فلتر: خيار --strip-tashkeel', () => {
  const a = run([], { input: 'مُحَمَّد\n' });
  const b = run(['--strip-tashkeel'], { input: 'مُحَمَّد\n' });
  assert.equal(a.stdout, fixLine('مُحَمَّد') + '\n');
  assert.equal(b.stdout, fixLine('مُحَمَّد', { stripTashkeel: true }) + '\n');
  assert.notEqual(a.stdout, b.stdout);
});

// ---------------------------------------------------------------------------
// وضع الغلاف: arafix -- <cmd>
// ---------------------------------------------------------------------------

test('غلاف: مخرجات عربية من أمر مغلّف تُصلح', () => {
  const r = run(['--', process.execPath, '-e', 'console.log("مرحبا كيفك")']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, fixLine('مرحبا كيفك') + '\n');
});

test('غلاف: أمر بدون عربية يمر كما هو', () => {
  const r = run(['--', process.execPath, '-e', 'console.log("plain output")']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'plain output\n');
});

test('غلاف: كود خروج الأمر يُمرر كما هو', () => {
  const r = run(['--', process.execPath, '-e', 'process.exit(3)']);
  assert.equal(r.status, 3);
});

test('غلاف: أمر غير موجود → exit code 127', () => {
  const r = run(['--', 'arafix-no-such-cmd-xyz', '--version']);
  assert.equal(r.status, 127);
});

test('غلاف: أمر مباشر بلا -- يعمل أيضًا', () => {
  const r = run([process.execPath, '-e', 'console.log("مرحبا")']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, fixLine('مرحبا') + '\n');
});

// ---------------------------------------------------------------------------
// المساعدة والإصدار
// ---------------------------------------------------------------------------

test('--help يطبع المساعدة وينجح', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('arafix'));
  assert.ok(r.stdout.includes('الاستخدام'));
});

test('-h يعمل كاختصار', () => {
  const r = run(['-h']);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('arafix'));
});

test('--version يطبع إصدار package.json', () => {
  const r = run(['--version']);
  assert.equal(r.status, 0);
  assert.ok(/^\d+\.\d+\.\d+\n$/.test(r.stdout), `خرج غير متوقع: ${JSON.stringify(r.stdout)}`);
});

test('مساعدة بدون أنبوب: TTY بلا أمر لا يعلق إلى الأبد', () => {
  // TTY حقيقي غير متاح في الاختبار، لكن بلا stdin إطلاقًا:
  const r = run([], { input: '' });
  // stdin فارغ وغير TTY → وضع الفلتر ينتهي فورًا
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
