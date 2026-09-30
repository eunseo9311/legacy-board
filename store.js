// 게시판 저장소. 주소에 ?demo 가 있으면 이 휴대폰 안에만 저장하는 체험 모드로 돕니다.
export const firebaseConfig = {
  apiKey: "AIzaSyAkju6VayY6kAyySR6H9LEgq2Ku0GY7VzA",
  authDomain: "legacy-academy-board.firebaseapp.com",
  projectId: "legacy-academy-board",
  storageBucket: "legacy-academy-board.firebasestorage.app",
  messagingSenderId: "822152355179",
  appId: "1:822152355179:web:3f96ee7485801f9ab5002e",
};

export const isDemo = new URLSearchParams(location.search).has("demo");

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

const store = isDemo ? demoStore() : await firebaseStore(firebaseConfig);
export default store;

function demoStore() {
  const KEY = "lb.demo.v1";
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

async function firebaseStore(config) {
  const base = "https://www.gstatic.com/firebasejs/10.14.1";
  const [{ initializeApp }, fs] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const db = fs.getFirestore(initializeApp(config));
  const posts = fs.collection(db, "posts");
  const ms = (t) => (t && t.toMillis ? t.toMillis() : Date.now());
  const toItem = (d) => { const v = d.data(); return { ...v, id: d.id, createdAt: ms(v.createdAt) }; };
  const visible = (snap) => snap.docs.map(toItem).filter((x) => !x.hidden);

  return {
    watchRecent(cb, onErr) {
      return fs.onSnapshot(fs.query(posts, fs.orderBy("createdAt", "desc"), fs.limit(40)), (s) => cb(visible(s).slice(0, 30)), onErr);
    },
    watchBoard(board, cb, onErr) {
      const q = fs.query(posts, fs.where("board", "==", board), fs.orderBy("createdAt", "desc"), fs.limit(150));
      return fs.onSnapshot(q, (s) => cb(visible(s)), onErr);
    },
    watchPost(id, cb, onErr) {
      return fs.onSnapshot(fs.doc(db, "posts", id), (d) => cb(d.exists() ? toItem(d) : null), onErr);
    },
    watchComments(id, cb, onErr) {
      const q = fs.query(fs.collection(db, "posts", id, "comments"), fs.orderBy("createdAt", "asc"), fs.limit(300));
      return fs.onSnapshot(q, (s) => cb(visible(s)), onErr);
    },
    async addPost({ board, tag, name, text }) {
      const ref = fs.doc(posts);
      await fs.setDoc(ref, { board, tag, name, text, createdAt: fs.serverTimestamp(),
        keyHash: await sha(await itemKey(ref.id)), amen: 0, comments: 0, hidden: false });
      return ref.id;
    },
    async addComment(postId, { name, text }) {
      const ref = fs.doc(fs.collection(db, "posts", postId, "comments"));
      await fs.setDoc(ref, { name, text, createdAt: fs.serverTimestamp(),
        keyHash: await sha(await itemKey(ref.id)), hidden: false });
      await fs.updateDoc(fs.doc(db, "posts", postId), { comments: fs.increment(1) }).catch(() => {});
    },
    amen(postId) {
      return fs.updateDoc(fs.doc(db, "posts", postId), { amen: fs.increment(1) });
    },
    async hidePost(id, adminCode) {
      await fs.updateDoc(fs.doc(db, "posts", id),
        { hidden: true, text: "", name: "", tag: "", delKey: adminCode || await itemKey(id) });
    },
    async hideComment(postId, id, adminCode) {
      await fs.updateDoc(fs.doc(db, "posts", postId, "comments", id),
        { hidden: true, text: "", name: "", delKey: adminCode || await itemKey(id) });
      await fs.updateDoc(fs.doc(db, "posts", postId), { comments: fs.increment(-1) }).catch(() => {});
    },
  };
}
