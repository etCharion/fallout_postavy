import { FIELDS_PAGE1, FIELDS_PAGE2, AREAS, LAYOUTS } from "./fieldData.js";

const $ = (sel) => document.querySelector(sel);

const UI = {
  selCharacter: $("#selCharacter"),
  btnNew: $("#btnNew"),
  btnLoad: $("#btnLoad"),
  btnSave: $("#btnSave"),
  btnDelete: $("#btnDelete"),
  inpToken: $("#inpToken"),
  btnRememberToken: $("#btnRememberToken"),
  overlay1: $("#overlay1"),
  overlay2: $("#overlay2"),
  notice: $("#notice"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  page1: document.querySelector('.page[data-page="1"]'),
  page2: document.querySelector('.page[data-page="2"]'),
};

const STORAGE_KEYS = {
  token: "fallout_sheet_github_token",
  lastCharId: "fallout_sheet_last_character_id",
};

const DEFAULT_STATE = () => ({
  version: 1,
  id: "",
  fields: {},      // PDF widgets we render
  lists: {
    weapons: [],
    ammo: [],
    equipment: [],
    perks: [],
  },
  meta: {
    updatedAt: new Date().toISOString(),
  },
});

let state = DEFAULT_STATE();

/** -----------------------------
 *  Repo config
 *  ----------------------------- */
function inferRepoFromLocation() {
  const host = window.location.hostname;
  const path = window.location.pathname.split("/").filter(Boolean);

  // Typical GitHub Pages patterns:
  // - https://<owner>.github.io/<repo>/
  // - https://<owner>.github.io/  (user-site repo: <owner>.github.io)
  if (!host.endsWith("github.io")) return null;

  const owner = host.split(".")[0];
  const repo = path.length ? path[0] : `${owner}.github.io`;
  return { owner, repo, branch: "main" };
}

// Change here if you want a hardcoded repo (e.g. custom domain).
const CONFIG = {
  ...inferRepoFromLocation(),
  // If inferRepoFromLocation() returns null (e.g. custom domain), fill these:
  owner: inferRepoFromLocation()?.owner ?? "CHANGE_ME",
  repo: inferRepoFromLocation()?.repo ?? "CHANGE_ME",
  branch: inferRepoFromLocation()?.branch ?? "main",
  charactersIndexPath: "data/characters/index.json",
  charactersDir: "data/characters",
};

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}/${path}`;
}

function apiUrl(path) {
  return `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
}

/** -----------------------------
 *  UI helpers
 *  ----------------------------- */
function setNotice(msg) {
  UI.notice.textContent = msg || "";
}

function getToken() {
  return UI.inpToken.value?.trim() || localStorage.getItem(STORAGE_KEYS.token) || "";
}

function rememberToken() {
  const token = UI.inpToken.value?.trim();
  if (!token) return;
  localStorage.setItem(STORAGE_KEYS.token, token);
  UI.inpToken.value = "";
  setNotice("Token uložen v tomto prohlížeči (localStorage).");
}

function firstWordPasswordFromName(name) {
  const n = (name || "").trim();
  if (!n) return "";
  const first = n.split(/\s+/)[0] || "";
  return first.toLocaleLowerCase("cs-CZ");
}

async function promptPasswordOrThrow() {
  const name = state.fields["Textbox1"] || "";
  const expected = firstWordPasswordFromName(name);
  const entered = window.prompt("Heslo = první slovo jména postavy (malými písmeny):") || "";
  if (entered.trim().toLocaleLowerCase("cs-CZ") !== expected) {
    throw new Error("Špatné heslo.");
  }
}

/** -----------------------------
 *  Render: fixed PDF fields
 *  ----------------------------- */
function makeFieldEl(meta) {
  const isCheckbox = meta.type === "checkbox";
  const el = document.createElement(isCheckbox ? "input" : (meta.multiline ? "textarea" : "input"));

  el.dataset.field = meta.name;
  el.className = "field" + (isCheckbox ? " checkbox" : "") + (meta.multiline ? " multiline" : "");

  el.style.left = `${meta.x}%`;
  el.style.top = `${meta.y}%`;
  el.style.width = `${meta.w}%`;
  el.style.height = `${meta.h}%`;

  if (isCheckbox) {
    el.type = "checkbox";
    el.checked = Boolean(state.fields[meta.name]);
    el.addEventListener("change", () => {
      state.fields[meta.name] = el.checked;
      state.meta.updatedAt = new Date().toISOString();
    });
  } else {
    el.type = "text";
    el.value = state.fields[meta.name] ?? "";
    el.addEventListener("input", () => {
      state.fields[meta.name] = el.value;
      state.meta.updatedAt = new Date().toISOString();
    });
  }

  return el;
}

function renderFixedFields() {
  UI.overlay1.innerHTML = "";
  UI.overlay2.innerHTML = "";

  FIELDS_PAGE1.forEach((m) => UI.overlay1.appendChild(makeFieldEl(m)));
  FIELDS_PAGE2.forEach((m) => UI.overlay2.appendChild(makeFieldEl(m)));
}

/** -----------------------------
 *  Render: dynamic list areas
 *  ----------------------------- */
function ensureListMinimums() {
  // Keep at least visible rows so the page doesn't look "empty".
  const minWeapons = LAYOUTS.weapons.visibleRows;
  const minAmmo = LAYOUTS.ammo.visibleRows;
  const minEquipment = LAYOUTS.equipment.visibleRows;
  const minPerks = LAYOUTS.perks.visibleRows;

  while (state.lists.weapons.length < minWeapons) state.lists.weapons.push({});
  while (state.lists.ammo.length < minAmmo) state.lists.ammo.push({});
  while (state.lists.equipment.length < minEquipment) state.lists.equipment.push({});
  while (state.lists.perks.length < minPerks) state.lists.perks.push({});
}

function createListArea(overlay, area, layout, listKey, title) {
  const wrap = document.createElement("div");
  wrap.className = "listArea";
  wrap.style.left = `${area.x}%`;
  wrap.style.top = `${area.y}%`;
  wrap.style.width = `${area.w}%`;
  wrap.style.height = `${area.h}%`;
  wrap.dataset.list = listKey;

  const controls = document.createElement("div");
  controls.className = "listControls";

  const btnAdd = document.createElement("button");
  btnAdd.textContent = `+ ${title}`;
  btnAdd.addEventListener("click", () => {
    state.lists[listKey].push({});
    renderAll();
  });

  const btnRemove = document.createElement("button");
  btnRemove.textContent = "− poslední";
  btnRemove.addEventListener("click", () => {
    if (state.lists[listKey].length <= layout.visibleRows) return;
    state.lists[listKey].pop();
    renderAll();
  });

  controls.append(btnAdd, btnRemove);
  wrap.appendChild(controls);

  const scroller = document.createElement("div");
  scroller.className = "listScroller";
  wrap.appendChild(scroller);

  // Calculate row height in px so the first N rows align with the printed lines.
  // Use requestAnimationFrame so wrap has layout metrics.
  requestAnimationFrame(() => {
    const rowH = wrap.getBoundingClientRect().height / layout.visibleRows;

    scroller.innerHTML = "";
    state.lists[listKey].forEach((rowObj, idx) => {
      const row = document.createElement("div");
      row.className = "listRow";
      row.style.height = `${rowH}px`;

      // Per-row delete (only for rows beyond visible defaults)
      if (idx >= layout.visibleRows) {
        const del = document.createElement("button");
        del.textContent = "×";
        del.title = "Smazat řádek";
        del.style.position = "absolute";
        del.style.right = "0";
        del.style.top = "0";
        del.style.transform = "translate(110%, 0)";
        del.style.padding = "4px 6px";
        del.style.borderRadius = "10px";
        del.style.background = "rgba(17,24,39,0.9)";
        del.style.border = "1px solid rgba(255,255,255,0.14)";
        del.style.color = "#e5e7eb";
        del.addEventListener("click", () => {
          state.lists[listKey].splice(idx, 1);
          renderAll();
        });
        row.appendChild(del);
      }

      layout.columns.forEach((col) => {
        const cell = document.createElement("input");
        cell.className = "cell" + (col.type === "checkbox" ? " checkbox" : "");
        cell.style.left = `${col.left}%`;
        cell.style.width = `${col.width}%`;

        if (col.type === "checkbox") {
          cell.type = "checkbox";
          cell.checked = Boolean(rowObj[col.key]);
          cell.addEventListener("change", () => {
            rowObj[col.key] = cell.checked;
            state.meta.updatedAt = new Date().toISOString();
          });
        } else {
          cell.type = "text";
          cell.value = rowObj[col.key] ?? "";
          cell.addEventListener("input", () => {
            rowObj[col.key] = cell.value;
            state.meta.updatedAt = new Date().toISOString();
          });
        }

        row.appendChild(cell);
      });

      scroller.appendChild(row);
    });
  });

  overlay.appendChild(wrap);
}

function renderDynamicLists() {
  // Page 1: weapons
  createListArea(UI.overlay1, AREAS.weapons, LAYOUTS.weapons, "weapons", "Zbraň");

  // Page 2: ammo, equipment, perks
  createListArea(UI.overlay2, AREAS.ammo, LAYOUTS.ammo, "ammo", "Munice");
  createListArea(UI.overlay2, AREAS.equipment, LAYOUTS.equipment, "equipment", "Vybavení");
  createListArea(UI.overlay2, AREAS.perks, LAYOUTS.perks, "perks", "Perk/Rys");
}

/** -----------------------------
 *  GitHub I/O
 *  ----------------------------- */
async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

async function loadIndex() {
  // Prefer raw (instant updates), fallback to relative path (works for local/dev).
  try {
    return await fetchJson(rawUrl(CONFIG.charactersIndexPath) + `?t=${Date.now()}`);
  } catch {
    return await fetchJson(`./${CONFIG.charactersIndexPath}?t=${Date.now()}`);
  }
}

async function loadCharacterFile(filePath) {
  try {
    return await fetchJson(rawUrl(filePath) + `?t=${Date.now()}`);
  } catch {
    return await fetchJson(`./${filePath}?t=${Date.now()}`);
  }
}

async function githubGetFile(path) {
  const res = await fetch(apiUrl(path), {
    headers: { "Accept": "application/vnd.github+json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  return res.json();
}

async function githubPutFile(path, contentText, message) {
  const token = getToken();
  if (!token) throw new Error("Chybí GitHub token (PAT).");

  const existing = await githubGetFile(path);
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(contentText))),
    branch: CONFIG.branch,
  };
  if (existing?.sha) body.sha = existing.sha;

  const res = await fetch(apiUrl(path), {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status}`);
  return res.json();
}

async function githubDeleteFile(path, message) {
  const token = getToken();
  if (!token) throw new Error("Chybí GitHub token (PAT).");

  const existing = await githubGetFile(path);
  if (!existing?.sha) throw new Error("Soubor neexistuje nebo nejde zjistit SHA.");

  const res = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      sha: existing.sha,
      branch: CONFIG.branch,
    }),
  });

  if (!res.ok) throw new Error(`GitHub DELETE failed: ${res.status}`);
  return res.json();
}

/** -----------------------------
 *  Admin actions
 *  ----------------------------- */
function slugify(s) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "postava";
}

async function refreshCharacterSelect() {
  const idx = await loadIndex();
  UI.selCharacter.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— vyber postavu —";
  UI.selCharacter.appendChild(opt0);

  (idx.characters || []).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name || c.id;
    UI.selCharacter.appendChild(opt);
  });

  const last = localStorage.getItem(STORAGE_KEYS.lastCharId);
  if (last) UI.selCharacter.value = last;
}

function newCharacter() {
  state = DEFAULT_STATE();
  ensureListMinimums();
  renderAll();
  setNotice("Nová postava: vyplň pole a pak použij „Upravit postavu (uložit změny)“ pro první uložení.");
}

async function loadSelectedCharacter() {
  const id = UI.selCharacter.value;
  if (!id) return;

  const idx = await loadIndex();
  const entry = (idx.characters || []).find((c) => c.id === id);
  if (!entry?.file) throw new Error("Chybí cesta k souboru v indexu.");

  const data = await loadCharacterFile(entry.file);
  state = { ...DEFAULT_STATE(), ...data };
  ensureListMinimums();
  renderAll();
  localStorage.setItem(STORAGE_KEYS.lastCharId, id);
  setNotice(`Načteno: ${entry.name || entry.id}`);
}

async function saveCharacter(isNew) {
  await promptPasswordOrThrow();

  const name = (state.fields["Textbox1"] || "").trim();
  if (!name) throw new Error("Chybí jméno postavy (Strana 1 – „JMÉNO POSTAVY“).");

  const id = state.id || slugify(name);
  state.id = id;
  state.meta.updatedAt = new Date().toISOString();

  const filePath = `${CONFIG.charactersDir}/${id}.json`;

  // 1) save character file
  await githubPutFile(filePath, JSON.stringify(state, null, 2), `Update character: ${name}`);

  // 2) update index
  const idx = await loadIndex();
  const chars = idx.characters || [];
  const existing = chars.find((c) => c.id === id);

  if (existing) {
    existing.name = name;
    existing.file = filePath;
  } else {
    chars.push({ id, name, file: filePath });
  }

  idx.characters = chars.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, "cs-CZ"));
  await githubPutFile(CONFIG.charactersIndexPath, JSON.stringify(idx, null, 2), `Update character index`);

  await refreshCharacterSelect();
  UI.selCharacter.value = id;
  localStorage.setItem(STORAGE_KEYS.lastCharId, id);

  setNotice(isNew ? `Uloženo jako nová postava: ${name}` : `Uloženy změny: ${name}`);
}

async function deleteCharacter() {
  await promptPasswordOrThrow();

  const id = UI.selCharacter.value;
  if (!id) throw new Error("Nejdřív vyber postavu.");

  const idx = await loadIndex();
  const entry = (idx.characters || []).find((c) => c.id === id);
  if (!entry?.file) throw new Error("Soubor postavy v indexu nenalezen.");

  // 1) delete character file
  await githubDeleteFile(entry.file, `Delete character: ${entry.name || id}`);

  // 2) update index
  idx.characters = (idx.characters || []).filter((c) => c.id !== id);
  await githubPutFile(CONFIG.charactersIndexPath, JSON.stringify(idx, null, 2), `Update character index`);

  await refreshCharacterSelect();
  newCharacter();
  setNotice(`Smazáno: ${entry.name || id}`);
}

/** -----------------------------
 *  Tabs
 *  ----------------------------- */
function setTab(pageNum) {
  const is1 = String(pageNum) === "1";
  UI.page1.style.display = is1 ? "" : "none";
  UI.page2.style.display = is1 ? "none" : "";
  UI.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === String(pageNum)));
}

/** -----------------------------
 *  Render all
 *  ----------------------------- */
function renderAll() {
  renderFixedFields();

  // wipe + rebuild dynamic overlays (simple, fast enough)
  // Keep fixed fields already rendered above; dynamic lists are appended after.
  // Re-render fixed fields already cleared overlays, so now append lists:
  renderDynamicLists();
}

async function init() {
  // Pre-fill token field from storage hint (do not reveal actual token).
  if (localStorage.getItem(STORAGE_KEYS.token)) {
    UI.inpToken.placeholder = "GitHub token uložen (můžeš ho vyměnit)";
  }

  // Buttons availability hint
  if (CONFIG.owner === "CHANGE_ME" || CONFIG.repo === "CHANGE_ME") {
    setNotice("⚠️ Vyplň CONFIG.owner a CONFIG.repo v app.js (nebo hostuj na GitHub Pages, kde se to většinou vyplní samo).");
  }

  ensureListMinimums();
  renderAll();

  await refreshCharacterSelect();
  const last = UI.selCharacter.value;
  if (last) {
    try { await loadSelectedCharacter(); } catch { /* ignore */ }
  }
}

UI.btnRememberToken.addEventListener("click", rememberToken);
UI.btnNew.addEventListener("click", newCharacter);
UI.btnLoad.addEventListener("click", async () => {
  try { await loadSelectedCharacter(); } catch (e) { setNotice(e.message); }
});
UI.btnSave.addEventListener("click", async () => {
  try { await saveCharacter(!state.id); } catch (e) { setNotice(e.message); }
});
UI.btnDelete.addEventListener("click", async () => {
  try { await deleteCharacter(); } catch (e) { setNotice(e.message); }
});

UI.tabs.forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));

init().catch((e) => setNotice(e.message));
