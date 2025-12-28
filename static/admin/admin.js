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
const shortcodeBtn = document.getElementById("shortcodeBtn");
const shortcodeModal = document.getElementById("shortcodeModal");
const closeShortcodeBtn = document.getElementById("closeShortcodeBtn");
const shortcodeSelect = document.getElementById("shortcodeSelect");
const shortcodeFields = document.getElementById("shortcodeFields");
const insertShortcodeBtn = document.getElementById("insertShortcodeBtn");
const toastEl = document.getElementById("toast");
const mediaBtn = document.getElementById("mediaBtn");
const mediaModal = document.getElementById("mediaModal");
const closeMediaBtn = document.getElementById("closeMediaBtn");
const imagePreviewModal = document.getElementById("imagePreviewModal");
const closeImagePreviewBtn = document.getElementById("closeImagePreviewBtn");
const imagePreviewImg = document.getElementById("imagePreviewImg");
const imageInput = document.getElementById("imageInput");
const uploadImageBtn = document.getElementById("uploadImageBtn");
const mediaGallery = document.getElementById("mediaGallery");
const fileDrop = document.getElementById("fileDrop");
const uploadProgress = document.getElementById("uploadProgress");
const uploadProgressBar = document.getElementById("uploadProgressBar");
const uploadProgressLabel = document.getElementById("uploadProgressLabel");
const uploadPreview = document.getElementById("uploadPreview");
const uploadPreviewImg = document.getElementById("uploadPreviewImg");
const clearUploadBtn = document.getElementById("clearUploadBtn");

let editor;
let currentPost = null; // { path, sha }
let shortcodes = [];
let selectedSection = CONTENT_DIRS[0];
let editorInstanceHeight = 560;
let mediaItems = [];
let currentPreviewUrl = null;

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

function toggleMediaModal(open) {
  if (!mediaModal) return;
  if (open) clearUploadSelection(); // reset preview each time the modal opens
  mediaModal.classList.toggle("hidden", !open);
  if (open) loadMediaGallery().catch(() => {});
}

function openImagePreview(url, name = "image") {
  if (!imagePreviewModal || !imagePreviewImg) return;
  imagePreviewImg.src = url;
  imagePreviewImg.alt = name;
  imagePreviewModal.classList.remove("hidden");
}

function closeImagePreview() {
  if (!imagePreviewModal || !imagePreviewImg) return;
  imagePreviewModal.classList.add("hidden");
  imagePreviewImg.removeAttribute("src");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      const base64 = typeof result === "string" ? result.split(",").pop() : "";
      resolve(base64 || "");
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function renderMediaGallery(items = []) {
  if (!mediaGallery) return;
  if (!items.length) {
    mediaGallery.innerHTML = "<p class='hint'>No images in Nextcloud yet.</p>";
    return;
  }
  mediaGallery.innerHTML = "";
  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "media-item";
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "media-thumb-wrap";
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.name || "Image";
    img.className = "media-thumb";
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "media-view-btn";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openImagePreview(item.url, item.name);
    });
    const meta = document.createElement("div");
    meta.className = "media-meta";
    const label = document.createElement("span");
    label.textContent = item.name || "Image";
    const size = document.createElement("span");
    size.textContent = item.size ? `${Math.round(item.size / 1024)}kb` : "";
    meta.appendChild(label);
    meta.appendChild(size);
    thumbWrap.appendChild(img);
    btn.appendChild(thumbWrap);
    btn.appendChild(viewBtn);
    btn.appendChild(meta);
    btn.addEventListener("click", () => insertImage(item.url, item.name));
    mediaGallery.appendChild(btn);
  });
}

async function loadMediaGallery() {
  if (!mediaGallery) return;
  mediaGallery.innerHTML = "<p class='hint'>Loading images...</p>";
  try {
    const data = await api("listImages");
    mediaItems = Array.isArray(data.items) ? data.items : [];
    renderMediaGallery(mediaItems);
  } catch (err) {
    if (err.message === "unauthorized") {
      showLogin();
      return;
    }
    mediaGallery.innerHTML = "<p class='hint'>Unable to load images.</p>";
    showToast(err.message, true);
  }
}

function insertImage(url, name = "image") {
  if (!editor) return;
  const alt = (name || "image").replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  const snippet = `![${alt}](${url})`;
  editor.insertText(snippet + "\n");
  toggleMediaModal(false);
  showToast("Image inserted");
}

function toggleUploadProgress(show) {
  if (!uploadProgress) return;
  uploadProgress.classList.toggle("hidden", !show);
  if (!show) {
    uploadProgressBar?.style.setProperty("--upload-progress", "0%");
    if (uploadProgressLabel) uploadProgressLabel.textContent = "0%";
  }
}

function setUploadProgress(percent) {
  if (!uploadProgressBar || !uploadProgressLabel) return;
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  uploadProgressBar.style.setProperty("--upload-progress", `${clamped}%`);
  uploadProgressLabel.textContent = `${clamped}%`;
}

function showUploadPreview(url, name = "image") {
  if (!uploadPreview || !uploadPreviewImg) return;
  if (currentPreviewUrl && currentPreviewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
  currentPreviewUrl = url;
  uploadPreviewImg.src = url;
  uploadPreviewImg.alt = name;
  uploadPreview.classList.remove("hidden");
}

function clearUploadSelection() {
  if (uploadPreview) uploadPreview.classList.add("hidden");
  if (uploadPreviewImg) uploadPreviewImg.removeAttribute("src");
  if (currentPreviewUrl && currentPreviewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
  currentPreviewUrl = null;
  if (imageInput) imageInput.value = "";
  toggleUploadProgress(false);
}

function handleLocalFileSelection() {
  if (!imageInput || !imageInput.files || !imageInput.files.length) {
    clearUploadSelection();
    return;
  }
  const file = imageInput.files[0];
  if (!file.type.startsWith("image/")) {
    showToast("Images only", true);
    clearUploadSelection();
    return;
  }
  toggleUploadProgress(false);
  const previewUrl = URL.createObjectURL(file);
  showUploadPreview(previewUrl, file.name);
}

function setInputFiles(files) {
  if (!files?.length || !imageInput) {
    clearUploadSelection();
    return;
  }
  const file = files[0];
  if (!file.type.startsWith("image/")) {
    showToast("Images only", true);
    clearUploadSelection();
    return;
  }
  const dt = new DataTransfer();
  dt.items.add(file);
  imageInput.files = dt.files;
  handleLocalFileSelection();
}

async function uploadWithProgress(payload, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/.netlify/functions/uploadImage");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable || typeof onProgress !== "function") return;
      const percent = (evt.loaded / evt.total) * 100;
      onProgress(percent);
    };
    xhr.onload = () => {
      const status = xhr.status;
      let data;
      try { data = JSON.parse(xhr.responseText || "{}"); } catch { data = { error: xhr.responseText }; }
      if (status === 401) return reject(new Error("unauthorized"));
      if (status < 200 || status >= 300) {
        return reject(new Error(data?.error || xhr.statusText || "Upload failed"));
      }
      resolve(data);
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(JSON.stringify(payload));
  });
}

async function uploadImage() {
  if (!imageInput || !imageInput.files || !imageInput.files.length) {
    showToast("Choose an image first", true);
    return;
  }
  const file = imageInput.files[0];
  if (!file.type.startsWith("image/")) {
    showToast("Images only", true);
    return;
  }
  try {
    toggleUploadProgress(true);
    setUploadProgress(5);
    if (uploadImageBtn) uploadImageBtn.disabled = true;
    const base64 = await fileToBase64(file);
    const payload = {
      name: file.name,
      contentType: file.type,
      data: base64,
    };
    const res = await uploadWithProgress(payload, (p) => setUploadProgress(Math.max(10, p)));
    setUploadProgress(100);
    if (res?.url) {
      showUploadPreview(res.url, res.name || file.name);
      if (imageInput) imageInput.value = "";
      insertImage(res.url, res.name || file.name);
      await loadMediaGallery();
      showToast("Image uploaded");
    }
  } catch (err) {
    if (err.message === "unauthorized") {
      showLogin();
      return;
    }
    showToast(err.message, true);
  } finally {
    if (uploadImageBtn) uploadImageBtn.disabled = false;
    setTimeout(() => toggleUploadProgress(false), 600);
  }
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
    const title = item.title || item.name;
    row.innerHTML = `<div><strong>${title}</strong></div><span>${item.size}b</span>`;
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
    if (sectionInput && section) sectionInput.value = section;
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
    if (editor && typeof editor.setHeight === "function") {
      editor.setHeight(editorInstanceHeight + "px");
    }
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
  if (mediaBtn) mediaBtn.addEventListener("click", () => toggleMediaModal(true));
  if (closeMediaBtn) closeMediaBtn.addEventListener("click", () => toggleMediaModal(false));
  if (uploadImageBtn) uploadImageBtn.addEventListener("click", uploadImage);
  if (clearUploadBtn) {
    clearUploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearUploadSelection();
    });
  }
  if (closeImagePreviewBtn) closeImagePreviewBtn.addEventListener("click", closeImagePreview);
  if (imageInput) {
    imageInput.addEventListener("change", handleLocalFileSelection);
  }
  if (fileDrop) {
    fileDrop.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    fileDrop.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) {
        setInputFiles(e.dataTransfer.files);
      }
    });
  }
  if (imagePreviewModal) {
    imagePreviewModal.addEventListener("click", (e) => {
      if (e.target === imagePreviewModal) closeImagePreview();
    });
  }
  if (mediaModal) {
    mediaModal.addEventListener("click", (e) => {
      if (e.target === mediaModal) toggleMediaModal(false);
    });
  }

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
