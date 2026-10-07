// common.js — 全ページ共通。各ページの JS より先に読み込むこと。
const STORAGE = { settings: 'appSettings', latest: 'latestLayout', history: 'historyLayouts', scores: 'calculatedScores' };
const HISTORY_LIMIT = 50;

// ---------- キー配置(唯一の定義) ----------
// 実機のずれ(数字行 -0.5 / A行 +0.25 / Z行 +0.75 など)を距離に反映するなら、ここ(ROW_OFFSET)だけ変える。
// 変わるのは距離計算用の x だけで、ホーム選択用の座標ID(coordStr)は変わらない。
const ROW_OFFSET = { '-1': 0, 0: 0, 1: 0, 2: 0 };
const LAYOUT_ROWS = [
  { y: -1, keys: [...'1234567890', '-', '^', '¥'] },
  { y: 0, keys: [...'QWERTYUIOP@['] },
  { y: 1, keys: [...'ASDFGHJKL;:]'] },
  { y: 2, keys: [...'ZXCVBNM,./\\'] }
];
const SPACE_KEY = { name: 'Space', isSpace: true, col: 4, y: 3 };

// 全キー(基準・変更しない)。coordStr は [列, 行] の座標ID
const KEY_LAYOUT = [
  ...LAYOUT_ROWS.flatMap(({ y, keys }) => keys.map((name, col) => (
    { name, col, y, x: col + (ROW_OFFSET[y] ?? 0), coordStr: `[${col},${y}]` }))),
  { ...SPACE_KEY, x: SPACE_KEY.col, coordStr: `[${SPACE_KEY.col},${SPACE_KEY.y}]` }
];
// edit / history / result 用の行表示データ(KEY_LAYOUT と同じ定義から作る)
const DEFAULT_ROWS = [...LAYOUT_ROWS.map(({ keys }) => keys.map(name => ({ name }))), [{ name: 'Space', isSpace: true }]];
// 保存済み swapMap を反映した全キーのコピー
const applySwapToKeys = (keys, swap = {}) =>
  keys.map(k => ({ ...k, name: k.isSpace ? k.name : (swap[k.name] ?? k.name) }));

// ---------- 指(名前・順序・負担スコアの唯一の定義) ----------
const FINGER_TYPE_LABEL = { thumb: '親指', index: '人差し指', middle: '中指', ring: '薬指', pinky: '小指' };
const FINGERS = [   // 実際の左→右の並び順
  ['left', 'pinky', 0.297], ['left', 'ring', 0.190], ['left', 'middle', 0.035], ['left', 'index', 0.058], ['left', 'thumb', 0.174],
  ['right', 'thumb', 0.150], ['right', 'index', 0.000], ['right', 'middle', 0.012], ['right', 'ring', 0.192], ['right', 'pinky', 0.301]
].map(([side, type, penalty]) => ({
  id: `${side}-${type}`, side, type, penalty, label: (side === 'left' ? '左' : '右') + FINGER_TYPE_LABEL[type]
}));
const fingersOf = (side) => FINGERS.filter(f => f.side === side);
const fingerLabel = (id) => FINGERS.find(f => f.id === id)?.label ?? id;
const FINGER_PENALTY = { ...Object.fromEntries(FINGERS.map(f => [f.id, f.penalty])), unknown: 0.150 };

// ---------- 表示用ラベル ----------
const HAND_LABELS = { right: '右手のみ', left: '左手のみ', 'r&l': '両手' };
const SCORE_COLUMNS = ['キー', '負担スコア(物理)', '使用頻度F(k)', '総合影響度', '指負担P(k)', '距離/最大距離', '押下回数', '担当指'];

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

// 設定の取得。旧バージョンで保存された Space の座標 [4,4] を [4,3] へ移行する
function getSettings() {
  const s = loadJSON(STORAGE.settings, null);
  if (!s) return null;
  if (Array.isArray(s.homeCoords) && s.homeCoords.includes('[4,4]')) {
    const mv = (c) => (c === '[4,4]' ? '[4,3]' : c);
    s.homeCoords = s.homeCoords.map(mv);
    s.fingerMapping = Object.fromEntries(Object.entries(s.fingerMapping || {}).map(([k, v]) => [mv(k), v]));
    saveJSON(STORAGE.settings, s);
    localStorage.removeItem(STORAGE.scores);
  }
  return s;
}

// 隠しコマンド(例: 'score')を入力したら callback を呼ぶ。IME変換中・修飾キー・長押しは無視
function onSecretCommand(word, callback) {
  let buf = '';
  document.addEventListener('keydown', (e) => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.repeat || !/^[a-zA-Z]$/.test(e.key)) return;
    buf = (buf + e.key.toLowerCase()).slice(-word.length);
    if (buf === word) { buf = ''; callback(); }
  });
}
