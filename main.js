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
  
  // 🟢 保存した配列があればアラートなしで自動適用
  const savedDataStr = localStorage.getItem('latestLayout');
  if (savedDataStr) {
    try {
      const savedLayout = JSON.parse(savedDataStr);
      if (savedLayout && savedLayout.swapMap && Object.keys(savedLayout.swapMap).length > 0) {
        const swap = savedLayout.swapMap;
        
        // ALL_KEYS_LAYOUT の各キーを前回の swapMap に従って適用
        ALL_KEYS_LAYOUT.forEach(keyObj => {
          if (keyObj.name !== 'Space' && swap[keyObj.name]) {
            keyObj.name = swap[keyObj.name]; 
          }
        });
        
        console.log('保存された配列を自動適用しました:', swap);
      }
    } catch (e) {
      console.error('保存データの読み込みに失敗しました', e);
    }
  }

  // 設定情報の取得と初期表示
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

      maxDistanceResults = calculateMaxDistances(settings.homeCoords, settings.fingerMapping || {});
      
      console.log('=== 各ホームポジションからの最遠キー計算結果 ===');
      console.table(maxDistanceResults);

      const dataToSave = {
        calculatedAt: new Date().toISOString(),
        distanceResults: maxDistanceResults
      };
      
      localStorage.setItem('maxDistanceResults', JSON.stringify(dataToSave));

    } else {
      displayCoords.textContent = '未設定';
    }
  } else {
    alert('設定が見つかりません。初期設定画面に戻ります。');
    window.location.href = 'index.html';
  }

  // 次へ進むボタンの遷移処理
  const nextPageBtn = document.getElementById('nextPageBtn');
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      window.location.href = 'result.html';
    });
  }

  // 🟢 初期配列(QWERTY)に戻すボタンのイベント設定
  const resetQwertyBtn = document.getElementById('resetQwertyBtn');
  if (resetQwertyBtn) {
    resetQwertyBtn.addEventListener('click', () => {
      if (confirm('現在の配列設定を初期QWERTY配列に戻しますか？\n（現在のカスタム配列は履歴に保存されます）')) {
        const savedDataStr = localStorage.getItem('latestLayout');
        let settings = {};

        if (savedDataStr) {
          try {
            const savedLayout = JSON.parse(savedDataStr);
            settings = savedLayout.settings || {};
            
            // 入れ替え設定が存在する場合は履歴（historyLayouts）に押し出す
            if (savedLayout.swapMap && Object.keys(savedLayout.swapMap).length > 0) {
              const historyLayouts = JSON.parse(localStorage.getItem('historyLayouts') || '[]');
              historyLayouts.unshift(savedLayout);
              localStorage.setItem('historyLayouts', JSON.stringify(historyLayouts));
            }
          } catch (e) {
            console.error('履歴への保存処理に失敗しました', e);
          }
        }

        // latestLayout を標準QWERTY配列 (swapMap: {}) として保存
        const resetData = {
          id: Date.now(),
          date: new Date().toLocaleString('ja-JP'),
          settings: settings,
          swapMap: {}
        };
        localStorage.setItem('latestLayout', JSON.stringify(resetData));

        alert('初期配列(QWERTY)にリセットしました。');
        location.reload(); // 画面を更新して標準配列に戻す
      }
    });
  }
});

// ファイルが選択されたら「送信ボタン」を有効化する
fileInput.addEventListener('change', () => {
  sendBtn.disabled = fileInput.files.length === 0;
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

    sendBtn.disabled = true;
    
    let progressBar = document.getElementById('loadingBar');
    if (!progressBar) {
      progressBar = document.createElement('progress');
      progressBar.id = 'loadingBar';
      progressBar.max = 100;
      progressBar.value = 10;
      progressBar.style.marginLeft = '10px';
      sendBtn.parentNode.insertBefore(progressBar, sendBtn.nextSibling);
    }
    progressBar.style.display = 'inline-block';
    progressBar.value = 30;

    const reader = new FileReader();

    reader.onload = function(e) {
      progressBar.value = 70;
      
      const text = e.target.result;
      
      let totalKeyCount = 0;
      let normalKeys = {};
      let specialKeys = {};
      let shortcutKeys = {};

      const totalMatch = text.match(/総キー押下イベント数:\s*(\d+)/);
      if (totalMatch) {
        totalKeyCount = parseInt(totalMatch[1], 10);
      }

      const arrayMatches = text.match(/\[\{([\s\S]*?)\}\]/g);

      if (arrayMatches && arrayMatches.length >= 3) {
        const parseBlock = (blockStr) => {
          const obj = {};
          const regex = /([^,\s{}[\]]+):\s*(\d+)/g;
          let m;
          while ((m = regex.exec(blockStr)) !== null) {
            obj[m[1]] = parseInt(m[2], 10);
          }
          return obj;
        };

        normalKeys = parseBlock(arrayMatches[0]);
        specialKeys = parseBlock(arrayMatches[1]);
        shortcutKeys = parseBlock(arrayMatches[2]);
      }

      progressBar.value = 100;

      console.log('=== Keylog2 解析結果 ===');
      console.log('合計のキーを押した数:', totalKeyCount);
      console.log('通常キー:', normalKeys);
      console.log('特殊キー:', specialKeys);
      console.log('ショートカット:', shortcutKeys);

      setTimeout(() => {
        progressBar.style.display = 'none';
        sendBtn.disabled = false;
        
        if (lastCalculatedScores) {
          localStorage.setItem('calculatedScores', JSON.stringify(lastCalculatedScores));
        }

        let successMsg = document.getElementById('successMsg');
        if (!successMsg) {
          successMsg = document.createElement('span');
          successMsg.id = 'successMsg';
          successMsg.style.color = '#28a745';
          successMsg.style.fontWeight = 'bold';
          successMsg.style.marginLeft = '10px';
          successMsg.style.fontSize = '0.9em';
          sendBtn.parentNode.insertBefore(successMsg, document.getElementById('nextPageBtn'));
        }
        successMsg.textContent = '解析完了！';
        successMsg.style.display = 'inline';

        const nextPageBtn = document.getElementById('nextPageBtn');
        if (nextPageBtn) {
          nextPageBtn.style.display = 'inline-block';
        }

        setTimeout(() => {
          successMsg.style.display = 'none';
        }, 3000);

      }, 500);

      if (maxDistanceResults && ALL_KEYS_LAYOUT) {
        const replacementScores = calculateKeyScores(totalKeyCount, normalKeys, ALL_KEYS_LAYOUT, maxDistanceResults);
        lastCalculatedScores = replacementScores; 
        
        console.log('=== 🔄 キー入れ替え推奨度スコア S(k) ===');
        console.table(replacementScores);
      } else {
        console.warn('最大距離データが不足しているためスコア計算をスキップしました。');
      }
    };

    reader.readAsText(file);
    
  } else {
    alert('ファイルを選択してください。');
  }
});

// 設定変更ボタン
changeSettingsBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// ホームポジション計算
function calculateMaxDistances(homeCoords, fingerMapping) {
  const fingerNames = {
    'left-pinky': '左小指', 'left-ring': '左薬指', 'left-middle': '左中指', 'left-index': '左人差', 'left-thumb': '左親指',
    'right-thumb': '右親指', 'right-index': '右人差', 'right-middle': '右中指', 'right-ring': '右薬指', 'right-pinky': '右小指'
  };

  const allKeys = ALL_KEYS_LAYOUT;

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

  allKeys.forEach(keyObj => {
    let minDistance = Infinity;
    let closestHome = null;

    homes.forEach(home => {
      const dist = Math.sqrt(Math.pow(keyObj.x - home.x, 2) + Math.pow(keyObj.y - home.y, 2));
      if (dist < minDistance) {
        minDistance = dist;
        closestHome = home;
      }
    });

    if (closestHome && minDistance > closestHome.maxDistance) {
      closestHome.maxDistance = Math.round(minDistance * 100) / 100;
      closestHome.farthestKey = keyObj.name;
      closestHome.farthestCoord = keyObj.coordStr;
    }
  });

  return homes.map(h => ({
    指: h.fingerName,
    ホームキー: h.homeKeyName,
    ホーム座標: h.coordStr,
    担当する最遠キー: h.farthestKey,
    最遠キー座標: h.farthestCoord,
    距離: h.maxDistance
  }));
}

// 指ごとの負担スコア P(k)
const fingerPenalty = {
  'right-index': 0.000, 'right-middle': 0.012, 'left-middle': 0.035, 'left-index': 0.058,
  'right-thumb': 0.150, 'left-thumb': 0.174, 'left-ring': 0.190, 'right-ring': 0.192,
  'left-pinky': 0.297, 'right-pinky': 0.301, 'unknown': 0.150
};

// スコア計算
function calculateKeyScores(totalKeyCount, normalKeys, allKeysConfig, maxDistanceResults) {
  const keyNameMap = {
    '左角括弧': '[', '右角括弧': ']', 'コロン': ':', 'コンマ': ','
  };

  const scores = [];

  allKeysConfig.forEach(keyObj => {
    const searchName = keyObj.name.toLowerCase().trim();
    
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

    const fingerIdMap = {
      '右人差': 'right-index', '右中指': 'right-middle', '左中指': 'left-middle', '左人差': 'left-index',
      '右親指': 'right-thumb', '左親指': 'left-thumb', '左薬指': 'left-ring', '右薬指': 'right-ring',
      '左小指': 'left-pinky', '右小指': 'right-pinky'
    };
    const fingerId = fingerIdMap[closestHome.fingerName] || 'unknown';
    const p_k = fingerPenalty[fingerId];

    const maxDist = targetHomeResult.距離;
    const distanceRatio = maxDist > 0 ? (minDistance / maxDist) : 0;

    const costScore = p_k + distanceRatio;
    const totalScore = costScore * f_k;

    scores.push({
      キー: keyObj.name,
      '負担スコア(物理)': costScore.toFixed(4),
      '使用頻度F(k)': (f_k * 100).toFixed(2) + '%',
      '総合影響度': totalScore.toFixed(6),
      '指負担P(k)': p_k.toFixed(3),
      '距離/最大距離': distanceRatio.toFixed(3),
      押下回数: pressCount,
      担当指: closestHome.fingerName
    });
  });

  scores.sort((a, b) => parseFloat(b['負担スコア(物理)']) - parseFloat(a['負担スコア(物理)']));
  return scores;
}

// 隠しコマンド処理
document.addEventListener('keydown', (e) => {
  if (/^[a-zA-Z]$/.test(e.key)) {
    secretCommand += e.key.toLowerCase();
    if (secretCommand.length > 10) {
      secretCommand = secretCommand.slice(-10);
    }
    if (secretCommand.endsWith('score')) {
      showScoreCard();
    }
  }
});

function showScoreCard() {
  if (!lastCalculatedScores) {
    alert('まだスコアが計算されていません。ファイルを送信してからコマンドを打ってください。');
    return;
  }
  
  const resultArea = document.getElementById('score-result-area');
  const tbody = document.getElementById('score-tbody');
  
  if (!resultArea || !tbody) return;

  tbody.innerHTML = '';
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
  
  resultArea.style.display = 'block';
  
  const copyBtn = document.getElementById('copyTableBtn');
  if (copyBtn) {
    copyBtn.removeEventListener('click', copyTableToClipboard); 
    copyBtn.addEventListener('click', copyTableToClipboard);
  }

  setTimeout(() => {
     resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

async function copyTableToClipboard() {
  if (!lastCalculatedScores || lastCalculatedScores.length === 0) return;

  const headers = ['キー', '負担スコア(物理)', '使用頻度F(k)', '総合影響度', '指負担P(k)', '距離/最大距離', '押下回数', '担当指'];
  let tsvContent = headers.join('\t') + '\n';

  lastCalculatedScores.forEach(row => {
    const rowData = headers.map(h => {
      let cell = row[h] !== undefined ? String(row[h]) : '';
      return cell.replace(/\t|\n|\r/g, ' ');
    });
    tsvContent += rowData.join('\t') + '\n';
  });

  try {
    await navigator.clipboard.writeText(tsvContent);
  } catch (err) {
    console.error('コピーに失敗しました', err);
    alert('クリップボードへのコピーに失敗しました。');
  }
}