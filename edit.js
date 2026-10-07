window.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_KEYBOARD = DEFAULT_ROWS; // common.js の共通定義


  let currentKeyboard = JSON.parse(JSON.stringify(DEFAULT_KEYBOARD));

  // 1. 最新の保存データを読み込み、現在の配列に適用する
  const savedLayout = loadJSON(STORAGE.latest, null);
  if (savedLayout && savedLayout.swapMap) currentKeyboard = applySwapMap(currentKeyboard, savedLayout.swapMap);

  // 読み込みが完了した時点の配列を「比較のベース」として記憶しておく
  const initialKeyboard = JSON.parse(JSON.stringify(currentKeyboard));

  let selectedKeyPos = null;
  const msgEl = document.getElementById('message');
  const container = document.getElementById('keyboard-editor');

  // 3. キーボードの描画(見た目は style.css の .edit-key 系クラス)
  function render() {
    container.innerHTML = '';
    currentKeyboard.forEach((row, r) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'edit-keyboard-row';
      row.forEach((keyObj, c) => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'edit-key';
        keyDiv.textContent = keyObj.isSpace ? 'Space' : keyObj.name;
        if (keyObj.isSpace) keyDiv.classList.add('space-key');
        if (isExcludedKey(keyObj)) {
          keyDiv.classList.add('disabled-key');       // 数字キー・Space は入れ替え不可
        } else {
          if (selectedKeyPos && selectedKeyPos.r === r && selectedKeyPos.c === c) keyDiv.classList.add('selected');
          else if (initialKeyboard[r][c].name !== keyObj.name) keyDiv.classList.add('swapped');   // 開いた時から変わったキー
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
      msgEl.classList.add('is-active');
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
      msgEl.classList.remove('is-active');
    }
    render(); // 画面を更新
  }

  // 初回描画
  render();

  // 5. 保存して終了ボタン(履歴・最新配列・スコア無効化は commitLayout が担当)
  document.getElementById('saveBtn').addEventListener('click', () => {
    commitLayout(buildSwapMap(currentKeyboard));
    alert('手動編集した配列を保存しました！\nメイン画面に戻ります。');
    window.location.href = 'main.html';
  });

  // 6. キャンセルボタン
  document.getElementById('cancelBtn').addEventListener('click', () => {
    window.location.href = 'main.html';
  });
});