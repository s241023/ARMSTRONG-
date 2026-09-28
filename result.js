window.addEventListener('DOMContentLoaded', () => {
  // 1. ローカルストレージからデータの取得
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const scores = JSON.parse(localStorage.getItem('calculatedScores') || '[]');

  if (!scores || scores.length === 0) {
    alert('スコアデータが見つかりません。メイン画面から解析を行ってください。');
    window.location.href = 'main.html';
    return;
  }

  // キーボードレイアウト構造
  const KEYBOARD_ROWS = [
    [{ name: '1' }, { name: '2' }, { name: '3' }, { name: '4' }, { name: '5' }, { name: '6' }, { name: '7' }, { name: '8' }, { name: '9' }, { name: '0' }, { name: '-' }, { name: '^' }, { name: '¥' }],
    [{ name: 'Q' }, { name: 'W' }, { name: 'E' }, { name: 'R' }, { name: 'T' }, { name: 'Y' }, { name: 'U' }, { name: 'I' }, { name: 'O' }, { name: 'P' }, { name: '@' }, { name: '[' }],
    [{ name: 'A' }, { name: 'S' }, { name: 'D' }, { name: 'F' }, { name: 'G' }, { name: 'H' }, { name: 'J' }, { name: 'K' }, { name: 'L' }, { name: ';' }, { name: ':' }, { name: ']' }],
    [{ name: 'Z' }, { name: 'X' }, { name: 'C' }, { name: 'V' }, { name: 'B' }, { name: 'N' }, { name: 'M' }, { name: ',' }, { name: '.' }, { name: '/' }, { name: '\\' }],
    [{ name: 'Space', isSpace: true }]
  ];

  // 🟢 数字キーおよび Space キーを除外リストに指定
  const excludedKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Space', 'space'];
  const isExcludedKey = (keyName) => excludedKeys.includes(keyName.trim());

  // 2. 設定情報の簡易表示
  const displayHands = document.getElementById('user-hands');
  const displayCoordsCount = document.getElementById('user-coords-count');
  
  if (displayHands) {
    let handsText = '未設定';
    if (settings.usehands === 'right') handsText = '右手のみ';
    if (settings.usehands === 'left') handsText = '左手のみ';
    if (settings.usehands === 'r&l') handsText = '両手';
    displayHands.textContent = handsText;
  }
  if (displayCoordsCount) {
    displayCoordsCount.textContent = settings.homeCoords ? `${settings.homeCoords.length} 箇所` : '0';
  }

  // 3. Min-Max 正規化用データの計算（除外キー以外で算出）
  const eligibleScores = scores.filter(item => !isExcludedKey(item.キー));

  let minCost = Infinity, maxCost = -Infinity;
  let minFreq = Infinity, maxFreq = -Infinity;

  eligibleScores.forEach(item => {
    const cost = parseFloat(item['負担スコア(物理)']);
    const freq = parseFloat(item['使用頻度F(k)']);
    if (!isNaN(cost)) {
      if (cost < minCost) minCost = cost;
      if (cost > maxCost) maxCost = cost;
    }
    if (!isNaN(freq)) {
      if (freq < minFreq) minFreq = freq;
      if (freq > maxFreq) maxFreq = freq;
    }
  });

  function calculateSmallnessScore(cost, freq) {
    const normCost = maxCost > minCost ? (cost - minCost) / (maxCost - minCost) : 0;
    const normFreq = maxFreq > minFreq ? (freq - minFreq) / (maxFreq - minFreq) : 0;
    return Math.sqrt(normCost * normCost + normFreq * normFreq);
  }

  // 4. 改善対象キーの抽出 (除外キー以外 / 負担 >= 0.75 / 頻度 > 0%)
  const targetKeys = eligibleScores.filter(item => {
    const physScore = parseFloat(item['負担スコア(物理)']);
    const pressCount = parseInt(item.押下回数, 10);
    return !isNaN(physScore) && physScore >= 0.75 && !isNaN(pressCount) && pressCount > 0;
  }).sort((a, b) => b.押下回数 - a.押下回数);

  const usedCandidates = new Set();
  const swapMap = {}; // { '元キー': '新キー' }

  // 5. マッチング処理とテーブルHTML生成
  const tbody = document.getElementById('suggestion-tbody');
  tbody.innerHTML = '';

  targetKeys.forEach((target, index) => {
    const targetCost = parseFloat(target['負担スコア(物理)']);
    const targetFreq = parseFloat(target['使用頻度F(k)']);

    const validCandidates = eligibleScores.filter(item => {
      if (usedCandidates.has(item.キー) || item.キー === target.キー) return false;
      const cCost = parseFloat(item['負担スコア(物理)']);
      const cFreq = parseFloat(item['使用頻度F(k)']);
      return cCost < targetCost && cFreq < targetFreq;
    });

    validCandidates.sort((a, b) => {
      const scoreA = calculateSmallnessScore(parseFloat(a['負担スコア(物理)']), parseFloat(a['使用頻度F(k)']));
      const scoreB = calculateSmallnessScore(parseFloat(b['負担スコア(物理)']), parseFloat(b['使用頻度F(k)']));
      return scoreA - scoreB;
    });

    const candidate = validCandidates[0];
    const tr = document.createElement('tr');

    if (candidate) {
      usedCandidates.add(candidate.キー);

      // 🟢 互いの移動先を記録
      swapMap[target.キー] = candidate.キー;
      swapMap[candidate.キー] = target.キー;

      tr.innerHTML = `
        <td><strong>${index + 1}</strong></td>
        <td><strong style="color: #dc3545;">${target.キー}</strong></td>
        <td>${target['使用頻度F(k)']}</td>
        <td>${target['負担スコア(物理)']}</td>
        <td><strong style="color: #28a745;">${candidate.キー}</strong></td>
        <td>${candidate['負担スコア(物理)']}</td>
        <td>${candidate['使用頻度F(k)']}</td>
      `;
    } else {
      tr.innerHTML = `
        <td><strong>${index + 1}</strong></td>
        <td><strong style="color: #dc3545;">${target.キー}</strong></td>
        <td>${target['使用頻度F(k)']}</td>
        <td>${target['負担スコア(物理)']}</td>
        <td colspan="3" style="color: #888; text-align: center; font-size: 0.85em;">条件に合致する交換先なし</td>
      `;
    }
    tbody.appendChild(tr);
  });

  // 6. キーボードプレビューを描画
  function renderKeyboardPreview() {
    const container = document.getElementById('keyboard-preview');
    container.innerHTML = '';

    KEYBOARD_ROWS.forEach(row => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'preview-row';

      row.forEach(keyObj => {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'preview-key';
        if (keyObj.isSpace) keyDiv.classList.add('space-key');

        const originalName = keyObj.name;
        const newKey = swapMap[originalName];

        if (newKey) {
          // 🟢 入れ替えが発生したキーを一律ハイライト
          keyDiv.classList.add('swapped-key');
          keyDiv.innerHTML = `
            <span>${newKey}</span>
            <span class="original-label">(元:${originalName})</span>
          `;
        } else {
          keyDiv.textContent = originalName;
        }

        rowDiv.appendChild(keyDiv);
      });

      container.appendChild(rowDiv);
    });
  }

  renderKeyboardPreview();

  // 7. 隠しコマンド（"score"）の監視
  let secretCommand = '';
  document.addEventListener('keydown', (e) => {
    if (/^[a-zA-Z]$/.test(e.key)) {
      secretCommand += e.key.toLowerCase();
      if (secretCommand.length > 10) {
        secretCommand = secretCommand.slice(-10);
      }
      
      if (secretCommand.endsWith('score')) {
        const suggestionArea = document.getElementById('suggestion-area');
        if (suggestionArea) {
          suggestionArea.style.display = 'block';
          suggestionArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  });

  // 戻るボタン
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'main.html';
  });
});