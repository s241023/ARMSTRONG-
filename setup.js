const wizardScreen = document.getElementById('wizard-screen');
const confirmScreen = document.getElementById('confirm-screen');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const saveBtn = document.getElementById('saveBtn');

let currentStepIndex = 0;
let activeSteps = []; 

// キーボードと割り当て用の変数
let selectedCoords = [];
let baseCoordStep3 = null; 
let baseCoordStep4 = null; 
const maxKeys = 10;
let unusedFingers = [];
let currentMapping = {}; // 🟢 確定用のマッピングデータを保持する変数

const fingerNames = {
  'right-thumb': '右親', 'right-index': '右人', 'right-middle': '右中', 'right-ring': '右薬', 'right-pinky': '右小',
  'left-thumb': '左親', 'left-index': '左人', 'left-middle': '左中', 'left-ring': '左薬', 'left-pinky': '左小'
};

// 選択状況に応じて経由するステップを構築する
function initSteps() {
  const usehands = document.getElementById('usehands').value;
  activeSteps = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3')
  ];
  if (usehands === 'r&l') {
    activeSteps.push(document.getElementById('step-4')); 
  }
  activeSteps.push(document.getElementById('step-5')); // 🟢 確認画面を追加
  activeSteps.push(document.getElementById('step-6')); // 完了画面
}

function updateUI() {
  document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
  activeSteps[currentStepIndex].classList.add('active');

  prevBtn.disabled = currentStepIndex === 0;

  if (currentStepIndex === activeSteps.length - 1) {
    nextBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
  } else {
    nextBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
  }
}

document.getElementById('usehands').addEventListener('change', initSteps);

// --- ウィザードの進む・戻る (ロジックを整理) ---
nextBtn.addEventListener('click', () => {
  const currentStepElement = activeSteps[currentStepIndex];

  // バリデーションチェック
  if (currentStepElement.id === 'step-2') {
    if (selectedCoords.length === 0) {
      alert('ホームポジションを1つ以上選択してください。'); return;
    }
  } else if (currentStepElement.id === 'step-3') {
    if (!baseCoordStep3) {
      alert('基準となるキーを1つ選択してください。'); return;
    }
  } else if (currentStepElement.id === 'step-4') {
    if (!baseCoordStep4) {
      alert('左手の基準となるキーを1つ選択してください。'); return;
    }
  }

  // 次のステップへ進み、必要なUIを構築
  if (currentStepIndex < activeSteps.length - 1) {
    currentStepIndex++;
    const nextStepElement = activeSteps[currentStepIndex];
    
    if (nextStepElement.id === 'step-3') buildStep3();
    if (nextStepElement.id === 'step-4') buildStep4();
    if (nextStepElement.id === 'step-5') buildStep5(); // 🟢 確認画面の生成処理を呼び出し
    
    updateUI();
  }
});

prevBtn.addEventListener('click', () => {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    updateUI();
  }
});

// --- ステップ2の処理 ---
function toggleKey(coordVal, element) {
  if (selectedCoords.includes(coordVal)) {
    selectedCoords = selectedCoords.filter(c => c !== coordVal);
    element.classList.remove('selected');
  } else {
    if (selectedCoords.length < maxKeys) {
      selectedCoords.push(coordVal);
      element.classList.add('selected');
    } else {
      alert(`ホームポジションは最大${maxKeys}個までです。`);
    }
  }
  document.getElementById('selected-keys-display').textContent = selectedCoords.length > 0 ? selectedCoords.join(' , ') : 'なし';
}

document.querySelectorAll('#step-2 .key').forEach(keyEl => {
  keyEl.addEventListener('click', () => toggleKey(keyEl.getAttribute('data-coord'), keyEl));
});

// --- ステップ3 (右手/片手) の動的構築 ---
function buildStep3() {
  const usehands = document.getElementById('usehands').value;
  document.getElementById('step3-title').textContent = (usehands === 'r&l') ? 'ステップ 3: 右手の割り当て' : 'ステップ 3: 指の割り当て';
  document.getElementById('unused-finger-title').textContent = (usehands === 'r&l') ? '右手で使用しない指があれば選択してください' : '使用しない指があれば選択してください';

  const fingerArea = document.getElementById('finger-buttons-area');
  fingerArea.innerHTML = '';
  baseCoordStep3 = null;
  document.getElementById('base-keys-display').textContent = 'なし';

  let availableFingers = [];
  if (usehands === 'right' || usehands === 'r&l') {
    availableFingers.push({ id: 'right-thumb', label: '右親指' }, { id: 'right-index', label: '右人差' }, { id: 'right-middle', label: '右中指' }, { id: 'right-ring', label: '右薬指' }, { id: 'right-pinky', label: '右小指' });
  } else if (usehands === 'left') {
    availableFingers.push({ id: 'left-pinky', label: '左小指' }, { id: 'left-ring', label: '左薬指' }, { id: 'left-middle', label: '左中指' }, { id: 'left-index', label: '左人差' }, { id: 'left-thumb', label: '左親指' });
  }

  availableFingers.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'finger-btn';
    if (unusedFingers.includes(f.id)) btn.classList.add('selected-finger');
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected-finger');
      if (btn.classList.contains('selected-finger')) {
        if (!unusedFingers.includes(f.id)) unusedFingers.push(f.id);
      } else {
        unusedFingers = unusedFingers.filter(id => id !== f.id);
      }
      updateBaseFingerLabelStep3(usehands);
    });
    fingerArea.appendChild(btn);
  });

  const step3KeyboardArea = document.getElementById('step3-keyboard-area');
  step3KeyboardArea.innerHTML = document.querySelector('#step-2 .keyboard').outerHTML;

  step3KeyboardArea.querySelectorAll('.key').forEach(keyEl => {
    keyEl.classList.remove('selected');
    const coord = keyEl.getAttribute('data-coord');
    if (!selectedCoords.includes(coord)) {
      keyEl.classList.add('disabled-key'); keyEl.disabled = true;
    } else {
      keyEl.classList.add('available-base-key');
      keyEl.addEventListener('click', () => toggleBaseKeyStep3(coord, keyEl));
    }
  });

  updateBaseFingerLabelStep3(usehands);
}

function updateBaseFingerLabelStep3(usehands) {
  const targetSide = (usehands === 'left') ? 'left' : 'right';
  const labelText = getBaseFingerName(targetSide);
  document.getElementById('base-instruction-text').innerHTML = `<strong><span id="base-finger-label">${labelText}</span></strong> を置くキーを、以下のホームポジションの中から <strong style="color:#d9534f; font-size:1.2em;">1つ</strong> クリックしてください:`;
}

function toggleBaseKeyStep3(coordVal, element) {
  if (baseCoordStep3 === coordVal) {
    baseCoordStep3 = null; element.classList.remove('selected-base');
  } else {
    const existing = document.querySelector('#step3-keyboard-area .selected-base');
    if (existing) existing.classList.remove('selected-base');
    baseCoordStep3 = coordVal; element.classList.add('selected-base');
  }
  document.getElementById('base-keys-display').textContent = baseCoordStep3 || 'なし';
}

// --- ステップ4 (左手用) の動的構築 ---
function buildStep4() {
  const fingerArea = document.getElementById('finger-buttons-area-left');
  fingerArea.innerHTML = '';
  baseCoordStep4 = null;
  document.getElementById('base-keys-display-left').textContent = 'なし';

  let availableFingers = [
    { id: 'left-pinky', label: '左小指' }, { id: 'left-ring', label: '左薬指' },
    { id: 'left-middle', label: '左中指' }, { id: 'left-index', label: '左人差' }, { id: 'left-thumb', label: '左親指' }
  ];

  availableFingers.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'finger-btn';
    if (unusedFingers.includes(f.id)) btn.classList.add('selected-finger');
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected-finger');
      if (btn.classList.contains('selected-finger')) {
        if (!unusedFingers.includes(f.id)) unusedFingers.push(f.id);
      } else {
        unusedFingers = unusedFingers.filter(id => id !== f.id);
      }
      updateBaseFingerLabelStep4();
    });
    fingerArea.appendChild(btn);
  });

  const step4KeyboardArea = document.getElementById('step4-keyboard-area');
  step4KeyboardArea.innerHTML = document.querySelector('#step-2 .keyboard').outerHTML;

  step4KeyboardArea.querySelectorAll('.key').forEach(keyEl => {
    keyEl.classList.remove('selected');
    const coord = keyEl.getAttribute('data-coord');

    if (!selectedCoords.includes(coord)) {
      keyEl.classList.add('disabled-key'); keyEl.disabled = true;
    } else if (coord === baseCoordStep3) {
      keyEl.classList.add('disabled-key'); keyEl.disabled = true;
      keyEl.style.backgroundColor = '#d1e7dd'; 
      keyEl.textContent = '済';
    } else {
      keyEl.classList.add('available-base-key');
      keyEl.addEventListener('click', () => toggleBaseKeyStep4(coord, keyEl));
    }
  });

  updateBaseFingerLabelStep4();
}

function updateBaseFingerLabelStep4() {
  const labelText = getBaseFingerName('left');
  document.getElementById('base-instruction-text-left').innerHTML = `<strong><span id="base-finger-label-left">${labelText}</span></strong> を置くキーを、以下のホームポジションの中から <strong style="color:#d9534f; font-size:1.2em;">1つ</strong> クリックしてください:`;
}

function toggleBaseKeyStep4(coordVal, element) {
  if (baseCoordStep4 === coordVal) {
    baseCoordStep4 = null; element.classList.remove('selected-base');
  } else {
    const existing = document.querySelector('#step4-keyboard-area .selected-base');
    if (existing) existing.classList.remove('selected-base');
    baseCoordStep4 = coordVal; element.classList.add('selected-base');
  }
  document.getElementById('base-keys-display-left').textContent = baseCoordStep4 || 'なし';
}

// 🟢 --- ステップ5: 割り当て確認・修正画面の生成 ---
function buildStep5() {
  const container = document.getElementById('mapping-edit-container');
  container.innerHTML = '';
  
  // ステップ1で選んだ手を取得
  const usehands = document.getElementById('usehands').value;
  
  // 自動計算を実行して currentMapping に初期値をセット
  currentMapping = calculateFingerMapping();
  
  // 選択されたキーをX座標順（左から右）に並び替え
  const sortedCoords = [...selectedCoords].sort((a, b) => JSON.parse(a)[0] - JSON.parse(b)[0]);
  
  // 使用する手に応じてドロップダウンの選択肢を絞り込む
  let availableFingers = [];
  if (usehands === 'left' || usehands === 'r&l') {
    availableFingers.push(
      { id: 'left-pinky', label: '左小指' }, { id: 'left-ring', label: '左薬指' },
      { id: 'left-middle', label: '左中指' }, { id: 'left-index', label: '左人差' }, { id: 'left-thumb', label: '左親指' }
    );
  }
  if (usehands === 'right' || usehands === 'r&l') {
    availableFingers.push(
      { id: 'right-thumb', label: '右親指' }, { id: 'right-index', label: '右人差' },
      { id: 'right-middle', label: '右中指' }, { id: 'right-ring', label: '右薬指' }, { id: 'right-pinky', label: '右小指' }
    );
  }
  
  // 各キーに対する行を生成
  sortedCoords.forEach(coord => {
    const keyEl = document.querySelector(`#step-2 .key[data-coord="${coord}"]`);
    const keyName = keyEl ? keyEl.getAttribute('data-key') : coord;
    
    const row = document.createElement('div');
    row.className = 'mapping-row';
    
    const label = document.createElement('div');
    label.className = 'mapping-key-label';
    // 「キー」という文字を消してアルファベットやSpaceのみにする
    label.textContent = keyName === 'SPACE' ? 'Space' : keyName;
    
    const select = document.createElement('select');
    select.className = 'mapping-select';
    
    // 絞り込んだ指のリストからドロップダウンの中身を生成
    availableFingers.forEach(f => {
      const option = document.createElement('option');
      option.value = f.id;
      option.textContent = f.label;
      if (currentMapping[coord] === f.id) {
        option.selected = true; // 自動計算された指を初期選択状態にする
      }
      select.appendChild(option);
    });
    
    // ドロップダウンが変更されたら、確定用のデータを上書き
    select.addEventListener('change', (e) => {
      currentMapping[coord] = e.target.value;
    });
    
    row.appendChild(label);
    row.appendChild(select);
    container.appendChild(row);
  });
}

// --- 共通ユーティリティ ---
function getBaseFingerName(side) {
  const priority = ['index', 'middle', 'ring', 'pinky', 'thumb'];
  for (let p of priority) {
    if (!unusedFingers.includes(`${side}-${p}`)) return p === 'index' ? '人差し指' : p === 'middle' ? '中指' : p === 'ring' ? '薬指' : p === 'pinky' ? '小指' : '親指';
  }
  return '人差し指';
}

function getBaseFingerNameEng(side) {
  const priority = ['index', 'middle', 'ring', 'pinky', 'thumb'];
  for (let p of priority) {
    if (!unusedFingers.includes(`${side}-${p}`)) return p;
  }
  return 'index';
}

// 物理キーボード入力
document.addEventListener('keydown', (e) => {
  let keyChar = e.key === ' ' || e.code === 'Space' ? 'SPACE' : e.key.toUpperCase();
  if (keyChar === 'SPACE') e.preventDefault();

  const currentStepElement = activeSteps[currentStepIndex];
  if (!currentStepElement) return;

  if (currentStepElement.id === 'step-2') {
    const keyEl = document.querySelector(`#step-2 .key[data-key="${keyChar}"]`);
    if (keyEl) toggleKey(keyEl.getAttribute('data-coord'), keyEl);
  } else if (currentStepElement.id === 'step-3') {
    const keyEl = document.querySelector(`#step3-keyboard-area .key[data-key="${keyChar}"]`);
    if (keyEl && !keyEl.classList.contains('disabled-key')) toggleBaseKeyStep3(keyEl.getAttribute('data-coord'), keyEl);
  } else if (currentStepElement.id === 'step-4') {
    const keyEl = document.querySelector(`#step4-keyboard-area .key[data-key="${keyChar}"]`);
    if (keyEl && !keyEl.classList.contains('disabled-key')) toggleBaseKeyStep4(keyEl.getAttribute('data-coord'), keyEl);
  }
});

// --- 指の自動マッピング計算 ---
function calculateFingerMapping() {
  const usehands = document.getElementById('usehands').value;
  let mapping = {}; 
  const sortedCoords = [...selectedCoords].sort((a, b) => JSON.parse(a)[0] - JSON.parse(b)[0]);

  if (usehands === 'right' || usehands === 'left') {
    const baseCoord = baseCoordStep3;
    const baseIdx = sortedCoords.indexOf(baseCoord);
    
    let fingerOrder = usehands === 'right' 
      ? ['right-thumb', 'right-index', 'right-middle', 'right-ring', 'right-pinky']
      : ['left-pinky', 'left-ring', 'left-middle', 'left-index', 'left-thumb'];
    fingerOrder = fingerOrder.filter(f => !unusedFingers.includes(f));
    
    const targetSide = usehands === 'right' ? 'right' : 'left';
    const baseFinger = `${targetSide}-${getBaseFingerNameEng(targetSide)}`;
    const baseFingerIdx = fingerOrder.indexOf(baseFinger);
    
    mapping[baseCoord] = baseFinger;

    let fIdx = baseFingerIdx - 1;
    for (let i = baseIdx - 1; i >= 0; i--) {
      mapping[sortedCoords[i]] = (fIdx >= 0) ? fingerOrder[fIdx--] : fingerOrder[0];
    }
    fIdx = baseFingerIdx + 1;
    for (let i = baseIdx + 1; i < sortedCoords.length; i++) {
      mapping[sortedCoords[i]] = (fIdx < fingerOrder.length) ? fingerOrder[fIdx++] : fingerOrder[fingerOrder.length - 1];
    }

  } else if (usehands === 'r&l') {
    let rightBaseIdx = sortedCoords.indexOf(baseCoordStep3);
    let leftBaseIdx = sortedCoords.indexOf(baseCoordStep4);

    if (leftBaseIdx > rightBaseIdx) [leftBaseIdx, rightBaseIdx] = [rightBaseIdx, leftBaseIdx];

    let leftFingers = ['left-index', 'left-middle', 'left-ring', 'left-pinky'].filter(f => !unusedFingers.includes(f));
    let rightFingers = ['right-index', 'right-middle', 'right-ring', 'right-pinky'].filter(f => !unusedFingers.includes(f));
    let thumbs = ['left-thumb', 'right-thumb'].filter(f => !unusedFingers.includes(f));

    let leftBaseFinger = `left-${getBaseFingerNameEng('left')}`;
    let rightBaseFinger = `right-${getBaseFingerNameEng('right')}`;

    mapping[sortedCoords[leftBaseIdx]] = leftBaseFinger;
    let lBaseIdxInArr = leftFingers.indexOf(leftBaseFinger);
    if(lBaseIdxInArr === -1) lBaseIdxInArr = 0;
    let fIdx = lBaseIdxInArr + 1;
    for (let i = leftBaseIdx - 1; i >= 0; i--) {
      mapping[sortedCoords[i]] = (fIdx < leftFingers.length) ? leftFingers[fIdx++] : (leftFingers[leftFingers.length - 1] || 'left-pinky');
    }

    mapping[sortedCoords[rightBaseIdx]] = rightBaseFinger;
    let rBaseIdxInArr = rightFingers.indexOf(rightBaseFinger);
    if(rBaseIdxInArr === -1) rBaseIdxInArr = 0;
    fIdx = rBaseIdxInArr + 1;
    for (let i = rightBaseIdx + 1; i < sortedCoords.length; i++) {
      mapping[sortedCoords[i]] = (fIdx < rightFingers.length) ? rightFingers[fIdx++] : (rightFingers[rightFingers.length - 1] || 'right-pinky');
    }

    let thumbIdx = 0;
    for (let i = leftBaseIdx + 1; i < rightBaseIdx; i++) {
      mapping[sortedCoords[i]] = (thumbs.length > 0) ? thumbs[thumbIdx % thumbs.length] : 'thumb';
      thumbIdx++;
    }
  }
  return mapping;
}

// --- 保存と復元 ---
saveBtn.addEventListener('click', () => {
  const settingsData = {
    usehands: document.getElementById('usehands').value,
    homeCoords: selectedCoords,
    fingerMapping: currentMapping // 🟢 修正結果が反映されたデータを保存
  };
  localStorage.setItem('appSettings', JSON.stringify(settingsData));
  window.location.href = 'main.html';
});

document.getElementById('startBtn').addEventListener('click', () => window.location.href = 'main.html');

document.getElementById('resetBtn').addEventListener('click', () => {
  confirmScreen.style.display = 'none';
  wizardScreen.style.display = 'block';
  currentStepIndex = 0;
  initSteps();
  updateUI();
});

window.addEventListener('DOMContentLoaded', () => {
  const savedData = localStorage.getItem('appSettings');
  if (savedData) {
    const settings = JSON.parse(savedData);
    if (settings.usehands) document.getElementById('usehands').value = settings.usehands;
    if (settings.homeCoords && Array.isArray(settings.homeCoords)) {
      selectedCoords = settings.homeCoords;
      selectedCoords.forEach(coordVal => {
        const keyEl = document.querySelector(`.key[data-coord="${coordVal}"]`);
        if (keyEl) keyEl.classList.add('selected');
      });
      document.getElementById('selected-keys-display').textContent = selectedCoords.length > 0 ? selectedCoords.join(' , ') : 'なし';
    }

    const handsText = document.querySelector(`#usehands option[value="${settings.usehands}"]`)?.textContent;
    document.getElementById('confirm-hands').textContent = handsText || '不明';
    document.getElementById('confirm-keys').textContent = (settings.homeCoords && settings.homeCoords.length > 0) ? settings.homeCoords.join(' , ') : '未設定';

    if (settings.fingerMapping) {
      const mappingDisplay = Object.entries(settings.fingerMapping)
        .map(([coord, fingerId]) => `${coord}:${fingerNames[fingerId]}`)
        .join(' / ');
      document.getElementById('confirm-mapping').textContent = mappingDisplay;
    }
    confirmScreen.style.display = 'block';
  } else {
    initSteps();
    wizardScreen.style.display = 'block';
    updateUI();
  }
});