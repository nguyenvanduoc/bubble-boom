// ============================================================
// BÀN PHÍM + CẢM ỨNG. Hướng đi = phím bấm GẦN NHẤT còn đang giữ.
// ============================================================
const KEY_DIR = {
  ArrowUp: 1, KeyW: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3, ArrowRight: 4, KeyD: 4,
};
const KEY_ACT = { Space: 'b', KeyJ: 'b', KeyZ: 'n', KeyK: 'n', KeyX: 's', KeyL: 's' };

export class Input {
  constructor() {
    this.stack = [];                 // các hướng đang giữ, phần tử cuối = ưu tiên
    this.latch = { b: 0, n: 0, s: 0 }; // nút bấm 1 lần, giữ lại tới khi tick kế tiếp đọc
    this.enabled = false;
    addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      const d = KEY_DIR[e.code], a = KEY_ACT[e.code];
      if (d) { e.preventDefault(); this.press(d); }
      if (a) { e.preventDefault(); if (!e.repeat) this.latch[a] = 1; }
    });
    addEventListener('keyup', (e) => { const d = KEY_DIR[e.code]; if (d) this.release(d); });
    addEventListener('blur', () => { this.stack = []; });
  }
  press(d) { this.stack = this.stack.filter((x) => x !== d); this.stack.push(d); }
  release(d) { this.stack = this.stack.filter((x) => x !== d); }
  dir() { return this.enabled ? this.stack[this.stack.length - 1] || 0 : 0; }
  /** Lấy và xoá các nút bấm 1 lần */
  consume() { const l = this.latch; this.latch = { b: 0, n: 0, s: 0 }; return this.enabled ? l : { b: 0, n: 0, s: 0 }; }

  /** Gắn nút ảo trên màn hình cảm ứng: phần tử có data-dir hoặc data-act */
  bindTouch(root) {
    root.querySelectorAll('[data-dir]').forEach((el) => {
      const d = Number(el.dataset.dir);
      const on = (e) => { e.preventDefault(); this.press(d); el.classList.add('on'); };
      const off = (e) => { e.preventDefault(); this.release(d); el.classList.remove('on'); };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    });
    root.querySelectorAll('[data-act]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.latch[el.dataset.act] = 1; });
    });
  }
}
