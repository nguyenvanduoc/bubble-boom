// ============================================================
// LƯU HỒ SƠ NGƯỜI CHƠI (ví xu, kho đồ) VÀO FILE JSON TRÊN SERVER
// Ghi gộp sau 2 giây để không ghi đĩa liên tục; ghi qua file tạm rồi đổi tên để không hỏng file.
// ============================================================
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { newProfile, fixProfile } from './public/shared/profile.js';

export class FileStore {
  constructor(file) {
    this.file = file;
    this.data = {};
    this.timer = null;
    try { this.data = JSON.parse(readFileSync(file, 'utf8')); }
    catch { /* chưa có file -> bắt đầu rỗng */ }
    mkdirSync(dirname(file), { recursive: true });
  }

  get(token) {
    return fixProfile(this.data[token] || (this.data[token] = newProfile()));
  }

  save() {
    if (this.timer) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      const tmp = this.file + '.tmp';
      await writeFile(tmp, JSON.stringify(this.data));
      await rename(tmp, this.file);
    }, 2000);
  }

  /** Ghi ngay lập tức (dùng khi tắt server) */
  flushSync() {
    clearTimeout(this.timer); this.timer = null;
    writeFileSync(this.file + '.tmp', JSON.stringify(this.data));
    renameSync(this.file + '.tmp', this.file);
  }
}
