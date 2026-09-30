// 게시판 저장소. 서버 없이 각 휴대폰(브라우저) 안에만 저장합니다.
export const isDemo = true;

// 글마다 따로 만든 지우기 열쇠. 기기 열쇠는 이 휴대폰에만 있고 서버에는 열쇠의 지문만 올라갑니다.
const enc = new TextEncoder();
async function sha(s, as = "b64") {
  const buf = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  if (as === "hex") return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deviceKey() {
  let k = null;
  try { k = localStorage.getItem("lb.key"); } catch {}
  if (!k) {
    k = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem("lb.key", k); } catch {}
  }
  return k;
}
const itemKey = (id) => sha(deviceKey() + ":" + id, "hex");
export async function isMine(id, keyHash) {
  return keyHash === (await sha(await itemKey(id)));
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const store = demoStore();
export default store;

function demoStore() {
  const KEY = "lb.local.v1";
  const subs = new Set();
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { posts: [], comments: {} }; } catch { return { posts: [], comments: {} }; } };
  let db = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} subs.forEach((fn) => fn()); };
  const sub = (fn) => { subs.add(fn); fn(); return () => subs.delete(fn); };
  const byNew = (a, b) => b.createdAt - a.createdAt;
  const admin = async (k) => (await sha(k)) === "HrLXrK6ZV-TzrHypRsY8oADLYt7H9cBv-q0TLiofB8Y";

  return {
    watchRecent(cb) { return sub(() => cb(db.posts.filter((p) => !p.hidden).sort(byNew).slice(0, 30))); },
    watchBoard(board, cb) { return sub(() => cb(db.posts.filter((p) => p.board === board && !p.hidden).sort(byNew))); },
    watchPost(id, cb) { return sub(() => cb(db.posts.find((p) => p.id === id) || null)); },
    watchComments(id, cb) { return sub(() => cb((db.comments[id] || []).filter((c) => !c.hidden).sort((a, b) => a.createdAt - b.createdAt))); },
    async addPost({ board, tag, name, text }) {
      const id = newId();
      db.posts.push({ id, board, tag, name, text, createdAt: Date.now(), keyHash: await sha(await itemKey(id)), amen: 0, comments: 0, hidden: false });
      save(); return id;
    },
    async addComment(postId, { name, text }) {
      const id = newId();
      (db.comments[postId] ||= []).push({ id, name, text, createdAt: Date.now(), keyHash: await sha(await itemKey(id)), hidden: false });
      const p = db.posts.find((x) => x.id === postId); if (p) p.comments++;
      save();
    },
    async amen(postId) { const p = db.posts.find((x) => x.id === postId); if (p) { p.amen++; save(); } },
    async hidePost(id, adminCode) {
      const p = db.posts.find((x) => x.id === id);
      if (!p) return;
      if (!(adminCode ? await admin(adminCode) : await isMine(id, p.keyHash))) throw new Error("denied");
      Object.assign(p, { hidden: true, text: "", name: "", tag: "" }); save();
    },
    async hideComment(postId, id, adminCode) {
      const c = (db.comments[postId] || []).find((x) => x.id === id);
      if (!c) return;
      if (!(adminCode ? await admin(adminCode) : await isMine(id, c.keyHash))) throw new Error("denied");
      Object.assign(c, { hidden: true, text: "", name: "" });
      const p = db.posts.find((x) => x.id === postId); if (p) p.comments--;
      save();
    },
  };
}
