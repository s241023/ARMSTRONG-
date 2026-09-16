// 要素の取得
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');
const displayHands = document.getElementById('display-hands');
const displayCoords = document.getElementById('display-coords');
const changeSettingsBtn = document.getElementById('changeSettingsBtn');

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

      // 🟢 ホームポジションから各指の「現実的に担当する最遠キー」と距離を計算
      const distanceResults = calculateMaxDistances(settings.homeCoords, settings.fingerMapping || {});
      
      // コンソールに出力
      console.log('=== 各ホームポジションからの最遠キー計算結果 ===');
      console.table(distanceResults);

      // 保存するためのデータ形式
      const dataToSave = {
        calculatedAt: new Date().toISOString(),
        distanceResults: distanceResults
      };
      
      // 🟢 appSettingsとは別のキー名（maxDistanceResults）でローカルストレージに保存
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

  // メイン画面側にキーボード描画が無い場合でも計算できるようにするためのフォールバック用キー情報
  const defaultLayout = [
    { coordStr: '[0,0]', name: 'Q', x: 0, y: 0 }, { coordStr: '[1,0]', name: 'W', x: 1, y: 0 }, { coordStr: '[2,0]', name: 'E', x: 2, y: 0 }, { coordStr: '[3,0]', name: 'R', x: 3, y: 0 }, { coordStr: '[4,0]', name: 'T', x: 4, y: 0 }, { coordStr: '[5,0]', name: 'Y', x: 5, y: 0 }, { coordStr: '[6,0]', name: 'U', x: 6, y: 0 }, { coordStr: '[7,0]', name: 'I', x: 7, y: 0 }, { coordStr: '[8,0]', name: 'O', x: 8, y: 0 }, { coordStr: '[9,0]', name: 'P', x: 9, y: 0 },
    { coordStr: '[0,1]', name: 'A', x: 0, y: 1 }, { coordStr: '[1,1]', name: 'S', x: 1, y: 1 }, { coordStr: '[2,1]', name: 'D', x: 2, y: 1 }, { coordStr: '[3,1]', name: 'F', x: 3, y: 1 }, { coordStr: '[4,1]', name: 'G', x: 4, y: 1 }, { coordStr: '[5,1]', name: 'H', x: 5, y: 1 }, { coordStr: '[6,1]', name: 'J', x: 6, y: 1 }, { coordStr: '[7,1]', name: 'K', x: 7, y: 1 }, { coordStr: '[8,1]', name: 'L', x: 8, y: 1 }, { coordStr: '[9,1]', name: ';', x: 9, y: 1 },
    { coordStr: '[0,2]', name: 'Z', x: 0, y: 2 }, { coordStr: '[1,2]', name: 'X', x: 1, y: 2 }, { coordStr: '[2,2]', name: 'C', x: 2, y: 2 }, { coordStr: '[3,2]', name: 'V', x: 3, y: 2 }, { coordStr: '[4,2]', name: 'B', x: 4, y: 2 }, { coordStr: '[5,2]', name: 'N', x: 5, y: 2 }, { coordStr: '[6,2]', name: 'M', x: 6, y: 2 }, { coordStr: '[7,2]', name: ',', x: 7, y: 2 }, { coordStr: '[8,2]', name: '.', x: 8, y: 2 }, { coordStr: '[9,2]', name: '/', x: 9, y: 2 },
    { coordStr: '[4,4]', name: 'Space', x: 4, y: 4 }
  ];

  // DOM上にキー要素があれば取得し、無ければ定義データを利用する
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