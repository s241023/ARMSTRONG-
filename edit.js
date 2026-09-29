window.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_KEYBOARD = [
    [{ name: '1' }, { name: '2' }, { name: '3' }, { name: '4' }, { name: '5' }, { name: '6' }, { name: '7' }, { name: '8' }, { name: '9' }, { name: '0' }, { name: '-' }, { name: '^' }, { name: '¥' }],
    [{ name: 'Q' }, { name: 'W' }, { name: 'E' }, { name: 'R' }, { name: 'T' }, { name: 'Y' }, { name: 'U' }, { name: 'I' }, { name: 'O' }, { name: 'P' }, { name: '@' }, { name: '[' }],
    [{ name: 'A' }, { name: 'S' }, { name: 'D' }, { name: 'F' }, { name: 'G' }, { name: 'H' }, { name: 'J' }, { name: 'K' }, { name: 'L' }, { name: ';' }, { name: ':' }, { name: ']' }],
    [{ name: 'Z' }, { name: 'X' }, { name: 'C' }, { name: 'V' }, { name: 'B' }, { name: 'N' }, { name: 'M' }, { name: ',' }, { name: '.' }, { name: '/' }, { name: '\\' }],
    [{ name: 'Space', isSpace: true }]
  ];

  // 🟢 編集・入れ替えを禁止するキーの定義（数字キー + Spaceキー）
  const EXCLUDED_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Space', 'space'];
  const isExcludedKey = (keyObj) => keyObj.isSpace || EXCLUDED_KEYS.includes(keyObj.name.trim());

  let currentKeyboard = JSON.parse(JSON.stringify(DEFAULT_KEYBOARD));
  let settings = {};

  // 1. 最新の保存データを読み込み、現在の配列に適用する
  const savedDataStr = localStorage.getItem('latestLayout');
  if (savedDataStr) {
    try {
      const savedLayout = JSON.parse(savedDataStr);
      settings = savedLayout.settings || {};
      if (savedLayout.swapMap) {
        const swap = savedLayout.swapMap;
        currentKeyboard.forEach(row => {
          row.forEach(keyObj => {
            if (!keyObj.isSpace && swap[keyObj.name]) {
              keyObj.name = swap[keyObj.name];
            }
          });
        });
      }
    } catch (e) {
      console.error('データの読み込みに失敗しました', e);
    }
  }

  // 読み込みが完了した時点の配列を「比較のベース」として記憶しておく
  const initialKeyboard = JSON.parse(JSON.stringify(currentKeyboard));

  let selectedKeyPos = null;
  const msgEl = document.getElementById('message');
  const container = document.getElementById('keyboard-editor');

  // 3. キーボードの描画
  function render() {
    container.innerHTML = '';
    currentKeyboard.forEach((row, r) => {
      const rowDiv = document.createElement('div');
      rowDiv.style.display = 'flex';
      rowDiv.style.gap = '8px';
      rowDiv.style.marginBottom = '8px';

      if (r === 1) rowDiv.style.paddingLeft = '24px';
      if (r === 2) rowDiv.style.paddingLeft = '36px';
      if (r === 3) rowDiv.style.paddingLeft = '60px';
      if (r === 4) {
        rowDiv.style.paddingLeft = '0';
        rowDiv.style.justifyContent = 'center';
      }

      row.forEach((keyObj, c) => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'keyboard-key edit-key';
        
        keyDiv.style.width = '42px';
        keyDiv.style.height = '46px';
        keyDiv.style.border = '1px solid #ccc';
        keyDiv.style.borderRadius = '6px';
        keyDiv.style.display = 'flex';
        keyDiv.style.flexDirection = 'column';
        keyDiv.style.justifyContent = 'center';
        keyDiv.style.alignItems = 'center';
        keyDiv.style.backgroundColor = '#fff';
        keyDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
        
        // 🟢 数字キーおよび Space キーの入れ替え不可判定
        if (isExcludedKey(keyObj)) {
          keyDiv.classList.add('disabled-key');
          keyDiv.style.backgroundColor = '#e9ecef';
          keyDiv.style.color = '#6c757d';
          keyDiv.style.borderColor = '#dee2e6';
          keyDiv.style.cursor = 'not-allowed';

          if (keyObj.isSpace) {
            keyDiv.classList.add('space-key');
            keyDiv.textContent = 'Space';
            keyDiv.style.width = '240px';
          } else {
            keyDiv.textContent = keyObj.name;
          }
        } else {
          keyDiv.textContent = keyObj.name;
          keyDiv.style.cursor = 'pointer';
          
          if (selectedKeyPos && selectedKeyPos.r === r && selectedKeyPos.c === c) {
            keyDiv.classList.add('selected');
            keyDiv.style.backgroundColor = '#4CAF50';
            keyDiv.style.color = 'white';
            keyDiv.style.borderColor = '#388E3C';
          }
          // 「開いた時の状態(initialKeyboard)」から変わっていたら赤く表示
          else if (initialKeyboard[r][c].name !== keyObj.name) {
            keyDiv.classList.add('swapped');
            keyDiv.style.backgroundColor = '#f44336';
            keyDiv.style.color = 'white';
            keyDiv.style.borderColor = '#d32f2f';
          }

          keyDiv.addEventListener('click', () => handleKeyClick(r, c));
        }
        rowDiv.appendChild(keyDiv);
      });
      container.appendChild(rowDiv);
    });
  }

  // 4. クリック時の処理
  function handleKeyClick(r, c) {
    // 防御策：万が一除外対象キーがクリックされても処理しない
    if (isExcludedKey(currentKeyboard[r][c])) return;

    if (!selectedKeyPos) {
      // ▼ 1回目のクリック：選択状態にする
      selectedKeyPos = { r, c };
      msgEl.textContent = '選択したキーと入れ替えるキーを選択してください';
      msgEl.style.color = '#388E3C';
    } else {
      // ▼ 2回目のクリック
      if (selectedKeyPos.r === r && selectedKeyPos.c === c) {
        // 同じキーを押した場合は選択キャンセル
        selectedKeyPos = null;
      } else {
        // 別のキーを押した場合は入れ替え実行
        const r1 = selectedKeyPos.r;
        const c1 = selectedKeyPos.c;
        const temp = currentKeyboard[r1][c1].name;
        
        currentKeyboard[r1][c1].name = currentKeyboard[r][c].name;
        currentKeyboard[r][c].name = temp;
        
        selectedKeyPos = null; // 選択解除
      }
      
      // メッセージを元に戻す
      msgEl.textContent = '入れ替えるキーを選択してください';
      msgEl.style.color = 'black';
    }
    render(); // 画面を更新
  }

  // 初回描画
  render();

  // 5. 保存して終了ボタン
  document.getElementById('saveBtn').addEventListener('click', () => {
    const newSwapMap = {};

    // 画面上の配列とQWERTYを比較して、新しい swapMap を逆算する
    for (let r = 0; r < DEFAULT_KEYBOARD.length; r++) {
      for (let c = 0; c < DEFAULT_KEYBOARD[r].length; c++) {
        if (!DEFAULT_KEYBOARD[r][c].isSpace) {
          const defaultKey = DEFAULT_KEYBOARD[r][c].name;
          const currentKey = currentKeyboard[r][c].name;
          if (defaultKey !== currentKey) {
            newSwapMap[defaultKey] = currentKey;
          }
        }
      }
    }

    const newSaveData = {
      id: Date.now(),
      date: new Date().toLocaleString('ja-JP'),
      settings: settings,
      swapMap: newSwapMap
    };

    // 履歴管理の処理（最新を過去に押し出して、今回を最新にする）
    const currentLatest = JSON.parse(localStorage.getItem('latestLayout'));
    if (currentLatest) {
      const historyLayouts = JSON.parse(localStorage.getItem('historyLayouts') || '[]');
      historyLayouts.unshift(currentLatest);
      localStorage.setItem('historyLayouts', JSON.stringify(historyLayouts));
    }

    localStorage.setItem('latestLayout', JSON.stringify(newSaveData));
    
    alert('手動編集した配列を保存しました！\nメイン画面に戻ります。');
    window.location.href = 'main.html';
  });

  // 6. キャンセルボタン
  document.getElementById('cancelBtn').addEventListener('click', () => {
    window.location.href = 'main.html';
  });
});