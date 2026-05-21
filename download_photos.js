const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const OUTPUT_DIR = path.join(__dirname, 'photo');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Parse constants.js manually to extract id, name, img
const content = fs.readFileSync(path.join(__dirname, 'src/data/constants.js'), 'utf8');

// Extract MENU items: id, name, img
const menuItems = [];
const menuRe = /\{id:(\d+),cat:"[^"]*",name:"([^"]+)",[^}]*img:"([^"]+)"/g;
let m;
while ((m = menuRe.exec(content)) !== null) {
  menuItems.push({ id: Number(m[1]), name: m[2], img: m[3] });
}

// Extract SLIDES: img + imgLight
const slideImgs = [];
const slideRe = /img:"(https[^"]+)",\s*imgLight:"(https[^"]+)"/g;
while ((m = slideRe.exec(content)) !== null) {
  slideImgs.push({ dark: m[1], light: m[2] });
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[аА]/g, 'a').replace(/[бБ]/g, 'b').replace(/[вВ]/g, 'v')
    .replace(/[гГ]/g, 'g').replace(/[дД]/g, 'd').replace(/[еЕёЁ]/g, 'e')
    .replace(/[жЖ]/g, 'zh').replace(/[зЗ]/g, 'z').replace(/[иИйЙ]/g, 'i')
    .replace(/[кК]/g, 'k').replace(/[лЛ]/g, 'l').replace(/[мМ]/g, 'm')
    .replace(/[нН]/g, 'n').replace(/[оО]/g, 'o').replace(/[пП]/g, 'p')
    .replace(/[рР]/g, 'r').replace(/[сС]/g, 's').replace(/[тТ]/g, 't')
    .replace(/[уУ]/g, 'u').replace(/[фФ]/g, 'f').replace(/[хХ]/g, 'kh')
    .replace(/[цЦ]/g, 'ts').replace(/[чЧ]/g, 'ch').replace(/[шШ]/g, 'sh')
    .replace(/[щЩ]/g, 'sch').replace(/[ъЪьЬ]/g, '').replace(/[ыЫ]/g, 'y')
    .replace(/[эЭ]/g, 'e').replace(/[юЮ]/g, 'yu').replace(/[яЯ]/g, 'ya')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function extFromUrl(rawUrl) {
  try {
    const pathname = new url.URL(rawUrl).pathname;
    const ext = path.extname(pathname).toLowerCase().split('?')[0];
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext)) return ext;
  } catch {}
  if (rawUrl.includes('.webp')) return '.webp';
  if (rawUrl.includes('.png')) return '.png';
  if (rawUrl.includes('.gif')) return '.gif';
  return '.jpg';
}

function download(rawUrl, destPath) {
  return new Promise((resolve) => {
    const protocol = rawUrl.startsWith('https') ? https : http;
    const req = protocol.get(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.google.com/',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        req.destroy();
        download(res.headers.location, destPath).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        req.destroy();
        resolve({ ok: false, status: res.statusCode });
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve({ ok: true }); });
      file.on('error', (e) => { resolve({ ok: false, err: e.message }); });
    });
    req.on('error', (e) => resolve({ ok: false, err: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, err: 'timeout' }); });
  });
}

async function main() {
  const tasks = [];

  // Menu items
  for (const item of menuItems) {
    const ext = extFromUrl(item.img);
    const filename = `menu_${String(item.id).padStart(2,'0')}_${slugify(item.name)}${ext}`;
    tasks.push({ url: item.img, filename, label: item.name });
  }

  // Slides
  slideImgs.forEach((sl, i) => {
    const extD = extFromUrl(sl.dark);
    const extL = extFromUrl(sl.light);
    tasks.push({ url: sl.dark, filename: `slide_${i+1}_dark${extD}`, label: `Слайд ${i+1} (тёмная)` });
    tasks.push({ url: sl.light, filename: `slide_${i+1}_light${extL}`, label: `Слайд ${i+1} (светлая)` });
  });

  let ok = 0, fail = 0;
  for (const task of tasks) {
    const dest = path.join(OUTPUT_DIR, task.filename);
    process.stdout.write(`  Скачиваю: ${task.label}... `);
    const result = await download(task.url, dest);
    if (result.ok) {
      const size = fs.existsSync(dest) ? (fs.statSync(dest).size / 1024).toFixed(0) : 0;
      console.log(`OK (${size} KB) → ${task.filename}`);
      ok++;
    } else {
      console.log(`ОШИБКА: ${result.status || result.err}`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      fail++;
    }
  }

  console.log(`\nГотово: ${ok} скачано, ${fail} ошибок.`);
  console.log(`Папка: ${OUTPUT_DIR}`);
}

main().catch(console.error);
