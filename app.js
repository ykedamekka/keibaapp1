
"use strict";

// ========================================
// 競馬メモアプリ
// 既存データを引き継ぐバージョン
// 複数メモ選択・一括コピー対応
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

// 選択中のメモIDを保存する
const selectedMemoIds = new Set();

// 一括操作用の画面要素
let bulkToolbar = null;
let bulkCountLabel = null;
let selectVisibleButton = null;
let deselectAllButton = null;
let bulkCopyButton = null;

// ----------------------------------------
// 保存データの読み込み
// ----------------------------------------

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (raw === null) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(`${key} の読み込みに失敗しました。`, error);
    return fallback;
  }
}

function loadMemos() {
  const data = readJSON(STORAGE_KEY, []);

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter((memo) =>
    memo &&
    typeof memo.id === "string" &&
    typeof memo.title === "string" &&
    typeof memo.original === "string"
  );
}

function loadGenres() {
  const data = readJSON(GENRE_STORAGE_KEY, null);

  if (!Array.isArray(data)) {
    return [...DEFAULT_GENRES];
  }

  return [...new Set(
    data.filter(
      (genre) =>
        typeof genre === "string" &&
        genre.trim() !== ""
    ).map((genre) => genre.trim())
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
    localStorage.setItem(
      GENRE_STORAGE_KEY,
      JSON.stringify(genres)
    );
    return true;
  } catch (error) {
    console.error("ジャンルの保存に失敗しました。", error);
    alert("ジャンルを保存できませんでした。");
    return false;
  }
}

// ----------------------------------------
// HTML要素を安全に作る
// ----------------------------------------

function makeElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  return element;
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// ----------------------------------------
// 複数選択ツールバーを作成
// HTMLの追加編集は不要
// ----------------------------------------

function createBulkToolbar() {
  if (!memoList || bulkToolbar) return;

  bulkToolbar = document.createElement("section");
  bulkToolbar.className = "bulk-memo-toolbar";
  bulkToolbar.setAttribute("aria-label", "メモの一括操作");

  // スマホで押しやすい表示
  Object.assign(bulkToolbar.style, {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "14px",
    margin: "12px 0",
    border: "1px solid #d7dce2",
    borderRadius: "12px",
    background: "#f7f9fc",
    boxSizing: "border-box",
    width: "100%"
  });

  const heading = makeElement(
    "strong",
    "メモの一括操作"
  );

  heading.style.fontSize = "16px";
  bulkToolbar.appendChild(heading);

  bulkCountLabel = makeElement(
    "p",
    "0件選択中",
    "bulk-memo-count"
  );

  Object.assign(bulkCountLabel.style, {
    margin: "0",
    fontSize: "14px",
    lineHeight: "1.5"
  });

  bulkToolbar.appendChild(bulkCountLabel);

  const buttonRow = document.createElement("div");

  Object.assign(buttonRow.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    width: "100%"
  });

  selectVisibleButton = makeElement(
    "button",
    "表示中をすべて選択"
  );

  selectVisibleButton.type = "button";

  deselectAllButton = makeElement(
    "button",
    "選択を解除"
  );

  deselectAllButton.type = "button";

  bulkCopyButton = makeElement(
    "button",
    "選択したメモをまとめてコピー"
  );

  bulkCopyButton.type = "button";

  [selectVisibleButton, deselectAllButton, bulkCopyButton]
    .forEach((button) => {
      Object.assign(button.style, {
        minHeight: "44px",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid #c8ced6",
        fontSize: "14px",
        lineHeight: "1.4",
        cursor: "pointer",
        touchAction: "manipulation",
        whiteSpace: "normal",
        flex: "1 1 140px",
        boxSizing: "border-box"
      });
    });

  Object.assign(bulkCopyButton.style, {
    background: "#1769aa",
    color: "#ffffff",
    border: "1px solid #1769aa",
    fontWeight: "bold",
    flexBasis: "100%"
  });

  selectVisibleButton.addEventListener("click", () => {
    getVisibleMemos().forEach((memo) => {
      selectedMemoIds.add(memo.id);
    });

    renderMemos();
  });

  deselectAllButton.addEventListener("click", () => {
    selectedMemoIds.clear();
    renderMemos();
  });

  bulkCopyButton.addEventListener("click", copySelectedMemos);

  buttonRow.appendChild(selectVisibleButton);
  buttonRow.appendChild(deselectAllButton);
  buttonRow.appendChild(bulkCopyButton);

  bulkToolbar.appendChild(buttonRow);

  // メモ一覧の直前に表示する
  memoList.parentNode.insertBefore(bulkToolbar, memoList);
}

// ----------------------------------------
// 表示中のメモを取得
// 検索語・ジャンル絞り込みに対応
// ----------------------------------------

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
    ].filter(Boolean).join(" ").toLocaleLowerCase();

    const matchesKeyword = searchableText.includes(keyword);

    const matchesCategory =
      selectedCategory === "all" ||
      memo.category === selectedCategory;

    return matchesKeyword && matchesCategory;
  });
}

// ----------------------------------------
// 一括操作の表示を更新
// ----------------------------------------

function updateBulkToolbar() {
  if (!bulkToolbar) return;

  // 削除済みのメモIDは選択から取り除く
  const existingIds = new Set(memos.map((memo) => memo.id));

  [...selectedMemoIds].forEach((id) => {
    if (!existingIds.has(id)) {
      selectedMemoIds.delete(id);
    }
  });

  const count = selectedMemoIds.size;
  const visibleMemos = getVisibleMemos();

  bulkCountLabel.textContent = `${count}件選択中（表示中：${visibleMemos.length}件）`;

  bulkCopyButton.disabled = count === 0;
  deselectAllButton.disabled = count === 0;
  selectVisibleButton.disabled =
    visibleMemos.length === 0 ||
    visibleMemos.every((memo) => selectedMemoIds.has(memo.id));

  [selectVisibleButton, deselectAllButton, bulkCopyButton]
    .forEach((button) => {
      button.style.opacity = button.disabled ? "0.5" : "1";
      button.style.cursor = button.disabled ? "not-allowed" : "pointer";
    });

  bulkToolbar.hidden = memos.length === 0;
}

// ----------------------------------------
// ジャンル選択欄を更新
// ----------------------------------------

function getHistoricalGenres() {
  return [...new Set(
    memos
      .map((memo) => memo.category)
      .filter(
        (category) =>
          typeof category === "string" &&
          category.trim() !== ""
      )
  )];
}

function populateCategorySelects() {
  const historicalGenres = getHistoricalGenres();

  const allGenres = [...new Set([
    ...genres,
    ...historicalGenres
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
      currentFilter === "all" || allGenres.includes(currentFilter)
        ? currentFilter
        : "all";
  }
}

// ----------------------------------------
// ジャンルの追加・削除
// ----------------------------------------

function renderGenres() {
  if (!genreList) return;

  genreList.replaceChildren();

  genres.forEach((genre) => {
    const row = document.createElement("div");
    row.className = "genre-item";

    row.appendChild(
      makeElement("span", genre, "genre-item-name")
    );

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
      makeElement(
        "p",
        "ジャンルがありません。追加してください。",
        "empty-message"
      )
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

  if (newGenreName) {
    newGenreName.value = "";
  }
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
    if (input) {
      input.disabled = !isReading;
    }
  });
}

function getSourceFromForm() {
  return {
    bookTitle: sourceBookTitle
      ? sourceBookTitle.value.trim()
      : "",
    author: sourceAuthor
      ? sourceAuthor.value.trim()
      : "",
    page: sourcePage
      ? sourcePage.value.trim()
      : ""
  };
}

function fillSourceFields(source) {
  if (sourceBookTitle) {
    sourceBookTitle.value = source?.bookTitle || "";
  }

  if (sourceAuthor) {
    sourceAuthor.value = source?.author || "";
  }

  if (sourcePage) {
    sourcePage.value = source?.page || "";
  }

  updateSourceFields();
}

// ----------------------------------------
// メモ一覧
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

    // ------------------------------------
    // メモ選択欄
    // ------------------------------------

    const selectionRow = document.createElement("label");
    selectionRow.className = "memo-selection-row";

    Object.assign(selectionRow.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      minHeight: "44px",
      padding: "6px 2px",
      marginBottom: "6px",
      cursor: "pointer",
      touchAction: "manipulation",
      fontSize: "15px"
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedMemoIds.has(memo.id);
    checkbox.setAttribute(
      "aria-label",
      `「${memo.title}」を一括コピーの対象にする`
    );

    Object.assign(checkbox.style, {
      width: "22px",
      height: "22px",
      minWidth: "22px",
      margin: "0",
      accentColor: "#1769aa",
      cursor: "pointer"
    });

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedMemoIds.add(memo.id);
      } else {
        selectedMemoIds.delete(memo.id);
      }

      updateBulkToolbar();
    });

    const selectionText = makeElement(
      "span",
      selectedMemoIds.has(memo.id)
        ? "一括コピーに選択中"
        : "このメモを選択",
      "memo-selection-text"
    );

    selectionRow.appendChild(checkbox);
    selectionRow.appendChild(selectionText);
    card.appendChild(selectionRow);

    const header = document.createElement("div");
    header.className = "memo-card-header";

    header.appendChild(
      makeElement(
        "span",
        memo.category || "未分類",
        "memo-category-label"
      )
    );

    header.appendChild(
      makeElement(
        "time",
        formatDate(memo.updatedAt || memo.createdAt),
        "memo-date"
      )
    );

    card.appendChild(header);

    card.appendChild(
      makeElement("h3", memo.title, "memo-card-title")
    );

    // 読書ソースを表示
    const source = memo.source || {};

    if (source.bookTitle || source.author || source.page) {
      const sourceBox = document.createElement("div");
      sourceBox.className = "memo-card-source";

      sourceBox.appendChild(
        makeElement("strong", "読書ソース")
      );

      if (source.bookTitle) {
        sourceBox.appendChild(
          makeElement("p", `本のタイトル：${source.bookTitle}`)
        );
      }

      if (source.author) {
        sourceBox.appendChild(
          makeElement("p", `著者名：${source.author}`)
        );
      }

      if (source.page) {
        sourceBox.appendChild(
          makeElement("p", `ページ番号：${source.page}`)
        );
      }

      card.appendChild(sourceBox);
    }

    const original = makeElement(
      "p",
      memo.original,
      "memo-card-original"
    );

    original.style.whiteSpace = "pre-wrap";
    card.appendChild(original);

    // Notion転記状況
    const notionRow = document.createElement("div");
    notionRow.className = "notion-status-row";

    const isNotionDone = memo.notionCopied === true;

    const statusLabel = makeElement(
      "span",
      isNotionDone ? "Notion転記済み" : "Notion未転記",
      `notion-status-label ${isNotionDone ? "is-done" : "is-pending"}`
    );

    notionRow.appendChild(statusLabel);

    const notionButton = makeElement(
      "button",
      isNotionDone ? "未転記に戻す" : "転記済みにする",
      `notion-status-button ${isNotionDone ? "is-done" : "is-pending"}`
    );

    notionButton.type = "button";

    notionButton.addEventListener("click", () => {
      toggleNotionStatus(memo.id);
    });

    notionRow.appendChild(notionButton);
    card.appendChild(notionRow);

    // 編集・コピー・削除ボタン
    const actions = document.createElement("div");
    actions.className = "memo-card-actions";

    const editButton = makeElement(
      "button",
      "編集",
      "memo-edit-button"
    );

    editButton.type = "button";

    editButton.addEventListener("click", () => {
      startEditing(memo.id);
    });

    actions.appendChild(editButton);

    // Notion転記用のコピー
    const copyButton = makeElement(
      "button",
      "Notion転記用にコピー",
      "memo-copy-button"
    );

    copyButton.type = "button";

    copyButton.addEventListener("click", () => {
      copyMemoToNotion(memo.id);
    });

    actions.appendChild(copyButton);

    // ChatGPT用のコピー
    const aiOrganizeButton = makeElement(
      "button",
      "ChatGPTでAI整理",
      "memo-copy-button"
    );

    aiOrganizeButton.type = "button";

    aiOrganizeButton.addEventListener("click", () => {
      copyMemoForChatGPT(memo.id);
    });

    actions.appendChild(aiOrganizeButton);

    // 削除
    const deleteButton = makeElement(
      "button",
      "削除",
      "memo-delete-button"
    );

    deleteButton.type = "button";

    deleteButton.addEventListener("click", () => {
      deleteMemo(memo.id);
    });

    actions.appendChild(deleteButton);

    card.appendChild(actions);
    memoList.appendChild(card);
  });

  updateCounts();
  updateBulkToolbar();
}

// ----------------------------------------
// Notion転記用の文章を作成
// ----------------------------------------

function buildNotionText(memo) {
  return memo.original || "";
}

// ----------------------------------------
// 一括コピー用の文章を作成
// タイトル・ジャンル・本文をまとめる
// ----------------------------------------

function buildBulkNotionText(selectedMemos) {
  return selectedMemos.map((memo, index) => {
    const source = memo.source || {};

    const lines = [
      `【メモ ${index + 1}】`,
      `タイトル：${memo.title || "無題のメモ"}`,
      `ジャンル：${memo.category || "未分類"}`,
      `記録日：${formatDate(memo.updatedAt || memo.createdAt) || "日付不明"}`
    ];

    if (source.bookTitle) {
      lines.push(`本のタイトル：${source.bookTitle}`);
    }

    if (source.author) {
      lines.push(`著者名：${source.author}`);
    }

    if (source.page) {
      lines.push(`ページ番号：${source.page}`);
    }

    lines.push("", "【本文】", memo.original || "");

    return lines.join("\n");
  }).join("\n\n----------------------------------------\n\n");
}

// ----------------------------------------
// 選択したメモをまとめてコピー
// ----------------------------------------

async function copySelectedMemos() {
  const selectedMemos = memos.filter((memo) =>
    selectedMemoIds.has(memo.id)
  );

  if (selectedMemos.length === 0) {
    alert("コピーするメモを選択してください。");
    return;
  }

  const text = buildBulkNotionText(selectedMemos);
  const succeeded = await copyText(text);

  if (succeeded) {
    alert(
      `${selectedMemos.length}件のメモをまとめてコピーしました！\n\n` +
      "Notionを開いて、貼り付けてください。"
    );
  } else {
    showCopyFailure(text);
  }
}

// ----------------------------------------
// クリップボードにコピー
// iPhoneなどで使えない場合は代替処理
// ----------------------------------------

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn("Clipboard APIでのコピーに失敗しました。", error);
  }

  // Clipboard APIが使えない場合の代替処理
  const textarea = document.createElement("textarea");
  textarea.value = text;

  Object.assign(textarea.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    opacity: "0",
    fontSize: "16px"
  });

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (error) {
    console.error("代替コピーにも失敗しました。", error);
  }

  textarea.remove();

  return copied;
}

function showCopyFailure(text) {
  // 自動コピーに失敗した場合、手動でコピーできる画面を表示
  const overlay = document.createElement("div");

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "99999",
    background: "rgba(0, 0, 0, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    boxSizing: "border-box"
  });

  const panel = document.createElement("div");

  Object.assign(panel.style, {
    width: "100%",
    maxWidth: "600px",
    maxHeight: "85vh",
    overflow: "auto",
    background: "#ffffff",
    color: "#222222",
    borderRadius: "12px",
    padding: "16px",
    boxSizing: "border-box"
  });

  const heading = makeElement(
    "h2",
    "コピーできませんでした"
  );

  heading.style.fontSize = "18px";
  panel.appendChild(heading);

  const explanation = makeElement(
    "p",
    "下の文章を長押しして選択し、コピーしてください。"
  );

  panel.appendChild(explanation);

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-label", "コピーするメモの文章");

  Object.assign(textarea.style, {
    width: "100%",
    minHeight: "220px",
    fontSize: "16px",
    lineHeight: "1.5",
    padding: "10px",
    boxSizing: "border-box"
  });

  panel.appendChild(textarea);

  const closeButton = makeElement("button", "閉じる");

  Object.assign(closeButton.style, {
    width: "100%",
    minHeight: "44px",
    marginTop: "12px",
    padding: "10px",
    fontSize: "16px"
  });

  closeButton.addEventListener("click", () => {
    overlay.remove();
  });

  panel.appendChild(closeButton);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  textarea.focus();
  textarea.select();
}

// ----------------------------------------
// ChatGPTでAI整理するための指示文を作成
// ----------------------------------------

function buildChatGPTOrganizationPrompt(memo) {
  const source = memo.source || {};

  const memoDate =
    formatDate(memo.updatedAt || memo.createdAt) || "日付不明";

  const sourceLines = [
    source.bookTitle
      ? `本のタイトル：${source.bookTitle}`
      : "",
    source.author
      ? `著者名：${source.author}`
      : "",
    source.page
      ? `ページ番号：${source.page}`
      : ""
  ].filter(Boolean);

  return `あなたは競馬の記録を整理するアシスタントです。
以下のメモを、元の意味を変えずに整理してください。

【整理ルール】
1. メモの内容を短く要約する
2. 確認できた事実を整理する
3. 自分の気づき・考察を整理する
4. 予想や仮説を整理する
5. 今後、確認したいことを列挙する
6. メモに書かれていない事実は追加しない
7. 根拠が不足している場合は、推測と明記する
8. 競馬の専門用語や馬名などは、意味を変えずに扱う
9. 内容がない項目は、無理に埋めず「記載なし」とする

【出力形式】
■ 要約
■ 事実
■ 気づき・考察
■ 仮説
■ 今後の確認事項
■ 関連するジャンル

【メモ情報】
タイトル：${memo.title || "無題のメモ"}
ジャンル：${memo.category || "未分類"}
記録日：${memoDate}
${sourceLines.length ? `読書ソース：\n${sourceLines.join("\n")}` : ""}

【競馬メモ本文】
${memo.original || ""}`;
}

// ----------------------------------------
// ChatGPT用の指示文とメモをコピー
// ----------------------------------------

async function copyMemoForChatGPT(id) {
  const memo = memos.find((item) => item.id === id);

  if (!memo) {
    alert("整理するメモが見つかりません。");
    return;
  }

  const text = buildChatGPTOrganizationPrompt(memo);
  const succeeded = await copyText(text);

  if (succeeded) {
    alert(
      "ChatGPTでAI整理するための文章をコピーしました！\n" +
      "ChatGPTを開き、新しいチャットに貼り付けてください。"
    );
  } else {
    showCopyFailure(text);
  }
}

// ----------------------------------------
// Notion転記用の文章をコピー
// ----------------------------------------

async function copyMemoToNotion(id) {
  const memo = memos.find((item) => item.id === id);

  if (!memo) {
    alert("コピーするメモが見つかりません。");
    return;
  }

  const text = buildNotionText(memo);
  const succeeded = await copyText(text);

  if (succeeded) {
    alert(
      "Notion転記用の文章をコピーしました！\n" +
      "Notionで貼り付けてください。"
    );
  } else {
    showCopyFailure(text);
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
      notionCopiedAt: nextStatus
        ? new Date().toISOString()
        : null
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
// 入力フォーム
// ----------------------------------------

function resetEditor() {
  editingMemoId = null;

  if (memoForm) {
    memoForm.reset();
  }

  fillSourceFields(null);

  if (editorTitle) {
    editorTitle.textContent = "新しいメモ";
  }

  if (editorSection) {
    editorSection.hidden = true;
  }

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

  if (memoTitle) {
    memoTitle.focus();
  }
}

function startEditing(id) {
  const memo = memos.find((item) => item.id === id);

  if (!memo) return;

  editingMemoId = id;

  populateCategorySelects();

  if (memoCategory) {
    memoCategory.value = memo.category || "その他";
  }

  if (memoTitle) {
    memoTitle.value = memo.title;
  }

  if (memoOriginal) {
    memoOriginal.value = memo.original;
  }

  fillSourceFields(memo.source || null);

  if (editorTitle) {
    editorTitle.textContent = "メモを編集";
  }

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

  if (!confirm(`「${memo.title}」を削除しますか？`)) {
    return;
  }

  const previousMemos = memos;
  memos = memos.filter((item) => item.id !== id);
  selectedMemoIds.delete(id);

  if (!saveMemos()) {
    memos = previousMemos;
    return;
  }

  if (editingMemoId === id) {
    resetEditor();
  }

  renderMemos();
}

// ----------------------------------------
// メモの追加・更新
// ----------------------------------------

if (memoForm) {
  memoForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const category = memoCategory
      ? memoCategory.value
      : "その他";

    const title = memoTitle
      ? memoTitle.value.trim()
      : "";

    const original = memoOriginal
      ? memoOriginal.value
      : "";

    const finalTitle = title || "無題のメモ";

    if (!original.trim()) {
      alert("メモの内容を入力してください。");

      if (memoOriginal) {
        memoOriginal.focus();
      }

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

    if (newGenreName) {
      addGenre(newGenreName.value);
    }
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

createBulkToolbar();
populateCategorySelects();
renderGenres();
updateSourceFields();
renderMemos();
