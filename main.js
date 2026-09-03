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
    
    // 座標の表示
    if (settings.homeCoords && settings.homeCoords.length > 0) {
      displayCoords.textContent = settings.homeCoords.join(' , ');
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
    // 1. 許可する拡張子のリスト
    const allowedExtensions = ['.keylog2'];
    
    // 2. ファイル名から拡張子をチェック
    const fileName = file.name.toLowerCase();
    const isValid = allowedExtensions.some(ext => fileName.endsWith(ext));

    // 3. 拡張子がダメだった場合、アラートを出して終了
    if (!isValid) {
      alert('許可されていないファイル形式です。.keylog2 を選択してください。');
      fileInput.value = ''; // ファイル選択をリセット（必要に応じて）
      return; // 👈 ここで処理を強制終了する（下のアラートには進まない）
    }

    // --- ここから通常のファイル送信・読み込み処理 ---
    alert(`「${file.name}」の送信処理を開始します！\n（ファイルサイズ: ${file.size} bytes）`);
    
  } else {
    // ファイルが選択されていない場合の処理（任意）
    alert('ファイルを選択してください。');
  }
});

// 設定変更ボタンの処理（index.htmlに戻る）
changeSettingsBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

