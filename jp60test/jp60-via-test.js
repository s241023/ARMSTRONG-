'use strict';

// JP60 / QMK 0.18.17 / VIA 0x000A 専用の隔離テスト。
// 既存のARMSTRONG/common.js/result.js/edit.jsには依存しない。
//
// 重要:
// - 0x06 dynamic_keymap_reset
// - 0x0A eeprom_reset
// - 0x0B bootloader_jump
// - 0x07/0x08/0x09 lighting系
// は意図的に使用しない。
//
// 参照:
// QMK 0.18.17 via.c / via.h / dynamic_keymap.c
// Remap WebHid.ts / Commands.ts

const JP60 = Object.freeze({
  name: 'JP60',
  expectedVendorId: 0xA103,
  expectedProductId: 0x0024,
  viaUsagePage: 0xFF60,
  viaUsage: 0x61,
  matrixRows: 5,
  matrixCols: 14,
  baseLayer: 0,
  safeUnusedCell: { layer: 0, row: 3, column: 1 },
  knownUnusedCells: [
    [3, 1],
    [4, 4],
    [4, 5],
    [4, 6],
    [4, 8],
    [4, 9]
  ],
});

const VIA = Object.freeze({
  GET_PROTOCOL_VERSION: 0x01,
  GET_KEYBOARD_VALUE: 0x02,
  SET_KEYBOARD_VALUE: 0x03,
  GET_KEYCODE: 0x04,
  SET_KEYCODE: 0x05,
  DYNAMIC_KEYMAP_RESET: 0x06,
  LIGHTING_SET_VALUE: 0x07,
  LIGHTING_GET_VALUE: 0x08,
  LIGHTING_SAVE: 0x09,
  EEPROM_RESET: 0x0A,
  BOOTLOADER_JUMP: 0x0B,
  DYNAMIC_KEYMAP_GET_LAYER_COUNT: 0x11,
});

const QMK = Object.freeze({
  KC_NO: 0x0000,
  KC_A: 0x0004,
});

const els = {
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  readUnusedBtn: document.getElementById('readUnusedBtn'),
  enableWrite: document.getElementById('enableWrite'),
  confirmText: document.getElementById('confirmText'),
  writeTestBtn: document.getElementById('writeTestBtn'),
  status: document.getElementById('status'),
  productName: document.getElementById('productName'),
  vendorId: document.getElementById('vendorId'),
  productId: document.getElementById('productId'),
  usageInfo: document.getElementById('usageInfo'),
  reportId: document.getElementById('reportId'),
  protocol: document.getElementById('protocol'),
  layers: document.getElementById('layers'),
  readResult: document.getElementById('readResult'),
  writeResult: document.getElementById('writeResult'),
  logView: document.getElementById('logView'),
};

let device = null;
let reportId = 0;
let pending = null;
let currentProtocol = null;
let currentLayerCount = null;
let lastUnusedRead = null;

function now() {
  return new Date().toLocaleTimeString('ja-JP', { hour12: false });
}

function hex8(value) {
  return `0x${Number(value).toString(16).padStart(2, '0')}`;
}

function hex16(value) {
  return `0x${Number(value).toString(16).padStart(4, '0')}`;
}

function bytesHex(bytes) {
  return [...bytes].map(hex8).join(' ');
}

function uiLog(level, message, data) {
  const line =
    `[${now()}] [JP60-VIA] ${message}` +
    `${data === undefined ? '' : ` ${JSON.stringify(data)}`}`;

  els.logView.textContent += line + '\n';
  els.logView.scrollTop = els.logView.scrollHeight;

  if (level === 'error') {
    console.error(line, data);
  } else if (level === 'warn') {
    console.warn(line, data);
  } else {
    console.log(line, data);
  }
}

function setStatus(text, kind = 'normal') {
  els.status.textContent = text;
  els.status.style.color =
    kind === 'error'
      ? '#c62828'
      : kind === 'ok'
        ? '#2e7d32'
        : '';
}

function assertWebHidAvailable() {
  if (!window.isSecureContext) {
    throw new Error(
      'Secure Contextではありません。' +
      'GitHub Pages等のHTTPS、またはlocalhostで実行してください。'
    );
  }

  if (!('hid' in navigator)) {
    throw new Error(
      'navigator.hid がありません。このブラウザではWebHIDを利用できません。'
    );
  }
}

function getViaCollection(hidDevice) {
  return (
    (hidDevice.collections || []).find(
      c =>
        c.usagePage === JP60.viaUsagePage &&
        c.usage === JP60.viaUsage
    ) || null
  );
}

function findOutputReportId(hidDevice, collection) {
  const outputReports = collection?.outputReports || [];

  if (
    outputReports.length > 0 &&
    outputReports[0].reportId !== undefined
  ) {
    return outputReports[0].reportId;
  }

  // Remapと同様、Report IDなしなら0。
  return 0;
}

function dumpDeviceInfo(hidDevice) {
  const collection = getViaCollection(hidDevice);

  const info = {
    productName: hidDevice.productName,
    vendorId: hex16(hidDevice.vendorId),
    productId: hex16(hidDevice.productId),
    usagePage: collection
      ? hex16(collection.usagePage)
      : null,
    usage: collection
      ? hex8(collection.usage)
      : null,
    opened: hidDevice.opened,
    collections: (hidDevice.collections || []).map(c => ({
      usagePage: c.usagePage,
      usage: c.usage,
      inputReports: (c.inputReports || []).map(
        r => r.reportId
      ),
      outputReports: (c.outputReports || []).map(
        r => r.reportId
      ),
      featureReports: (c.featureReports || []).map(
        r => r.reportId
      ),
    })),
  };

  console.table(info.collections);
  uiLog('log', 'DEVICE INFO', info);
}

function inputReportHandler(event) {
  const data = new Uint8Array(event.data.buffer);

  uiLog('log', 'INPUT REPORT', {
    eventReportId: event.reportId,
    bytes: bytesHex(data),
  });

  if (!pending) {
    uiLog(
      'warn',
      '入力レポートを受信しましたが、待機中コマンドがありません。無視します。'
    );
    return;
  }

  if (pending.ignoreUntilNext) {
    if (!pending.matcher(data)) {
      uiLog(
        'warn',
        `待機中コマンドと一致しない入力レポートを無視: ${pending.label}`
      );
      return;
    }

    pending.ignoreUntilNext = false;
  }

  if (!pending.matcher(data)) {
    uiLog(
      'warn',
      `応答形式が一致しないため無視: ${pending.label}`
    );
    return;
  }

  const p = pending;

  pending = null;
  clearTimeout(p.timer);

  p.resolve(data);
}

async function ensureOpen() {
  if (!device) {
    throw new Error(
      'HID deviceが選択されていません。'
    );
  }

  if (!device.opened) {
    uiLog(
      'log',
      'Opening HID device...'
    );

    await device.open();
  }
}

async function connectJP60() {
  uiLog(
    'log',
    '=== CONNECT START ==='
  );

  assertWebHidAvailable();

  const authorized =
    await navigator.hid.getDevices();

  uiLog(
    'log',
    `getDevices(): ${authorized.length}件`
  );

  const matchingAuthorized =
    authorized.filter(d => getViaCollection(d));

  if (matchingAuthorized.length > 0) {
    console.table(
      matchingAuthorized.map(d => ({
        productName: d.productName,
        vendorId: hex16(d.vendorId),
        productId: hex16(d.productId),
      }))
    );
  }

  // 安全のため、以前に許可したデバイスが複数ある場合でも自動選択しない。
  // requestDeviceでユーザーに明示選択してもらう。
  const selected =
    await navigator.hid.requestDevice({
      filters: [
        {
          usagePage: JP60.viaUsagePage,
          usage: JP60.viaUsage,
        },
      ],
    });

  if (!selected || selected.length === 0) {
    throw new Error(
      'デバイスが選択されませんでした。'
    );
  }

  const selectedDevice = selected[0];

  const collection =
    getViaCollection(selectedDevice);

  if (!collection) {
    throw new Error(
      '選択デバイスにVIA用HID collection (0xFF60/0x61) がありません。'
    );
  }

  // JP60の既知VID/PIDと一致しない場合は、診断だけ許可し、書き込みボタンは有効化しない。
  const expectedId =
    selectedDevice.vendorId ===
      JP60.expectedVendorId &&
    selectedDevice.productId ===
      JP60.expectedProductId;

  device = selectedDevice;

  reportId =
    findOutputReportId(
      device,
      collection
    );

  els.productName.textContent =
    device.productName || '-';

  els.vendorId.textContent =
    hex16(device.vendorId);

  els.productId.textContent =
    hex16(device.productId);

  els.usageInfo.textContent =
    `${hex16(collection.usagePage)} / ${hex8(collection.usage)}`;

  els.reportId.textContent =
    hex8(reportId);

  dumpDeviceInfo(device);

  uiLog(
    expectedId ? 'log' : 'warn',
    expectedId
      ? 'JP60 expected VID/PID confirmed.'
      : 'VID/PID is not the expected JP60 pair. READ-ONLY diagnostics only.',
    {
      expectedVendorId:
        hex16(JP60.expectedVendorId),
      expectedProductId:
        hex16(JP60.expectedProductId),
      actualVendorId:
        hex16(device.vendorId),
      actualProductId:
        hex16(device.productId),
    }
  );

  device.addEventListener(
    'inputreport',
    inputReportHandler
  );

  try {
    await ensureOpen();

    setStatus(
      '接続済み',
      'ok'
    );

    await protocolCheck();
    await layerCountCheck();

  } catch (error) {
    await disconnectJP60();
    throw error;
  }

  // 書き込みボタンはprotocol+layer+expected VID/PID+unused checkの後に有効化。
  els.readUnusedBtn.disabled = false;

  updateWriteAvailability();

  uiLog(
    'log',
    '=== CONNECT SUCCESS ==='
  );
}

function sendCommand(
  payload,
  matcher,
  label,
  timeoutMs = 1500
) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureOpen();

      if (pending) {
        reject(
          new Error(
            `別のコマンド待ち中です: ${pending.label}`
          )
        );
        return;
      }

      const report =
        new Uint8Array(32);

      report.set(payload);

      uiLog(
        'log',
        `SEND ${label}`,
        {
          reportId:
            hex8(reportId),
          payload:
            bytesHex(payload),
        }
      );

      const timer = setTimeout(() => {
        if (pending?.label === label) {
          const p = pending;

          pending = null;

          uiLog(
            'error',
            `TIMEOUT ${label}`
          );

          p.reject(
            new Error(
              `${label}: ${timeoutMs}ms応答なし`
            )
          );
        }
      }, timeoutMs);

      pending = {
        label,
        matcher,
        resolve,
        reject,
        timer,
        ignoreUntilNext: false,
      };

      try {
        await device.sendReport(
          reportId,
          report
        );

      } catch (error) {
        if (pending?.label === label) {
          clearTimeout(
            pending.timer
          );

          pending = null;
        }

        uiLog(
          'error',
          `sendReport FAILED ${label}`,
          error?.message || error
        );

        reject(error);
      }

    } catch (error) {
      reject(error);
    }
  });
}

async function protocolCheck() {
  uiLog(
    'log',
    '=== STEP: VIA PROTOCOL ==='
  );

  const response =
    await sendCommand(
      new Uint8Array([
        VIA.GET_PROTOCOL_VERSION
      ]),
      data =>
        data[0] ===
        VIA.GET_PROTOCOL_VERSION,
      'GET_PROTOCOL_VERSION'
    );

  const version =
    (response[1] << 8) |
    response[2];

  currentProtocol =
    version;

  els.protocol.textContent =
    hex16(version);

  uiLog(
    version === 0x000A
      ? 'log'
      : 'error',
    `VIA protocol = ${hex16(version)}`
  );

  if (version !== 0x000A) {
    throw new Error(
      `VIA protocol ${hex16(version)} はこのテスト対象外です。期待値は0x000Aです。`
    );
  }
}

async function layerCountCheck() {
  uiLog(
    'log',
    '=== STEP: LAYER COUNT ==='
  );

  const response =
    await sendCommand(
      new Uint8Array([
        VIA.DYNAMIC_KEYMAP_GET_LAYER_COUNT
      ]),
      data =>
        data[0] ===
        VIA.DYNAMIC_KEYMAP_GET_LAYER_COUNT,
      'GET_LAYER_COUNT'
    );

  currentLayerCount =
    response[1];

  els.layers.textContent =
    String(currentLayerCount);

  uiLog(
    'log',
    `Layer count = ${currentLayerCount}`
  );

  if (
    !Number.isInteger(
      currentLayerCount
    ) ||
    currentLayerCount < 1
  ) {
    throw new Error(
      'レイヤー数の取得に失敗しました。'
    );
  }
}

async function getKeycode(
  layer,
  row,
  column
) {
  if (
    !Number.isInteger(layer) ||
    !Number.isInteger(row) ||
    !Number.isInteger(column)
  ) {
    throw new Error(
      'GET_KEYCODE座標が整数ではありません。'
    );
  }

  if (
    layer < 0 ||
    layer >= currentLayerCount
  ) {
    throw new Error(
      `layer範囲外: ${layer}`
    );
  }

  if (
    row < 0 ||
    row >= JP60.matrixRows ||
    column < 0 ||
    column >= JP60.matrixCols
  ) {
    throw new Error(
      `matrix範囲外: row=${row}, col=${column}`
    );
  }

  const response =
    await sendCommand(
      new Uint8Array([
        VIA.GET_KEYCODE,
        layer,
        row,
        column
      ]),
      data =>
        data[0] ===
          VIA.GET_KEYCODE &&
        data[1] === layer &&
        data[2] === row &&
        data[3] === column,
      `GET_KEYCODE L${layer} R${row} C${column}`
    );

  const keycode =
    (response[4] << 8) |
    response[5];

  uiLog(
    'log',
    `READ L${layer} R${row} C${column} = ${hex16(keycode)}`
  );

  return keycode;
}

async function setKeycode(
  layer,
  row,
  column,
  keycode
) {
  if (
    !Number.isInteger(keycode) ||
    keycode < 0 ||
    keycode > 0xFFFF
  ) {
    throw new Error(
      `keycode範囲外: ${keycode}`
    );
  }

  if (
    layer < 0 ||
    layer >= currentLayerCount
  ) {
    throw new Error(
      `layer範囲外: ${layer}`
    );
  }

  if (
    row < 0 ||
    row >= JP60.matrixRows ||
    column < 0 ||
    column >= JP60.matrixCols
  ) {
    throw new Error(
      `matrix範囲外: row=${row}, col=${column}`
    );
  }

  const hi =
    (keycode >> 8) & 0xFF;

  const lo =
    keycode & 0xFF;

  const response =
    await sendCommand(
      new Uint8Array([
        VIA.SET_KEYCODE,
        layer,
        row,
        column,
        hi,
        lo,
      ]),
      data =>
        data[0] ===
          VIA.SET_KEYCODE &&
        data[1] === layer &&
        data[2] === row &&
        data[3] === column &&
        data[4] === hi &&
        data[5] === lo,
      `SET_KEYCODE L${layer} R${row} C${column} = ${hex16(keycode)}`
    );

  uiLog(
    'log',
    `SET ACK L${layer} R${row} C${column} = ${hex16(keycode)}`
  );

  return response;
}

async function readKnownUnusedCells() {
  if (
    currentProtocol !==
    0x000A
  ) {
    throw new Error(
      'VIA protocolが確定していません。'
    );
  }

  if (
    currentLayerCount < 1
  ) {
    throw new Error(
      'Base layerがありません。'
    );
  }

  uiLog(
    'log',
    '=== STEP: READ KNOWN KC_NO CELLS ==='
  );

  const result = [];

  for (
    const [row, column]
    of JP60.knownUnusedCells
  ) {
    const keycode =
      await getKeycode(
        JP60.baseLayer,
        row,
        column
      );

    result.push({
      row,
      column,
      keycode
    });
  }

  lastUnusedRead =
    result;

  els.readResult.textContent =
    JSON.stringify(
      result.map(r => ({
        row: r.row,
        column: r.column,
        keycode:
          hex16(r.keycode),
        expectedKC_NO:
          r.keycode ===
          QMK.KC_NO,
      })),
      null,
      2
    );

  const allNo =
    result.every(
      r =>
        r.keycode ===
        QMK.KC_NO
    );

  if (!allNo) {
    uiLog(
      'error',
      'KC_NO expected cell contains a non-zero keycode. Write test BLOCKED.',
      result
    );

    throw new Error(
      'JP60の未使用matrixセルがKC_NOではありません。書き込みテストを中止します。'
    );
  }

  uiLog(
    'log',
    'All known unused cells are KC_NO. Write test may be enabled after explicit confirmation.'
  );

  updateWriteAvailability();

  return result;
}

function updateWriteAvailability() {
  const checksPassed =
    !!device &&
    currentProtocol ===
      0x000A &&
    Number.isInteger(
      currentLayerCount
    ) &&
    currentLayerCount >= 1 &&
    !!lastUnusedRead &&
    lastUnusedRead.every(
      r =>
        r.keycode ===
        QMK.KC_NO
    ) &&
    device.vendorId ===
      JP60.expectedVendorId &&
    device.productId ===
      JP60.expectedProductId;

  const explicitlyAllowed =
    els.enableWrite.checked &&
    els.confirmText.value.trim() ===
      'JP60 WRITE';

  els.writeTestBtn.disabled =
    !(checksPassed &&
      explicitlyAllowed);
}

async function writeTest() {
  if (
    els.writeTestBtn.disabled
  ) {
    throw new Error(
      '安全条件を満たしていません。'
    );
  }

  const {
    layer,
    row,
    column
  } = JP60.safeUnusedCell;

  uiLog(
    'warn',
    '=== WRITE TEST START: EEPROM WILL BE MODIFIED ===',
    {
      layer,
      row,
      column
    }
  );

  let original = null;
  let changed = false;

  try {
    // 最終ガード: 書き込む直前に再読込して0x0000であることを確認
    original =
      await getKeycode(
        layer,
        row,
        column
      );

    if (
      original !==
      QMK.KC_NO
    ) {
      throw new Error(
        `安全セルの直前値がKC_NOではありません: ${hex16(original)}`
      );
    }

    // 実際にEEPROMを書き換える唯一の箇所
    await setKeycode(
      layer,
      row,
      column,
      QMK.KC_A
    );

    changed = true;

    const afterWrite =
      await getKeycode(
        layer,
        row,
        column
      );

    if (
      afterWrite !==
      QMK.KC_A
    ) {
      throw new Error(
        `書き込み確認失敗: expected ${hex16(QMK.KC_A)}, actual ${hex16(afterWrite)}`
      );
    }

    // 即時復元
    await setKeycode(
      layer,
      row,
      column,
      original
    );

    changed = false;

    const afterRestore =
      await getKeycode(
        layer,
        row,
        column
      );

    if (
      afterRestore !==
      original
    ) {
      throw new Error(
        `復元確認失敗: expected ${hex16(original)}, actual ${hex16(afterRestore)}`
      );
    }

    els.writeResult.textContent =
      JSON.stringify(
        {
          success: true,
          target: {
            layer,
            row,
            column
          },
          original:
            hex16(original),
          temporary:
            hex16(QMK.KC_A),
          restored:
            hex16(afterRestore),
        },
        null,
        2
      );

    uiLog(
      'log',
      '=== WRITE TEST SUCCESS / ORIGINAL VALUE RESTORED ==='
    );

  } catch (error) {
    uiLog(
      'error',
      '=== WRITE TEST FAILED ===',
      error?.message || error
    );

    // 変更後に失敗した可能性がある場合は、必ず復元を試みる。
    if (
      changed &&
      original !== null
    ) {
      uiLog(
        'warn',
        'Rollback attempt started...',
        {
          layer,
          row,
          column,
          original:
            hex16(original)
        }
      );

      try {
        await setKeycode(
          layer,
          row,
          column,
          original
        );

        const restored =
          await getKeycode(
            layer,
            row,
            column
          );

        uiLog(
          restored === original
            ? 'log'
            : 'error',
          `Rollback verification = ${hex16(restored)}`
        );

      } catch (rollbackError) {
        uiLog(
          'error',
          '!!! ROLLBACK FAILED !!! Keyboard test cell may still contain temporary keycode.',
          rollbackError?.message ||
            rollbackError
        );
      }
    }

    els.writeResult.textContent =
      JSON.stringify(
        {
          success: false,
          error:
            error?.message ||
            String(error),
          target: {
            layer,
            row,
            column
          },
        },
        null,
        2
      );

    throw error;
  }
}

async function disconnectJP60() {
  uiLog(
    'log',
    '=== DISCONNECT ==='
  );

  if (device) {
    try {
      device.removeEventListener(
        'inputreport',
        inputReportHandler
      );
    } catch (error) {
      uiLog(
        'warn',
        'removeEventListener failed',
        error?.message || error
      );
    }

    try {
      if (device.opened) {
        await device.close();
      }
    } catch (error) {
      uiLog(
        'error',
        'device.close() failed',
        error?.message || error
      );
    }
  }

  device = null;
  pending = null;
  reportId = 0;
  currentProtocol = null;
  currentLayerCount = null;
  lastUnusedRead = null;

  els.protocol.textContent = '-';
  els.layers.textContent = '-';
  els.reportId.textContent = '-';

  els.readUnusedBtn.disabled = true;
  els.writeTestBtn.disabled = true;

  setStatus('未接続');
}

els.connectBtn.addEventListener(
  'click',
  async () => {
    try {
      await connectJP60();

    } catch (error) {
      uiLog(
        'error',
        'CONNECT FAILED',
        error?.message ||
          error
      );

      setStatus(
        '接続/診断失敗',
        'error'
      );
    }
  }
);

els.disconnectBtn.addEventListener(
  'click',
  async () => {
    await disconnectJP60();
  }
);

els.readUnusedBtn.addEventListener(
  'click',
  async () => {
    try {
      await readKnownUnusedCells();

    } catch (error) {
      uiLog(
        'error',
        'READ-ONLY CHECK FAILED',
        error?.message ||
          error
      );

      setStatus(
        '読み取りチェック失敗',
        'error'
      );
    }
  }
);

els.enableWrite.addEventListener(
  'change',
  updateWriteAvailability
);

els.confirmText.addEventListener(
  'input',
  updateWriteAvailability
);

els.writeTestBtn.addEventListener(
  'click',
  async () => {
    const sure =
      window.confirm(
        'JP60の未使用matrixセル [layer 0, row 3, col 1] を一時的に書き換え、直ちに元へ戻します。\n\n' +
        'この操作はEEPROMを書き換えます。実行しますか？'
      );

    if (!sure) {
      uiLog(
        'warn',
        'Write test cancelled by user.'
      );

      return;
    }

    try {
      els.writeTestBtn.disabled =
        true;

      await writeTest();

      setStatus(
        '書き込みテスト成功',
        'ok'
      );

    } catch (error) {
      setStatus(
        '書き込みテスト失敗',
        'error'
      );

    } finally {
      updateWriteAvailability();
    }
  }
);

window.addEventListener(
  'beforeunload',
  () => {
    // 非同期処理は行わない。
    // 通常時はユーザーが「切断」を押すか、
    // ブラウザ側が管理する。
  }
);

uiLog(
  'log',
  'Test page loaded. No HID write will occur until the explicit write-test action.'
);