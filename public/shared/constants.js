// ============================================================
// HẰNG SỐ DÙNG CHUNG cho server (Node.js) và client (trình duyệt)
// Mọi thời gian tính bằng mili-giây (ms).
// ============================================================

export const TICK_RATE = 30;                 // số lần server mô phỏng / giây
export const TICK_MS = 1000 / TICK_RATE;     // ~33.3ms mỗi tick
export const COLS = 15;
export const ROWS = 13;
export const MAX_PLAYERS = 6;

// ---------------- THỜI GIAN NỔ & HIỆU ỨNG ----------------
export const TIMING = {
  BOMB_FUSE: 3000,        // bóng nước nổ sau 3 giây kể từ lúc đặt
  CHAIN_DELAY: 80,        // bóng bị tia nước chạm -> nổ dây chuyền sau 80ms
  FLAME_TIME: 550,        // tia nước tồn tại 0.55 giây
  BOX_BREAK_TIME: 450,    // thùng vỡ trong 0.45 giây rồi mới lộ vật phẩm
  TRAP_TIME: 4500,        // bị nhốt trong bong bóng 4.5 giây rồi vỡ (thua)
  RESCUE_INVULN: 1200,    // bất tử 1.2s sau khi được cứu / dùng kim
  MOUNT_LOSS_INVULN: 1000,// bất tử 1s sau khi mất thú cưỡi
  SHIELD_TIME: 2500,      // khiên bảo vệ 2.5 giây
  COUNTDOWN: 3000,        // đếm ngược 3-2-1 trước trận
  MATCH_TIME: 180000,     // 1 trận tối đa 3 phút, hết giờ = hòa
  RESULT_TIME: 6000,      // hiện bảng kết quả 6 giây rồi về phòng
  SUDDEN_DEATH: 45000,    // còn 45 giây: tường bắt đầu rơi xoắn ốc thu hẹp bản đồ
  SUDDEN_STEP: 330,       // cứ 0.33 giây rơi 1 khối tường
  REMOTE_MAX: 8000,       // Bom Hẹn Giờ: không kích nổ thì tự nổ sau 8 giây
  DART_COOLDOWN: 350,     // khoảng nghỉ giữa 2 lần ném Phi Tiêu
};

export const KICK_SPEED = 9;     // tốc độ bóng bị đẩy (ô/giây)
export const DART_SPEED = 15;    // tốc độ Phi Tiêu (ô/giây)
export const DART_RANGE = 10;    // Phi Tiêu bay tối đa 10 ô
export const TRAPPED_SPEED = 0.7;// tốc độ trôi khi bị nhốt (ô/giây)
export const MOUNT_SPEED = 5.6;  // tốc độ tối thiểu khi cưỡi slime
export const BOX_DENSITY = 0.82; // tỉ lệ ô '?' biến thành thùng
export const ITEM_CHANCE = 0.5;  // tỉ lệ thùng chứa vật phẩm

/** Đổi cấp tốc độ -> ô/giây */
export const speedFromLevel = (lv) => 2.3 + lv * 0.48;

// Hướng: 0 đứng yên, 1 lên, 2 xuống, 3 trái, 4 phải
export const DIRS = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]];

// ---------------- VẬT PHẨM ----------------
// ch: ký tự lưu trên lưới bản đồ
export const ITEMS = {
  bomb:     { ch: 'B', name: 'Bóng Nước', desc: '+1 bóng đặt cùng lúc', weight: 30 },
  range:    { ch: 'R', name: 'Lọ Nước',   desc: '+1 tầm nổ',             weight: 30 },
  speed:    { ch: 'S', name: 'Giày Gió',  desc: '+1 tốc độ chạy',        weight: 22 },
  maxrange: { ch: 'M', name: 'Siêu Lọ',   desc: 'Tầm nổ tối đa',         weight: 4 },
  needle:   { ch: 'N', name: 'Kim Bạc',   desc: 'Tự thoát bong bóng (Z)',weight: 7 },
  shield:   { ch: 'H', name: 'Khiên Sao', desc: 'Bất tử 2.5s (X)',       weight: 5 },
  kick:     { ch: 'K', name: 'Găng Đẩy',  desc: 'Đẩy được bóng nước',    weight: 5 },
  mount:    { ch: 'O', name: 'Slime Cưỡi',desc: 'Chạy nhanh, đỡ 1 lần trúng', weight: 5 },
};
export const ITEM_BY_CH = Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [v.ch, k]));

// ---------------- CỬA HÀNG ----------------
// item   : vật phẩm tiêu hao, mua theo số lượng, tự mang vào trận (tối đa "carry"), dùng bằng phím "key".
//          Dùng không hết -> hoàn lại vào kho sau trận.
// outfit : trang phục (chỉ đổi ngoại hình), mặc 1 bộ.
// skin   : kiểu bóng nước (chỉ đổi ngoại hình), dùng 1 kiểu.
// gear   : phụ kiện tăng chỉ số khởi đầu, mặc tối đa MAX_EQUIP món (không vượt giới hạn nhân vật).
export const SHOP_TABS = [
  { kind: 'item', name: 'Vật phẩm', icon: '🎒' },
  { kind: 'outfit', name: 'Trang phục', icon: '👒' },
  { kind: 'skin', name: 'Bóng nước', icon: '🎈' },
  { kind: 'gear', name: 'Phụ kiện', icon: '⚙️' },
];
export const SHOP = {
  needle: { kind: 'item', name: 'Kim Bạc',     desc: 'Tự thoát khỏi bong bóng khi bị nhốt',              price: 40, icon: 'needle', carry: 3, key: 'Z', field: 'needles' },
  shield: { kind: 'item', name: 'Khiên Sao',   desc: 'Bất tử 2.5 giây, tia nước không làm gì được',      price: 60, icon: 'shield', carry: 2, key: 'X', field: 'shields' },
  dart:   { kind: 'item', name: 'Phi Tiêu',    desc: 'Ném thẳng phía trước: kích nổ bóng nước, chọc vỡ bong bóng đối thủ', price: 50, icon: 'dart', carry: 5, key: 'C', field: 'darts' },
  remote: { kind: 'item', name: 'Bom Hẹn Giờ', desc: 'Đặt quả bóng đặc biệt (tầm +1), bấm lần nữa để kích nổ. Tự nổ sau 8 giây', price: 80, icon: 'remote', carry: 2, key: 'V', field: 'remotes' },

  pirate: { kind: 'outfit', name: 'Mũ Cướp Biển',  desc: 'Thuyền trưởng của mọi trận hải chiến', price: 300, icon: 'outfit:pirate' },
  wizard: { kind: 'outfit', name: 'Mũ Phù Thuỷ',   desc: 'Mũ nhọn lấp lánh sao',                 price: 350, icon: 'outfit:wizard' },
  shades: { kind: 'outfit', name: 'Kính Râm Ngầu', desc: 'Ngầu từ đầu trận tới cuối trận',       price: 250, icon: 'outfit:shades' },
  cape:   { kind: 'outfit', name: 'Áo Choàng Đỏ',  desc: 'Áo choàng tung bay khi chạy',          price: 450, icon: 'outfit:cape' },
  crown:  { kind: 'outfit', name: 'Vương Miện',    desc: 'Dành cho nhà vô địch',                 price: 900, icon: 'outfit:crown' },

  straw:  { kind: 'skin', name: 'Bóng Dâu Tây',  desc: 'Bóng nước đỏ hạt vàng',    price: 200,  icon: 'skin:straw' },
  melon:  { kind: 'skin', name: 'Bóng Dưa Hấu',  desc: 'Bóng sọc xanh mát lạnh',  price: 250,  icon: 'skin:melon' },
  pumpkin:{ kind: 'skin', name: 'Bóng Bí Ngô',   desc: 'Bóng cam có cuống xanh',  price: 300,  icon: 'skin:pumpkin' },
  star:   { kind: 'skin', name: 'Bóng Ngôi Sao', desc: 'Bóng vàng in hình sao',   price: 350,  icon: 'skin:star' },
  gold:   { kind: 'skin', name: 'Bóng Hoàng Kim',desc: 'Bóng vàng ròng lấp lánh', price: 1000, icon: 'skin:gold' },

  boots:  { kind: 'gear', name: 'Giày Lướt Sóng', desc: '+1 tốc độ khi vào trận',          price: 300, icon: 'boots',  bonus: { s: 1 } },
  bag:    { kind: 'gear', name: 'Balo Bóng',      desc: '+1 bóng nước khi vào trận',       price: 400, icon: 'bag',    bonus: { b: 1 } },
  nozzle: { kind: 'gear', name: 'Vòi Rồng',       desc: '+1 tầm nổ khi vào trận',          price: 400, icon: 'nozzle', bonus: { r: 1 } },
  glove:  { kind: 'gear', name: 'Găng Thần',      desc: 'Vào trận có sẵn Găng Đẩy bóng',   price: 250, icon: 'glove',  kick: true },
  vest:   { kind: 'gear', name: 'Áo Phao',        desc: 'Bong bóng giữ lâu thêm 1.5 giây', price: 350, icon: 'vest',   trapBonus: 1500 },
};
export const ITEM_IDS = Object.keys(SHOP).filter((id) => SHOP[id].kind === 'item');
export const MAX_EQUIP = 2;          // số trang bị mặc cùng lúc
export const START_COINS = 300;      // xu tặng người chơi mới
export const REWARD = { play: 20, win: 60, kill: 15, box: 1 };  // xu thưởng sau mỗi trận

// ---------------- NHÂN VẬT (thiết kế gốc) ----------------
// b: bóng ban đầu/tối đa, r: tầm nổ, s: cấp tốc độ
export const CHARACTERS = [
  { id: 'bin',  name: 'Bin',   desc: 'Cân bằng mọi mặt',       b: [1, 6], r: [1, 7], s: [4, 9],
    body: '#ff6b5b', skin: '#ffd9b8', acc: '#ffd23f', hat: 'cap' },
  { id: 'may',  name: 'Mây',   desc: 'Mang nhiều bóng',        b: [2, 8], r: [1, 6], s: [3, 8],
    body: '#5bb6ff', skin: '#ffe2c6', acc: '#ffffff', hat: 'cloud' },
  { id: 'soc',  name: 'Sóc',   desc: 'Tia nước bắn xa',        b: [1, 6], r: [2, 8], s: [3, 8],
    body: '#c98a4b', skin: '#f6d2a8', acc: '#7a4a24', hat: 'ears' },
  { id: 'tia',  name: 'Tia',   desc: 'Nhanh như chớp',         b: [1, 5], r: [1, 6], s: [6, 10],
    body: '#9b5bff', skin: '#ffdcc0', acc: '#ffe66b', hat: 'band' },
  { id: 'bong', name: 'Bông',  desc: 'Chậm nhưng tiềm năng lớn', b: [1, 9], r: [1, 8], s: [2, 7],
    body: '#f2f2f7', skin: '#ffe6d2', acc: '#ff8fb8', hat: 'bear' },
  { id: 'keo',  name: 'Kẹo',   desc: 'Khởi đầu mạnh',          b: [2, 6], r: [2, 6], s: [3, 7],
    body: '#3fd18b', skin: '#ffd8b5', acc: '#ff5fa2', hat: 'bow' },
];
export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

export const TEAMS = [
  { name: 'Đỏ', color: '#ff4d5e' },
  { name: 'Xanh', color: '#3d8bff' },
  { name: 'Lá', color: '#2fc46b' },
  { name: 'Vàng', color: '#ffc21a' },
  { name: 'Tím', color: '#a55bff' },
  { name: 'Cam', color: '#ff8a1f' },
];

// ---------------- BẢN ĐỒ ----------------
// '#' tường cứng, 'x' luôn là thùng, '?' có thể là thùng, '.' luôn trống, '1'-'6' điểm xuất phát
export const MAPS = [
  {
    id: 'lang', name: 'Làng Gió', theme: 0,
    rows: [
      '1.???????????.2',
      '.#?#?#?#?#?#?#.',
      '???????????????',
      '?#?#?#?#?#?#?#?',
      '???????????????',
      '.#?#?#?#?#?#?#.',
      '3.???????????.4',
      '.#?#?#?#?#?#?#.',
      '???????????????',
      '?#?#?#?#?#?#?#?',
      '???????????????',
      '.#?#?#?#?#?#?#.',
      '5.???????????.6',
    ],
  },
  {
    id: 'samac', name: 'Sa Mạc Cát', theme: 1,
    rows: [
      '1..?????????..2',
      '.##?#??.??#?##.',
      '.#???#???#???#.',
      '??#?????????#??',
      '?????##.##?????',
      '.#???#...#???#.',
      '3.???..?..???.4',
      '.#???#...#???#.',
      '?????##.##?????',
      '??#?????????#??',
      '.#???#???#???#.',
      '.##?#??.??#?##.',
      '5..?????????..6',
    ],
  },
  {
    id: 'keo', name: 'Đảo Kẹo', theme: 2,
    rows: [
      '1.?????.?????.2',
      '.#?##?#?#?##?#.',
      '???????????????',
      '?##?#?###?#?##?',
      '???????.???????',
      '.#?#?##.##?#?#.',
      '3.?????.?????.4',
      '.#?#?##.##?#?#.',
      '???????.???????',
      '?##?#?###?#?##?',
      '???????????????',
      '.#?##?#?#?##?#.',
      '5.?????.?????.6',
    ],
  },
  // '~' = nước biển (không đi qua, tia nước dừng lại)
  {
    id: 'thuyen', name: 'Thuyền Chiến', theme: 3,
    rows: [
      '~~~1.?????.2~~~',
      '~~..#?#?#?#..~~',
      '~?????????????~',
      '?#?#?##.##?#?#?',
      '???????.???????',
      '.#?#?#???#?#?#.',
      '3.???#.#.#???.4',
      '.#?#?#???#?#?#.',
      '???????.???????',
      '?#?#?##.##?#?#?',
      '~?????????????~',
      '~~..#?#?#?#..~~',
      '~~~5.?????.6~~~',
    ],
  },
  {
    id: 'haichien', name: 'Hải Chiến Hai Tàu', theme: 3,
    rows: [
      '1.????.3.????.2',
      '.#?#?#?.?#?#?#.',
      '???????????????',
      '?#?#?##?##?#?#?',
      '??.?????????.??',
      '~~.~~~~.~~~~.~~',
      '~~.~~~...~~~.~~',
      '~~.~~~~.~~~~.~~',
      '??.?????????.??',
      '?#?#?##?##?#?#?',
      '???????????????',
      '.#?#?#?.?#?#?#.',
      '5.????.4.????.6',
    ],
  },
  {
    id: 'bang', name: 'Băng Tuyết', theme: 4,
    rows: [
      '1.???.???.???.2',
      '..#???#?#???#..',
      '?#???#???#???#?',
      '???#???#???#???',
      '?#???#???#???#?',
      '.??#???#???#??.',
      '3.?????#?????.4',
      '.??#???#???#??.',
      '?#???#???#???#?',
      '???#???#???#???',
      '?#???#???#???#?',
      '..#???#?#???#..',
      '5.???.???.???.6',
    ],
  },
  {
    id: 'nam', name: 'Rừng Nấm', theme: 5,
    rows: [
      '1.?????#?????.2',
      '.##???###???##.',
      '???????????????',
      '?##?#?????#?##?',
      '????#?###?#????',
      '.??????.??????.',
      '3.##???.???##.4',
      '.??????.??????.',
      '????#?###?#????',
      '?##?#?????#?##?',
      '???????????????',
      '.##???###???##.',
      '5.?????#?????.6',
    ],
  },
  {
    id: 'quangtruong', name: 'Quảng Trường', theme: 0,
    rows: [
      '1.???????????.2',
      '.#?#?#?#?#?#?#.',
      '???????????????',
      '?#?#.......#?#?',
      '????.#...#.????',
      '.#?#...#...#?#.',
      '3.??...x...??.4',
      '.#?#...#...#?#.',
      '????.#...#.????',
      '?#?#.......#?#?',
      '???????????????',
      '.#?#?#?#?#?#?#.',
      '5.???????????.6',
    ],
  },
];
export const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));
// Thứ tự dùng điểm xuất phát để người chơi rải đều bản đồ
export const SPAWN_ORDER = ['1', '6', '2', '5', '3', '4'];
