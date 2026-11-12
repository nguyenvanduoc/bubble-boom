// ============================================================
// SẢNH & PHÒNG CHƠI. Không phụ thuộc WebSocket: chỉ cần hàm send(obj|string)
// -> dùng được cả trên server Node.js lẫn chế độ offline trong trình duyệt.
// ============================================================
import { TICK_MS, TIMING, MAX_PLAYERS, CHARACTERS, CHAR_BY_ID, MAPS, MAP_BY_ID, TEAMS, SHOP } from './constants.js';
import { Game } from './engine.js';
import { thinkBot } from './bot.js';
import { MemoryStore, buy, equip, takeLoadout, settle } from './profile.js';

const BOT_NAMES = ['Bot Mít', 'Bot Ổi', 'Bot Chuối', 'Bot Na', 'Bot Xoài', 'Bot Dừa', 'Bot Me'];
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const genToken = () => Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[(Math.random() * 62) | 0]).join('');
const nowMs = () => (globalThis.performance ? performance.now() : Date.now());

export class Lobby {
  /** store: nơi lưu hồ sơ { get(token), save() } - server lưu file, offline lưu trình duyệt */
  constructor(store = new MemoryStore()) {
    this.clients = new Map();
    this.rooms = new Map();
    this.seq = 1;
    this.store = store;
  }

  // ---------- kết nối ----------
  connect(send) {
    const c = { id: 'u' + this.seq++, send, name: 'Khách', charId: 'bin', room: null };
    this.clients.set(c.id, c);
    c.send({ t: 'welcome', id: c.id });
    return c;
  }

  disconnect(c) {
    this.leave(c);
    this.clients.delete(c.id);
  }

  handle(c, m) {
    if (!m || typeof m.t !== 'string') return;
    const room = c.room ? this.rooms.get(c.room) : null;
    const isHost = room && room.host === c.id;
    switch (m.t) {
      case 'hello':
        c.name = clean(m.name, 16) || 'Khách';
        if (CHAR_BY_ID[m.char]) c.charId = m.char;
        // token = "chìa khoá" của ví xu, client lưu lại để lần sau dùng tiếp
        c.token = TOKEN_RE.test(m.token) ? m.token : genToken();
        c.profile = this.store.get(c.token);
        this.sendProfile(c);
        c.send(this.lobbyMsg());
        break;
      case 'buy': case 'equip': {
        if (!c.profile) return;
        const err = m.t === 'buy' ? buy(c.profile, m.item, m.qty) : equip(c.profile, m.item, !!m.on);
        if (err) return c.send({ t: 'err', msg: err });
        this.store.save();
        this.sendProfile(c, m.t === 'buy' ? 'Mua thành công!' : null);
        const me = room && room.status === 'waiting' && room.members.find((x) => x.id === c.id);
        if (me) { Object.assign(me, this.looks(c)); this.sendRoom(room); }
        break;
      }
      case 'gear':
        if (isHost && room.status === 'waiting') { room.gear = !!m.v; this.sendRoom(room); }
        break;
      case 'list': c.send(this.lobbyMsg()); break;
      case 'create': {
        this.leave(c);
        const r = {
          id: this.newCode(), name: clean(m.name, 24) || `Phòng của ${c.name}`,
          host: c.id, mapId: MAP_BY_ID[m.map] ? m.map : MAPS[0].id, gear: true,
          members: [], status: 'waiting', game: null, loop: null, timers: [],
        };
        this.rooms.set(r.id, r);
        this.addMember(r, this.memberOf(c));
        c.room = r.id;
        this.sendRoom(r); this.pushLobby();
        break;
      }
      case 'join': {
        const r = this.rooms.get(clean(m.room, 8).toUpperCase());
        if (!r) return c.send({ t: 'err', msg: 'Không tìm thấy phòng' });
        if (r.status !== 'waiting') return c.send({ t: 'err', msg: 'Phòng đang chơi, đợi ván sau nhé' });
        if (r.members.length >= MAX_PLAYERS) return c.send({ t: 'err', msg: 'Phòng đã đầy' });
        if (c.room !== r.id) {
          this.leave(c);
          this.addMember(r, this.memberOf(c));
          c.room = r.id;
        }
        this.sendRoom(r); this.pushLobby();
        break;
      }
      case 'leave': this.leave(c); c.send(this.lobbyMsg()); break;
      case 'char': {
        if (!CHAR_BY_ID[m.char]) return;
        c.charId = m.char;
        const me = room && room.status === 'waiting' && room.members.find((x) => x.id === c.id);
        if (me) { me.charId = m.char; this.sendRoom(room); }
        break;
      }
      case 'team': {
        const t = m.team | 0;
        const me = room && room.status === 'waiting' && room.members.find((x) => x.id === (m.id && isHost ? m.id : c.id));
        if (me && t >= 0 && t < TEAMS.length) { me.team = t; this.sendRoom(room); }
        break;
      }
      case 'ready': {
        const me = room && room.status === 'waiting' && room.members.find((x) => x.id === c.id);
        if (me) { me.ready = !!m.v; this.sendRoom(room); }
        break;
      }
      case 'map':
        if (isHost && room.status === 'waiting' && MAP_BY_ID[m.map]) { room.mapId = m.map; this.sendRoom(room); this.pushLobby(); }
        break;
      case 'addBot':
        if (isHost && room.status === 'waiting' && room.members.length < MAX_PLAYERS) {
          const used = new Set(room.members.map((x) => x.name));
          const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot';
          const ch = CHARACTERS[(Math.random() * CHARACTERS.length) | 0];
          // bot thỉnh thoảng cũng diện đồ cho vui
          const pick = (kind) => { const ids = Object.keys(SHOP).filter((id) => SHOP[id].kind === kind); return Math.random() < 0.4 ? ids[(Math.random() * ids.length) | 0] : null; };
          this.addMember(room, { id: 'b' + this.seq++, name, charId: ch.id, bot: true, ready: true, gear: [], outfit: pick('outfit'), skin: pick('skin') });
          this.sendRoom(room); this.pushLobby();
        }
        break;
      case 'kick':
        if (isHost && room.status === 'waiting' && m.id !== c.id) {
          const target = room.members.find((x) => x.id === m.id);
          if (!target) return;
          if (target.bot) {
            room.members = room.members.filter((x) => x !== target);
            this.sendRoom(room); this.pushLobby();
          } else {
            const tc = this.clients.get(target.id);
            if (tc) { this.leave(tc); tc.send({ t: 'err', msg: 'Bạn đã bị chủ phòng mời ra' }); tc.send(this.lobbyMsg()); }
          }
        }
        break;
      case 'start': if (isHost) this.start(room, c); break;
      case 'chat': {
        const text = clean(m.text, 120);
        if (room && text) this.broadcast(room, { t: 'chat', from: c.name, text });
        break;
      }
      case 'in': if (room && room.game) room.game.pushInput(c.id, m); break;
      case 'ping': c.send({ t: 'pong', c: m.c }); break;
    }
  }

  // ---------- phòng ----------
  newCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do { code = Array.from({ length: 4 }, () => A[(Math.random() * A.length) | 0]).join(''); } while (this.rooms.has(code));
    return code;
  }

  memberOf(c) {
    return { id: c.id, name: c.name, charId: c.charId, bot: false, ...this.looks(c) };
  }

  /** Phụ kiện + trang phục + kiểu bóng đang dùng của 1 người */
  looks(c) {
    const p = c.profile;
    return { gear: p ? [...p.equipped] : [], outfit: p?.outfit || null, skin: p?.skin || null };
  }

  sendProfile(c, msg) {
    if (c.profile) c.send({ t: 'profile', token: c.token, profile: c.profile, msg });
  }

  addMember(r, m) {
    const used = new Set(r.members.map((x) => x.team));
    m.team = TEAMS.findIndex((_, i) => !used.has(i));
    if (m.team < 0) m.team = 0;
    m.ready = !!m.ready;
    r.members.push(m);
  }

  leave(c) {
    const r = c.room && this.rooms.get(c.room);
    c.room = null;
    if (!r) return;
    r.members = r.members.filter((x) => x.id !== c.id);
    if (r.game) r.game.removePlayer(c.id);
    if (!r.members.some((x) => !x.bot)) return this.destroy(r);
    if (r.host === c.id) r.host = r.members.find((x) => !x.bot).id;
    this.broadcast(r, { t: 'chat', from: '★', text: `${c.name} đã rời phòng` });
    this.sendRoom(r); this.pushLobby();
  }

  destroy(r) {
    clearInterval(r.loop);
    r.timers.forEach(clearTimeout);
    this.rooms.delete(r.id);
    this.pushLobby();
  }

  start(r, c) {
    if (r.status !== 'waiting') return;
    const err = (msg) => c.send({ t: 'err', msg });
    if (r.members.length < 2) return err('Cần ít nhất 2 người (có thể thêm bot)');
    if (new Set(r.members.map((m) => m.team)).size < 2) return err('Cần ít nhất 2 đội khác nhau');
    const notReady = r.members.filter((m) => !m.bot && m.id !== r.host && !m.ready);
    if (notReady.length) return err(`Chưa sẵn sàng: ${notReady.map((m) => m.name).join(', ')}`);

    // Lấy vật phẩm + trang bị từ kho của từng người (nếu chủ phòng cho phép)
    r.loadouts = new Map();
    const players = r.members.map((m) => {
      const info = { ...m };
      const cl = !m.bot && r.gear && this.clients.get(m.id);
      if (cl && cl.profile) { info.loadout = takeLoadout(cl.profile); r.loadouts.set(m.id, info.loadout); this.sendProfile(cl); }
      return info;
    });
    this.store.save();
    const game = new Game({ mapId: r.mapId, players });
    r.game = game; r.status = 'playing'; r.lastGv = game.gridVersion; r.ended = false;
    this.broadcast(r, { t: 'start', map: r.mapId, players: game.infoList(), g: game.grid.join(''), gv: game.gridVersion });
    this.pushLobby();

    // Vòng lặp cố định 30 tick/giây, tự bù khi bộ hẹn giờ bị trễ
    let last = nowMs(), acc = 0;
    r.loop = setInterval(() => {
      const t = nowMs();
      acc += t - last; last = t;
      if (acc > 250) acc = 250;                    // tránh "đuổi" quá nhiều sau khi máy bị đơ
      while (acc >= TICK_MS && r.game) { acc -= TICK_MS; this.step(r); }
    }, TICK_MS / 2);
  }

  step(r) {
    const g = r.game;
    for (const p of g.players.values()) if (p.bot) g.pushInput(p.id, thinkBot(g, p));
    g.tick();
    const includeGrid = g.gridVersion !== r.lastGv;
    r.lastGv = g.gridVersion;
    this.broadcast(r, g.snapshot(includeGrid));
    g.flushEvents();
    if (g.phase === 'end' && !r.ended) {
      r.ended = true;
      clearInterval(r.loop);
      // Thưởng xu + hoàn vật phẩm chưa dùng cho người còn ở trong phòng
      const coins = {};
      for (const m of r.members) {
        const cl = !m.bot && this.clients.get(m.id), gp = g.players.get(m.id);
        if (!cl || !cl.profile || !gp) continue;
        coins[m.id] = settle(cl.profile, r.loadouts.get(m.id), gp, g.result.winners.includes(m.id));
      }
      g.result.coins = coins;
      this.store.save();
      this.broadcast(r, { t: 'end', result: g.result });
      for (const id in coins) this.sendProfile(this.clients.get(id));
      r.timers.push(setTimeout(() => {
        r.game = null; r.status = 'waiting';
        r.members.forEach((m) => { if (!m.bot) m.ready = false; });
        this.sendRoom(r); this.pushLobby();
      }, TIMING.RESULT_TIME));
    }
  }

  // ---------- gửi tin ----------
  broadcast(r, msg) {
    const raw = JSON.stringify(msg);                  // tuần tự hoá 1 lần, gửi cho mọi người
    for (const m of r.members) if (!m.bot) this.clients.get(m.id)?.send(raw);
  }

  sendRoom(r) {
    this.broadcast(r, {
      t: 'room',
      room: { id: r.id, name: r.name, host: r.host, map: r.mapId, status: r.status, gear: r.gear,
        members: r.members.map(({ id, name, charId, team, ready, bot, gear, outfit, skin }) => ({ id, name, charId, team, ready, bot, gear: gear || [], outfit, skin })) },
    });
  }

  lobbyMsg() {
    return {
      t: 'lobby',
      rooms: [...this.rooms.values()].map((r) => ({
        id: r.id, name: r.name, map: r.mapId, count: r.members.length, max: MAX_PLAYERS, status: r.status,
      })),
      online: this.clients.size,
    };
  }

  pushLobby() {
    const raw = JSON.stringify(this.lobbyMsg());
    for (const c of this.clients.values()) if (!c.room) c.send(raw);
  }
}
