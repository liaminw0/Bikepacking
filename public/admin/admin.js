const CONTENT_DIRS = window.CONTENT_DIRS || [window.CONTENT_DIR || "content/journal", "content/photos"];
const editorEl = document.getElementById("editor");
const loginView = document.getElementById("loginView");
const listView = document.getElementById("listView");
const editorView = document.getElementById("editorView");
const postsContainer = document.getElementById("postsContainer");
const loadAllPostsBtn = document.getElementById("loadAllPostsBtn");
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
const tagsSection = document.getElementById("tagsSection");
const tagSuggestions = document.getElementById("tagSuggestions");
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
const exitConfirmModal = document.getElementById("exitConfirmModal");
const closeExitConfirmBtn = document.getElementById("closeExitConfirmBtn");
const saveExitBtn = document.getElementById("saveExitBtn");
const discardExitBtn = document.getElementById("discardExitBtn");
const cancelExitBtn = document.getElementById("cancelExitBtn");
const imageInput = document.getElementById("imageInput");
const uploadImageBtn = document.getElementById("uploadImageBtn");
const mediaGallery = document.getElementById("mediaGallery");
const photoImageInput = document.getElementById("photoImageInput");
const photoCaptionInput = document.getElementById("photoCaptionInput");
const photoImagePreview = document.getElementById("photoImagePreview");
const photoImagePreviewName = document.getElementById("photoImagePreviewName");
const photoImagePreviewWrap = document.getElementById("photoImagePreviewWrap");
const photoSection = document.getElementById("photoSection");
const photoImageSelectBtn = document.getElementById("photoImageSelectBtn");
const clearPhotoImageBtn = document.getElementById("clearPhotoImageBtn");
const photoPicker = document.getElementById("photoPicker");
const captionField = document.getElementById("captionField");
const bodyBlock = document.getElementById("bodyBlock");
const allUploadsGallery = document.getElementById("allUploadsGallery");
const bulkImageInput = document.getElementById("bulkImageInput");
const bulkUploadBtn = document.getElementById("bulkUploadBtn");
const bulkUploadProgress = document.getElementById("bulkUploadProgress");
const bulkUploadProgressBar = document.getElementById("bulkUploadProgressBar");
const bulkUploadProgressLabel = document.getElementById("bulkUploadProgressLabel");
const fileDrop = document.getElementById("fileDrop");
const uploadProgress = document.getElementById("uploadProgress");
const uploadProgressBar = document.getElementById("uploadProgressBar");
const uploadProgressLabel = document.getElementById("uploadProgressLabel");
const uploadPreview = document.getElementById("uploadPreview");
const uploadPreviewImg = document.getElementById("uploadPreviewImg");
const clearUploadBtn = document.getElementById("clearUploadBtn");
const viewUploadBtn = document.getElementById("viewUploadBtn");
const toggleMediaUploadBtn = document.getElementById("toggleMediaUploadBtn");
const mediaUploadTools = document.getElementById("mediaUploadTools");

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}

let editor;
let currentPost = null; // { path, sha }
let shortcodes = [];
let selectedSection = CONTENT_DIRS[0];
let editorInstanceHeight = 560;
let mediaItems = [];
let currentPreviewUrl = null;
let currentPreviewName = "image";
let photoSelectActive = false;
let currentRoute = null;
let suppressHashChange = false;
let initialEditorState = null;
let pendingRoute = null;
let isRouting = false;
let allPosts = [];
let showAllPosts = false;

const isPhotoSection = (sectionVal) => {
  const value = (sectionVal || sectionInput?.value || selectedSection || "").toLowerCase();
  return value.includes("content/photos");
};

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, "");
  const normalized = hash.startsWith("/") ? hash : `/${hash || ""}`;
  const [pathPart, query = ""] = normalized.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  if (segments[0] === "editor" && segments[1] === "new") {
    return { view: "editor-new", section: params.get("section") || selectedSection || CONTENT_DIRS[0] };
  }
  if (segments[0] === "editor" && segments[1] === "edit") {
    return { view: "editor-edit", path: params.get("path") || "" };
  }
  if (segments[0] === "login") return { view: "login" };
  return { view: "posts", section: params.get("section") || selectedSection || CONTENT_DIRS[0] };
}

function routeToHash(route) {
  if (!route) return "#/posts";
  if (route.view === "login") return "#/login";
  if (route.view === "editor-new") {
    const params = new URLSearchParams();
    if (route.section) params.set("section", route.section);
    return `#/editor/new${params.toString() ? `?${params.toString()}` : ""}`;
  }
  if (route.view === "editor-edit") {
    const params = new URLSearchParams();
    if (route.path) params.set("path", route.path);
    return `#/editor/edit${params.toString() ? `?${params.toString()}` : ""}`;
  }
  const params = new URLSearchParams();
  if (route.section) params.set("section", route.section);
  return `#/posts${params.toString() ? `?${params.toString()}` : ""}`;
}

function sameRoute(a, b) {
  return routeToHash(a) === routeToHash(b);
}

function setRoute(route, { replace = false } = {}) {
  const nextHash = routeToHash(route);
  if (window.location.hash === nextHash) {
    currentRoute = route;
    return;
  }
  if (replace) {
    suppressHashChange = true;
    window.history.replaceState(null, "", nextHash);
    currentRoute = route;
    setTimeout(() => { suppressHashChange = false; }, 0);
  } else {
    window.location.hash = nextHash;
  }
}

function getEditorState() {
  return {
    title: titleInput?.value || "",
    date: dateInput?.value || "",
    draft: !!draftInput?.checked,
    tags: tagsInput?.value || "",
    slug: slugInput?.value || "",
    section: sectionInput?.value || selectedSection || CONTENT_DIRS[0],
    body: editor ? editor.getMarkdown() : "",
    photoImage: photoImageInput?.value || "",
    photoCaption: photoCaptionInput?.value || "",
  };
}

function normalizeState(state) {
  return JSON.stringify({
    title: (state.title || "").trim(),
    date: state.date || "",
    draft: !!state.draft,
    tags: (state.tags || "").trim(),
    slug: (state.slug || "").trim(),
    section: state.section || "",
    body: state.body || "",
    photoImage: (state.photoImage || "").trim(),
    photoCaption: (state.photoCaption || "").trim(),
  });
}

function markEditorClean() {
  initialEditorState = normalizeState(getEditorState());
}

function hasUnsavedChanges() {
  if (!editorView || editorView.classList.contains("hidden")) return false;
  if (!initialEditorState) return false;
  return normalizeState(getEditorState()) !== initialEditorState;
}

function toggleExitConfirmModal(open) {
  if (!exitConfirmModal) return;
  exitConfirmModal.classList.toggle("hidden", !open);
}

async function attemptRouteChange(targetRoute) {
  if (!currentRoute || !currentRoute.view?.startsWith("editor") || !hasUnsavedChanges()) {
    await applyRoute(targetRoute);
    return true;
  }
  pendingRoute = targetRoute;
  toggleExitConfirmModal(true);
  if (currentRoute) setRoute(currentRoute, { replace: true });
  return false;
}

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
  currentRoute = { view: "login" };
  loginView.classList.remove("hidden");
  listView.classList.add("hidden");
  editorView.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

function showList() {
  currentRoute = currentRoute?.view === "posts" ? currentRoute : { view: "posts", section: selectedSection };
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
  if (open) {
    clearUploadSelection();
    toggleMediaUploadTools(false);
    mediaGallery?.scrollTo({ top: 0, behavior: "auto" });
  }
  mediaModal.classList.toggle("hidden", !open);
  if (open) loadMediaGallery().catch(() => {});
}

function toggleMediaUploadTools(forceOpen) {
  if (!mediaUploadTools || !toggleMediaUploadBtn) return;
  const nextOpen = typeof forceOpen === "boolean"
    ? forceOpen
    : mediaUploadTools.classList.contains("hidden");
  mediaUploadTools.classList.toggle("hidden", !nextOpen);
  toggleMediaUploadBtn.textContent = nextOpen ? "Hide upload" : "Upload new image";
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

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode image"));
    };
    img.src = objectUrl;
  });
}

async function convertImageToWebpPayload(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Images only");
  const img = await loadImageElement(file);
  const maxDimension = 2400;
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/webp", 0.82);
  if (!dataUrl.startsWith("data:image/webp")) {
    throw new Error("WebP conversion unsupported in this browser");
  }
  const baseName = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
  return {
    name: `${baseName}.webp`,
    contentType: "image/webp",
    data: dataUrl.split(",").pop() || "",
  };
}

function toggleFieldVisibility(sectionVal) {
  const isPhoto = isPhotoSection(sectionVal);
  const tagsField = tagsInput?.closest("label");
  const slugField = slugInput?.closest("label");
  [tagsField, slugField, tagsSection, bodyBlock, shortcodeBtn, mediaBtn].forEach((el) => {
    if (!el) return;
    if (el.tagName === "BUTTON") el.classList.toggle("hidden", isPhoto);
    else el.classList.toggle("hidden", isPhoto);
  });
  photoSection?.classList.toggle("hidden", !isPhoto);
  [photoPicker, captionField].forEach((el) => el?.classList.toggle("hidden", !isPhoto));
  if (!isPhoto) renderTagSuggestions();
}

function parseTags(value = "") {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function setTags(tags = []) {
  if (!tagsInput) return;
  tagsInput.value = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].join(", ");
  renderTagSuggestions();
}

function toggleTag(tag) {
  const current = parseTags(tagsInput?.value || "");
  const exists = current.some((entry) => entry.toLowerCase() === tag.toLowerCase());
  const next = exists
    ? current.filter((entry) => entry.toLowerCase() !== tag.toLowerCase())
    : [...current, tag];
  setTags(next);
}

function formatPostDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getSectionTags(section) {
  const counts = new Map();
  allPosts
    .filter((item) => !isPhotoSection(item.section || section) && (!section || item.section === section))
    .forEach((item) => {
      (item.tags || []).forEach((tag) => {
        const normalized = tag.trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        const entry = counts.get(key);
        counts.set(key, {
          label: entry?.label || normalized,
          count: (entry?.count || 0) + 1,
        });
      });
    });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((entry) => entry.label);
}

function renderTagSuggestions() {
  if (!tagSuggestions) return;
  const section = sectionInput?.value || selectedSection;
  if (isPhotoSection(section)) {
    tagSuggestions.classList.add("hidden");
    tagSuggestions.innerHTML = "";
    return;
  }
  const availableTags = getSectionTags(section);
  if (!availableTags.length) {
    tagSuggestions.classList.add("hidden");
    tagSuggestions.innerHTML = "";
    return;
  }
  const active = new Set(parseTags(tagsInput?.value || "").map((tag) => tag.toLowerCase()));
  tagSuggestions.innerHTML = "";
  availableTags.forEach((tag) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `tag-chip${active.has(tag.toLowerCase()) ? " is-active" : ""}`;
    chip.textContent = `#${tag}`;
    chip.addEventListener("click", () => toggleTag(tag));
    tagSuggestions.appendChild(chip);
  });
  tagSuggestions.classList.remove("hidden");
}

function renderMediaGallery(items = [], target = mediaGallery, onSelect) {
  if (!target) return;
  if (!items.length) {
    target.innerHTML = "<p class='hint'>No images in Nextcloud yet.</p>";
    return;
  }
  const isPicker = target === mediaGallery;
  target.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = `media-item${isPicker ? " media-item--picker" : ""}`;

    const previewBtn = document.createElement("button");
    previewBtn.type = "button";
    previewBtn.className = `media-preview-trigger${isPicker ? " media-preview-trigger--picker" : ""}`;
    previewBtn.setAttribute("aria-label", `Preview ${item.name || "image"}`);

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "media-thumb-wrap";
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.name || "Image";
    img.className = "media-thumb";

    previewBtn.addEventListener("click", () => {
      openImagePreview(item.url, item.name);
    });

    const meta = document.createElement("div");
    meta.className = `media-meta${isPicker ? " media-meta--picker" : ""}`;
    const label = document.createElement("span");
    label.textContent = item.name || "Image";
    const detail = document.createElement("span");
    const modified = item.lastModified ? new Date(item.lastModified) : null;
    const modifiedText = modified && !Number.isNaN(modified.getTime())
      ? modified.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
    const sizeText = item.size ? `${Math.round(item.size / 1024)}kb` : "";
    detail.textContent = [modifiedText, sizeText].filter(Boolean).join(" • ");

    thumbWrap.appendChild(img);
    previewBtn.appendChild(thumbWrap);
    meta.appendChild(label);
    if (detail.textContent) meta.appendChild(detail);

    card.appendChild(previewBtn);
    card.appendChild(meta);

    if (isPicker) {
      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "primary media-use-btn";
      useBtn.textContent = photoSelectActive ? "Use For Photo" : "Use This Image";
      useBtn.addEventListener("click", () => {
        if (typeof onSelect === "function") onSelect(item);
        else insertImage(item.url, item.name);
      });
      card.appendChild(useBtn);
    } else {
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "ghost small media-open-btn";
      viewBtn.textContent = "View";
      viewBtn.addEventListener("click", () => openImagePreview(item.url, item.name));
      card.appendChild(viewBtn);
    }

    target.appendChild(card);
  });
}

async function loadMediaGallery() {
  if (mediaGallery) mediaGallery.innerHTML = "<p class='hint'>Loading images...</p>";
  if (allUploadsGallery) allUploadsGallery.innerHTML = "<p class='hint'>Loading images...</p>";
  try {
    const data = await api("listImages");
    mediaItems = Array.isArray(data.items) ? data.items : [];
    renderMediaGallery(mediaItems, mediaGallery, (item) => insertImage(item.url, item.name));
    renderMediaGallery(mediaItems, allUploadsGallery, (item) => openImagePreview(item.url, item.name));
  } catch (err) {
    if (err.message === "unauthorized") {
      showLogin();
      return;
    }
    if (mediaGallery) mediaGallery.innerHTML = "<p class='hint'>Unable to load images.</p>";
    if (allUploadsGallery) allUploadsGallery.innerHTML = "<p class='hint'>Unable to load images.</p>";
    showToast(err.message, true);
  }
}

function insertImage(url, name = "image") {
  if (photoSelectActive) {
    setPhotoImage(url, name);
    photoSelectActive = false;
    toggleMediaModal(false);
    showToast("Image selected for photo");
    return;
  }
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

function toggleBulkProgress(show) {
  if (!bulkUploadProgress) return;
  bulkUploadProgress.classList.toggle("hidden", !show);
  if (!show) {
    bulkUploadProgressBar?.style.setProperty("--upload-progress", "0%");
    if (bulkUploadProgressLabel) bulkUploadProgressLabel.textContent = "0%";
  }
}

function setBulkProgress(percent, index = 1, total = 1) {
  if (!bulkUploadProgressBar || !bulkUploadProgressLabel) return;
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  bulkUploadProgressBar.style.setProperty("--upload-progress", `${clamped}%`);
  bulkUploadProgressLabel.textContent = `File ${index}/${total} — ${clamped}%`;
}

function showUploadPreview(url, name = "image") {
  if (!uploadPreview || !uploadPreviewImg) return;
  if (currentPreviewUrl && currentPreviewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(currentPreviewUrl);
  }
  currentPreviewUrl = url;
  currentPreviewName = name || "image";
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
  currentPreviewName = "image";
  if (imageInput) imageInput.value = "";
  toggleUploadProgress(false);
}

function setPhotoImage(url, name = "image") {
  if (photoImageInput) photoImageInput.value = url;
  if (photoImagePreview) photoImagePreview.src = url;
  if (photoImagePreviewName) photoImagePreviewName.textContent = name || url;
  if (photoImagePreviewWrap) photoImagePreviewWrap.classList.remove("hidden");
}

function clearPhotoImage() {
  if (photoImageInput) photoImageInput.value = "";
  if (photoImagePreview) photoImagePreview.removeAttribute("src");
  if (photoImagePreviewName) photoImagePreviewName.textContent = "";
  if (photoImagePreviewWrap) photoImagePreviewWrap.classList.add("hidden");
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
    xhr.open("POST", "/api/uploadImage");
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
    const payload = await convertImageToWebpPayload(file);
    const res = await uploadWithProgress(payload, (p) => setUploadProgress(Math.max(10, p)));
    setUploadProgress(100);
    if (res?.url) {
      showUploadPreview(res.url, res.name || file.name);
      if (imageInput) imageInput.value = "";
      insertImage(res.url, res.name || file.name);
      await loadMediaGallery();
      toggleMediaUploadTools(false);
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

async function uploadBulkImages() {
  if (!bulkImageInput || !bulkImageInput.files || !bulkImageInput.files.length) {
    showToast("Select images to upload", true);
    return;
  }
  const files = Array.from(bulkImageInput.files).filter((f) => f.type.startsWith("image/"));
  if (!files.length) {
    showToast("Images only", true);
    bulkImageInput.value = "";
    return;
  }
  let uploaded = 0;
  try {
    toggleBulkProgress(true);
    if (bulkUploadBtn) bulkUploadBtn.disabled = true;
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      setBulkProgress(5, i + 1, files.length);
      const payload = await convertImageToWebpPayload(file);
      await uploadWithProgress(payload, (p) => setBulkProgress(Math.max(10, p), i + 1, files.length));
      await loadMediaGallery().catch(() => {});
      setBulkProgress(100, i + 1, files.length);
      uploaded += 1;
    }
    showToast(`Uploaded ${uploaded}/${files.length} images`);
    bulkImageInput.value = "";
    await loadMediaGallery();
  } catch (err) {
    if (err.message === "unauthorized") {
      showLogin();
      return;
    }
    showToast(err.message, true);
  } finally {
    if (bulkUploadBtn) bulkUploadBtn.disabled = false;
    setTimeout(() => toggleBulkProgress(false), 600);
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

function buildFrontMatter(data, isPhoto = false) {
  const escapeVal = (val = "") => val.replace(/"/g, '\\"');
  const safeTitle = escapeVal(data.title || "");
  const lines = ["---", `title: "${safeTitle}"`, `date: ${data.date}`, `draft: ${data.draft ? "true" : "false"}`];
  if (isPhoto) {
    if (data.image) lines.push(`image: "${escapeVal(data.image)}"`);
    if (data.caption) lines.push(`caption: "${escapeVal(data.caption)}"`);
  } else {
    const tags = (data.tags || [])
      .map((t) => `"${t.trim().replace(/"/g, "")}"`)
      .filter(Boolean)
      .join(", ");
    lines.push(`tags: [${tags}]`);
    if (data.slug) lines.push(`slug: ${data.slug}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
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
  const selected = sectionFilter?.value || selectedSection || CONTENT_DIRS[0];
  selectedSection = selected;
  if (sectionInput) sectionInput.value = selected;
  const data = await api("listPosts");
  if (Array.isArray(data.contentDirs) && data.contentDirs.length) {
    setSections(data.contentDirs);
  }
  allPosts = Array.isArray(data.items) ? data.items.slice() : [];
  postsContainer.innerHTML = "";
  if (!allPosts.length) {
    postsContainer.innerHTML = "<p class='hint'>No posts yet.</p>";
    if (loadAllPostsBtn) loadAllPostsBtn.classList.add("hidden");
    return;
  }
  const filteredItems = allPosts
    .filter((item) => {
      const section = item.section || (item.path || "").split("/").slice(0, -1).join("/");
      return !section || section === selected;
    })
    .sort((a, b) => {
      const aDate = a.date ? new Date(a.date).getTime() : 0;
      const bDate = b.date ? new Date(b.date).getTime() : 0;
      if (aDate !== bDate) return bDate - aDate;
      return (a.title || a.name || "").localeCompare(b.title || b.name || "");
    });
  if (!filteredItems.length) {
    postsContainer.innerHTML = "<p class='hint'>No posts in this section yet.</p>";
    if (loadAllPostsBtn) loadAllPostsBtn.classList.add("hidden");
    renderTagSuggestions();
    return;
  }
  const visibleItems = showAllPosts ? filteredItems : filteredItems.slice(0, 3);
  visibleItems.forEach((item) => {
    const row = document.createElement("button");
    row.className = "post-row";
    row.type = "button";
    const title = item.title || item.name;
    const tagsMarkup = (item.tags || []).slice(0, 4).map((tag) => `<span class="post-tag">#${tag}</span>`).join("");
    row.innerHTML = `
      <div class="post-row__header">
        <strong>${title}</strong>
        <span class="post-row__date">${formatPostDate(item.date)}</span>
      </div>
      <div class="post-row__meta">
        <span>${item.size}b</span>
        <div class="post-row__tags">${tagsMarkup}</div>
      </div>
    `;
    row.addEventListener("click", () => setRoute({ view: "editor-edit", path: item.path }));
    postsContainer.appendChild(row);
  });
  if (loadAllPostsBtn) {
    const shouldShow = filteredItems.length > 3 && !showAllPosts;
    loadAllPostsBtn.classList.toggle("hidden", !shouldShow);
    if (shouldShow) loadAllPostsBtn.textContent = `Load all (${filteredItems.length})`;
  }
  renderTagSuggestions();
}

async function openPost(path) {
  try {
    const data = await api(`getPost?path=${encodeURIComponent(path)}`);
    const { fm, body } = parseFrontMatter(data.content);
    currentPost = { path: data.path, sha: data.sha };
    titleInput.value = fm.title || "";
    dateInput.value = fm.date ? formatDateInput(new Date(fm.date)) : formatDateInput(new Date());
    draftInput.checked = !!fm.draft;
    setTags(Array.isArray(fm.tags) ? fm.tags : []);
    if (slugInput) slugInput.value = fm.slug || "";
    const section = (data.path || "").split("/").slice(0, -1).join("/");
    if (sectionInput && section) sectionInput.value = section;
    const photoMode = isPhotoSection(section);
    if (photoImageInput) photoImageInput.value = photoMode ? fm.image || "" : "";
    if (photoCaptionInput) photoCaptionInput.value = photoMode ? fm.caption || "" : "";
    if (photoMode && fm.image) setPhotoImage(fm.image, fm.image);
    else clearPhotoImage();
    toggleFieldVisibility(section);
    if (!photoMode) editor.setMarkdown(body || "");
    else editor.setMarkdown(body || "");
    deletePostBtn.classList.remove("hidden");
    showEditor();
    currentRoute = { view: "editor-edit", path: data.path };
    markEditorClean();
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
  setTags([]);
  if (slugInput) slugInput.value = "";
  editor.setMarkdown("");
  photoImageInput && (photoImageInput.value = "");
  photoCaptionInput && (photoCaptionInput.value = "");
  clearPhotoImage();
  toggleFieldVisibility(sectionInput?.value || selectedSection);
  if (sectionInput && selectedSection) {
    sectionInput.value = selectedSection;
  }
  deletePostBtn.classList.add("hidden");
  showEditor();
  currentRoute = { view: "editor-new", section: sectionInput?.value || selectedSection || CONTENT_DIRS[0] };
  markEditorClean();
}

async function savePost(options = {}) {
  const { returnToRoute = null } = options;
  const title = titleInput.value.trim();
  if (!title) return showToast("Title required", true);
  const slug = (slugInput?.value || "").trim() || slugify(title);
  const date = new Date(dateInput.value || new Date());
  const chosenDir = (sectionInput && sectionInput.value) ? sectionInput.value : selectedSection || CONTENT_DIRS[0];
  const photoMode = isPhotoSection(chosenDir);
  const body = photoMode ? "" : editor.getMarkdown();
  const tags = parseTags(tagsInput.value);
  const fm = buildFrontMatter({
    title,
    date: date.toISOString(),
    draft: draftInput.checked,
    tags,
    slug,
    image: photoImageInput?.value.trim(),
    caption: photoCaptionInput?.value.trim(),
  }, photoMode);
  const content = `${fm}${body}`;
  const filename = `${date.toISOString().slice(0, 10)}-${slug}.md`;
  const path = currentPost?.path || `${chosenDir}/${filename}`;
  const payload = {
    path,
    content,
    message: currentPost ? `Update ${title}` : `Create ${title}`,
    sha: currentPost?.sha,
  };
  try {
    const res = await api("savePost", { method: "POST", body: JSON.stringify(payload) });
    currentPost = { path: res.path || path, sha: res.sha };
    if (!currentPost.path) currentPost.path = path;
    const nextEditorRoute = { view: "editor-edit", path: currentPost.path };
    currentRoute = nextEditorRoute;
    setRoute(nextEditorRoute, { replace: true });
    markEditorClean();
    showToast("Saved");
    await loadPosts();
    if (returnToRoute) await applyRoute(returnToRoute);
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
    currentPost = null;
    initialEditorState = null;
    await applyRoute({ view: "posts", section: selectedSection });
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
  } catch (err) {
    if (err.message === "unauthorized") return showToast("Bad password", true);
    showToast(err.message, true);
    return;
  }

  try {
    await loadPosts();
    await loadMediaGallery().catch(() => {});
    await applyRoute(parseRoute());
  } catch (err) {
    if (err.message === "unauthorized") return showToast("Session created, but follow-up auth failed", true);
    showToast(err.message, true);
  }
}

async function logout() {
  await api("logout", { method: "POST" }).catch(() => {});
  currentPost = null;
  initialEditorState = null;
  pendingRoute = null;
  toggleExitConfirmModal(false);
  setRoute({ view: "login" }, { replace: true });
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
  refreshBtn.addEventListener("click", () => {
    loadPosts().catch(() => {});
    loadMediaGallery().catch(() => {});
  });
  newPostBtn.addEventListener("click", () => {
    attemptRouteChange({ view: "editor-new", section: selectedSection || sectionInput?.value || CONTENT_DIRS[0] });
  });
  if (loadAllPostsBtn) {
    loadAllPostsBtn.addEventListener("click", () => {
      showAllPosts = true;
      loadPosts().catch(() => {});
    });
  }
  backToListBtn.addEventListener("click", () => {
    attemptRouteChange({ view: "posts", section: selectedSection || sectionFilter?.value || CONTENT_DIRS[0] });
  });
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
  if (toggleMediaUploadBtn) {
    toggleMediaUploadBtn.addEventListener("click", () => toggleMediaUploadTools());
  }
  if (uploadImageBtn) uploadImageBtn.addEventListener("click", uploadImage);
  if (bulkUploadBtn) bulkUploadBtn.addEventListener("click", uploadBulkImages);
  if (clearUploadBtn) {
    clearUploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearUploadSelection();
    });
  }
  if (viewUploadBtn) {
    viewUploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentPreviewUrl) openImagePreview(currentPreviewUrl, currentPreviewName);
    });
  }
  if (photoImageSelectBtn) {
    photoImageSelectBtn.addEventListener("click", (e) => {
      e.preventDefault();
      photoSelectActive = true;
      toggleMediaModal(true);
    });
  }
  if (clearPhotoImageBtn) {
    clearPhotoImageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearPhotoImage();
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
  if (exitConfirmModal) {
    exitConfirmModal.addEventListener("click", (e) => {
      if (e.target === exitConfirmModal) toggleExitConfirmModal(false);
    });
  }
  if (closeExitConfirmBtn) closeExitConfirmBtn.addEventListener("click", () => {
    pendingRoute = null;
    toggleExitConfirmModal(false);
  });
  if (cancelExitBtn) cancelExitBtn.addEventListener("click", () => {
    pendingRoute = null;
    toggleExitConfirmModal(false);
  });
  if (discardExitBtn) discardExitBtn.addEventListener("click", async () => {
    const route = pendingRoute || { view: "posts", section: selectedSection };
    pendingRoute = null;
    toggleExitConfirmModal(false);
    initialEditorState = normalizeState(getEditorState());
    await applyRoute(route);
  });
  if (saveExitBtn) saveExitBtn.addEventListener("click", async () => {
    const route = pendingRoute || { view: "posts", section: selectedSection };
    pendingRoute = null;
    toggleExitConfirmModal(false);
    await savePost({ returnToRoute: route });
  });

  loadShortcodes();
  setSections(CONTENT_DIRS);
  toggleFieldVisibility(selectedSection || CONTENT_DIRS[0]);
  setEditorHeight();
  window.addEventListener("resize", setEditorHeight);
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  window.addEventListener("hashchange", async () => {
    if (suppressHashChange || isRouting) return;
    const targetRoute = parseRoute();
    if (sameRoute(targetRoute, currentRoute)) return;
    await attemptRouteChange(targetRoute);
  });

  loadPosts()
    .then(() => loadMediaGallery())
    .then(() => applyRoute(parseRoute()))
    .catch((err) => {
      if (err.message === "unauthorized") showLogin();
      else showToast(err.message, true);
    });

  if (sectionFilter) {
    sectionFilter.addEventListener("change", () => {
      selectedSection = sectionFilter.value;
      showAllPosts = false;
      if (sectionInput) sectionInput.value = selectedSection;
      setRoute({ view: "posts", section: selectedSection });
      loadPosts().catch(() => {});
    });
  }

  if (sectionInput) {
    sectionInput.addEventListener("change", () => {
      toggleFieldVisibility(sectionInput.value);
      if (currentRoute?.view === "editor-new") {
        currentRoute = { view: "editor-new", section: sectionInput.value };
        setRoute(currentRoute, { replace: true });
      }
    });
  }

  if (tagsInput) {
    tagsInput.addEventListener("input", renderTagSuggestions);
  }
}

async function applyRoute(route) {
  isRouting = true;
  try {
    if (route.view === "login") {
      currentRoute = route;
      showLogin();
      return;
    }
    if (route.view === "posts") {
      showAllPosts = false;
      if (route.section) {
        selectedSection = route.section;
        if (sectionFilter) sectionFilter.value = selectedSection;
        if (sectionInput) sectionInput.value = selectedSection;
      }
      currentRoute = { view: "posts", section: selectedSection };
      await loadPosts();
      showList();
      return;
    }
    if (route.view === "editor-edit" && route.path) {
      setRoute(route, { replace: true });
      await openPost(route.path);
      return;
    }
    if (route.view === "editor-new") {
      if (route.section) {
        selectedSection = route.section;
        if (sectionInput) sectionInput.value = selectedSection;
        if (sectionFilter) sectionFilter.value = selectedSection;
      }
      setRoute({ view: "editor-new", section: selectedSection }, { replace: true });
      newPost();
      return;
    }
    currentRoute = { view: "posts", section: selectedSection };
    setRoute(currentRoute, { replace: true });
    await loadPosts();
    showList();
  } finally {
    isRouting = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loginForm.addEventListener("submit", login);
  init().catch((err) => {
    console.error(err);
    showToast(err.message || "Failed to load editor", true);
  });
});
