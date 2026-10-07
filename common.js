// common.js — 全ページ共通。各ページの JS より先に読み込むこと。
const STORAGE = { settings: 'appSettings', latest: 'latestLayout', history: 'historyLayouts', scores: 'calculatedScores' };
const HISTORY_LIMIT = 50;

// 標準QWERTY(JIS)の配列定義。以前は edit / history / result の3ファイルに重複していた
const DEFAULT_ROWS = [
  [...'1234567890'].map(name => ({ name })).concat([{ name: '-' }, { name: '^' }, { name: '¥' }]),
  [...'QWERTYUIOP@['].map(name => ({ name })),
  [...'ASDFGHJKL;:]'].map(name => ({ name })),
  [...'ZXCVBNM,./\\'].map(name => ({ name })),
  [{ name: 'Space', isSpace: true }]
];

// 入れ替え不可のキー(数字キー + Space)。文字列でもキーオブジェクトでも渡せる
const EXCLUDED_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Space', 'space'];
const isExcludedKey = (k) => k.isSpace === true || EXCLUDED_KEYS.includes(String(k.name ?? k).trim());

// localStorage の読み書き(壊れたデータでも画面が止まらない)
function loadJSON(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch (e) {
    console.error(`${key} の読み込みに失敗しました`, e);
    return fallback;
  }
}
const saveJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

// swapMap(標準配列 → 現在の配列)を標準配列に適用した配列を返す
const applySwapMap = (rows, swap = {}) =>
  rows.map(row => row.map(k => (k.isSpace ? { ...k } : { ...k, name: swap[k.name] ?? k.name })));

// 現在の配列(rows)を標準配列と位置で比較して swapMap を作る
function buildSwapMap(rows) {
  const map = {};
  DEFAULT_ROWS.forEach((row, r) => row.forEach((k, c) => {
    if (!k.isSpace && k.name !== rows[r][c].name) map[k.name] = rows[r][c].name;
  }));
  return map;
}

const sameSwap = (a = {}, b = {}) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k]);
};

// 配列を保存する唯一の入口:旧配列を履歴へ退避 → 最新を更新 → 古いスコアを破棄
function commitLayout(swapMap) {
  const prev = loadJSON(STORAGE.latest, null);
  if (sameSwap(prev?.swapMap, swapMap)) return prev;   // 変更なしなら何もしない(履歴を汚さない)
  if (prev && Object.keys(prev.swapMap || {}).length > 0) {
    saveJSON(STORAGE.history, [prev, ...loadJSON(STORAGE.history, [])].slice(0, HISTORY_LIMIT));
  }
  const layout = {
    id: Date.now(),
    date: new Date().toLocaleString('ja-JP'),
    createdAt: new Date().toISOString(),
    settings: loadJSON(STORAGE.settings, {}),
    swapMap
  };
  saveJSON(STORAGE.latest, layout);
  localStorage.removeItem(STORAGE.scores);             // 配列が変わったので古いスコアは無効
  return layout;
}
