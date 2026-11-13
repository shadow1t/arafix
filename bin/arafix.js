#!/usr/bin/env node
'use strict';

/**
 * arafix CLI — إصلاح عرض العربية في التيرمنال
 *
 *   arafix                      # وضع الفلتر: stdin → stdout (سطر بسطر)
 *   arafix -- <cmd> [args...]   # وضع الغلاف: شغّل أي أمر واصلح مخرجاته مباشرة
 *
 * @license MIT
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fixLine } from '../index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const HELP = `arafix v${pkg.version} — إصلاح عرض النص العربي في التيرمنال
Zero-dependency Arabic terminal display fixer (shaping + BiDi).

الاستخدام:
  arafix                      وضع الفلتر: يقرأ stdin ويكتب stdout مصلحًا
  some-cmd | arafix           مرّر مخرجات أي أمر عبر arafix
  arafix -- some-cmd args     وضع الغلاف: شغّل الأمر وتفاعل معه طبيعيًا
                              وستظهر مخرجاته العربية سليمة (يعمل مع أدوات AI CLI)

الخيارات:
  -s, --strip-tashkeel        إزالة التشكيل من العرض (أوضح في بعض التيرمنالات)
      --dir=auto|rtl|ltr      فرض اتجاه السطر (الافتراضي: تلقائي)
      --no-force-color        لا تفرض الألوان على الأمر المغلّف
  -h, --help                  هذه المساعدة
  -v, --version               الإصدار

أمثلة:
  echo "مرحبا كيفك" | arafix
  arafix -- claude            # تفاعل مع claude والردود تظهر سليمة
  arafix -- aichat -q "سؤال"
  # bash/zsh: اجعلها دائمة لكل أدوات الـ AI:
  #   alias claude='arafix -- claude'

ملاحظة مهمة عن الكتابة أثناء الطباعة: عرض ما تكتبه لحظة الكتابة
يرسمه التيرمنال نفسه قبل أي برنامج، فلا يمكن لأداة خارجية تغييره —
لكن ما تكتبه يصل للبرنامج سليمًا دائمًا. للعرض السليم أثناء الكتابة
استخدم تيرمنال يدعم BiDi مثل WezTerm أو mintty أو Konsole.

English: fixes Arabic output of any command for non-BiDi terminals
(filter mode, or wrapper mode: "arafix -- <cmd> [args]"). Typed-input
echo rendering is the terminal's job; use a BiDi terminal for that.
`;

function parseArgs(argv) {
  const opts = { stripTashkeel: false, dir: 'auto', forceColor: true };
  const cmd = [];
  let afterDash = false;
  for (const a of argv) {
    if (afterDash) { cmd.push(a); continue; }
    if (a === '--') { afterDash = true; continue; }
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a === '--strip-tashkeel' || a === '-s') opts.stripTashkeel = true;
    else if (a.startsWith('--dir=')) opts.dir = a.slice('--dir='.length);
    else if (a === '--no-force-color') opts.forceColor = false;
    else { cmd.push(a); afterDash = true; } // أول غير خيار = بداية الأمر
  }
  return { opts, cmd };
}

/** معالج تدفقي: يصلح الأسطر الكاملة فورًا ويحتفظ بالبقايا الجزئية. */
function makeLineFixer(opts, write) {
  let buf = '';
  return {
    feed(chunk) {
      buf += chunk;
      for (;;) {
        const m = /\r\n|\n|\r/.exec(buf);
        if (!m) break;
        const line = buf.slice(0, m.index);
        const delim = m[0];
        buf = buf.slice(m.index + delim.length);
        write(fixLine(line, opts) + delim);
      }
    },
    flush() {
      if (buf !== '') { write(fixLine(buf, opts)); buf = ''; }
    },
  };
}

function filterMode(opts) {
  const fx = makeLineFixer(opts, (s) => process.stdout.write(s));
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => fx.feed(c));
  process.stdin.on('end', () => fx.flush());
  process.stdin.on('error', () => { /* EPIPE وغيرها */ });
}

function wrapperMode(cmd, opts) {
  const [c0, ...rest] = cmd;
  const env = { ...process.env };
  if (opts.forceColor) {
    if (!env.FORCE_COLOR) env.FORCE_COLOR = '1';
    env.CLICOLOR_FORCE = '1';
  }
  let child;
  try {
    child = spawn(c0, rest, {
      env,
      stdio: ['inherit', 'pipe', 'inherit'],
      shell: process.platform === 'win32', // حلّ مواقع npm .cmd في ويندوز
    });
  } catch {
    process.stderr.write(`arafix: تعذر تشغيل "${c0}"\n`);
    process.exitCode = 127;
    return;
  }
  const fx = makeLineFixer(opts, (s) => process.stdout.write(s));
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (c) => fx.feed(c));
  child.on('error', (err) => {
    process.stderr.write(`arafix: ${err.message}\n`);
    process.exitCode = 127;
  });
  child.on('exit', (code) => {
    fx.flush();
    process.exitCode = code == null ? 0 : code;
  });
}

const { opts, cmd } = parseArgs(process.argv.slice(2));

if (opts.help) {
  process.stdout.write(HELP);
} else if (opts.version) {
  process.stdout.write(pkg.version + '\n');
} else if (cmd.length > 0) {
  wrapperMode(cmd, opts);
} else if (process.stdin.isTTY) {
  // بلا أمر وبلا أنبوب: اطبع المساعدة (منع الانتظار اللانهائي)
  process.stdout.write(HELP);
  process.exitCode = 1;
} else {
  filterMode(opts);
}
