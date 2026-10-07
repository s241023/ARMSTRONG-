// main.js — ログ解析画面。キー配置・指・定数は common.js を参照する
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');
const nextPageBtn = document.getElementById('nextPageBtn');

let maxDistanceResults = null;                        // ホームごとの最大距離
let lastCalculatedScores = loadJSON(STORAGE.scores, null);

// 現在の配列(保存済み swapMap を反映)。基準の KEY_LAYOUT は変更せずコピーを使う
const ALL_KEYS_LAYOUT = applySwapToKeys(KEY_LAYOUT, loadJSON(STORAGE.latest, null)?.swapMap);

// ログ上のキー名 → 配列上のキー名
const LOG_KEY_ALIASES = { '左角括弧': '[', '右角括弧': ']', 'コロン': ':', 'コンマ': ',' };

window.addEventListener('DOMContentLoaded', () => {
  const settings = getSettings();
  if (!settings) {
    alert('設定が見つかりません。初期設定画面に戻ります。');
    window.location.href = 'index.html';
    return;
  }

  const coords = settings.homeCoords ?? [];
  document.getElementById('display-hands').textContent = HAND_LABELS[settings.usehands] ?? '不明';
  document.getElementById('display-coords').textContent = coords.length ? coords.join(' , ') : '未設定';
  if (coords.length) maxDistanceResults = calculateMaxDistances(coords, settings.fingerMapping ?? {});

  nextPageBtn.addEventListener('click', () => { window.location.href = 'result.html'; });
  document.getElementById('changeSettingsBtn').addEventListener('click', () => { window.location.href = 'index.html'; });
  document.getElementById('copyTableBtn').addEventListener('click', copyTableToClipboard);

  document.getElementById('resetQwertyBtn').addEventListener('click', () => {
    if (!confirm('現在の配列設定を初期QWERTY配列に戻しますか？\n（現在のカスタム配列は履歴に保存されます）')) return;
    commitLayout({});                                  // 履歴へ退避し、QWERTYを最新に(スコアも無効化)
    alert('初期配列(QWERTY)にリセットしました。');
    location.reload();
  });
});

// ファイル選択 → 解析ボタンを有効化(前回の結果へは進めないようにする)
fileInput.addEventListener('change', () => {
  sendBtn.disabled = fileInput.files.length === 0;
  nextPageBtn.style.display = 'none';
});

sendBtn.addEventListener('click', () => {
  const file = fileInput.files[0];
  if (!file) { alert('ファイルを選択してください。'); return; }
  if (!file.name.toLowerCase().endsWith('.keylog2')) {
    alert('許可されていないファイル形式です。.keylog2 を選択してください。');
    fileInput.value = '';
    sendBtn.disabled = true;
    return;
  }
  if (!maxDistanceResults) { alert('ホームポジションが設定されていません。設定を確認してください。'); return; }

  const fail = (message) => {
    setStatus('');
    sendBtn.disabled = false;
    lastCalculatedScores = null;
    localStorage.removeItem(STORAGE.scores);
    alert(message);
  };

  sendBtn.disabled = true;
  setStatus('解析中…');

  const reader = new FileReader();
  reader.onerror = () => fail('ファイルを読み込めませんでした。');
  reader.onload = (e) => {
    const parsed = parseKeylog(String(e.target.result));
    if (!parsed) { fail('ログの形式を読み取れませんでした。.keylog2 ファイルを確認してください。'); return; }

    lastCalculatedScores = calculateKeyScores(parsed.total, parsed.normalKeys, ALL_KEYS_LAYOUT, maxDistanceResults);
    saveJSON(STORAGE.scores, lastCalculatedScores);
    sendBtn.disabled = false;
    setStatus('解析完了！', 3000);
    nextPageBtn.style.display = 'inline-block';
  };
  reader.readAsText(file);
});

// 解析状況の表示(解析ボタンの右隣)
function setStatus(text, hideAfterMs) {
  let el = document.getElementById('analysisStatus');
  if (!el) {
    el = document.createElement('span');
    el.id = 'analysisStatus';
    el.className = 'analysis-status';
    sendBtn.after(el);
  }
  el.textContent = text;
  el.style.display = text ? 'inline' : 'none';
  if (hideAfterMs) setTimeout(() => { el.style.display = 'none'; }, hideAfterMs);
}

// keylog2 のテキストから総押下数と通常キーの回数を取り出す(失敗時は null)
function parseKeylog(text) {
  const total = text.match(/総キー押下イベント数:\s*(\d+)/);
  const blocks = text.match(/\[\{([\s\S]*?)\}\]/g);
  if (!total || !blocks || blocks.length < 3) return null;
  const normalKeys = {};
  for (const m of blocks[0].matchAll(/([^,\s{}[\]]+):\s*(\d+)/g)) normalKeys[m[1]] = parseInt(m[2], 10);
  return Object.keys(normalKeys).length ? { total: parseInt(total[1], 10), normalKeys } : null;
}

// key に最も近いホームと、その距離
function nearestHome(homes, key) {
  let best = null, bestDist = Infinity;
  for (const home of homes) {
    const d = Math.hypot(key.x - home.x, key.y - home.y);
    if (d < bestDist) { bestDist = d; best = home; }
  }
  return { home: best, distance: bestDist };
}

// ホームごとの「担当キーのうち最も遠いキーまでの距離」(丸めない)
function calculateMaxDistances(homeCoords, fingerMapping) {
  const homes = homeCoords.map(coordStr => {
    const key = ALL_KEYS_LAYOUT.find(k => k.coordStr === coordStr);
    const [x, y] = key ? [key.x, key.y] : JSON.parse(coordStr);
    return { coordStr, x, y, fingerId: fingerMapping[coordStr] || 'unknown', maxDistance: 0, farthestKey: key?.name ?? coordStr };
  });
  ALL_KEYS_LAYOUT.forEach(key => {
    const { home, distance } = nearestHome(homes, key);
    if (home && distance > home.maxDistance) { home.maxDistance = distance; home.farthestKey = key.name; }
  });
  return homes;
}

// 各キーの負担スコア = 指の負担 P(k) + 距離/最大距離
function calculateKeyScores(totalKeyCount, normalKeys, keys, homes) {
  const counts = new Map();                            // 同名キーは最初の1件を採用(従来どおり)
  for (const [logKey, count] of Object.entries(normalKeys)) {
    const raw = logKey.trim();
    const name = (LOG_KEY_ALIASES[raw] ?? raw).toLowerCase();
    if (!counts.has(name)) counts.set(name, count);
  }

  const scores = keys.map(key => {
    const pressCount = counts.get(key.name.toLowerCase().trim()) ?? 0;
    const freq = totalKeyCount > 0 ? pressCount / totalKeyCount : 0;
    const { home, distance } = nearestHome(homes, key);
    const penalty = FINGER_PENALTY[home.fingerId] ?? FINGER_PENALTY.unknown;
    const distanceRatio = home.maxDistance > 0 ? distance / home.maxDistance : 0;
    const cost = penalty + distanceRatio;
    return {
      キー: key.name,
      '負担スコア(物理)': cost.toFixed(4),
      '使用頻度F(k)': (freq * 100).toFixed(2) + '%',
      '総合影響度': (cost * freq).toFixed(6),
      '指負担P(k)': penalty.toFixed(3),
      '距離/最大距離': distanceRatio.toFixed(3),
      押下回数: pressCount,
      担当指: fingerLabel(home.fingerId)
    };
  });
  return scores.sort((a, b) => parseFloat(b['負担スコア(物理)']) - parseFloat(a['負担スコア(物理)']));
}

// 隠しコマンド "score" で詳細スコア表を表示
onSecretCommand('score', showScoreCard);

function tableRow(tag, cells) {
  const tr = document.createElement('tr');
  cells.forEach(text => { const el = document.createElement(tag); el.textContent = text; tr.appendChild(el); });
  return tr;
}

function showScoreCard() {
  if (!lastCalculatedScores) {
    alert('まだスコアが計算されていません。ファイルを解析してからコマンドを打ってください。');
    return;
  }
  document.getElementById('score-thead').replaceChildren(tableRow('th', SCORE_COLUMNS));
  document.getElementById('score-tbody').replaceChildren(
    ...lastCalculatedScores.map(row => tableRow('td', SCORE_COLUMNS.map(c => row[c])))
  );
  const area = document.getElementById('score-result-area');
  area.style.display = 'block';
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function copyTableToClipboard() {
  if (!lastCalculatedScores?.length) return;
  const clean = (v) => String(v ?? '').replace(/[\t\n\r]/g, ' ');
  const tsv = [SCORE_COLUMNS, ...lastCalculatedScores.map(r => SCORE_COLUMNS.map(c => r[c]))]
    .map(cells => cells.map(clean).join('\t')).join('\n') + '\n';
  try {
    await navigator.clipboard.writeText(tsv);
  } catch (err) {
    console.error('コピーに失敗しました', err);
    alert('クリップボードへのコピーに失敗しました。');
  }
}
