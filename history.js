window.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_KEYBOARD = DEFAULT_ROWS; // common.js の共通定義

  const historyListEl = document.getElementById('historyList');
  const previewArea = document.getElementById('preview-area');
  const previewTitle = document.getElementById('preview-title');
  
  let selectedHistoryItem = null;

  // 5. 戻るボタン
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'edit.html';
  });
  
  // 現在の配列（latestLayout）を取得
  let currentSwapMap = {};
  const currentLatestStr = localStorage.getItem('latestLayout');
  if (currentLatestStr) {
    try {
      const parsed = JSON.parse(currentLatestStr);
      if (parsed && parsed.swapMap) {
        currentSwapMap = parsed.swapMap;
      }
    } catch(e) {
      console.error(e);
    }
  }

  // 1. 履歴データの読み込みとフィルタリング
  const rawHistory = loadJSON(STORAGE.history, []);
  const validHistory = rawHistory.filter(h => h.swapMap && Object.keys(h.swapMap).length > 0);

  if (validHistory.length === 0) {
    historyListEl.innerHTML = '<p style="color: #666; font-size: 16px;">有効な過去のカスタマイズ配列がありません。</p>';
    return;
  }

  // バージョン名の付与
  validHistory.reverse(); 
  validHistory.forEach((item, index) => {
    item.versionName = `v${index + 1} (${item.date || '日付不明'})`;
  });
  validHistory.reverse();

  // 2. リストの描画
  validHistory.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    const swapCount = Object.keys(item.swapMap).length;
    div.textContent = `${item.versionName} - 変更キー数: ${swapCount}個`;

    div.addEventListener('click', () => {
      document.querySelectorAll('.history-item').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      
      selectedHistoryItem = item;
      showPreview(item);
      
      // クリック時にプレビューエリアへスクロール（スムーズ）
      setTimeout(() => {
        previewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    });

    historyListEl.appendChild(div);
  });

  // 3. キーボード描画用関数（CSSクラス適用版）
  function renderKeyboard(containerId, swapMap) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    DEFAULT_KEYBOARD.forEach((row, r) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'keyboard-row';

      // 行ごとのインデント調整
      if (r === 1) rowDiv.style.paddingLeft = '20px';
      if (r === 2) rowDiv.style.paddingLeft = '30px';
      if (r === 3) rowDiv.style.paddingLeft = '50px';

      row.forEach((keyObj) => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'key'; // CSSで指定したサイズと枠線を適用

        if (keyObj.isSpace) {
          keyDiv.classList.add('space-key');
          keyDiv.textContent = 'Space';
        } else {
          if (swapMap && swapMap[keyObj.name]) {
            keyDiv.textContent = swapMap[keyObj.name];
            keyDiv.classList.add('swapped-key');
          } else {
            keyDiv.textContent = keyObj.name;
          }
        }
        rowDiv.appendChild(keyDiv);
      });
      container.appendChild(rowDiv);
    });
  }

  // プレビューの表示処理
  function showPreview(item) {
    previewArea.style.display = 'block';
    previewTitle.textContent = `プレビュー: ${item.versionName}`;
    
    renderKeyboard('keyboard-preview', item.swapMap);
    renderKeyboard('current-keyboard-preview', currentSwapMap);
  }

  // 4. 「この配列を適応する」ボタンの処理
  document.getElementById('applyBtn').addEventListener('click', () => {
    if (!selectedHistoryItem) return;

    if (confirm(`「${selectedHistoryItem.versionName}」を現在の配列として復元しますか？\n（現在の配列は履歴に移動します）`)) {
      
      commitLayout(selectedHistoryItem.swapMap); // 現在の配列を履歴へ退避し、スコアも無効化

      alert('過去の配列を適応しました！\n編集画面に戻ります。');
      window.location.href = 'edit.html';
    }
  });


});