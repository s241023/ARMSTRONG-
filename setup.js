// 画面要素の取得
const wizardScreen = document.getElementById('wizard-screen');
const confirmScreen = document.getElementById('confirm-screen');
const steps = document.querySelectorAll('.step');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const saveBtn = document.getElementById('saveBtn');

let currentStep = 0;

// 🟢 キーボード用の変数
let selectedCoords = []; // 文字ではなく座標を保存する配列
const maxKeys = 10;
const keyElements = document.querySelectorAll('.key');
const selectedKeysDisplay = document.getElementById('selected-keys-display');

// --- 画面更新 ---
function updateUI() {
  steps.forEach((step, index) => {
    step.classList.toggle('active', index === currentStep);
  });
  prevBtn.disabled = currentStep === 0;

  if (currentStep === steps.length - 1) {
    nextBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
  } else {
    nextBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
  }
}

// --- ウィザードの進む・戻る ---
nextBtn.addEventListener('click', () => {
  if (currentStep < steps.length - 1) {
    currentStep++;
    updateUI();
  }
});

prevBtn.addEventListener('click', () => {
  if (currentStep > 0) {
    currentStep--;
    updateUI();
  }
});

// 🟢 --- キーボード選択の処理（座標で管理） ---
function toggleKey(coordVal, element) {
  // すでに選択されている場合は解除
  if (selectedCoords.includes(coordVal)) {
    selectedCoords = selectedCoords.filter(c => c !== coordVal);
    element.classList.remove('selected');
  } else {
    // 選択されていない場合、上限に達していなければ追加
    if (selectedCoords.length < maxKeys) {
      selectedCoords.push(coordVal);
      element.classList.add('selected');
    } else {
      alert(`ホームポジションは最大${maxKeys}個までです。`);
    }
  }
  // 画面のテキストを更新（保存される座標を見えるようにする）
  selectedKeysDisplay.textContent = selectedCoords.length > 0 ? selectedCoords.join(' , ') : 'なし';
}

// 画面上のキーをクリックしたとき
keyElements.forEach(keyEl => {
  keyEl.addEventListener('click', () => {
    const coordVal = keyEl.getAttribute('data-coord'); // 座標を取得
    toggleKey(coordVal, keyEl);
  });
});

// 実際のキーボードを叩いたとき
document.addEventListener('keydown', (e) => {
  if (currentStep === 1 && wizardScreen.style.display !== 'none') {
    const keyChar = e.key.toUpperCase();
    // 入力された文字に対応するキー要素を探す
    const keyEl = document.querySelector(`.key[data-key="${keyChar}"]`);
    
    if (keyEl) {
      const coordVal = keyEl.getAttribute('data-coord'); // そのキーの座標を取得
      toggleKey(coordVal, keyEl);
    }
  }
});

// --- 保存処理 ---
saveBtn.addEventListener('click', () => {
  const usehands = document.getElementById('usehands').value;

  const settingsData = {
    usehands: usehands,
    homeCoords: selectedCoords
  };

  localStorage.setItem('appSettings', JSON.stringify(settingsData));
  
  // 変更：保存したら main.html にページ移動する
  window.location.href = 'main.html';
});

// --- 確認画面のボタン ---
document.getElementById('startBtn').addEventListener('click', () => {
  // 変更：「この設定で開始」を押したら main.html にページ移動する
  window.location.href = 'main.html';
});

document.getElementById('resetBtn').addEventListener('click', () => {
  confirmScreen.style.display = 'none';
  wizardScreen.style.display = 'block';
  currentStep = 0;
  updateUI();
});

// --- ページ読み込み時の復元処理 ---
window.addEventListener('DOMContentLoaded', () => {
  const savedData = localStorage.getItem('appSettings');
  
  if (savedData) {
    const settings = JSON.parse(savedData);
    
    // 復元: 使用する手
    if (settings.usehands) document.getElementById('usehands').value = settings.usehands;
    
    // 復元: キーボード座標
    if (settings.homeCoords && Array.isArray(settings.homeCoords)) {
      selectedCoords = settings.homeCoords;
      
      // 画面上のキーの色を復元
      selectedCoords.forEach(coordVal => {
        const keyEl = document.querySelector(`.key[data-coord="${coordVal}"]`);
        if (keyEl) keyEl.classList.add('selected');
      });
      selectedKeysDisplay.textContent = selectedCoords.length > 0 ? selectedCoords.join(' , ') : 'なし';
    }

    // 確認画面へのテキスト反映
    const handsText = document.querySelector(`#usehands option[value="${settings.usehands}"]`)?.textContent;
    document.getElementById('confirm-hands').textContent = handsText || '不明';
    document.getElementById('confirm-keys').textContent = (settings.homeCoords && settings.homeCoords.length > 0) ? settings.homeCoords.join(' , ') : '未設定';

    confirmScreen.style.display = 'block';
  } else {
    wizardScreen.style.display = 'block';
    updateUI();
  }
});