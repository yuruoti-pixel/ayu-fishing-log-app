const DB_NAME = "ayuFishingLogDb";
const DB_VERSION = 1;
const STORE_STATE = "state";
const STATE_KEY = "app";
const LEGACY_STORAGE_KEY = "ayuFishingLog.v1";

const sections = {
  common: { label: "共通情報", prefix: "" },
  morning: { label: "午前", prefix: "午前_" },
  afternoon: { label: "午後", prefix: "午後_" }
};

const typeLabels = {
  date: "日付",
  number: "数字",
  text: "テキスト",
  textarea: "長文メモ",
  select: "単一選択",
  multiselect: "複数選択",
  checkbox: "チェック"
};

let templateFields = [];
let templateOptions = {};
let db;
let state;
let editingId = null;
let activeTab = { add: "common", edit: "common" };

const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll(".nav-button");
const addForm = document.getElementById("addForm");
const editForm = document.getElementById("editForm");
const recordList = document.getElementById("recordList");
const fieldSettings = document.getElementById("fieldSettings");
const optionSettings = document.getElementById("optionSettings");
const searchInput = document.getElementById("searchInput");
const toast = document.getElementById("toast");

async function loadInitialTemplates() {
  const [fieldsRes, optionsRes] = await Promise.all([
    fetch("fields.json", { cache: "no-cache" }),
    fetch("options.json", { cache: "no-cache" })
  ]);
  if (!fieldsRes.ok || !optionsRes.ok) throw new Error("初期設定ファイルを読み込めません");
  templateFields = await fieldsRes.json();
  templateOptions = await optionsRes.json();
}

function makeDefaultState() {
  return {
    schemaVersion: 3,
    fields: structuredClone(templateFields),
    options: structuredClone(templateOptions),
    records: []
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_STATE)) database.createObjectStore(STORE_STATE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readStateFromDb() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STATE, "readonly");
    const request = tx.objectStore(STORE_STATE).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function writeStateToDb(nextState) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STATE, "readwrite");
    tx.objectStore(STORE_STATE).put(nextState, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadState() {
  const saved = await readStateFromDb();
  if (saved) {
    const merged = normalizeState(saved);
    const changed = mergeNewTemplateItems(merged);
    if (changed) await writeStateToDb(merged);
    return merged;
  }

  const legacy = loadLegacyState();
  if (legacy) {
    mergeNewTemplateItems(legacy);
    await writeStateToDb(legacy);
    return legacy;
  }

  const fallback = makeDefaultState();
  await writeStateToDb(fallback);
  return fallback;
}

function loadLegacyState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    return saved ? normalizeState(saved) : null;
  } catch {
    return null;
  }
}

function normalizeState(raw) {
  const fallback = makeDefaultState();
  return {
    schemaVersion: 3,
    fields: Array.isArray(raw.fields) ? raw.fields : fallback.fields,
    options: { ...fallback.options, ...(raw.options || {}) },
    records: Array.isArray(raw.records) ? raw.records.map(normalizeRecord) : []
  };
}

function mergeNewTemplateItems(targetState) {
  let changed = false;
  const existingIds = new Set(targetState.fields.map((field) => field.id));
  templateFields.forEach((field) => {
    if (!existingIds.has(field.id)) {
      targetState.fields.push(structuredClone(field));
      changed = true;
    }
  });
  Object.entries(templateOptions).forEach(([key, values]) => {
    if (!Array.isArray(targetState.options[key])) {
      targetState.options[key] = structuredClone(values);
      changed = true;
    }
  });
  return changed;
}

async function importNewTemplateItems() {
  const before = state.fields.length + Object.keys(state.options).length;
  mergeNewTemplateItems(state);
  await saveState();
  renderSettings();
  buildForm(addForm, createEmptyRecord(), "add");
  const after = state.fields.length + Object.keys(state.options).length;
  showToast(after > before ? "新しい初期項目を取り込みました" : "追加できる新しい項目はありません");
}

async function resetSettingsToTemplates() {
  if (!confirm("スマホで編集した項目や選択肢が初期状態に戻ります。実行しますか？")) return;
  state.fields = structuredClone(templateFields);
  state.options = structuredClone(templateOptions);
  await saveState();
  renderSettings();
  buildForm(addForm, createEmptyRecord(), "add");
  showToast("初期設定に戻しました");
}

function normalizeRecord(record) {
  if (record.common || record.morning || record.afternoon) {
    return {
      id: record.id || crypto.randomUUID(),
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString(),
      common: { ...(record.common || {}) },
      morning: { ...(record.morning || {}) },
      afternoon: { ...(record.afternoon || {}) },
      archivedValues: { ...(record.archivedValues || {}) }
    };
  }
  return {
    id: record.id || crypto.randomUUID(),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
    common: {
      date: record.date || "",
      river: record.river || "",
      point: record.point || "",
      weather: record.weather || "",
      airTemp: record.airTemp || "",
      commonMemo: record.memo || ""
    },
    morning: {
      waterTemp: record.waterTemp || "",
      waterLevel: record.waterLevel || "",
      waterClarity: record.waterClarity || "",
      riverCondition: record.riverCondition || "",
      mossCondition: record.mossCondition || "",
      rod: record.rod || "",
      rig: record.rig || "",
      catchCount: record.catchCount || "",
      maxSize: record.maxSize || "",
      memo: ""
    },
    afternoon: {},
    archivedValues: {}
  };
}

async function saveState() {
  await writeStateToDb(state);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sectionFields(section, includeHidden = false) {
  return state.fields
    .filter((field) => field.section === section && (includeHidden || field.visible))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function recordSectionValue(record, field) {
  const section = record[field.section] || {};
  return section[field.sourceId || field.id] ?? "";
}

function setRecordSectionValue(record, field, value) {
  record[field.section] ||= {};
  record[field.section][field.sourceId || field.id] = value;
}

function createEmptyRecord() {
  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    common: { date: today() },
    morning: {},
    afternoon: {},
    archivedValues: {}
  };
  state.fields.forEach((field) => {
    const key = field.sourceId || field.id;
    record[field.section] ||= {};
    if (!(key in record[field.section])) record[field.section][key] = "";
  });
  return record;
}

function buildForm(form, record, mode) {
  form.innerHTML = "";
  const tabWrap = document.createElement("div");
  tabWrap.className = "section-tabs";
  Object.entries(sections).forEach(([key, section]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button ${activeTab[mode] === key ? "active" : ""}`;
    button.dataset.formTab = key;
    button.textContent = section.label;
    tabWrap.appendChild(button);
  });
  form.appendChild(tabWrap);

  Object.entries(sections).forEach(([key, section]) => {
    const panel = document.createElement("div");
    panel.className = `form-section ${key} ${activeTab[mode] === key ? "active" : ""}`;
    panel.dataset.sectionPanel = key;
    panel.innerHTML = `<h3>${section.label}</h3>`;
    sectionFields(key).forEach((field) => panel.appendChild(createFieldControl(field, record, mode)));
    if (key !== "common") {
      const summary = document.createElement("p");
      summary.className = "section-total";
      summary.textContent = `${section.label}釣果：${sessionCatch(record, key)}匹`;
      panel.appendChild(summary);
    }
    form.appendChild(panel);
  });

  const total = document.createElement("div");
  total.className = "total-strip";
  total.textContent = `合計釣果：${totalCatch(record)}匹`;
  form.appendChild(total);

  const actions = document.createElement("div");
  actions.className = "form-actions";
  actions.innerHTML = mode === "add"
    ? '<button class="primary-button" type="submit">記録を保存</button>'
    : [
      '<button class="primary-button" type="submit">変更を保存</button>',
      '<button class="secondary-button" id="shareRecordButton" type="button">共有</button>',
      '<button class="secondary-button" id="lineShareButton" type="button">LINEへ送る</button>',
      '<button class="secondary-button" id="copyShareButton" type="button">コピー</button>',
      '<button class="danger-button" id="deleteEditingButton" type="button">削除</button>'
    ].join("");
  form.appendChild(actions);
}

function createFieldControl(field, record, mode) {
  const wrapper = document.createElement("div");
  wrapper.className = `form-field ${field.type === "textarea" ? "full" : ""}`;
  const inputName = `${field.section}.${field.sourceId || field.id}`;
  const label = document.createElement("label");
  label.htmlFor = `${mode}-${field.id}`;
  label.textContent = `${field.label}${field.unit ? `（${field.unit}）` : ""}${field.required ? " *" : ""}`;
  wrapper.appendChild(label);

  let input;
  const value = recordSectionValue(record, field);
  if (field.type === "select") {
    input = document.createElement("select");
    input.appendChild(new Option("選択してください", ""));
    (state.options[field.optionKey] || []).forEach((option) => input.appendChild(new Option(option, option)));
    input.value = value;
  } else if (field.type === "multiselect") {
    input = document.createElement("select");
    input.multiple = true;
    input.size = Math.min(5, Math.max(3, (state.options[field.optionKey] || []).length));
    const values = Array.isArray(value) ? value : String(value || "").split("、").filter(Boolean);
    (state.options[field.optionKey] || []).forEach((option) => {
      const opt = new Option(option, option);
      opt.selected = values.includes(option);
      input.appendChild(opt);
    });
  } else if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.value = value;
  } else if (field.type === "checkbox") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value === true || value === "true" || value === "1";
  } else {
    input = document.createElement("input");
    input.type = field.type;
    input.value = value;
    if (field.type === "number") input.inputMode = "decimal";
  }
  input.id = `${mode}-${field.id}`;
  input.name = inputName;
  input.required = !!field.required;
  input.dataset.fieldId = field.id;
  wrapper.appendChild(input);
  return wrapper;
}

function collectForm(form, existing = {}) {
  const record = normalizeRecord(existing);
  record.updatedAt = new Date().toISOString();
  state.fields.forEach((field) => {
    const input = form.elements[`${field.section}.${field.sourceId || field.id}`];
    if (!input) return;
    let value;
    if (field.type === "multiselect") value = Array.from(input.selectedOptions).map((option) => option.value);
    else if (field.type === "checkbox") value = input.checked;
    else value = input.value.trim();
    setRecordSectionValue(record, field, value);
  });
  return record;
}

function showView(name) {
  views.forEach((view) => view.classList.toggle("active", view.id === `view-${name}`));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  if (name === "add") buildForm(addForm, createEmptyRecord(), "add");
  if (name === "list") renderList();
  if (name === "settings") renderSettings();
}

function renderList() {
  const query = searchInput.value.trim().toLowerCase();
  const records = [...state.records]
    .filter((record) => [record.common.river, record.common.point, record.common.commonMemo, record.morning.memo, record.afternoon.memo].join(" ").toLowerCase().includes(query))
    .sort((a, b) => (b.common.date || "").localeCompare(a.common.date || ""));
  document.getElementById("recordCountText").textContent = `${records.length}件の記録`;
  recordList.innerHTML = "";
  if (!records.length) {
    recordList.innerHTML = '<p class="empty-state">まだ記録がありません。追加画面から最初の釣行を保存してください。</p>';
    return;
  }
  records.forEach((record) => {
    const card = document.createElement("article");
    card.className = "record-card";
    card.innerHTML = `
      <div class="record-main" data-edit="${record.id}">
        <div>
          <div class="record-date">${escapeHtml(record.common.date || "日付なし")}</div>
          <div class="record-river">${escapeHtml(record.common.river || "川未設定")} ${record.common.point ? `・${escapeHtml(record.common.point)}` : ""}</div>
        </div>
        <div class="record-catch">合計 ${totalCatch(record)}匹</div>
      </div>
      <div class="record-meta">
        <span>${escapeHtml(record.common.weather || "天気未設定")}</span>
        <span>午前 ${sessionCatch(record, "morning")}匹</span>
        <span>午後 ${sessionCatch(record, "afternoon")}匹</span>
      </div>
      <div class="card-actions">
        <button class="secondary-button" type="button" data-edit="${record.id}">編集</button>
        <button class="danger-button" type="button" data-delete="${record.id}">削除</button>
      </div>
    `;
    recordList.appendChild(card);
  });
}

function renderSettings() {
  fieldSettings.innerHTML = `
    <div class="setting-card">
      <h3>入力項目</h3>
      <div class="settings-actions">
        <button class="secondary-button" type="button" id="exportSettingsButton">設定をJSONバックアップ</button>
        <label class="file-import settings-import">設定をJSON復元<input id="importSettingsInput" type="file" accept="application/json,.json"></label>
        <button class="secondary-button" type="button" id="importTemplateButton">初期設定から新しい項目だけ取り込む</button>
        <button class="danger-button" type="button" id="resetSettingsButton">初期設定に戻す</button>
      </div>
      <div class="field-add-grid">
        <input id="newFieldLabel" type="text" placeholder="表示名">
        <select id="newFieldSection">
          <option value="common">共通情報</option>
          <option value="morning">午前</option>
          <option value="afternoon">午後</option>
        </select>
        <select id="newFieldType">
          ${Object.entries(typeLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}
        </select>
        <button class="small-button" type="button" id="addFieldButton">項目追加</button>
      </div>
      ${state.fields.map((field) => fieldRow(field)).join("")}
    </div>
  `;

  optionSettings.innerHTML = optionSettingKeys().map((key) => `
    <div class="setting-card" data-option-card="${key}">
      <h3>${optionLabel(key)}の選択肢</h3>
      <div class="option-list">
        ${(state.options[key] || []).map((option, index) => optionRow(key, option, index)).join("")}
      </div>
      <div class="option-actions">
        <input type="text" placeholder="追加する選択肢" data-option-input="${key}">
        <button class="small-button" type="button" data-option-add="${key}">追加</button>
      </div>
    </div>
  `).join("");
}

function fieldRow(field) {
  return `
    <div class="field-row" data-field-row="${field.id}">
      <input type="text" value="${escapeAttribute(field.label)}" data-field-label="${field.id}" aria-label="表示名">
      <select data-field-section="${field.id}" aria-label="区分">
        ${Object.entries(sections).map(([key, section]) => `<option value="${key}" ${field.section === key ? "selected" : ""}>${section.label}</option>`).join("")}
      </select>
      <select data-field-type="${field.id}" aria-label="入力タイプ">
        ${Object.entries(typeLabels).map(([key, label]) => `<option value="${key}" ${field.type === key ? "selected" : ""}>${label}</option>`).join("")}
      </select>
      <input type="number" value="${Number(field.order || 0)}" data-field-order="${field.id}" aria-label="並び順">
      <label class="mini-check"><input type="checkbox" data-field-visible="${field.id}" ${field.visible ? "checked" : ""}>表示</label>
      <label class="mini-check"><input type="checkbox" data-field-required="${field.id}" ${field.required ? "checked" : ""}>必須</label>
      <button class="small-button" type="button" data-field-save="${field.id}">更新</button>
      <button class="danger-button" type="button" data-field-hide="${field.id}">非表示</button>
    </div>
  `;
}

function optionRow(key, option, index) {
  return `
    <div class="option-row">
      <input type="text" value="${escapeAttribute(option)}" data-option-edit="${key}" data-option-index="${index}" aria-label="${optionLabel(key)}の選択肢">
      <button class="small-button" type="button" data-option-save="${key}" data-option-index="${index}">更新</button>
      <button class="danger-button" type="button" data-option-delete="${key}" data-option-index="${index}">削除</button>
    </div>
  `;
}

function optionSettingKeys() {
  const keys = new Set(Object.keys(templateOptions));
  state.fields.forEach((field) => {
    if ((field.type === "select" || field.type === "multiselect") && field.optionKey) keys.add(field.optionKey);
  });
  return Array.from(keys);
}

function optionLabel(key) {
  const field = state.fields.find((item) => item.optionKey === key);
  return field?.label || key;
}

function openEdit(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  editingId = id;
  activeTab.edit = "common";
  buildForm(editForm, record, "edit");
  showView("edit");
}

async function deleteRecord(id) {
  if (!confirm("この記録を削除しますか？")) return;
  state.records = state.records.filter((record) => record.id !== id);
  await saveState();
  renderList();
  showToast("記録を削除しました");
}

function sessionCatch(record, section) {
  return Number(record?.[section]?.catchCount || 0) || 0;
}

function totalCatch(record) {
  return sessionCatch(record, "morning") + sessionCatch(record, "afternoon");
}

function getEditingRecord() {
  if (!editingId) return null;
  const base = state.records.find((record) => record.id === editingId);
  return base ? collectForm(editForm, base) : null;
}

function buildShareText(record) {
  const lines = ["【鮎釣り記録】"];
  appendShareSection(lines, "common", record);
  lines.push("", "【午前】");
  appendShareSection(lines, "morning", record);
  lines.push("", "【午後】");
  appendShareSection(lines, "afternoon", record);
  lines.push("", `合計釣果数：${totalCatch(record)}`);
  return lines.join("\n");
}

function appendShareSection(lines, section, record) {
  sectionFields(section).forEach((field) => {
    lines.push(`${field.label}：${formatValue(recordSectionValue(record, field))}`);
  });
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function shareCurrentRecord() {
  const record = getEditingRecord();
  if (!record) return;
  const text = buildShareText(record);
  if (navigator.share) {
    try {
      await navigator.share({ title: "鮎釣り記録", text });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  await copyText(text);
  showToast("共有文をコピーしました");
}

function lineShareCurrentRecord() {
  const record = getEditingRecord();
  if (!record) return;
  location.href = `https://line.me/R/share?text=${encodeURIComponent(buildShareText(record))}`;
}

async function copyCurrentRecord() {
  const record = getEditingRecord();
  if (!record) return;
  await copyText(buildShareText(record));
  showToast("共有文をコピーしました");
}

function exportFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const fields = [...sectionFields("common", true), ...sectionFields("morning", true), ...sectionFields("afternoon", true)];
  const headers = fields.map((field) => `${sections[field.section].prefix}${field.label}`).concat("合計釣果数");
  const rows = [...state.records]
    .sort((a, b) => (b.common.date || "").localeCompare(a.common.date || ""))
    .map((record) => fields.map((field) => formatValue(recordSectionValue(record, field))).concat(totalCatch(record)));
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  exportFile(`ayu-log-${today()}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportJson() {
  exportFile(`ayu-log-backup-${today()}.json`, JSON.stringify(state, null, 2), "application/json");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.records) || !Array.isArray(imported.fields) || !imported.options) throw new Error("invalid");
      state = normalizeState(imported);
      mergeNewTemplateItems(state);
      await saveState();
      buildForm(addForm, createEmptyRecord(), "add");
      showToast("JSONを復元しました");
      showView("list");
    } catch {
      showToast("JSONを読み込めませんでした");
    }
  };
  reader.readAsText(file);
}

function exportSettings() {
  exportFile(`ayu-log-settings-${today()}.json`, JSON.stringify({ fields: state.fields, options: state.options }, null, 2), "application/json");
}

function importSettings(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.fields) || !imported.options) throw new Error("invalid");
      state.fields = imported.fields;
      state.options = imported.options;
      mergeNewTemplateItems(state);
      await saveState();
      renderSettings();
      buildForm(addForm, createEmptyRecord(), "add");
      showToast("設定を復元しました");
    } catch {
      showToast("設定JSONを読み込めませんでした");
    }
  };
  reader.readAsText(file);
}

function formatValue(value) {
  return Array.isArray(value) ? value.join("、") : (value ?? "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function bindFormTabs(form, mode) {
  form.addEventListener("click", (event) => {
    const tab = event.target.dataset.formTab;
    if (!tab) return;
    activeTab[mode] = tab;
    buildForm(form, collectForm(form, mode === "edit" ? getEditingRecord() || createEmptyRecord() : createEmptyRecord()), mode);
  });
}

bindFormTabs(addForm, "add");
bindFormTabs(editForm, "edit");

navButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.getElementById("quickAddButton").addEventListener("click", () => showView("add"));

addForm.addEventListener("input", () => {
  const record = collectForm(addForm, createEmptyRecord());
  addForm.querySelector(".total-strip").textContent = `合計釣果：${totalCatch(record)}匹`;
});

editForm.addEventListener("input", () => {
  const record = getEditingRecord();
  if (record) editForm.querySelector(".total-strip").textContent = `合計釣果：${totalCatch(record)}匹`;
});

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = collectForm(addForm, createEmptyRecord());
  state.records.push(record);
  await saveState();
  activeTab.add = "common";
  buildForm(addForm, createEmptyRecord(), "add");
  showToast("記録を保存しました");
  showView("list");
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const index = state.records.findIndex((record) => record.id === editingId);
  if (index < 0) return;
  state.records[index] = collectForm(editForm, state.records[index]);
  await saveState();
  showToast("変更を保存しました");
  showView("list");
});

editForm.addEventListener("click", (event) => {
  if (event.target.id === "deleteEditingButton") deleteRecord(editingId);
  if (event.target.id === "shareRecordButton") shareCurrentRecord();
  if (event.target.id === "lineShareButton") lineShareCurrentRecord();
  if (event.target.id === "copyShareButton") copyCurrentRecord();
});

recordList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-edit], [data-delete]");
  if (!target) return;
  if (target.dataset.edit) openEdit(target.dataset.edit);
  if (target.dataset.delete) deleteRecord(target.dataset.delete);
});

searchInput.addEventListener("input", renderList);

fieldSettings.addEventListener("click", async (event) => {
  if (event.target.id === "exportSettingsButton") return exportSettings();
  if (event.target.id === "importTemplateButton") return importNewTemplateItems();
  if (event.target.id === "resetSettingsButton") return resetSettingsToTemplates();
  if (event.target.id === "addFieldButton") {
    const label = document.getElementById("newFieldLabel").value.trim();
    const section = document.getElementById("newFieldSection").value;
    const type = document.getElementById("newFieldType").value;
    if (!label) return;
    const id = `${section}_${Date.now()}`;
    const optionKey = type === "select" || type === "multiselect" ? id : "";
    state.fields.push({ id, label, type, optionKey, section, visible: true, order: Date.now(), required: false });
    if (optionKey) state.options[optionKey] = [];
    await saveState();
    renderSettings();
    showToast("項目を追加しました");
    return;
  }

  const saveId = event.target.dataset.fieldSave;
  const hideId = event.target.dataset.fieldHide;
  if (!saveId && !hideId) return;
  const id = saveId || hideId;
  const field = state.fields.find((item) => item.id === id);
  if (!field) return;
  if (hideId) field.visible = false;
  if (saveId) {
    field.label = fieldSettings.querySelector(`[data-field-label="${id}"]`).value.trim() || field.label;
    field.section = fieldSettings.querySelector(`[data-field-section="${id}"]`).value;
    field.type = fieldSettings.querySelector(`[data-field-type="${id}"]`).value;
    if ((field.type === "select" || field.type === "multiselect") && !field.optionKey) {
      field.optionKey = field.id;
      state.options[field.optionKey] ||= [];
    }
    field.order = Number(fieldSettings.querySelector(`[data-field-order="${id}"]`).value || field.order || 0);
    field.visible = fieldSettings.querySelector(`[data-field-visible="${id}"]`).checked;
    field.required = fieldSettings.querySelector(`[data-field-required="${id}"]`).checked;
  }
  await saveState();
  renderSettings();
  buildForm(addForm, createEmptyRecord(), "add");
  showToast("入力項目を保存しました");
});

fieldSettings.addEventListener("change", (event) => {
  if (event.target.id === "importSettingsInput") {
    const [file] = event.target.files;
    if (file) importSettings(file);
    event.target.value = "";
  }
});

optionSettings.addEventListener("click", async (event) => {
  const addKey = event.target.dataset.optionAdd;
  const saveKey = event.target.dataset.optionSave;
  const deleteKey = event.target.dataset.optionDelete;

  if (addKey) {
    const input = optionSettings.querySelector(`[data-option-input="${addKey}"]`);
    const value = input.value.trim();
    if (!value) return;
    state.options[addKey] = [...(state.options[addKey] || []), value];
    input.value = "";
  }

  if (saveKey) {
    const index = Number(event.target.dataset.optionIndex);
    const input = optionSettings.querySelector(`[data-option-edit="${saveKey}"][data-option-index="${index}"]`);
    const value = input.value.trim();
    if (!value) return;
    state.options[saveKey][index] = value;
  }

  if (deleteKey) {
    const index = Number(event.target.dataset.optionIndex);
    state.options[deleteKey].splice(index, 1);
  }

  if (addKey || saveKey || deleteKey) {
    await saveState();
    renderSettings();
    buildForm(addForm, createEmptyRecord(), "add");
    showToast("選択肢を保存しました");
  }
});

document.getElementById("exportCsvButton").addEventListener("click", exportCsv);
document.getElementById("exportJsonButton").addEventListener("click", exportJson);
document.getElementById("importJsonInput").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file && confirm("JSONバックアップから復元しますか？")) importJson(file);
  event.target.value = "";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

(async function init() {
  try {
    await loadInitialTemplates();
    db = await openDatabase();
    state = await loadState();
    buildForm(addForm, createEmptyRecord(), "add");
  } catch (error) {
    document.body.innerHTML = '<main class="view active"><div class="section-heading"><h2>起動できません</h2><p>初期設定またはIndexedDBを読み込めません。HTTP/HTTPSで開いているか確認してください。</p></div></main>';
  }
})();
