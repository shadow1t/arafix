# arafix

**أداة إصلاح عرض النص العربي في التيرمنال — صفر اعتماديات**
**Zero-dependency Arabic terminal display fixer**

[![Node CI](https://github.com/shadow1t/arafix/actions/workflows/ci.yml/badge.svg)](https://github.com/shadow1t/arafix/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<div dir="rtl">

## المشكلة

معظم التيرمنالات لا تدعم العربية بشكل كامل، فترى النص العربي **معكوسًا ومفككًا**:

- الحروف لا تتصل ببعضها: `مرحبا` تظهر كـ `م ر ح ب ا`
- الترتيب معكوس: أول الكلمة يظهر في أقصى اليسار
- الأسطر المختلطة (عربي + إنجليزي + أرقام) تتشابس تمامًا

هذا ما يحدث مع أي أمر يطبع عربيًا — أدوات الـ AI على سطر الأوامر، سكربتاتك، مخرجات `cat` و `grep`... إلخ.

## الحل

`arafix` تقوم بشيئين، تمامًا كما يفعل أي محرك عرض عربي حقيقي:

1. **التشكيل السياقي (Contextual Shaping)**: تحويل الحروف إلى صورها المتصلة
   (Arabic Presentation Forms) — مثلًا `ب` تتحول إلى شكلها المتصل بما قبلها وبعدها.
2. **إعادة الترتيب ثنائي الاتجاه (BiDi Reordering)**: ترتيب الحروف بصريًا من اليمين
   إلى اليسار، مع الحفاظ على الإنجليزية والأرقام في اتجاهها الصحيح، ومرآة الأقواس.

النتيجة: نص عربي **مقروء وواضح** في أي تيرمنال، حتى التيرمنالات التي لا تعرف شيئًا عن العربية.

## التثبيت

```bash
npm install -g github:shadow1t/arafix
```

أو بدون تثبيت مباشرة:

```bash
npx github:shadow1t/arafix
```

## الاستخدام — وضعان

### 1. وضع الفلتر (Filter)

مرّر أي مخرجات عبر الأنبوب:

```bash
echo "مرحبا كيفك" | arafix
cat notes.txt | arafix
my-script.sh | arafix
```

### 2. وضع الغلاف (Wrapper) — مثالي لأدوات الـ AI CLI

شغّل أي أمر عبر `arafix` وسطور مخرجاته العربية ستُصلح مباشرة أثناء عمله:

```bash
arafix -- claude           # تفاعل مع claude كالمعتاد، والردود تظهر سليمة
arafix -- aichat -q "اشرح لي التوريق"
arafix -- gemini
arafix -- aider
```

**اجعلها دائمة لكل جلسة** — أضف alias في `~/.bashrc` أو `~/.zshrc`:

```bash
alias claude='arafix -- claude'
alias aichat='arafix -- aichat'
```

في PowerShell (ملف `$PROFILE`):

```powershell
function claude { arafix -- claude @args }
```

> **كيف يعمل وضع الغلاف؟** يعمل الأمر كعملية ابنة، ويمرر مدخلك إليه كما هي
> (stdin موروث)، ويصلح stdout سطرًا بسطر قبل عرضه، مع تمرير كود الخروج كما هو.
> الألوان تُحفظ (رموز ANSI تبقى حرفية ويُفرض `FORCE_COLOR=1`).

## على ويندوز

- شغّل `chcp 65001` لتفعيل UTF-8 في CMD/PowerShell (أو أضفها في ملف الـ profile).
- استخدم خطًا يدعم Arabic Presentation Forms مثل **Cascadia Mono** أو **Noto Naskh Arabic**
  أو **Consolas** مع fallback عربي.
- `arafix` تعمل مع CMD و PowerShell و Windows Terminal و Git Bash.

## الخيارات

| الخيار | الوصف |
|---|---|
| `-s, --strip-tashkeel` | إزالة التشكيل (الفتحة/الضمة/الشدّة...) من العرض — أوضح في بعض التيرمنالات |
| `--dir=auto\|rtl\|ltr` | فرض اتجاه السطر (الافتراضي: تلقائي حسب أول حرف قوي) |
| `--no-force-color` | عدم فرض الألوان على الأمر المغلّف |
| `-h, --help` | المساعدة |
| `-v, --version` | الإصدار |

## الحدود الصادقة: ماذا عن الكتابة أثناء الطباعة؟

ما **تكتبه** على لوحة المفاتيح يعرضه التيرمنال نفسه لحظة الكتابة (echo) قبل أن يصل
لأي برنامج — لذا لا يمكن لأي أداة خارجية تغييره. لكن كن مطمئنًا:

- ✅ **ما تكتبه يصل للبرنامج سليمًا 100%** — النص المرسل صحيح دائمًا.
- ✅ **مخرجات البرنامج** (الردود) — هذه مجال arafix وتُصلح كاملة.

لعرض سليم أثناء الكتابة أيضًا، استخدم تيرمنالًا يدعم BiDi أصلًا:
[WezTerm](https://wezterm.org/) أو [mintty](https://mintty.github.io/) أو
[Konsole](https://konsole.kde.org/) — وفي هذه الحالة لن تحتاج arafix أصلًا.
على ويندوز هناك أيضًا [EasyTer](https://github.com/jaqop/EasyTer) — تيرمنال مصمم
خصيصًا لعرض العربية المتصلة على ويندوز. تنبيه مهم: Windows Terminal و kitty
**لا يطبقان** خوارزمية BiDi الكاملة حتى الآن (النص المختلط يظهر مشوشًا فيهما)،
و mintty مضمّن مع Git for Windows (خيار Text ← BiDi).
الفائدة الحقيقية لـ arafix هي للتيرمنالات **بدون** دعم BiDi، مثل CMD و
Windows Console القديمة وبعض التيرمنالات عبر SSH.

## كمكتبة (Library)

```js
import { fixLine, shapeArabic, bidiReorder, containsArabic, splitClusters, stripTashkeel } from 'arafix';

fixLine('مرحبا');        // النص جاهز للعرض في أي تيرمنال
shapeArabic('مرحبا');    // التشكيل فقط، بالترتيب المنطقي
bidiReorder('...');      // الترتيب البصري فقط
```

| الدالة | الوصف |
|---|---|
| `fixLine(line, options?)` | الإصلاح الكامل لسطر واحد: محارف خفية + تشكيل + ترتيب بصري |
| `shapeArabic(text)` | التشكيل السياقي إلى Presentation Forms (ترتيب منطقي) |
| `bidiReorder(text, dir?)` | إعادة ترتيب BiDi مبسّطة وفق UAX #9 |
| `containsArabic(text)` | هل يحتوي النص حروفًا عربية؟ |
| `stripTashkeel(text)` | إزالة التشكيل |
| `splitClusters(text)` | تقسيم إلى عناقيد (حرف أساسي + علاماته المركّبة) |

## التطوير

```bash
git clone https://github.com/shadow1t/arafix.git
cd arafix
npm test
```

- Node.js ≥ 14 — لا اعتماديات إطلاقًا.
- الاختبارات تشمل round-trip لكل صور العرض عبر NFKC.

## الترخيص

[MIT](LICENSE) © 2026 Rasheed (shadow1t)

</div>

---

## English

### The problem

Most terminals have no real Arabic support, so Arabic appears **reversed and disconnected**:
letters don't join (`م ر ح ب ا` instead of `مرحبا`), word order runs backwards, and mixed
Arabic/English/digit lines become scrambled. This hits every command that prints Arabic —
AI CLI tools, your scripts, `cat`, `grep`...

### The fix

`arafix` does exactly what a real Arabic text engine does:

1. **Contextual shaping** — converts letters to their joined presentation forms.
2. **Simplified BiDi reordering** — lays out runs visually RTL, keeps Latin/numbers LTR,
   mirrors brackets, and preserves ANSI color codes byte-for-byte.

Result: readable Arabic in any terminal, including Windows consoles that know nothing about RTL.

### Usage

```bash
npm install -g github:shadow1t/arafix

# Filter mode: pipe anything through it
echo "مرحبا كيفك" | arafix

# Wrapper mode: run any AI CLI and fix its Arabic output live
arafix -- claude

# Make it permanent
alias claude='arafix -- claude'   # bash/zsh
function claude { arafix -- claude @args }   # PowerShell
```

Options: `-s/--strip-tashkeel`, `--dir=auto|rtl|ltr`, `--no-force-color`, `-h`, `-v`.

### Honest limits: typed-input echo

What **you type** is echoed by the terminal itself before any program sees it — no external
tool can change that rendering. What you type always reaches the program intact, and all
program **output** is what arafix fixes. For correct typed-echo rendering use a BiDi-native
terminal: [WezTerm](https://wezterm.org/), [mintty](https://mintty.github.io/), or
[Konsole](https://konsole.kde.org/) — on Windows also [EasyTer](https://github.com/jaqop/EasyTer).
Note: Windows Terminal and kitty do not implement full BiDi yet. arafix shines on
terminals **without** BiDi support (classic Windows console, some SSH setups).

### Development

```bash
npm test   # node --test, zero dependencies, Node >= 14
```

License: [MIT](LICENSE) © 2026 Rasheed (shadow1t)
