"use strict";

// ========================================
// 競馬メモアプリ
// 本文のみコピー・複数メモ一括コピー対応
// 既存データを引き継ぐバージョン
// ========================================

const STORAGE_KEY = "keiba-memo-app-memos";
const GENRE_STORAGE_KEY = "keiba-memo-app-genres";

const DEFAULT_GENRES = [
  "騎手分析",
  "種牡馬・血統",
  "馬体・走法",
  "レース回顧",
  "予想・仮説",
  "読書記録",
  "競馬の知識",
  "競馬産業・競馬史",
  "その他"
];

const $ = (id) => document.getElementById(id);

const memoForm = $("memo-form");
const memoCategory = $("memo-category");
const memoTitle = $("memo-title");
const memoOriginal = $("memo-original");
const memoSearch = $("memo-search");
const categoryFilter = $("category-filter");
const memoList = $("memo-list");

const memoCount = $("memo-count");
const pendingCount = $("pending-count");

const editorSection = $("editor-section");
const editorTitle = $("editor-title");
const newMemoButton = $("new-memo-button");
const cancelEditButton = $("cancel-edit-button");

const sourceFields = $("source-fields");
const sourceBookTitle = $("source-book-title");
const sourceAuthor = $("source-author");
const sourcePage = $("source-page");

const genreForm = $("genre-form");
const newGenreName = $("new-genre-name");
const genreList = $("genre-list");

let editingMemoId = null;
const selectedMemoIds = new Set();

// ----------------------------------------
// 保存データの読み込み
// ----------------------------------------

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`${key} の読み込みに失敗しました。`, error);
    return fallback;
  }
}

function loadMemos() {
  const data = readJSON(STORAGE_KEY, []);

  if (!Array.isArray(data)) return [];

  return data.filter((memo) =>
    memo &&
    typeof memo.id === "string" &&
    typeof memo.title === "string" &&
    typeof memo.original === "string"
  );
}

function loadGenres() {
  const data = readJSON(GENRE_STORAGE_KEY, null);

  if (!Array.isArray(data)) return [...DEFAULT_GENRES];

  return [...new Set(
    data
      .filter((genre) =>
        typeof genre === "string" && genre.trim() !== ""
      )
      .map((genre) => genre.trim())
  )];
}

let memos = loadMemos();
let genres = loadGenres();

// ----------------------------------------
// 保存
// ----------------------------------------

function saveMemos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    return true;
  } catch (error) {
    console.error("メモの保存に失敗しました。", error);
    alert("メモを保存できませんでした。ブラウザの保存容量をご確認ください。");
    return false;
  }
}

function saveGenres() {
  try {
    localStorage.setItem(GENRE_STORAGE_KEY, JSON.stringify(genres));
    return true;
  } catch (error) {
    console.error("ジャンルの保存に失敗しました。", error);
    alert("ジャンルを保存できませんでした。");
    return false;
  }
}

// ----------------------------------------
// HTML要素の作成
// ----------------------------------------

function makeElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) element.className = className;

  return element;
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function styleButton(button, background, color) {
  button.style.minHeight = "44px";
  button.style.padding = "10px 14px";
  button.style.border = "1px solid #d4ddd5";
  button.style.borderRadius = "10px";
  button.style.background = background;
  button.style.color = color;
  button.style.fontSize = "14px";
  button.style.fontWeight = "600";
  button.style.cursor = "pointer";
  button.style.touchAction = "manipulation";
}

// ----------------------------------------
// コピーする内容を取得
// 重要：メモ本文以外は絶対に追加しない
// ----------------------------------------

function getMemoBodyForClipboard(memo) {
  if (!memo || typeof memo.original !== "string") {
    return "";
  }

  // memo.title、memo.category、日時、読書ソースは使用しない
  return memo.original;
}

// ----------------------------------------
// クリップボードへのコピー
// ----------------------------------------

async function writeClipboard(text) {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("コピーする本文がありません。");
  }

  // HTTPS環境で利用できる標準コピー機能
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  // 標準APIが利用できない場合の代替処理
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.fontSize = "16px";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (error) {
    console.error("代替コピーに失敗しました。", error);
  }

  textarea.remove();

  if (!copied) {
    throw new Error("クリップボードへのコピーに失敗しました。");
  }

  return true;
}

// ----------------------------------------
// 一括選択ツールバー
// ----------------------------------------

let selectionToolbar = null;
let selectionCountLabel = null;
let selectVisibleButton = null;
let clearSelectionButton = null;
let bulkCopyButton = null;

function createSelectionToolbar() {
  if (!memoList || selectionToolbar) return;

  selectionToolbar = document.createElement("section");
  selectionToolbar.className = "bulk-copy-toolbar";

  Object.assign(selectionToolbar.style, {
    margin: "16px 0",
    padding: "16px",
    border: "1px solid #dce4dc",
    borderRadius: "14px",
    background: "#f7faf7",
    boxSizing: "border-box"
  });

  const heading = makeElement("h3", "メモをまとめてコピー");

  Object.assign(heading.style, {
    margin: "0 0 8px",
    fontSize: "17px"
  });

  const description = makeElement(
    "p",
    "コピーしたいメモにチェックを入れてください。"
  );

  Object.assign(description.style, {
    margin: "0 0 12px",
    fontSize: "13px",
    lineHeight: "1.6",
    color: "#59665b"
  });

  selectionCountLabel = makeElement("p", "選択中：0件");

  Object.assign(selectionCountLabel.style, {
    margin: "0 0 12px",
    fontWeight: "700",
    fontSize: "15px"
  });

  const buttonRow = document.createElement("div");

  Object.assign(buttonRow.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px"
  });

  selectVisibleButton = makeElement(
    "button",
    "表示中をすべて選択"
  );

  selectVisibleButton.type = "button";
  styleButton(selectVisibleButton, "#ffffff", "#334b38");

  selectVisibleButton.addEventListener("click", () => {
    getVisibleMemos().forEach((memo) => {
      selectedMemoIds.add(memo.id);
    });

    renderMemos();
  });

  clearSelectionButton = makeElement("button", "選択解除");
  clearSelectionButton.type = "button";
  styleButton(clearSelectionButton, "#ffffff", "#334b38");

  clearSelectionButton.addEventListener("click", () => {
    selectedMemoIds.clear();
    renderMemos();
  });

  bulkCopyButton = makeElement("button", "選択したメモをコピー");
  bulkCopyButton.type = "button";
  styleButton(bulkCopyButton, "#315c40", "#ffffff");

  Object.assign(bulkCopyButton.style, {
    width: "100%",
    marginTop: "12px",
    minHeight: "50px",
    fontSize: "15px"
  });

  bulkCopyButton.addEventListener("click", copySelectedMemos);

  buttonRow.appendChild(selectVisibleButton);
  buttonRow.appendChild(clearSelectionButton);

  selectionToolbar.appendChild(heading);
  selectionToolbar.appendChild(description);
  selectionToolbar.appendChild(selectionCountLabel);
  selectionToolbar.appendChild(buttonRow);
  selectionToolbar.appendChild(bulkCopyButton);

  memoList.parentNode.insertBefore(selectionToolbar, memoList);
}

function getVisibleMemos() {
  const keyword = memoSearch
    ? memoSearch.value.trim().toLocaleLowerCase()
    : "";

  const selectedCategory = categoryFilter
    ? categoryFilter.value
    : "all";

  return memos.filter((memo) => {
    const source = memo.source || {};

    const searchableText = [
      memo.title,
      memo.category,
      memo.original,
      source.bookTitle,
      source.author,
      source.page
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();

    const matchesKeyword = searchableText.includes(keyword);

    const matchesCategory =
      selectedCategory === "all" ||
      selectedCategory === "すべて" ||
      memo.category === selectedCategory;

    return matchesKeyword && matchesCategory;
  });
}

function updateSelectionToolbar() {
  if (!selectionToolbar) return;

  const existingIds = new Set(memos.map((memo) => memo.id));

  for (const id of selectedMemoIds) {
    if (!existingIds.has(id)) {
      selectedMemoIds.delete(id);
    }
  }

  const count = selectedMemoIds.size;

  selectionCountLabel.textContent = `選択中：${count}件`;

  bulkCopyButton.disabled = count === 0;
  bulkCopyButton.style.opacity = count === 0 ? "0.5" : "1";
  bulkCopyButton.style.cursor = count === 0 ? "not-allowed" : "pointer";

  bulkCopyButton.textContent = count === 0
    ? "メモを選択してください"
    : `選択した${count}件をコピー`;

  selectVisibleButton.disabled = getVisibleMemos().length === 0;
}

// ----------------------------------------
// 一括コピー
// 選択したメモの本文だけをコピー
// ----------------------------------------

async function copySelectedMemos() {
  const selectedMemos = memos.filter((memo) =>
    selectedMemoIds.has(memo.id)
  );

  if (selectedMemos.length === 0) {
    alert("コピーするメモを選択してください。");
    return;
  }

  // 専用関数から本文だけを取得する
  const text = selectedMemos
    .map(getMemoBodyForClipboard)
    .filter((body) => body.trim() !== "")
    .join("\n\n");

  if (!text) {
    alert("コピーできるメモ本文がありません。");
    return;
  }

  try {
    await writeClipboard(text);

    alert(
      `${selectedMemos.length}件のメモ本文をコピーしました！\nNotionを開いて貼り付けてください。`
    );
  } catch (error) {
    console.error("一括コピーに失敗しました。", error);

    alert(
      "コピーできませんでした。\nもう一度お試しください。iPhoneでは公開サイトをSafariで開いて操作してください。"
    );
  }
}

// ----------------------------------------
// ジャンル選択欄
// ----------------------------------------

function getHistoricalGenres() {
  return [...new Set(
    memos
      .map((memo) => memo.category)
      .filter((category) =>
        typeof category === "string" && category.trim() !== ""
      )
  )];
}

function populateCategorySelects() {
  const allGenres = [...new Set([
    ...genres,
    ...getHistoricalGenres()
  ])];

  if (memoCategory) {
    const currentValue = editingMemoId
      ? memos.find((memo) => memo.id === editingMemoId)?.category
      : memoCategory.value;

    memoCategory.replaceChildren();

    allGenres.forEach((genre) => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      memoCategory.appendChild(option);
    });

    if (currentValue && allGenres.includes(currentValue)) {
      memoCategory.value = currentValue;
    }
  }

  if (categoryFilter) {
    const currentFilter = categoryFilter.value || "all";

    categoryFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "すべて";
    categoryFilter.appendChild(allOption);

    allGenres.forEach((genre) => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      categoryFilter.appendChild(option);
    });

    categoryFilter.value =
      currentFilter === "all" ||
      currentFilter === "すべて" ||
      allGenres.includes(currentFilter)
        ? currentFilter
        : "all";
  }
}

// ----------------------------------------
// ジャンル管理
// ----------------------------------------

function renderGenres() {
  if (!genreList) return;

  genreList.replaceChildren();

  genres.forEach((genre) => {
    const row = document.createElement("div");
    row.className = "genre-item";

    row.appendChild(makeElement("span", genre, "genre-item-name"));

    const deleteButton = makeElement(
      "button",
      "削除",
      "genre-delete-button"
    );

    deleteButton.type = "button";
    deleteButton.disabled = genre === "その他";

    deleteButton.addEventListener("click", () => {
      deleteGenre(genre);
    });

    row.appendChild(deleteButton);
    genreList.appendChild(row);
  });

  if (genres.length === 0) {
    genreList.appendChild(
      makeElement("p", "ジャンルがありません。追加してください。", "empty-message")
    );
  }
}

function addGenre(name) {
  const genre = name.trim();

  if (!genre) {
    alert("ジャンル名を入力してください。");
    return;
  }

  if (genres.includes(genre)) {
    alert("同じ名前のジャンルがすでにあります。");
    return;
  }

  const previousGenres = [...genres];
  genres.push(genre);

  if (!saveGenres()) {
    genres = previousGenres;
    return;
  }

  populateCategorySelects();
  renderGenres();

  if (newGenreName) newGenreName.value = "";
}

function deleteGenre(genre) {
  if (genre === "その他") {
    alert("「その他」は削除できません。");
    return;
  }

  const usedCount = memos.filter(
    (memo) => memo.category === genre
  ).length;

  const message = usedCount > 0
    ? `「${genre}」をジャンル一覧から削除しますか？\n過去の${usedCount}件のメモのジャンル名はそのまま残ります。`
    : `「${genre}」を削除しますか？`;

  if (!confirm(message)) return;

  const previousGenres = [...genres];
  genres = genres.filter((item) => item !== genre);

  if (!saveGenres()) {
    genres = previousGenres;
    return;
  }

  populateCategorySelects();
  renderGenres();
  renderMemos();
}

// ----------------------------------------
// 読書記録のソース欄
// ----------------------------------------

function updateSourceFields() {
  if (!sourceFields || !memoCategory) return;

  const isReading = memoCategory.value === "読書記録";
  sourceFields.hidden = !isReading;

  [sourceBookTitle, sourceAuthor, sourcePage].forEach((input) => {
    if (input) input.disabled = !isReading;
  });
}

function getSourceFromForm() {
  return {
    bookTitle: sourceBookTitle ? sourceBookTitle.value.trim() : "",
    author: sourceAuthor ? sourceAuthor.value.trim() : "",
    page: sourcePage ? sourcePage.value.trim() : ""
  };
}

function fillSourceFields(source) {
  if (sourceBookTitle) sourceBookTitle.value = source?.bookTitle || "";
  if (sourceAuthor) sourceAuthor.value = source?.author || "";
  if (sourcePage) sourcePage.value = source?.page || "";

  updateSourceFields();
}

// ----------------------------------------
// メモ一覧の表示
// ----------------------------------------

function renderMemos() {
  if (!memoList) return;

  populateCategorySelects();

  const filteredMemos = getVisibleMemos();
  memoList.replaceChildren();

  if (filteredMemos.length === 0) {
    memoList.appendChild(
      makeElement(
        "p",
        memos.length === 0
          ? "まだメモがありません。最初のメモを追加しましょう。"
          : "該当するメモがありません。",
        "empty-message"
      )
    );
  }

  filteredMemos.forEach((memo) => {
    const card = document.createElement("article");
    card.className = "memo-card";

    // 一括コピー用チェック欄
    const selectionRow = document.createElement("label");

    Object.assign(selectionRow.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      minHeight: "48px",
      marginBottom: "8px",
      padding: "4px 0",
      cursor: "pointer",
      touchAction: "manipulation"
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedMemoIds.has(memo.id);
    checkbox.setAttribute(
      "aria-label",
      `${memo.title || "無題のメモ"}を一括コピーの対象にする`
    );

    Object.assign(checkbox.style, {
      width: "22px",
      height: "22px",
      flexShrink: "0",
      cursor: "pointer",
      accentColor: "#315c40"
    });

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedMemoIds.add(memo.id);
      } else {
        selectedMemoIds.delete(memo.id);
      }

      updateSelectionToolbar();
    });

    const selectLabel = makeElement("span", "一括コピーに含める");

    Object.assign(selectLabel.style, {
      fontSize: "14px",
      color: "#4f5e51"
    });

    selectionRow.appendChild(checkbox);
    selectionRow.appendChild(selectLabel);
    card.appendChild(selectionRow);

    // ジャンル・日時（画面表示のみ）
    const header = document.createElement("div");
    header.className = "memo-card-header";

    header.appendChild(
      makeElement("span", memo.category || "未分類", "memo-category-label")
    );

    header.appendChild(
      makeElement("time", formatDate(memo.updatedAt || memo.createdAt), "memo-date")
    );

    card.appendChild(header);

    // タイトル（画面表示のみ）
    card.appendChild(
      makeElement("h3", memo.title || "無題のメモ", "memo-card-title")
    );

    // 読書ソース（画面表示のみ）
    const source = memo.source || {};

    if (source.bookTitle || source.author || source.page) {
      const sourceBox = document.createElement("div");
      sourceBox.className = "memo-card-source";

      sourceBox.appendChild(makeElement("strong", "読書ソース"));

      if (source.bookTitle) {
        sourceBox.appendChild(makeElement("p", `本のタイトル：${source.bookTitle}`));
      }

      if (source.author) {
        sourceBox.appendChild(makeElement("p", `著者名：${source.author}`));
      }

      if (source.page) {
        sourceBox.appendChild(makeElement("p", `ページ番号：${source.page}`));
      }

      card.appendChild(sourceBox);
    }

    // 本文
    const original = makeElement("p", memo.original, "memo-card-original");
    original.style.whiteSpace = "pre-wrap";
    card.appendChild(original);

    // Notion転記状況
    const notionRow = document.createElement("div");
    notionRow.className = "notion-status-row";

    const isNotionDone = memo.notionCopied === true;

    notionRow.appendChild(
      makeElement(
        "span",
        isNotionDone ? "Notion転記済み" : "Notion未転記",
        `notion-status-label ${isNotionDone ? "is-done" : "is-pending"}`
      )
    );

    const notionButton = makeElement(
      "button",
      isNotionDone ? "未転記に戻す" : "転記済みにする",
      `notion-status-button ${isNotionDone ? "is-done" : "is-pending"}`
    );

    notionButton.type = "button";
    notionButton.addEventListener("click", () => toggleNotionStatus(memo.id));

    notionRow.appendChild(notionButton);
    card.appendChild(notionRow);

    // 編集・本文コピー・削除
    const actions = document.createElement("div");
    actions.className = "memo-card-actions";

    const editButton = makeElement("button", "編集", "memo-edit-button");
    editButton.type = "button";
    editButton.addEventListener("click", () => startEditing(memo.id));
    actions.appendChild(editButton);

    const copyButton = makeElement("button", "本文をコピー", "memo-copy-button");
    copyButton.type = "button";
    styleButton(copyButton, "#edf5ef", "#28543a");
    copyButton.addEventListener("click", () => copySingleMemo(memo.id));
    actions.appendChild(copyButton);

    const deleteButton = makeElement("button", "削除", "memo-delete-button");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteMemo(memo.id));
    actions.appendChild(deleteButton);

    card.appendChild(actions);
    memoList.appendChild(card);
  });

  updateCounts();
  updateSelectionToolbar();
}

// ----------------------------------------
// 1件だけコピー
// 本文以外はコピーしない
// ----------------------------------------

async function copySingleMemo(id) {
  const memo = memos.find((item) => item.id === id);

  if (!memo) {
    alert("コピーするメモが見つかりません。");
    return;
  }

  const text = getMemoBodyForClipboard(memo);

  if (!text.trim()) {
    alert("コピーできるメモ本文がありません。");
    return;
  }

  try {
    await writeClipboard(text);
    alert("メモ本文をコピーしました！\nNotionで貼り付けてください。");
  } catch (error) {
    console.error("コピーに失敗しました。", error);
    alert("コピーできませんでした。もう一度お試しください。");
  }
}

// ----------------------------------------
// Notion転記状況の切り替え
// ----------------------------------------

function toggleNotionStatus(id) {
  const index = memos.findIndex((memo) => memo.id === id);
  if (index === -1) return;

  const previousMemos = memos;

  memos = memos.map((item) => {
    if (item.id !== id) return item;

    const nextStatus = item.notionCopied !== true;

    return {
      ...item,
      notionCopied: nextStatus,
      notionCopiedAt: nextStatus ? new Date().toISOString() : null
    };
  });

  if (!saveMemos()) {
    memos = previousMemos;
    return;
  }

  renderMemos();
}

// ----------------------------------------
// 件数表示
// ----------------------------------------

function updateCounts() {
  if (memoCount) {
    memoCount.textContent = String(memos.length);
  }

  if (pendingCount) {
    pendingCount.textContent = String(
      memos.filter((memo) => memo.status !== "organized").length
    );
  }
}

// ----------------------------------------
// メモ入力フォーム
// ----------------------------------------

function resetEditor() {
  editingMemoId = null;

  if (memoForm) memoForm.reset();

  fillSourceFields(null);

  if (editorTitle) editorTitle.textContent = "新しいメモ";
  if (editorSection) editorSection.hidden = true;

  updateSourceFields();
}

function openNewMemoEditor() {
  resetEditor();

  if (editorSection) {
    editorSection.hidden = false;
    editorSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  updateSourceFields();
  if (memoTitle) memoTitle.focus();
}

function startEditing(id) {
  const memo = memos.find((item) => item.id === id);
  if (!memo) return;

  editingMemoId = id;
  populateCategorySelects();

  if (memoCategory) memoCategory.value = memo.category || "その他";
  if (memoTitle) memoTitle.value = memo.title || "";
  if (memoOriginal) memoOriginal.value = memo.original || "";

  fillSourceFields(memo.source || null);

  if (editorTitle) editorTitle.textContent = "メモを編集";

  if (editorSection) {
    editorSection.hidden = false;
    editorSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  updateSourceFields();
}

function deleteMemo(id) {
  const memo = memos.find((item) => item.id === id);
  if (!memo) return;

  if (!confirm(`「${memo.title || "無題のメモ"}」を削除しますか？`)) {
    return;
  }

  const previousMemos = memos;
  memos = memos.filter((item) => item.id !== id);

  if (!saveMemos()) {
    memos = previousMemos;
    return;
  }

  selectedMemoIds.delete(id);

  if (editingMemoId === id) resetEditor();

  renderMemos();
}

// ----------------------------------------
// メモの追加・更新
// ----------------------------------------

if (memoForm) {
  memoForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const category = memoCategory ? memoCategory.value : "その他";
    const title = memoTitle ? memoTitle.value.trim() : "";
    const finalTitle = title || "無題のメモ";
    const original = memoOriginal ? memoOriginal.value : "";

    if (!original.trim()) {
      alert("メモの内容を入力してください。");
      if (memoOriginal) memoOriginal.focus();
      return;
    }

    const source = category === "読書記録"
      ? getSourceFromForm()
      : null;

    const now = new Date().toISOString();
    const previousMemos = memos;

    if (editingMemoId) {
      memos = memos.map((memo) => {
        if (memo.id !== editingMemoId) return memo;

        return {
          ...memo,
          category,
          title: finalTitle,
          original,
          source,
          updatedAt: now
        };
      });
    } else {
      memos.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        category,
        title: finalTitle,
        original,
        source,
        createdAt: now,
        updatedAt: now,
        status: "pending",
        notionCopied: false,
        notionCopiedAt: null
      });
    }

    if (!saveMemos()) {
      memos = previousMemos;
      return;
    }

    resetEditor();
    renderMemos();
  });
}

// ----------------------------------------
// イベント設定
// ----------------------------------------

if (genreForm) {
  genreForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (newGenreName) addGenre(newGenreName.value);
  });
}

if (memoCategory) {
  memoCategory.addEventListener("change", updateSourceFields);
}

if (newMemoButton) {
  newMemoButton.addEventListener("click", openNewMemoEditor);
}

if (cancelEditButton) {
  cancelEditButton.addEventListener("click", resetEditor);
}

if (memoSearch) {
  memoSearch.addEventListener("input", renderMemos);
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", renderMemos);
}

const navAdd = $("nav-add");

if (navAdd) {
  navAdd.addEventListener("click", openNewMemoEditor);
}

const navHome = $("nav-home");

if (navHome) {
  navHome.addEventListener("click", () => {
    resetEditor();

    if (memoList) {
      memoList.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
}

const navNotes = $("nav-notes");

if (navNotes) {
  navNotes.addEventListener("click", () => {
    resetEditor();

    if (memoList) {
      memoList.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
}

// ----------------------------------------
// 初期表示
// ----------------------------------------

createSelectionToolbar();
populateCategorySelects();
renderGenres();
updateSourceFields();
renderMemos();