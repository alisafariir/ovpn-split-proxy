# OSP — راهنمای توسعه و استفاده (فارسی)

راهنمای نصب، اجرا و بیلد به‌همراه نکات فنی.

---

## نیازمندی‌ها

- فقط **ویندوز**
- **Node.js** 14 یا بالاتر (برای توسعه)
- **OpenVPN** حتماً باید روی سیستم نصب یا در پوشهٔ `bin` موجود باشد (پایین را ببینید).

---

## نیازمندی OpenVPN

**برنامه OpenVPN باید روی سیستم شما نصب یا در دسترس باشد.** OSP فقط OpenVPN را اجرا و کنترل می‌کند.

- **روش ۱ — نصب از سایت رسمی:**  
  از [https://openvpn.net/community-downloads/](https://openvpn.net/community-downloads/) نسخهٔ ویندوز (مثلاً OpenVPN 2.7 64-bit .msi) را دانلود و نصب کنید. OSP در صورت نصب، از همان `openvpn.exe` داخل Program Files استفاده می‌کند.

- **روش ۲ — استفاده از پوشهٔ `bin`:**  
  فایل **openvpn.exe** را داخل پوشهٔ **`bin`** پروژه قرار دهید. اگر این فایل وجود داشته باشد، OSP از همان استفاده می‌کند.

اگر OpenVPN در دسترس نباشد، با زدن Start در برنامه خطا نمایش داده می‌شود.

---

## ساختار پروژه

```
ovpn-split-proxy/
  main.js
  package.json
  src/
    index.html, preload.js, renderer.js
    vpn.js, socks-server.js, socks.js, utils.js
  assets/icons/   # اختیاری: icon.png
  bin/            # اختیاری: openvpn.exe
  DEVELOP.md
  DEVELOP.fa.md
  README.md
```

---

## اجرا (حالت توسعه)

۱. **نصب وابستگی‌ها**

   ```bash
   npm install
   ```

۲. **اجرا با دسترسی Administrator** (برای کار کردن OpenVPN لازم است):

   - دابل‌کلیک روی **`run-as-admin.cmd`** در پوشهٔ پروژه، یا  
   - باز کردن Command Prompt / PowerShell با «Run as administrator» و سپس:
     ```bash
     cd path\to\ovpn-split-proxy
     npm start
     ```

۳. در برنامه: یک کانفیگ `.ovpn` وارد یا انتخاب کنید، در صورت نیاز یوزر و پسورد را بگذارید، حالت **Proxy** یا **System** را انتخاب کنید و **Start** بزنید.

---

## بیلد (فایل exe ویندوز)

```bash
npm install
npm run build          # نصب‌کننده NSIS + یک exe پرتابل
npm run build:portable # فقط یک exe پرتابل
npm run build:dir      # برنامهٔ بازنشده در dist/win-unpacked
```

خروجی داخل **`dist/`** است. exe با سطح اجرای Administrator ساخته می‌شود.

**GitHub Actions:** با هر push به `main`، فایل `.github/workflows/release.yml` برنامه را بیلد می‌کند و یک Release با exe پرتابل می‌سازد. Actions را برای ریپو فعال نگه دارید.

**امضای کد (اختیاری):** برای کم‌کردن هشدار SmartScreen / «ناشر ناشناس» ویندوز، exe را امضا کنید. در CI متغیرهای `CSC_LINK` (فایل .pfx به صورت base64) و `CSC_KEY_PASSWORD` را تنظیم کنید و در `package.json` داخل `build.win` مقدار `"signAndEditExecutable": true` را اضافه کنید.

---

## امکانات (فنی)

- لیست کانفیگ: وارد کردن `.ovpn`، ذخیره نام، یوزر و پسورد برای هر کانفیگ؛ تغییر نام / ذخیره با نام جدید؛ حذف.
- دو حالت **Proxy** (فقط ترافیک SOCKS5 از VPN) و **System** (کل مسیریابی سیستم از VPN).
- سرور SOCKS5 داخلی روی `127.0.0.1:1080`؛ در حالت Proxy اتصال‌های خروجی از اینترفیس VPN بیرون می‌زنند.
- System tray: بستن پنجره برنامه را به tray می‌برد؛ با انتخاب Exit از منوی tray، VPN قطع شده و برنامه بسته می‌شود.
- گزینهٔ اجرا با ویندوز؛ بدون منوی برنامه؛ بررسی Administrator هنگام شروع و بستن برنامه با OK.

---

## خطاها و راه‌حل

- **openvpn.exe پیدا نشد** (در `bin/` یا Program Files): با زدن Start خطا نشان داده می‌شود.
- **فایل کانفیگ پیدا نشد:** هنگام Start خطا می‌گیرید.
- **اتصال ناموفق یا timeout:** پیام در لاگ و نوار وضعیت.
- اگر در لاگ خطای NETSH و «command failed» دیدید: برنامه را با Administrator اجرا کنید.

---

## لایسنس

MIT
