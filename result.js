window.addEventListener('DOMContentLoaded', () => {
  // 1. ローカルストレージからデータの取得
  const settings = getSettings() ?? {};
  const scores = loadJSON(STORAGE.scores, []);

  if (!scores || scores.length === 0) {
    alert('スコアデータが見つかりません。メイン画面から解析を行ってください。');
    window.location.href = 'main.html';
    return;
  }

  // 標準QWERTYレイアウト構造（初期配置定義）
  const DEFAULT_KEYBOARD_ROWS = DEFAULT_ROWS; // common.js の共通定義

  // 「提案前（解析・計算時）」の最新キー配列を構築
  const KEYBOARD_ROWS = applySwapMap(DEFAULT_KEYBOARD_ROWS, loadJSON(STORAGE.latest, null)?.swapMap);


  // 2. 設定情報の簡易表示
  const displayHands = document.getElementById('user-hands');
  const displayCoordsCount = document.getElementById('user-coords-count');
  
  if (displayHands) {
    displayHands.textContent = HAND_LABELS[settings.usehands] ?? '未設定';
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
  const proposedSwapMap = {}; // 今回の改善提案による入れ替え { '提案前キー': '提案後キー' }

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

      // 互いの移動先を記録
      proposedSwapMap[target.キー] = candidate.キー;
      proposedSwapMap[candidate.キー] = target.キー;

      tr.innerHTML = `
        <td><strong>${index + 1}</strong></td>
        <td><strong class="target-key">${target.キー}</strong></td>
        <td>${target['使用頻度F(k)']}</td>
        <td>${target['負担スコア(物理)']}</td>
        <td><strong class="candidate-key">${candidate.キー}</strong></td>
        <td>${candidate['負担スコア(物理)']}</td>
        <td>${candidate['使用頻度F(k)']}</td>
      `;
    } else {
      tr.innerHTML = `
        <td><strong>${index + 1}</strong></td>
        <td><strong class="target-key">${target.キー}</strong></td>
        <td>${target['使用頻度F(k)']}</td>
        <td>${target['負担スコア(物理)']}</td>
        <td colspan="3" class="no-candidate">条件に合致する交換先なし</td>
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

        const originalName = keyObj.name; // 提案前（計算時）のキー名
        const newKey = proposedSwapMap[originalName]; // 提案後のキー名

        if (newKey) {
          // 入れ替えが発生したキーを一律ハイライト
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

  // 7. 隠しコマンド("score")で詳細テーブルを表示
  onSecretCommand('score', () => {
    const area = document.getElementById('suggestion-area');
    if (!area) return;
    area.style.display = 'block';
    area.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // 戻るボタン
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'main.html';
  });

  // ローカルストレージに最新と履歴を分けて保存する処理
  document.getElementById('saveConfigBtn').addEventListener('click', () => {
    if (Object.keys(proposedSwapMap).length === 0) {
      alert('入れ替えされたキーが存在しません。');
      return;
    }

    // 提案前の配置に今回の提案を適用し、標準QWERTYとの差分(累計swapMap)を保存する
    const finalKeyboard = JSON.parse(JSON.stringify(KEYBOARD_ROWS));
    finalKeyboard.forEach(row => row.forEach(keyObj => {
      if (!keyObj.isSpace && proposedSwapMap[keyObj.name]) keyObj.name = proposedSwapMap[keyObj.name];
    }));
    commitLayout(buildSwapMap(finalKeyboard)); // 履歴退避・最新更新・スコア無効化

    // 4. ボタンの見た目を変更してフィードバック
    const btn = document.getElementById('saveConfigBtn');
    btn.textContent = '✅ 最新配列として保存！';
    btn.classList.replace('btn-success', 'btn-secondary');
    btn.disabled = true; // 連続クリック防止
    
    alert('最新の配列として保存し、古い配列は履歴に移動しました！');
  });

});