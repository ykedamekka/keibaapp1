
"use strict";

// ========================================
// 競馬メモアプリ
// ========================================

// HTMLの要素を取得
const memoForm = document.getElementById("memo-form");
const memoCategory = document.getElementById("memo-category");
const memoTitle = document.getElementById("memo-title");
const memoOriginal = document.getElementById("memo-original");
const memoSearch = document.getElementById("memo-search");
const categoryFilter = document.getElementById("category-filter");
const memoList = document.getElementById("memo-list");

const memoCount = document.getElementById("memo-count");
const pendingCount = document.getElementById("pending-count");

const editorSection = document.getElementById("editor-section");
const editorTitle = document.getElementById("editor-title");
const newMemoButton = document.getElementById("new-memo-button");
const cancelEditButton = document.getElementById("cancel-edit-button");

const STORAGE_KEY = "keiba-memo-app-memos";

// メモのデータを読み込む
function loadMemos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (memo) =>
        memo &&
        typeof memo.id === "string" &&
        typeof memo.title === "string" &&
        typeof memo.original === "string"
    );
  } catch (error) {
    console.error("メモの読み込みに失敗しました。", error);
    return [];
  }
}

let memos = loadMemos();
let editingMemoId = null;

// メモを保存する
function saveMemos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    return true;
  } catch (error) {
    console.error("メモの保存に失敗しました。", error);
    alert("メモを保存できませんでした。ブラウザの保存容量などをご確認ください。");
    return false;
  }
}

// HTMLに安全に文字を表示する
function createTextElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  return element;
}

// 日付を表示用に整える
function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString);

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

// メモ一覧を表示する
function renderMemos() {
  if (!memoList) return;

  const keyword = memoSearch
    ? memoSearch.value.trim().toLowerCase()
    : "";

  const selectedCategory = categoryFilter
    ? categoryFilter.value
    : "all";

  const filteredMemos = memos.filter((memo) => {
    const searchableText = [
      memo.title,
      memo.category,
      memo.original
    ].join(" ").toLowerCase();

    const matchesKeyword = searchableText.includes(keyword);

    const matchesCategory =
      !selectedCategory ||
      selectedCategory === "all" ||
      selectedCategory === "すべて" ||
      memo.category === selectedCategory;

    return matchesKeyword && matchesCategory;
  });

  memoList.replaceChildren();

  if (filteredMemos.length === 0) {
    memoList.appendChild(
      createTextElement(
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

    const header = document.createElement("div");
    header.className = "memo-card-header";

    header.appendChild(
      createTextElement("span", memo.category || "未分類", "memo-category-label")
    );

    header.appendChild(
      createTextElement("time", formatDate(memo.updatedAt || memo.createdAt), "memo-date")
    );

    card.appendChild(header);

    card.appendChild(
      createTextElement("h3", memo.title, "memo-card-title")
    );

    const original = createTextElement(
      "p",
      memo.original,
      "memo-card-original"
    );

    original.style.whiteSpace = "pre-wrap";
    card.appendChild(original);

    const actions = document.createElement("div");
    actions.className = "memo-card-actions";

    const editButton = createTextElement(
      "button",
      "編集",
      "memo-edit-button"
    );

    editButton.type = "button";
    editButton.addEventListener("click", () => {
      startEditing(memo.id);
    });

    actions.appendChild(editButton);

    const deleteButton = createTextElement(
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
}

// 件数を更新する
function updateCounts() {
  if (memoCount) {
    memoCount.textContent = String(memos.length);
  }

  if (pendingCount) {
    // AI整理機能は準備中のため、全メモを未整理として数える
    pendingCount.textContent = String(
      memos.filter((memo) => memo.status !== "organized").length
    );
  }
}

// 入力フォームを新規作成モードにする
function resetEditor() {
  editingMemoId = null;

  if (memoForm) {
    memoForm.reset();
  }

  if (editorTitle) {
    editorTitle.textContent = "新しいメモ";
  }

  if (editorSection) {
    editorSection.hidden = true;
  }
}

// 新規メモ作成画面を開く
function openNewMemoEditor() {
  resetEditor();

  if (editorTitle) {
    editorTitle.textContent = "新しいメモ";
  }

  if (editorSection) {
    editorSection.hidden = false;
    editorSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (memoTitle) {
    memoTitle.focus();
  }
}

// メモを編集する
function startEditing(id) {
  const memo = memos.find((item) => item.id === id);

  if (!memo) return;

  editingMemoId = id;

  if (memoCategory) {
    memoCategory.value = memo.category;
  }

  if (memoTitle) {
    memoTitle.value = memo.title;
  }

  if (memoOriginal) {
    memoOriginal.value = memo.original;
  }

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
}

// メモを削除する
function deleteMemo(id) {
  const memo = memos.find((item) => item.id === id);

  if (!memo) return;

  if (!confirm(`「${memo.title}」を削除しますか？`)) {
    return;
  }

  const previousMemos = memos;
  memos = memos.filter((item) => item.id !== id);

  if (!saveMemos()) {
    memos = previousMemos;
    return;
  }

  if (editingMemoId === id) {
    resetEditor();
  }

  renderMemos();
}

// メモを追加・更新する
if (memoForm) {
  memoForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const category = memoCategory
      ? memoCategory.value
      : "";

    const title = memoTitle
      ? memoTitle.value.trim()
      : "";

    const original = memoOriginal
      ? memoOriginal.value
      : "";

    if (!title) {
      alert("メモのタイトルを入力してください。");
      if (memoTitle) memoTitle.focus();
      return;
    }

    if (!original.trim()) {
      alert("メモの内容を入力してください。");
      if (memoOriginal) memoOriginal.focus();
      return;
    }

    const now = new Date().toISOString();
    const previousMemos = memos;

    if (editingMemoId) {
      memos = memos.map((memo) => {
        if (memo.id !== editingMemoId) {
          return memo;
        }

        return {
          ...memo,
          category,
          title,
          original,
          updatedAt: now
        };
      });
    } else {
      memos.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        category,
        title,
        original,
        createdAt: now,
        updatedAt: now,
        status: "pending"
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

// 新規メモボタン
if (newMemoButton) {
  newMemoButton.addEventListener("click", openNewMemoEditor);
}

// キャンセルボタン
if (cancelEditButton) {
  cancelEditButton.addEventListener("click", resetEditor);
}

// 検索
if (memoSearch) {
  memoSearch.addEventListener("input", renderMemos);
}

// ジャンル絞り込み
if (categoryFilter) {
  categoryFilter.addEventListener("change", renderMemos);
}

// 画面下部のナビゲーション
const navAdd = document.getElementById("nav-add");

if (navAdd) {
  navAdd.addEventListener("click", openNewMemoEditor);
}

const navHome = document.getElementById("nav-home");

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

const navNotes = document.getElementById("nav-notes");

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

// 初期表示
renderMemos();
