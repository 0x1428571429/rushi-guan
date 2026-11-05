/**
 * IndexedDB 封装
 *
 * 两个 object store：
 *   entries  —— 「观」的记录（可长期保存）
 *   practice —— 「勘」的练习记录（用于循环出题，不做统计展示）
 *
 * 原生 API，零依赖。
 */

const DB_NAME = "rushi";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("这个浏览器不支持 IndexedDB"));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("entries")) {
        const entries = db.createObjectStore("entries", { keyPath: "id" });
        entries.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains("practice")) {
        const practice = db.createObjectStore("practice", { keyPath: "id" });
        practice.createIndex("questionId", "questionId");
        practice.createIndex("createdAt", "createdAt");
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

// ---------- entries ----------

async function putEntry(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("entries", "readwrite");
    t.objectStore("entries").put(entry);
    t.oncomplete = () => resolve(entry);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function getAllEntries() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("entries", "readonly");
    const req = t.objectStore("entries").index("createdAt").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeEntry(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("entries", "readwrite");
    t.objectStore("entries").delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// ---------- practice ----------

async function putPractice(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("practice", "readwrite");
    t.objectStore("practice").put(record);
    t.oncomplete = () => resolve(record);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function getAllPractice() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("practice", "readonly");
    const req = t.objectStore("practice").index("createdAt").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- 迁移 ----------

/**
 * 把旧版 localStorage 里的「观」搬进 IndexedDB，然后删掉旧键。
 * 幂等：重复执行不会产生重复记录（以 id 为主键）。
 */
async function migrateLegacyEntries() {
  const LEGACY_KEY = "rushi:entries";

  let raw;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    const entries = parsed?.entries;
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (e && typeof e.id === "string") {
          await putEntry(e);
        }
      }
    }
  } catch {
    // 旧数据坏了就跳过，不阻塞启动
  }

  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}
