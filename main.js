// 要素の取得
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');
const displayHands = document.getElementById('display-hands');
const displayCoords = document.getElementById('display-coords');
const changeSettingsBtn = document.getElementById('changeSettingsBtn');

// 🟢 最大距離データを保持する独立した変数
let maxDistanceResults = null;

// 🟢 スコア結果を保持する変数と、隠しコマンド用の変数
let lastCalculatedScores = null;
let secretCommand = '';

// 🟢 どこからでも参照できるようにキー配置データを一番上で定義
const ALL_KEYS_LAYOUT = [
  { coordStr: '[0,-1]', name: '1', x: 0, y: -1 }, { coordStr: '[1,-1]', name: '2', x: 1, y: -1 }, { coordStr: '[2,-1]', name: '3', x: 2, y: -1 }, { coordStr: '[3,-1]', name: '4', x: 3, y: -1 }, { coordStr: '[4,-1]', name: '5', x: 4, y: -1 }, { coordStr: '[5,-1]', name: '6', x: 5, y: -1 }, { coordStr: '[7,-1]', name: '7', x: 7, y: -1 }, { coordStr: '[8,-1]', name: '8', x: 8, y: -1 }, { coordStr: '[9,-1]', name: '9', x: 9, y: -1 }, { coordStr: '[10,-1]', name: '0', x: 10, y: -1 }, { coordStr: '[11,-1]', name: '-', x: 11, y: -1 }, { coordStr: '[12,-1]', name: '^', x: 12, y: -1 }, { coordStr: '[13,-1]', name: '¥', x: 13, y: -1 },
  { coordStr: '[0,0]', name: 'Q', x: 0, y: 0 }, { coordStr: '[1,0]', name: 'W', x: 1, y: 0 }, { coordStr: '[2,0]', name: 'E', x: 2, y: 0 }, { coordStr: '[3,0]', name: 'R', x: 3, y: 0 }, { coordStr: '[4,0]', name: 'T', x: 4, y: 0 }, { coordStr: '[5,0]', name: 'Y', x: 5, y: 0 }, { coordStr: '[6,0]', name: 'U', x: 6, y: 0 }, { coordStr: '[7,0]', name: 'I', x: 7, y: 0 }, { coordStr: '[8,0]', name: 'O', x: 8, y: 0 }, { coordStr: '[9,0]', name: 'P', x: 9, y: 0 }, { coordStr: '[10,0]', name: '@', x: 10, y: 0 }, { coordStr: '[11,0]', name: '[', x: 11, y: 0 },
  { coordStr: '[0,1]', name: 'A', x: 0, y: 1 }, { coordStr: '[1,1]', name: 'S', x: 1, y: 1 }, { coordStr: '[2,1]', name: 'D', x: 2, y: 1 }, { coordStr: '[3,1]', name: 'F', x: 3, y: 1 }, { coordStr: '[4,1]', name: 'G', x: 4, y: 1 }, { coordStr: '[5,1]', name: 'H', x: 5, y: 1 }, { coordStr: '[6,1]', name: 'J', x: 6, y: 1 }, { coordStr: '[7,1]', name: 'K', x: 7, y: 1 }, { coordStr: '[8,1]', name: 'L', x: 8, y: 1 }, { coordStr: '[9,1]', name: ';', x: 9, y: 1 }, { coordStr: '[10,1]', name: ':', x: 10, y: 1 }, { coordStr: '[11,1]', name: ']', x: 11, y: 1 },
  { coordStr: '[0,2]', name: 'Z', x: 0, y: 2 }, { coordStr: '[1,2]', name: 'X', x: 1, y: 2 }, { coordStr: '[2,2]', name: 'C', x: 2, y: 2 }, { coordStr: '[3,2]', name: 'V', x: 3, y: 2 }, { coordStr: '[4,2]', name: 'B', x: 4, y: 2 }, { coordStr: '[5,2]', name: 'N', x: 5, y: 2 }, { coordStr: '[6,2]', name: 'M', x: 6, y: 2 }, { coordStr: '[7,2]', name: ',', x: 7, y: 2 }, { coordStr: '[8,2]', name: '.', x: 8, y: 2 }, { coordStr: '[9,2]', name: '/', x: 9, y: 2 }, { coordStr: '[10,2]', name: '\\', x: 10, y: 2 },
  { coordStr: '[4,4]', name: 'Space', x: 4, y: 4 }
];

// ページ読み込み時にローカルストレージの設定を取得して表示する
window.addEventListener('DOMContentLoaded', () => {
  const savedData = localStorage.getItem('appSettings');
  
  if (savedData) {
    const settings = JSON.parse(savedData);
    
    // 使用する手の表示変換
    let handsText = '不明';
    if (settings.usehands === 'right') handsText = '右手のみ';
    if (settings.usehands === 'left') handsText = '左手のみ';
    if (settings.usehands === 'r&l') handsText = '両手';
    
    displayHands.textContent = handsText;
    
  // 座標の表示と最遠キーの計算
    if (settings.homeCoords && settings.homeCoords.length > 0) {
      displayCoords.textContent = settings.homeCoords.join(' , ');

      // 🟢 ホームポジションから各指の「現実的に担当する最遠キー」と距離を計算し、独立変数に保存
      maxDistanceResults = calculateMaxDistances(settings.homeCoords, settings.fingerMapping || {});
      
      // コンソールに出力
      console.log('=== 各ホームポジションからの最遠キー計算結果 ===');
      console.table(maxDistanceResults);

      // 保存するためのデータ形式
      const dataToSave = {
        calculatedAt: new Date().toISOString(),
        distanceResults: maxDistanceResults
      };
      
      // ローカルストレージに保存
      localStorage.setItem('maxDistanceResults', JSON.stringify(dataToSave));

    } else {
      displayCoords.textContent = '未設定';
    }
  } else {
    // もし設定データがないのに直接このページに来てしまったら、設定画面に戻す
    alert('設定が見つかりません。初期設定画面に戻ります。');
    window.location.href = 'index.html';
  }
});

// ファイルが選択されたら「送信ボタン」を有効化する
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    sendBtn.disabled = false;
  } else {
    sendBtn.disabled = true;
  }
});

sendBtn.addEventListener('click', () => {
  const file = fileInput.files[0];
  
  if (file) {
    const allowedExtensions = ['.keylog2'];
    const fileName = file.name.toLowerCase();
    const isValid = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      alert('許可されていないファイル形式です。.keylog2 を選択してください。');
      fileInput.value = ''; 
      return; 
    }

    // --- 1. UIの更新：ボタンを無効化し、プログレスバーを表示する ---
    sendBtn.disabled = true; // 送信ボタンを押せなくする
    
    // プログレスバー（読み込みバー）の要素を取得、無ければ自動作成
    let progressBar = document.getElementById('loadingBar');
    if (!progressBar) {
      progressBar = document.createElement('progress');
      progressBar.id = 'loadingBar';
      progressBar.max = 100; // 最大値
      progressBar.value = 10; // 初期値
      progressBar.style.marginLeft = '10px';
      // 送信ボタンのすぐ後ろに追加
      sendBtn.parentNode.insertBefore(progressBar, sendBtn.nextSibling);
    }
    progressBar.style.display = 'inline-block';
    progressBar.value = 30; // ちょっとだけ進めておく

    // --- 2. ファイルの読み込みと解析処理 ---
    const reader = new FileReader();

    reader.onload = function(e) {
      progressBar.value = 70; // 読み込み完了時点でバーを進める
      
      const text = e.target.result;
      
      // 抽出用の変数を用意
      let totalKeyCount = 0;
      let normalKeys = {};
      let specialKeys = {};
      let shortcutKeys = {};

      // ① 「総キー押下イベント数」を取得
      const totalMatch = text.match(/総キー押下イベント数:\s*(\d+)/);
      if (totalMatch) {
        totalKeyCount = parseInt(totalMatch[1], 10);
      }

      // ② [{ ... }] のブロックを3つ抽出（改行が含まれていても読み込めるように強化）
      const arrayMatches = text.match(/\[\{([\s\S]*?)\}\]/g);

      if (arrayMatches && arrayMatches.length >= 3) {
        // "キー名: 回数" の文字列をオブジェクト(辞書型)に変換する関数
        const parseBlock = (blockStr) => {
          const obj = {};
          // 正規表現で「カンマやスペース以外の文字」と「数字」のペアを探す
          const regex = /([^,\s{}[\]]+):\s*(\d+)/g;
          let m;
          while ((m = regex.exec(blockStr)) !== null) {
            obj[m[1]] = parseInt(m[2], 10);
          }
          return obj;
        };

        // それぞれのブロックをパースして変数に格納
        normalKeys = parseBlock(arrayMatches[0]);
        specialKeys = parseBlock(arrayMatches[1]);
        shortcutKeys = parseBlock(arrayMatches[2]);
      }

      progressBar.value = 100; // 解析完了でバーをMAXに

      // --- 3. コンソールへ結果を出力 ---
      console.log('=== Keylog2 解析結果 ===');
      console.log('合計のキーを押した数:', totalKeyCount);
      console.log('通常キー:', normalKeys);
      console.log('特殊キー:', specialKeys);
      console.log('ショートカット:', shortcutKeys);

      // --- 4. 処理完了後の後片付け（1秒後にバーを消してボタンを戻す） ---
      setTimeout(() => {
        progressBar.style.display = 'none';
        sendBtn.disabled = false;
        alert('ファイルの解析が完了しました！コンソールを確認してください。');
      }, 500);
      // --- 3. コンソールへ結果を出力 ---
      console.log('=== Keylog2 解析結果 ===');
      console.log('合計のキーを押した数:', totalKeyCount);
      console.log('通常キー:', normalKeys);
      console.log('特殊キー:', specialKeys);
      console.log('ショートカット:', shortcutKeys);

// 🟢 window.allKeysConfig ではなく、一番上で定義した ALL_KEYS_LAYOUT を使う
      if (maxDistanceResults && ALL_KEYS_LAYOUT) {
        const replacementScores = calculateKeyScores(totalKeyCount, normalKeys, ALL_KEYS_LAYOUT, maxDistanceResults);
        
        // 🟢 隠しコマンド表示用に結果を保存
        lastCalculatedScores = replacementScores; 
        
        console.log('=== 🔄 キー入れ替え推奨度スコア S(k) ===');
        console.table(replacementScores);
      } else {
        console.warn('最大距離データが不足しているためスコア計算をスキップしました。一度ページをリロードしてホームポジションを設定し直してください。');
      }

      // --- 4. 処理完了後の後片付け（1秒後にバーを消してボタンを戻す） ---
    };

    // テキストとしてファイルを読み込む
    reader.readAsText(file);
    
  } else {
    alert('ファイルを選択してください。');
  }
});

// 設定変更ボタンの処理（index.htmlに戻る）
changeSettingsBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// 🟢 ホームポジションごとの最遠キーおよび距離を計算する関数
function calculateMaxDistances(homeCoords, fingerMapping) {
  const fingerNames = {
    'left-pinky': '左小指', 'left-ring': '左薬指', 'left-middle': '左中指', 'left-index': '左人差', 'left-thumb': '左親指',
    'right-thumb': '右親指', 'right-index': '右人差', 'right-middle': '右中指', 'right-ring': '右薬指', 'right-pinky': '右小指'
  };

  // 🟢 一番上で定義した共通データを使用する
  const allKeys = ALL_KEYS_LAYOUT;

  // 1. ホームポジションの情報を整理
  const homes = homeCoords.map(coordStr => {
    const [x, y] = JSON.parse(coordStr);
    const fingerId = fingerMapping[coordStr] || 'unknown';
    const targetKey = allKeys.find(k => k.coordStr === coordStr);
    const keyName = targetKey ? targetKey.name : coordStr;

    return {
      coordStr,
      x,
      y,
      fingerId,
      fingerName: fingerNames[fingerId] || fingerId,
      homeKeyName: keyName,
      maxDistance: 0,
      farthestKey: keyName,
      farthestCoord: coordStr
    };
  });

  // 2. すべてのキーに対し、最も近いホームポジションを判定して距離を更新
  allKeys.forEach(keyObj => {
    let minDistance = Infinity;
    let closestHome = null;

    homes.forEach(home => {
      // 直線距離の計算
      const dist = Math.sqrt(Math.pow(keyObj.x - home.x, 2) + Math.pow(keyObj.y - home.y, 2));
      if (dist < minDistance) {
        minDistance = dist;
        closestHome = home;
      }
    });

    // 担当ホームポジションの「最遠記録」を更新
    if (closestHome && minDistance > closestHome.maxDistance) {
      closestHome.maxDistance = Math.round(minDistance * 100) / 100;
      closestHome.farthestKey = keyObj.name;
      closestHome.farthestCoord = keyObj.coordStr;
    }
  });

  // 3. 必要なデータだけを抽出して返す
  return homes.map(h => ({
    指: h.fingerName,
    ホームキー: h.homeKeyName,
    ホーム座標: h.coordStr,
    担当する最遠キー: h.farthestKey,
    最遠キー座標: h.farthestCoord,
    距離: h.maxDistance
  }));
}

// ==========================================
// 🟢 入れ替え推奨度スコア S(k) の計算関連
// ==========================================

// 指ごとの負担スコア P(k)
const fingerPenalty = {
  'right-index': 0.000,
  'right-middle': 0.012,
  'left-middle': 0.035,
  'left-index': 0.058,
  'right-thumb': 0.150,
  'left-thumb': 0.174,
  'left-ring': 0.190,
  'right-ring': 0.192,
  'left-pinky': 0.297,
  'right-pinky': 0.301,
  'unknown': 0.150 // 割り当てがない場合の予備
};

// スコア S(k) を計算する関数（F(k)独立・分離バージョン）
function calculateKeyScores(totalKeyCount, normalKeys, allKeysConfig, maxDistanceResults) {
  // Keylog2の日本語表記と、座標上のキー名を統一するための変換辞書
  const keyNameMap = {
    '左角括弧': '[', '右角括弧': ']', 'コロン': ':', 'コンマ': ','
  };

  const scores = [];

  // 1. 各キーに対して処理を行う
  allKeysConfig.forEach(keyObj => {
    // 🟢 前後の見えない空白や改行を trim() で除去して比較する
    const searchName = keyObj.name.toLowerCase().trim();
    
    // F(k) の計算: 押された回数を取得して総数で割る
    let pressCount = 0;
    for (const [logKey, count] of Object.entries(normalKeys)) {
      const rawKey = logKey.trim();
      const mappedKey = keyNameMap[rawKey] ? keyNameMap[rawKey].toLowerCase() : rawKey.toLowerCase();
      if (mappedKey === searchName) {
        pressCount = count;
        break;
      }
    }

    const f_k = totalKeyCount > 0 ? (pressCount / totalKeyCount) : 0;

    // 2. そのキーから最も近いホームポジションを探す
    let minDistance = Infinity;
    let closestHome = null;
    let targetHomeResult = null;

    maxDistanceResults.forEach(home => {
      const [hx, hy] = JSON.parse(home.ホーム座標);
      const dist = Math.sqrt(Math.pow(keyObj.x - hx, 2) + Math.pow(keyObj.y - hy, 2));
      
      if (dist < minDistance) {
        minDistance = dist;
        closestHome = { hx, hy, coordStr: home.ホーム座標, fingerName: home.指 };
        targetHomeResult = home;
      }
    });

    if (!closestHome || !targetHomeResult) return;

    // 3. 担当する指の P(k) を取得
    const fingerIdMap = {
      '右人差': 'right-index', '右中指': 'right-middle', '左中指': 'left-middle', '左人差': 'left-index',
      '右親指': 'right-thumb', '左親指': 'left-thumb', '左薬指': 'left-ring', '右薬指': 'right-ring',
      '左小指': 'left-pinky', '右小指': 'right-pinky'
    };
    const fingerId = fingerIdMap[closestHome.fingerName] || 'unknown';
    const p_k = fingerPenalty[fingerId];

    // 4. ( d(k, home) / maxDistance ) の計算
    const maxDist = targetHomeResult.距離;
    const distanceRatio = maxDist > 0 ? (minDistance / maxDist) : 0;

    // 🟢 5. 物理的負担スコア Cost(k) と 使用頻度 F(k) を独立して算出
    // 純粋な物理負担感 Cost(k) = P(k) + distanceRatio
    const costScore = p_k + distanceRatio;
    
    // 総合負担影響度（参考：従来スコア） = Cost(k) * F(k)
    const totalScore = costScore * f_k;

    scores.push({
      キー: keyObj.name,
      '負担スコア(物理)': costScore.toFixed(4),    // 1回あたりの押しにくさ
      '使用頻度F(k)': (f_k * 100).toFixed(2) + '%', // 独立させた使用率
      '総合影響度': totalScore.toFixed(6),          // 掛け合わせた参考値
      '指負担P(k)': p_k.toFixed(3),
      '距離/最大距離': distanceRatio.toFixed(3),
      押下回数: pressCount,
      担当指: closestHome.fingerName
    });
  });

  // 🟢 物理的負担スコアが高い順（1回あたりの押しにくさ順）にソート
  scores.sort((a, b) => parseFloat(b['負担スコア(物理)']) - parseFloat(a['負担スコア(物理)']));
  return scores;
}

// ==========================================
// 🟢 隠しコマンド: スコア表示カードの生成
// ==========================================

// キーボード入力を監視
document.addEventListener('keydown', (e) => {
  // 入力された文字を小文字で記録（文字キーのみ）
  if (/^[a-zA-Z]$/.test(e.key)) {
    secretCommand += e.key.toLowerCase();
    
    // 履歴が長くなりすぎないように直近10文字だけ保持
    if (secretCommand.length > 10) {
      secretCommand = secretCommand.slice(-10);
    }
    
    // 「score」と打たれたらカードを表示
    if (secretCommand.endsWith('score')) {
      showScoreCard();
    }
  }
});

// スコア表を生成・表示する関数（HTMLの枠組みを利用）
function showScoreCard() {
  if (!lastCalculatedScores) {
    alert('まだスコアが計算されていません。ファイルを送信してからコマンドを打ってください。');
    return;
  }
  
  const resultArea = document.getElementById('score-result-area');
  const tbody = document.getElementById('score-tbody');
  
  if (!resultArea || !tbody) {
    console.error('スコア表示用のHTML要素が見つかりません。');
    return;
  }

  // 1. tbody の中身を空にする
  tbody.innerHTML = '';
  
  // 2. データを元に行（tr）を作成して追加する
  const headers = ['キー', '負担スコア(物理)', '使用頻度F(k)', '総合影響度', '指負担P(k)', '距離/最大距離', '押下回数', '担当指'];
  
  lastCalculatedScores.forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = row[h];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  
  // 3. 表示領域を「表示（block）」に切り替える
  resultArea.style.display = 'block';
  
  // 4. CSVダウンロードボタンのイベントリスナーが複数登録されないように一度削除してから登録
  const downloadBtn = document.getElementById('downloadCsvBtn');
  downloadBtn.removeEventListener('click', downloadCSV); 
  downloadBtn.addEventListener('click', downloadCSV);

  // 5. スクロール処理
  // 念のため少し遅延させて、ブラウザの描画が追いついてからスクロールさせる
  setTimeout(() => {
     resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}