// Storage.js - IndexedDB wrapper for persistent chat storage
const DB_NAME = "deepseek_clone_db";
const DB_VERSION = 1;
const STORE_CONVERSATIONS = "conversations";
const STORE_MESSAGES = "messages";

class Storage {
  constructor() {
    this.db = null;
    this.ready = this._init();
  }

  async _init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
          const convStore = db.createObjectStore(STORE_CONVERSATIONS, { keyPath: "id" });
          convStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: "id" });
          msgStore.createIndex("conversationId", "conversationId", { unique: false });
          msgStore.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = (e) => { reject(e.target.error); };
    });
  }

  async _tx(storeName, mode) {
    await this.ready;
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  // Conversations
  async createConversation(title = "新对话") {
    const conv = { id: crypto.randomUUID(), title, createdAt: Date.now(), updatedAt: Date.now() };
    const store = await this._tx(STORE_CONVERSATIONS, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.add(conv);
      req.onsuccess = () => resolve(conv);
      req.onerror = () => reject(req.error);
    });
  }

  async getConversations() {
    const store = await this._tx(STORE_CONVERSATIONS, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.updatedAt - a.updatedAt));
      req.onerror = () => reject(req.error);
    });
  }

  async updateConversation(id, updates) {
    const store = await this._tx(STORE_CONVERSATIONS, "readwrite");
    const conv = await new Promise((res, rej) => { const r = store.get(id); r.onsuccess = () => res(r.result); r.onerror = rej; });
    if (!conv) return;
    Object.assign(conv, updates, { updatedAt: Date.now() });
    return new Promise((resolve, reject) => { const r = store.put(conv); r.onsuccess = () => resolve(conv); r.onerror = reject; });
  }

  async deleteConversation(id) {
    const msgStore = await this._tx(STORE_MESSAGES, "readwrite");
    const idx = msgStore.index("conversationId");
    const msgs = await new Promise((res, rej) => { const r = idx.getAll(id); r.onsuccess = () => res(r.result); r.onerror = rej; });
    for (const m of msgs) msgStore.delete(m.id);

    const convStore = await this._tx(STORE_CONVERSATIONS, "readwrite");
    convStore.delete(id);
  }

  // Messages
  async addMessage(conversationId, role, content, model = null) {
    const msg = { id: crypto.randomUUID(), conversationId, role, content, model, editHistory: [], createdAt: Date.now() };
    const store = await this._tx(STORE_MESSAGES, "readwrite");
    await new Promise((resolve, reject) => { const r = store.add(msg); r.onsuccess = resolve; r.onerror = reject; });
    await this.updateConversation(conversationId, {});
    return msg;
  }

  async getMessages(conversationId) {
    const store = await this._tx(STORE_MESSAGES, "readonly");
    const idx = store.index("conversationId");
    return new Promise((resolve, reject) => {
      const req = idx.getAll(conversationId);
      req.onsuccess = () => resolve(req.result.sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => reject(req.error);
    });
  }

  async editMessage(messageId, newContent) {
    const store = await this._tx(STORE_MESSAGES, "readwrite");
    const msg = await new Promise((res, rej) => { const r = store.get(messageId); r.onsuccess = () => res(r.result); r.onerror = rej; });
    if (!msg) return;
    msg.editHistory.push({ content: msg.content, editedAt: Date.now() });
    msg.content = newContent;
    return new Promise((resolve, reject) => { const r = store.put(msg); r.onsuccess = () => resolve(msg); r.onerror = reject; });
  }

  async deleteAfterMessage(messageId) {
    const store = await this._tx(STORE_MESSAGES, "readonly");
    const msg = await new Promise((res, rej) => { const r = store.get(messageId); r.onsuccess = () => res(r.result); r.onerror = rej; });
    if (!msg) return;
    const idx = store.index("conversationId");
    const all = await new Promise((res, rej) => { const r = idx.getAll(msg.conversationId); r.onsuccess = () => res(r.result); r.onerror = rej; });
    const toDelete = all.filter(m => m.createdAt >= msg.createdAt);
    const delStore = await this._tx(STORE_MESSAGES, "readwrite");
    for (const m of toDelete) delStore.delete(m.id);
  }

  async getMessageCount(conversationId) {
    const store = await this._tx(STORE_MESSAGES, "readonly");
    const idx = store.index("conversationId");
    return new Promise((resolve, reject) => { const r = idx.count(conversationId); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
  }
}

const storage = new Storage();
