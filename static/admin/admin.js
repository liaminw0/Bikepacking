const CONTENT_DIRS = window.CONTENT_DIRS || [window.CONTENT_DIR || "content/journal", "content/photos"];
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
const sectionInput = document.getElementById("sectionInput");
const sectionFilter = document.getElementById("sectionFilter");
const customFields = document.getElementById("customFields");
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
let selectedSection = CONTENT_DIRS[0];
let templates = [];
let editorInstanceHeight = 560;

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
  logoutBtn.classList.add("hidden");
}

function showList() {
  loginView.classList.add("hidden");
  listView.classList.remove("hidden");
  editorView.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
}

function showEditor() {
  loginView.classList.add("hidden");
  listView.classList.add("hidden");
  editorView.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
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
  if (data.extras) {
    Object.entries(data.extras).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      const safeVal = String(value).replace(/"/g, '\\"');
      lines.push(`${key}: "${safeVal}"`);
    });
  }
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
  if (Array.isArray(data.contentDirs) && data.contentDirs.length) {
    setSections(data.contentDirs);
  }
  postsContainer.innerHTML = "";
  if (!data.items || !data.items.length) {
    postsContainer.innerHTML = "<p class='hint'>No posts yet.</p>";
    return;
  }
  const selected = sectionFilter?.value || selectedSection || CONTENT_DIRS[0];
  selectedSection = selected;
  if (sectionInput) sectionInput.value = selected;
  data.items.forEach((item) => {
    const section = item.section || (item.path || "").split("/").slice(0, -1).join("/");
    if (section && section !== selected) return;
    const row = document.createElement("button");
    row.className = "post-row";
    row.type = "button";
    row.innerHTML = `<div><strong>${item.name}</strong><br><span>${section}</span></div><span>${item.size}b</span>`;
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
    const section = (data.path || "").split("/").slice(0, -1).join("/");
    if (section) {
      selectedSection = section;
      if (sectionInput) sectionInput.value = section;
      if (sectionFilter) sectionFilter.value = section;
    }
    renderCustomFields(fm);
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
  if (sectionInput && selectedSection) {
    sectionInput.value = selectedSection;
  }
  renderCustomFields();
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
    extras: gatherCustomFields(),
  });
  const content = `${fm}${body}`;
  const filename = `${date.toISOString().slice(0, 10)}-${slug}.md`;
  const chosenDir = (sectionInput && sectionInput.value) ? sectionInput.value : selectedSection || CONTENT_DIRS[0];
  const path = currentPost?.path || `${chosenDir}/${filename}`;
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

function setSections(sections) {
  const opts = (sections || []).map((section) => ({
    value: section,
    label: section.replace(/^content\//, ""),
  }));
  if (sectionInput) {
    sectionInput.innerHTML = "";
    opts.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      sectionInput.appendChild(opt);
    });
  }
  if (sectionFilter) {
    sectionFilter.innerHTML = "";
    opts.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      sectionFilter.appendChild(opt);
    });
  }
  if (!selectedSection && opts.length) selectedSection = opts[0].value;
  if (sectionInput && selectedSection) sectionInput.value = selectedSection;
  if (sectionFilter && selectedSection) sectionFilter.value = selectedSection;
  renderCustomFields();
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

async function loadTemplates() {
  try {
    const res = await fetch("templates.json", { cache: "no-cache" });
    templates = await res.json();
  } catch {
    templates = [];
  }
}

function currentTemplate(section) {
  return templates.find((t) => t.section === section) || null;
}

function renderCustomFields(prefill = {}) {
  if (!customFields) return;
  const template = currentTemplate(selectedSection);
  customFields.innerHTML = "";
  if (!template || !template.fields) return;
  template.fields.forEach((field) => {
    const wrap = document.createElement("label");
    wrap.textContent = field.label;
    wrap.style.display = "grid";
    wrap.style.gap = "0.35rem";
    let input;
    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
    } else if (field.type === "select") {
      input = document.createElement("select");
      (field.options || []).forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else {
      input = document.createElement("input");
      input.type = "text";
    }
    input.dataset.key = field.key;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (prefill[field.key] !== undefined) input.value = prefill[field.key];
    wrap.appendChild(input);
    customFields.appendChild(wrap);
  });
}

function gatherCustomFields() {
  if (!customFields) return {};
  const extras = {};
  customFields.querySelectorAll("[data-key]").forEach((el) => {
    const key = el.dataset.key;
    extras[key] = el.value;
  });
  return extras;
}

async function ensureToastUI() {
  // Prefer local bundled assets to avoid CDN/MIME/blocked issues.
  loadCss("toastui-editor.min.css");
  if (!window.toastui?.Editor) {
    try {
      await loadScript("toastui-editor-all.min.js");
    } catch (e) {
      console.warn("Local Toast UI load failed", e);
    }
  }
  // Final fallback: attempt CDN if local not available.
  if (!window.toastui?.Editor) {
    loadCss("https://uicdn.toast.com/editor/latest/toastui-editor.min.css");
    try {
      await loadScript("https://uicdn.toast.com/editor/latest/toastui-editor-all.min.js");
    } catch (e) {
      console.warn("Primary Toast UI CDN failed", e);
    }
  }
  if (!window.toastui?.Editor) throw new Error("Toast UI editor failed to load");
}

async function init() {
  await ensureToastUI();
  const setEditorHeight = () => {
    editorInstanceHeight = Math.max(320, Math.floor(window.innerHeight * 0.6));
    if (editor) editor.height(editorInstanceHeight + "px");
  };
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

  await loadTemplates().catch(() => {});
  loadShortcodes();
  setSections(CONTENT_DIRS);
  setEditorHeight();
  window.addEventListener("resize", setEditorHeight);

  loadPosts().then(showList).catch((err) => {
    if (err.message === "unauthorized") showLogin();
    else showToast(err.message, true);
  });

  if (sectionFilter) {
    sectionFilter.addEventListener("change", () => {
      selectedSection = sectionFilter.value;
      if (sectionInput) sectionInput.value = selectedSection;
      loadPosts().catch(() => {});
    });
  }

  if (sectionInput) {
    sectionInput.addEventListener("change", () => {
      loadPosts().catch(() => {});
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loginForm.addEventListener("submit", login);
  init().catch((err) => {
    console.error(err);
    showToast(err.message || "Failed to load editor", true);
  });
});
