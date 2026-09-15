// 要素の取得
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');
const displayHands = document.getElementById('display-hands');
const displayCoords = document.getElementById('display-coords');
const changeSettingsBtn = document.getElementById('changeSettingsBtn');

// ページ読み込み時にローカルストレージの設定を取得して表示し、最遠キーを計算する
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
    
    // 座標の表示
    if (settings.homeCoords && settings.homeCoords.length > 0) {
      displayCoords.textContent = settings.homeCoords.join(' , ');

      // 🟢 ホームポジションから各指の「現実的に担当する最遠キー」と距離を計算
      const distanceResults = calculateMaxDistances(settings.homeCoords, settings.fingerMapping || {});
      
      // コンソールに出力
      console.log('=== 各ホームポジションからの最遠キー計算結果 ===');
      console.table(distanceResults);

      // クラウドストレージ用保存データ
      const dataToSave = {
        calculatedAt: new Date().toISOString(),
        distanceResults: distanceResults
      };
      // saveToCloudStorage(dataToSave); // クラウド連携時に使用
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

// 送信ボタンの処理
sendBtn.addEventListener('click', () => {
  const file = fileInput.files[0];
  if (file) {
    alert(`「${file.name}」の送信処理を開始します！\n（ファイルサイズ: ${file.size} bytes）`);
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

  // main.html側にキーボード描画が無い場合でも計算できるフォールバック座標データ
  const defaultLayout = [
    { coordStr: '[0,0]', name: 'Q', x: 0, y: 0 }, { coordStr: '[1,0]', name: 'W', x: 1, y: 0 }, { coordStr: '[2,0]', name: 'E', x: 2, y: 0 }, { coordStr: '[3,0]', name: 'R', x: 3, y: 0 }, { coordStr: '[4,0]', name: 'T', x: 4, y: 0 }, { coordStr: '[5,0]', name: 'Y', x: 5, y: 0 }, { coordStr: '[6,0]', name: 'U', x: 6, y: 0 }, { coordStr: '[7,0]', name: 'I', x: 7, y: 0 }, { coordStr: '[8,0]', name: 'O', x: 8, y: 0 }, { coordStr: '[9,0]', name: 'P', x: 9, y: 0 },
    { coordStr: '[0,1]', name: 'A', x: 0, y: 1 }, { coordStr: '[1,1]', name: 'S', x: 1, y: 1 }, { coordStr: '[2,1]', name: 'D', x: 2, y: 1 }, { coordStr: '[3,1]', name: 'F', x: 3, y: 1 }, { coordStr: '[4,1]', name: 'G', x: 4, y: 1 }, { coordStr: '[5,1]', name: 'H', x: 5, y: 1 }, { coordStr: '[6,1]', name: 'J', x: 6, y: 1 }, { coordStr: '[7,1]', name: 'K', x: 7, y: 1 }, { coordStr: '[8,1]', name: 'L', x: 8, y: 1 }, { coordStr: '[9,1]', name: ';', x: 9, y: 1 },
    { coordStr: '[0,2]', name: 'Z', x: 0, y: 2 }, { coordStr: '[1,2]', name: 'X', x: 1, y: 2 }, { coordStr: '[2,2]', name: 'C', x: 2, y: 2 }, { coordStr: '[3,2]', name: 'V', x: 3, y: 2 }, { coordStr: '[4,2]', name: 'B', x: 4, y: 2 }, { coordStr: '[5,2]', name: 'N', x: 5, y: 2 }, { coordStr: '[6,2]', name: 'M', x: 6, y: 2 }, { coordStr: '[7,2]', name: ',', x: 7, y: 2 }, { coordStr: '[8,2]', name: '.', x: 8, y: 2 }, { coordStr: '[9,2]', name: '/', x: 9, y: 2 },
    { coordStr: '[4,4]', name: 'Space', x: 4, y: 4 }
  ];

  // DOM上にキー要素があれば取得し、無ければ定義データを利用
  const keyElements = document.querySelectorAll('.key[data-coord]');
  let allKeys = [];

  if (keyElements.length > 0) {
    keyElements.forEach(keyEl => {
      const coordStr = keyEl.getAttribute('data-coord');
      const [kx, ky] = JSON.parse(coordStr);
      const name = keyEl.getAttribute('data-key') === 'SPACE' ? 'Space' : keyEl.getAttribute('data-key');
      allKeys.push({ coordStr, name, x: kx, y: ky });
    });
  } else {
    allKeys = defaultLayout;
  }

  // ホームポジション情報オブジェクトを準備
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

  // 各キーから「最も近いホームポジション」を割り出し、その指の最大距離を更新
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