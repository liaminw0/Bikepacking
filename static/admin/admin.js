const editorEl = document.getElementById("editor");
const loginView = document.getElementById("loginView");
const listView = document.getElementById("listView");
const editorView = document.getElementById("editorView");
const postsContainer = document.getElementById("postsContainer");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const newPostBtn = document.getElementById("newPostBtn");
const backToListBtn = document.getElementById("backToListBtn");
const deletePostBtn = document.getElementById("deletePostBtn");
const savePostBtn = document.getElementById("savePostBtn");
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("passwordInput");
const titleInput = document.getElementById("titleInput");
const dateInput = document.getElementById("dateInput");
const draftInput = document.getElementById("draftInput");
const tagsInput = document.getElementById("tagsInput");
const slugInput = document.getElementById("slugInput");
const shortcodeBtn = document.getElementById("shortcodeBtn");
const shortcodeModal = document.getElementById("shortcodeModal");
const closeShortcodeBtn = document.getElementById("closeShortcodeBtn");
const shortcodeSelect = document.getElementById("shortcodeSelect");
const shortcodeFields = document.getElementById("shortcodeFields");
const insertShortcodeBtn = document.getElementById("insertShortcodeBtn");
const toastEl = document.getElementById("toast");

let editor;
let currentPost = null; // { path, sha }
let shortcodes = [];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.style.borderColor = isError ? "var(--danger)" : "var(--border)";
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3000);
}

function showLogin() {
  loginView.classList.remove("hidden");
  listView.classList.add("hidden");
  editorView.classList.add("hidden");
}

function showList() {
  loginView.classList.add("hidden");
  listView.classList.remove("hidden");
  editorView.classList.add("hidden");
}

function showEditor() {
  loginView.classList.add("hidden");
  listView.classList.add("hidden");
  editorView.classList.remove("hidden");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatDateInput(date) {
  const iso = date.toISOString();
  return iso.slice(0, 16);
}

function parseFrontMatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/m.exec(markdown);
  if (!match) return { fm: {}, body: markdown };
  const lines = match[1].split("\n");
  const fm = {};
  lines.forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) return;
    const value = rest.join(":").trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      fm[key.trim()] = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    } else if (value === "true" || value === "false") {
      fm[key.trim()] = value === "true";
    } else {
      fm[key.trim()] = value.replace(/^"|"$/g, "");
    }
  });
  return { fm, body: match[2] };
}

function buildFrontMatter(data) {
  const safeTitle = data.title.replace(/"/g, '\\"');
  const tags = (data.tags || [])
    .map((t) => `"${t.trim().replace(/"/g, "")}"`)
    .filter(Boolean)
    .join(", ");
  const lines = [
    "---",
    `title: "${safeTitle}"`,
    `date: ${data.date}`,
    `draft: ${data.draft ? "true" : "false"}`,
    `tags: [${tags}]`,
  ];
  if (data.slug) lines.push(`slug: ${data.slug}`);
  lines.push("---", "");
  return lines.join("\n");
}

async function api(path, options = {}) {
  const res = await fetch(`/.netlify/functions/${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text || "{}"); } catch { data = { error: text }; }
  if (!res.ok) {
    const message = data?.error || res.statusText || "Request failed";
    if (res.status === 401) throw new Error("unauthorized");
    throw new Error(message);
  }
  return data;
}

async function loadPosts() {
  const data = await api("listPosts");
  postsContainer.innerHTML = "";
  if (!data.items || !data.items.length) {
    postsContainer.innerHTML = "<p class='hint'>No posts yet.</p>";
    return;
  }
  data.items.forEach((item) => {
    const row = document.createElement("button");
    row.className = "post-row";
    row.type = "button";
    row.innerHTML = `<div><strong>${item.name}</strong><br><span>${item.path}</span></div><span>${item.size}b</span>`;
    row.addEventListener("click", () => openPost(item.path));
    postsContainer.appendChild(row);
  });
}

async function openPost(path) {
  try {
    const data = await api(`getPost?path=${encodeURIComponent(path)}`);
    const { fm, body } = parseFrontMatter(data.content);
    currentPost = { path: data.path, sha: data.sha };
    titleInput.value = fm.title || "";
    dateInput.value = fm.date ? formatDateInput(new Date(fm.date)) : formatDateInput(new Date());
    draftInput.checked = !!fm.draft;
    tagsInput.value = Array.isArray(fm.tags) ? fm.tags.join(", ") : "";
    slugInput.value = fm.slug || "";
    editor.setMarkdown(body || "");
    deletePostBtn.classList.remove("hidden");
    showEditor();
  } catch (err) {
    if (err.message === "unauthorized") {
      showLogin();
      return;
    }
    showToast(err.message, true);
  }
}

function newPost() {
  currentPost = null;
  titleInput.value = "";
  dateInput.value = formatDateInput(new Date());
  draftInput.checked = false;
  tagsInput.value = "";
  slugInput.value = "";
  editor.setMarkdown("");
  deletePostBtn.classList.add("hidden");
  showEditor();
}

async function savePost() {
  const title = titleInput.value.trim();
  if (!title) return showToast("Title required", true);
  const slug = slugInput.value.trim() || slugify(title);
  const date = new Date(dateInput.value || new Date());
  const body = editor.getMarkdown();
  const tags = tagsInput.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const fm = buildFrontMatter({
    title,
    date: date.toISOString(),
    draft: draftInput.checked,
    tags,
    slug,
  });
  const content = `${fm}${body}`;
  const filename = `${date.toISOString().slice(0, 10)}-${slug}.md`;
  const path = currentPost?.path || `content/posts/${filename}`;
  const payload = {
    path,
    content,
    message: currentPost ? `Update ${title}` : `Create ${title}`,
    sha: currentPost?.sha,
  };
  try {
    await api("savePost", { method: "POST", body: JSON.stringify(payload) });
    showToast("Saved");
    showList();
    await loadPosts();
  } catch (err) {
    if (err.message === "unauthorized") return showLogin();
    showToast(err.message, true);
  }
}

async function deletePost() {
  if (!currentPost) return;
  const confirmed = window.confirm("Delete this post?");
  if (!confirmed) return;
  try {
    await api("deletePost", {
      method: "POST",
      body: JSON.stringify({
        path: currentPost.path,
        sha: currentPost.sha,
        message: `Delete ${currentPost.path}`,
      }),
    });
    showToast("Deleted");
    showList();
    await loadPosts();
  } catch (err) {
    if (err.message === "unauthorized") return showLogin();
    showToast(err.message, true);
  }
}

async function login(event) {
  event.preventDefault();
  const password = passwordInput.value;
  if (!password) return;
  try {
    await api("login", { method: "POST", body: JSON.stringify({ password }) });
    passwordInput.value = "";
    await loadPosts();
    showList();
  } catch (err) {
    if (err.message === "unauthorized") return showToast("Bad password", true);
    showToast(err.message, true);
  }
}

async function logout() {
  await api("logout", { method: "POST" }).catch(() => {});
  showLogin();
}

function toggleShortcodeModal(open) {
  shortcodeModal.classList.toggle("hidden", !open);
}

function renderShortcodeFields(sc) {
  shortcodeFields.innerHTML = "";
  sc.fields.forEach((field) => {
    const label = document.createElement("label");
    label.textContent = field.label;
    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      field.options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      });
    } else if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
    } else {
      input = document.createElement("input");
      input.type = "text";
    }
    input.dataset.key = field.key;
    label.appendChild(input);
    shortcodeFields.appendChild(label);
  });
}

function applyTemplate(template, values) {
  return template.replace(/\$\{(.*?)\}/g, (_, key) => values[key] ?? "");
}

function insertShortcode() {
  const sc = shortcodes.find((s) => s.name === shortcodeSelect.value);
  if (!sc) return;
  const values = {};
  shortcodeFields.querySelectorAll("[data-key]").forEach((el) => {
    values[el.dataset.key] = el.value || "";
  });
  const snippet = applyTemplate(sc.template, values);
  editor.insertText(snippet);
  toggleShortcodeModal(false);
}

async function loadShortcodes() {
  try {
    const res = await fetch("shortcodes.json", { cache: "no-cache" });
    shortcodes = await res.json();
    shortcodeSelect.innerHTML = "";
    shortcodes.forEach((sc) => {
      const option = document.createElement("option");
      option.value = sc.name;
      option.textContent = `${sc.name} — ${sc.description}`;
      shortcodeSelect.appendChild(option);
    });
    if (shortcodes[0]) renderShortcodeFields(shortcodes[0]);
  } catch {
    shortcodes = [];
  }
}

async function ensureToastUI() {
  loadCss("https://uicdn.toast.com/editor/latest/toastui-editor.min.css");
  if (!window.toastui?.Editor) {
    try {
      await loadScript("https://uicdn.toast.com/editor/latest/toastui-editor-all.min.js");
    } catch (e) {
      console.warn("Primary Toast UI CDN failed", e);
    }
  }
  if (!window.toastui?.Editor) {
    loadCss("https://cdn.jsdelivr.net/npm/@toast-ui/editor@3.2.3/dist/toastui-editor.min.css");
    await loadScript("https://cdn.jsdelivr.net/npm/@toast-ui/editor@3.2.3/dist/toastui-editor-all.min.js");
  }
  if (!window.toastui?.Editor) throw new Error("Toast UI editor failed to load");
}

async function init() {
  await ensureToastUI();

  editor = new toastui.Editor({
    el: editorEl,
    height: "560px",
    initialEditType: "markdown",
    previewStyle: "tab",
    usageStatistics: false,
    toolbarItems: [
      ["heading", "bold", "italic", "strike"],
      ["hr", "quote"],
      ["ul", "ol", "task", "indent", "outdent"],
      ["table", "image", "link", "code", "codeblock"],
    ],
  });

  loginForm.addEventListener("submit", login);
  logoutBtn.addEventListener("click", logout);
  refreshBtn.addEventListener("click", () => loadPosts().catch(() => {}));
  newPostBtn.addEventListener("click", newPost);
  backToListBtn.addEventListener("click", showList);
  savePostBtn.addEventListener("click", (e) => { e.preventDefault(); savePost(); });
  deletePostBtn.addEventListener("click", deletePost);
  shortcodeBtn.addEventListener("click", () => toggleShortcodeModal(true));
  closeShortcodeBtn.addEventListener("click", () => toggleShortcodeModal(false));
  shortcodeSelect.addEventListener("change", () => {
    const sc = shortcodes.find((s) => s.name === shortcodeSelect.value);
    if (sc) renderShortcodeFields(sc);
  });
  insertShortcodeBtn.addEventListener("click", insertShortcode);
  shortcodeModal.addEventListener("click", (e) => {
    if (e.target === shortcodeModal) toggleShortcodeModal(false);
  });

  loadShortcodes();
  loadPosts().then(showList).catch((err) => {
    if (err.message === "unauthorized") showLogin();
    else showToast(err.message, true);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error(err);
    showToast(err.message || "Failed to load editor", true);
  });
});
