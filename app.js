// DeepClaude App - Main Application Logic
const $ = (id) => document.getElementById(id);
const API_URL = "https://api.deepseek.com/v1/chat/completions";

// ===== State =====
const state = {
  currentConvId: null,
  mode: "flash", // flash | pro
  isGenerating: false,
  sidebarVisible: true,
};

// ===== Theme =====
function applyTheme() {
  const saved = localStorage.getItem("deepclaude_theme");
  if (saved === "light" || saved === "dark") {
    document.documentElement.setAttribute("data-theme", saved);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}
applyTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

// ===== Toast =====
function showToast(msg, ms = 2000) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), ms);
}

// ===== API Key =====
function getApiKey() {
  return localStorage.getItem("deepclaude_api_key") || "";
}
function setApiKey(key) {
  localStorage.setItem("deepclaude_api_key", key);
}

// ===== Sidebar =====
function renderSidebar() {
  storage.getConversations().then(convs => {
    const list = $("convList");
    list.innerHTML = convs.map(c => `
      <div class="conv-item ${c.id === state.currentConvId ? 'active' : ''}" data-id="${c.id}">
        <span class="conv-title">${escHtml(c.title)}</span>
        <span class="conv-actions">
          <button data-action="rename" data-id="${c.id}" title="重命名">✎</button>
          <button data-action="delete" data-id="${c.id}" title="删除">✕</button>
        </span>
      </div>
    `).join("");

    list.querySelectorAll(".conv-item").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.closest("[data-action]")) return;
        switchConversation(item.dataset.id);
      });
    });
    list.querySelectorAll("[data-action=rename]").forEach(btn => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); renameConversation(btn.dataset.id); });
    });
    list.querySelectorAll("[data-action=delete]").forEach(btn => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); deleteConversation(btn.dataset.id); });
    });
  });
}

async function switchConversation(id) {
  state.currentConvId = id;
  await renderMessages();
  renderSidebar();
  $("welcome").style.display = "none";
  scrollToBottom();
}

async function newConversation() {
  const conv = await storage.createConversation();
  state.currentConvId = conv.id;
  await renderMessages();
  renderSidebar();
  $("welcome").style.display = "flex";
}

async function renameConversation(id) {
  const newTitle = prompt("输入新名称：");
  if (!newTitle || !newTitle.trim()) return;
  await storage.updateConversation(id, { title: newTitle.trim() });
  renderSidebar();
}

async function deleteConversation(id) {
  if (!confirm("确定删除该对话？")) return;
  await storage.deleteConversation(id);
  if (state.currentConvId === id) {
    const convs = await storage.getConversations();
    if (convs.length > 0) {
      state.currentConvId = convs[0].id;
      await renderMessages();
    } else {
      state.currentConvId = null;
      $("chatMessages").innerHTML = "";
      $("welcome").style.display = "flex";
    }
  }
  renderSidebar();
}

// ===== Messages =====
function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderMarkdown(text) {
  if (!text) return "";
  let html = marked.parse(text);
  return html;
}

function highlightCode() {
  document.querySelectorAll(".msg-content pre code").forEach(block => {
    try { hljs.highlightElement(block); } catch (e) {}
  });
}

function addCopyButtons() {
  document.querySelectorAll(".msg-content pre").forEach(pre => {
    if (pre.querySelector(".copy-btn")) return;
    const code = pre.querySelector("code");
    const lang = code?.className?.replace("language-", "") || "";
    if (lang) {
      const label = document.createElement("span");
      label.className = "code-lang";
      label.textContent = lang;
      pre.appendChild(label);
    }
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.textContent = "复制";
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(code?.textContent || "").then(() => {
        btn.textContent = "已复制!";
        setTimeout(() => btn.textContent = "复制", 2000);
      });
    });
    pre.style.position = "relative";
    pre.appendChild(btn);
  });
}

async function renderMessages() {
  if (!state.currentConvId) { $("chatMessages").innerHTML = ""; return; }
  const msgs = await storage.getMessages(state.currentConvId);
  const container = $("chatMessages");
  container.innerHTML = msgs.map(m => {
    const isUser = m.role === "user";
    const avatar = isUser ? "👤" : "🤖";
    const editedMark = m.editHistory?.length > 0 ? `<span class="msg-edited">(已编辑 ${m.editHistory.length} 次)</span>` : "";
    const content = isUser ? escHtml(m.content) : renderMarkdown(m.content);
    return `
      <div class="message ${isUser ? 'user' : 'assistant'}" data-id="${m.id}">
        <div class="avatar">${avatar}</div>
        <div class="msg-content">${content}${editedMark}</div>
        <div class="msg-actions">
          <button data-action="edit" data-id="${m.id}">✎ 编辑</button>
          <button data-action="retry" data-id="${m.id}">⟳ 重试</button>
          <button data-action="deleteAfter" data-id="${m.id}">✕ 删除后续</button>
        </div>
      </div>
    `;
  }).join("");

  highlightCode();
  addCopyButtons();

  // Bind message actions
  container.querySelectorAll("[data-action=edit]").forEach(btn => {
    btn.addEventListener("click", () => startEditMessage(btn.dataset.id));
  });
  container.querySelectorAll("[data-action=retry]").forEach(btn => {
    btn.addEventListener("click", () => retryMessage(btn.dataset.id));
  });
  container.querySelectorAll("[data-action=deleteAfter]").forEach(btn => {
    btn.addEventListener("click", () => deleteAfter(btn.dataset.id));
  });
}

function scrollToBottom() {
  const area = $("chatArea");
  requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

// Message editing
async function startEditMessage(msgId) {
  const msgEl = document.querySelector(`.message[data-id="${msgId}"]`);
  if (!msgEl || state.isGenerating) return;
  const contentEl = msgEl.querySelector(".msg-content");
  const currentText = contentEl.firstChild?.textContent || "";

  const textarea = document.createElement("textarea");
  textarea.className = "msg-edit-area";
  textarea.value = currentText;
  contentEl.innerHTML = "";
  contentEl.appendChild(textarea);
  textarea.focus();

  const buttons = document.createElement("div");
  buttons.className = "msg-edit-buttons";
  buttons.innerHTML = `<button class="btn-save">保存</button><button class="btn-cancel">取消</button>`;
  contentEl.appendChild(buttons);

  buttons.querySelector(".btn-save").addEventListener("click", async () => {
    const newContent = textarea.value.trim();
    if (!newContent) { showToast("内容不能为空"); return; }
    await storage.editMessage(msgId, newContent);
    await renderMessages();
    if (msgEl.classList.contains("user")) {
      await deleteAfter(msgId);
      await sendMessage(newContent);
    }
    scrollToBottom();
  });
  buttons.querySelector(".btn-cancel").addEventListener("click", renderMessages);
}

async function retryMessage(msgId) {
  const msgs = await storage.getMessages(state.currentConvId);
  const idx = msgs.findIndex(m => m.id === msgId);
  if (idx < 1 || msgs[idx - 1].role !== "user") return;
  await deleteAfter(msgId);
  await sendMessage(msgs[idx - 1].content);
}

async function deleteAfter(msgId) {
  await storage.deleteAfterMessage(msgId);
  await renderMessages();
}

// ===== API Call =====
async function sendMessage(text) {
  if (state.isGenerating || !text.trim()) return;
  const apiKey = getApiKey();
  if (!apiKey) {
    showToast("请先在左侧 API 设置中填入 DeepSeek API Key");
    $("apiModal").classList.add("show");
    $("apiKeyInput").focus();
    return;
  }

  $("welcome").style.display = "none";
  state.isGenerating = true;
  $("btnSend").disabled = true;

  // Add user message
  const userMsg = await storage.addMessage(state.currentConvId, "user", text);
  await renderMessages();
  scrollToBottom();

  // Add placeholder assistant message
  const assistantMsg = await storage.addMessage(state.currentConvId, "assistant", "思考中...");
  await renderMessages();
  scrollToBottom();

  // Build message history for API
  const allMsgs = await storage.getMessages(state.currentConvId);
  const apiMsgs = allMsgs.filter(m => m.id !== assistantMsg.id).map(m => ({
    role: m.role,
    content: m.content
  }));

  const model = state.mode === "pro" ? "deepseek-reasoner" : "deepseek-chat";

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: apiMsgs, stream: false })
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API 错误 ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    let reply = data.choices?.[0]?.message?.content || "";
    
    // If Pro mode, prepend reasoning if available
    if (state.mode === "pro" && data.choices?.[0]?.message?.reasoning_content) {
      reply = data.choices[0].message.reasoning_content + "\n\n---\n\n" + reply;
    }

    // Update assistant message
    await storage.editMessage(assistantMsg.id, reply);
    await renderMessages();
    addCopyButtons();
    scrollToBottom();

    // Auto-title conversation
    const count = await storage.getMessageCount(state.currentConvId);
    if (count <= 3) {
      const title = text.slice(0, 30) + (text.length > 30 ? "..." : "");
      await storage.updateConversation(state.currentConvId, { title });
      renderSidebar();
    }
  } catch (err) {
    const errorMsg = `❌ ${err.message}`;
    await storage.editMessage(assistantMsg.id, errorMsg);
    await renderMessages();
    showToast("请求失败：" + err.message);
  }

  state.isGenerating = false;
  $("btnSend").disabled = false;
}

// ===== Event Handlers =====
function init() {
  // Sidebar toggle
  $("btnToggleSidebar").addEventListener("click", () => {
    state.sidebarVisible = !state.sidebarVisible;
    $("sidebar").classList.toggle("collapsed", !state.sidebarVisible);
  });

  // New chat
  $("btnNewChat").addEventListener("click", newConversation);

  // Mode toggle
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.mode = btn.dataset.mode;
    });
  });

  // Send message
  $("btnSend").addEventListener("click", () => {
    const text = $("chatInput").value;
    sendMessage(text);
    $("chatInput").value = "";
  });

  // Enter to send, Shift+Enter for newline
  $("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = $("chatInput").value;
      if (text.trim()) {
        sendMessage(text);
        $("chatInput").value = "";
      }
    }
  });

  // Auto-resize textarea
  $("chatInput").addEventListener("input", () => {
    const el = $("chatInput");
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
    $("btnSend").disabled = !el.value.trim() || state.isGenerating;
  });

  // File upload
  $("btnFileUpload").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    if (text.length > 100000) { showToast("文件太大（超过10万字符）"); return; }
    $("chatInput").value = `[文件: ${file.name}]\n\n${text.slice(0, 50000)}`;
    $("chatInput").dispatchEvent(new Event("input"));
  });

  // API settings
  $("btnApiSettings").addEventListener("click", () => {
    $("apiKeyInput").value = getApiKey();
    $("apiModal").classList.add("show");
    $("apiKeyInput").focus();
  });
  $("btnApiCancel").addEventListener("click", () => $("apiModal").classList.remove("show"));
  $("apiModal").addEventListener("click", (e) => { if (e.target === $("apiModal")) $("apiModal").classList.remove("show"); });
  $("btnApiSave").addEventListener("click", () => {
    const key = $("apiKeyInput").value.trim();
    if (!key) { showToast("请输入 API Key"); return; }
    setApiKey(key);
    $("apiModal").classList.remove("show");
    showToast("✅ API Key 已保存");
  });
  $("apiKeyInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btnApiSave").click();
  });

  // Clear all
  $("btnClearAll").addEventListener("click", async () => {
    if (!confirm("确定删除所有对话记录？此操作不可恢复。")) return;
    const convs = await storage.getConversations();
    for (const c of convs) await storage.deleteConversation(c.id);
    state.currentConvId = null;
    $("chatMessages").innerHTML = "";
    $("welcome").style.display = "flex";
    renderSidebar();
    showToast("已清除所有对话");
  });

  // ===== Initial Load =====
  (async () => {
    await storage.ready;
    const convs = await storage.getConversations();
    if (convs.length > 0) {
      state.currentConvId = convs[0].id;
      await renderMessages();
      $("welcome").style.display = "none";
      scrollToBottom();
    }
    renderSidebar();
  })();
}

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return code;
  }
});

document.addEventListener("DOMContentLoaded", init);
