// Tạo data.js từ data.json (để mở game trực tiếp bằng file:// khi không có server).
// Chạy lại sau mỗi lần sửa data.json:  node public/lachan/build-data.js
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'data.json');
const data = JSON.parse(fs.readFileSync(src, 'utf8'));
const out = '// TỰ SINH từ data.json bằng build-data.js — đừng sửa tay, hãy sửa data.json rồi chạy lại.\nwindow.LCNT_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
fs.writeFileSync(path.join(__dirname, 'data.js'), out);
console.log('✓ Đã tạo data.js từ data.json');
