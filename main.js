// 要素の取得
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');
const displayHands = document.getElementById('display-hands');
const displayCoords = document.getElementById('display-coords');
const changeSettingsBtn = document.getElementById('changeSettingsBtn');

// 🟢 最大距離データを保持する独立した変数
let maxDistanceResults = null;

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

      // ② [{ ... }] のブロックを3つ抽出[cite: 4]
      const arrayMatches = text.match(/\[\{(.*?)\}\]/g);
      
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

// スコア S(k) を計算する関数
function calculateKeyScores(totalKeyCount, normalKeys, allKeysConfig, maxDistanceResults) {
  // Keylog2の日本語表記と、座標上のキー名を統一するための変換辞書
  const keyNameMap = {
    '左角括弧': '[', '右角括弧': ']', 'コロン': ':', 'コンマ': ','
  };

  const scores = [];

  // 1. 各キーに対して処理を行う
  allKeysConfig.forEach(keyObj => {
    // 検索用のキー名（大文字小文字の差異を吸収）
    const searchName = keyObj.name.toLowerCase();
    
    // F(k) の計算: 押された回数を取得して総数で割る
    let pressCount = 0;
    
    // normalKeysの中から、キー名が一致するもの、または日本語表記が一致するものを探す
    for (const [logKey, count] of Object.entries(normalKeys)) {
      const mappedKey = keyNameMap[logKey] ? keyNameMap[logKey].toLowerCase() : logKey.toLowerCase();
      if (mappedKey === searchName) {
        pressCount = count;
        break;
      }
    }

    const f_k = totalKeyCount > 0 ? (pressCount / totalKeyCount) : 0;

    // もし1回も押されていないキーならスコアは0としてスキップ
    if (f_k === 0) {
      scores.push({ キー: keyObj.name, スコア: 0, 詳細: '入力なし' });
      return;
    }

    // 2. そのキーから最も近いホームポジションを探す
    let minDistance = Infinity;
    let closestHome = null;
    let targetHomeResult = null; // maxDistanceResults内の該当データ

    maxDistanceResults.forEach(home => {
      // homeStr "[x,y]" をパースして座標を取り出す
      const [hx, hy] = JSON.parse(home.ホーム座標);
      const dist = Math.sqrt(Math.pow(keyObj.x - hx, 2) + Math.pow(keyObj.y - hy, 2));
      
      if (dist < minDistance) {
        minDistance = dist;
        closestHome = { hx, hy, coordStr: home.ホーム座標, fingerName: home.指 };
        targetHomeResult = home;
      }
    });

    if (!closestHome || !targetHomeResult) return;

    // 3. 担当する指の ID (right-indexなど) を名前から逆引きして P(k) を取得
    const fingerIdMap = {
      '右人差': 'right-index', '右中指': 'right-middle', '左中指': 'left-middle', '左人差': 'left-index',
      '右親指': 'right-thumb', '左親指': 'left-thumb', '左薬指': 'left-ring', '右薬指': 'right-ring',
      '左小指': 'left-pinky', '右小指': 'right-pinky'
    };
    const fingerId = fingerIdMap[closestHome.fingerName] || 'unknown';
    const p_k = fingerPenalty[fingerId];

    // 4. ( d(k, home) / maxDistance ) の計算
    // maxDistanceが0（ホームポジションしか担当していない場合）はゼロ除算を防ぐため0とする
    const maxDist = targetHomeResult.距離;
    const distanceRatio = maxDist > 0 ? (minDistance / maxDist) : 0;

    // 5. 最終スコア S(k) の計算
    // S(k) = F(k) * ( P(k) + distanceRatio )
    const s_k = f_k * (p_k + distanceRatio);

    scores.push({
      キー: keyObj.name,
      スコア: s_k.toFixed(6), // 見やすく小数点以下6桁に
      担当指: closestHome.fingerName,
      押下回数: pressCount,
      '距離/最大距離': distanceRatio.toFixed(3)
    });
  });

  // スコアが高い順（入れ替え推奨度が高い順）に並び替える
  scores.sort((a, b) => parseFloat(b.スコア) - parseFloat(a.スコア));
  return scores;
}