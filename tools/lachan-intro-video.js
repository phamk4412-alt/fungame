// Ghi video mở đầu Lá Chắn Ngôn Từ thành MP4 (1920×1080, 30 khung/giây, có nhạc nền).
// Cần: Playwright (chromium) và ffmpeg.
//   node tools/lachan-intro-video.js [ra.mp4] [--video intro|r1|r2|r3] [--fps 30] [--frames 2.5,12,40]
//   (--video: video mở đầu hoặc video trước Màn 1/2/3; --frames: chỉ chụp ảnh PNG các giây đó)
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(args.find((a) => a.endsWith('.mp4')) || 'la-chan-ngon-tu-mo-dau.mp4');
const fps = Number(opt('--fps', 30));
const frames = opt('--frames', null);
const page = 'file://' + path.resolve(__dirname, '../public/lachan/intro.html') + '?v=' + opt('--video', 'intro');

(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto(page);
  await pg.waitForFunction(() => window.__intro);
  const dur = await pg.evaluate(() => window.__intro.duration);

  if (frames) {
    for (const s of frames.split(',').map(Number)) {
      await pg.evaluate((x) => window.__intro.seek(x), s);
      const f = out.replace(/\.mp4$/, `-${String(s).replace('.', '_')}s.png`);
      await pg.screenshot({ path: f });
      console.log(f);
    }
    await browser.close();
    return;
  }

  const wav = out.replace(/\.mp4$/, '.wav');
  fs.writeFileSync(wav, Buffer.from(await pg.evaluate(() => window.__intro.renderAudio()), 'base64'));

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-i', wav,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(dur * fps);
  for (let i = 0; i < total; i++) {
    await pg.evaluate((x) => window.__intro.seek(x), i / fps);
    const jpg = await pg.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % (fps * 5) === 0) process.stdout.write(`\r${Math.round((i / total) * 100)}%`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error('ffmpeg lỗi ' + c)) : r())));
  fs.unlinkSync(wav);
  await browser.close();
  console.log('\nĐã ghi', out);
})().catch((e) => { console.error(e); process.exit(1); });
