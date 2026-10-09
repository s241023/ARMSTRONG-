'use strict';

/*
 * ============================================================
 * jp60-via-test.js
 * JP60 / QMK 0.18.x / VIA READ-ONLY TEST v4.1
 * ============================================================
 *
 * 目的:
 *   L0 (Base Layer) のJP60 5x14 = 70 matrixセルを、
 *   VIA DYNAMIC_KEYMAP_GET_BUFFER (0x12) で読み取る。
 *
 * 安全性:
 *   このファイルにはキーマップ/EEPROMを書き換えるコマンドを
 *   実装していない。
 *
 * 実装するVIAコマンド:
 *   0x01 GET_PROTOCOL_VERSION   (read only)
 *   0x04 GET_KEYCODE            (read only)
 *   0x11 GET_LAYER_COUNT        (read only)
 *   0x12 GET_BUFFER             (read only)
 *
 * 明示的に実装しないコマンド:
 *   0x03 SET_KEYBOARD_VALUE
 *   0x05 SET_KEYCODE
 *   0x06 DYNAMIC_KEYMAP_RESET
 *   0x07/0x08/0x09 LIGHTING系
 *   0x0A EEPROM_RESET
 *   0x0B BOOTLOADER_JUMP
 *   0x13 DYNAMIC_KEYMAP_SET_BUFFER
 *   0x14/0x15 ENCODER GET/SET
 *
 * 検証手順:
 *   1. WebHID / VIA HID interface確認
 *   2. Protocol確認
 *   3. Layer数確認
 *   4. 既知KC_NOセル6個をGET_KEYCODEで確認
 *   5. L0全70セルをGET_BUFFERで5チャンク読み取り
 *   6. 同じ5チャンクをもう一度読み、完全一致を確認
 *   7. GET_BUFFERから復元した全70セルをGET_KEYCODEで照合
 *   8. 生バイト、matrix、chunk、cross-check、SHA-256を結果表示
 *
 * QMK 0.18.17仕様との対応:
 *   GET_BUFFER request:
 *     [0x12, offset_hi, offset_lo, size]
 *   response:
 *     [0x12, offset_hi, offset_lo, size, data...]
 *   size <= 28 bytes
 *   keycode = big-endian 16-bit
 *   buffer order = layer / row / column
 *
 * 前提HTML:
 *   これまでの jp60-via-test.html を使用。
 *
 * 必要DOM ID:
 *   connectBtn
 *   disconnectBtn
 *   readUnusedBtn
 *   status
 *   productName
 *   vendorId
 *   productId
 *   usageInfo
 *   reportId
 *   protocol
 *   layers
 *   readResult
 *   logView
 *
 * readUnusedBtn は既存HTMLのIDをそのまま流用する。
 * このv4ではボタンを「L0全70セル読み取り」に変更する。
 */

// ============================================================
// JP60 definition
// ============================================================

const JP60 = Object.freeze({
  name: 'JP60',

  expectedVendorId: 0xA103,
  expectedProductId: 0x0024,

  viaUsagePage: 0xFF60,
  viaUsage: 0x61,

  // Official QMK 0.18.17 JP60 config.h declares MATRIX_ROWS=5,
  // MATRIX_COLS=14. Custom firmware could differ; VIA does not expose
  // these compile-time dimensions as a direct query.
  matrixRows: 5,
  matrixCols: 14,

  baseLayer: 0,

  knownUnusedCells: [
    [3, 1],
    [4, 4],
    [4, 5],
    [4, 6],
    [4, 8],
    [4, 9],
  ],
});

// ============================================================
// Test configuration
// ============================================================

const TEST = Object.freeze({
  // QMK VIA GET_BUFFER supports <= 28 bytes per request.
  bufferChunkBytes: 28,

  // Each keycode occupies 2 bytes.
  keycodeBytes: 2,

  // Wait a little between requests so the device is not hammered.
  interCommandDelayMs: 10,

  // Individual command timeout.
  timeoutMs: 2000,

  // Re-read the same chunks once and compare byte-for-byte.
  verifyBufferStability: true,

  // Cross-check every one of the 70 cells using GET_KEYCODE.
  crossCheckEveryCell: true,
});

// ============================================================
// VIA command IDs
// ============================================================

const VIA = Object.freeze({
  GET_PROTOCOL_VERSION: 0x01,
  GET_KEYCODE: 0x04,
  GET_LAYER_COUNT: 0x11,
  GET_BUFFER: 0x12,
});

// ============================================================
// QMK values
// ============================================================

const QMK = Object.freeze({
  KC_NO: 0x0000,
});

// ============================================================
// Supported VIA protocol versions
// ============================================================

const SUPPORTED_VIA_PROTOCOLS = new Set([
  0x0009,
  0x000A,
]);

// ============================================================
// DOM
// ============================================================

const $ = id => document.getElementById(id);

const els = {
  connectBtn: $('connectBtn'),
  disconnectBtn: $('disconnectBtn'),
  readUnusedBtn: $('readUnusedBtn'),

  status: $('status'),

  productName: $('productName'),
  vendorId: $('vendorId'),
  productId: $('productId'),
  usageInfo: $('usageInfo'),
  reportId: $('reportId'),

  protocol: $('protocol'),
  layers: $('layers'),

  readResult: $('readResult'),
  logView: $('logView'),
};

// ============================================================
// State
// ============================================================

let device = null;
let reportId = 0;
let pending = null;
let currentProtocol = null;
let currentLayerCount = null;
let inputReportHandler = null;
let inputReportIds = [];
let connecting = false;
let readInProgress = false;

// ============================================================
// Utility
// ============================================================

function now() {
  return new Date().toLocaleTimeString(
    'ja-JP',
    { hour12: false }
  );
}

function hex8(value) {
  return (
    '0x' +
    Number(value)
      .toString(16)
      .padStart(2, '0')
  );
}

function hex16(value) {
  return (
    '0x' +
    Number(value)
      .toString(16)
      .padStart(4, '0')
  );
}

function bytesHex(bytes) {
  return [...bytes]
    .map(hex8)
    .join(' ');
}

function byteArraysEqual(a, b) {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setStatus(text, type = 'normal') {
  if (!els.status) return;

  els.status.textContent = text;

  if (type === 'error') {
    els.status.style.color = '#c62828';
  } else if (type === 'ok') {
    els.status.style.color = '#2e7d32';
  } else {
    els.status.style.color = '';
  }
}

function log(level, message, data) {
  const line = `[${now()}] [JP60-VIA] ${message}`;

  if (els.logView) {
    els.logView.textContent +=
      line +
      (data === undefined ? '' : ` ${JSON.stringify(data)}`) +
      '\n';

    els.logView.scrollTop = els.logView.scrollHeight;
  }

  if (level === 'error') {
    console.error(line, data);
  } else if (level === 'warn') {
    console.warn(line, data);
  } else {
    console.log(line, data);
  }
}

function setReadButtonLabel() {
  if (els.readUnusedBtn) {
    els.readUnusedBtn.textContent =
      'L0全70セルを読み取る（読み取り専用）';
    els.readUnusedBtn.title =
      'VIA GET_BUFFERでL0の全70セルを読み取り、GET_KEYCODEで全セル照合します。書き込みは行いません。';
  }
}

// ============================================================
// SHA-256
// ============================================================

async function sha256Hex(bytes) {
  if (!window.crypto?.subtle) {
    return null;
  }

  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new Uint8Array(bytes)
  );

  // Standard SHA-256 is 64 hexadecimal characters; do not use hex8()
  // here because hex8() adds a '0x' prefix to every byte.
  return [...new Uint8Array(buffer)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================
// Secure Context / WebHID
// ============================================================

function assertWebHidAvailable() {
  log('log', 'Checking WebHID availability...');

  if (!window.isSecureContext) {
    throw new Error(
      'Secure Contextではありません。GitHub Pages(HTTPS)またはlocalhostで実行してください。'
    );
  }

  if (!('hid' in navigator)) {
    throw new Error(
      'navigator.hid が存在しません。WebHID対応ブラウザを使用してください。'
    );
  }

  log('log', 'WebHID is available.');
}

// ============================================================
// VIA HID collection
// ============================================================

function getViaCollection(hidDevice) {
  const collections = hidDevice.collections || [];

  return (
    collections.find(
      collection =>
        collection.usagePage === JP60.viaUsagePage &&
        collection.usage === JP60.viaUsage
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

  log(
    'warn',
    'Output Report IDが取得できなかったため0x00を使用します。'
  );

  return 0x00;
}

function dumpDeviceInfo(hidDevice) {
  const collection = getViaCollection(hidDevice);

  const info = {
    productName: hidDevice.productName,
    vendorId: hex16(hidDevice.vendorId),
    productId: hex16(hidDevice.productId),
    opened: hidDevice.opened,
    usagePage: collection ? hex16(collection.usagePage) : null,
    usage: collection ? hex8(collection.usage) : null,
    collections: (hidDevice.collections || []).map(c => ({
      usagePage: hex16(c.usagePage),
      usage: hex8(c.usage),
      inputReports: (c.inputReports || []).map(report => report.reportId),
      outputReports: (c.outputReports || []).map(report => report.reportId),
      featureReports: (c.featureReports || []).map(report => report.reportId),
    })),
  };

  log('log', 'DEVICE INFO', info);
  console.table(info.collections);
}

// ============================================================
// Input report
// ============================================================

function handleInputReport(event) {
  // HIDDataView may represent a slice of a larger ArrayBuffer.
  // Respect byteOffset/byteLength so unrelated bytes cannot enter parsing.
  const view = event.data;
  const data = new Uint8Array(
    view.buffer,
    view.byteOffset,
    view.byteLength
  );

  log('log', 'INPUT REPORT', {
    eventReportId: event.reportId,
    byteLength: data.length,
    bytes: bytesHex(data),
  });

  if (
    inputReportIds.length > 0 &&
    !inputReportIds.includes(event.reportId)
  ) {
    log('warn', '想定外のInput Report IDを無視します。', {
      receivedReportId: event.reportId,
      expectedReportIds: inputReportIds,
    });
    return;
  }

  if (data.length < 4) {
    log('error', 'Input Reportが短すぎるため無視します。', {
      actualLength: data.length,
      minimumLength: 4,
    });
    return;
  }

  if (!pending) {
    log(
      'warn',
      '待機中コマンドがないため入力レポートを無視します。'
    );
    return;
  }

  const current = pending;

  if (!current.matcher(data)) {
    log(
      'warn',
      `${current.label} に一致しない入力レポートを無視します。`
    );
    return;
  }

  pending = null;
  clearTimeout(current.timer);
  current.resolve(data);
}

// ============================================================
// Device open
// ============================================================

async function ensureOpen() {
  if (!device) {
    throw new Error('HID deviceがありません。');
  }

  if (!device.opened) {
    log('log', 'Opening HID device...');
    await device.open();
    log('log', 'HID device opened.');
  }
}

// ============================================================
// Send command
// ============================================================

function sendCommand(payload, matcher, label, timeoutMs = TEST.timeoutMs) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureOpen();

      if (pending) {
        reject(
          new Error(`別のVIAコマンド待ち中です: ${pending.label}`)
        );
        return;
      }

      const report = new Uint8Array(32);
      report.set(payload);

      log('log', `SEND ${label}`, {
        reportId: hex8(reportId),
        payload: bytesHex(payload),
      });

      const timer = setTimeout(() => {
        if (pending && pending.label === label) {
          const current = pending;
          pending = null;

          log('error', `TIMEOUT ${label}`);

          current.reject(
            new Error(
              `${label}: ${timeoutMs}ms以内に応答がありません。`
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
      };

      try {
        await device.sendReport(reportId, report);
        log('log', `sendReport OK: ${label}`);
      } catch (error) {
        if (pending && pending.label === label) {
          clearTimeout(pending.timer);
          pending = null;
        }

        log(
          'error',
          `sendReport FAILED: ${label}`,
          error?.message || error
        );

        reject(error);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================================
// Common precondition checks
// ============================================================

function assertProtocolReady() {
  if (currentProtocol === null) {
    throw new Error('VIA protocolが未確認です。');
  }

  if (!SUPPORTED_VIA_PROTOCOLS.has(currentProtocol)) {
    throw new Error(
      `VIA protocol ${hex16(currentProtocol)} はこのテスト対象外です。`
    );
  }
}

function assertLayerReady() {
  if (
    currentLayerCount === null ||
    !Number.isInteger(currentLayerCount) ||
    currentLayerCount < 1
  ) {
    throw new Error(
      `Layer countが不正です: ${currentLayerCount}`
    );
  }
}

// ============================================================
// Protocol
// ============================================================

async function checkProtocol() {
  log('log', '----------------------------------------');
  log('log', 'STEP 1: GET_PROTOCOL_VERSION');
  log('log', '----------------------------------------');

  const response = await sendCommand(
    new Uint8Array([VIA.GET_PROTOCOL_VERSION]),
    data => data[0] === VIA.GET_PROTOCOL_VERSION,
    'GET_PROTOCOL_VERSION'
  );

  const version =
    (response[1] << 8) |
    response[2];

  currentProtocol = version;

  if (els.protocol) {
    els.protocol.textContent = hex16(version);
  }

  if (!SUPPORTED_VIA_PROTOCOLS.has(version)) {
    log('error', `UNSUPPORTED VIA PROTOCOL: ${hex16(version)}`);
    throw new Error(
      `VIA protocol ${hex16(version)} はこのテスト対象外です。`
    );
  }

  log('log', `SUPPORTED VIA PROTOCOL: ${hex16(version)}`);
}

// ============================================================
// Layer count
// ============================================================

async function checkLayerCount() {
  log('log', '----------------------------------------');
  log('log', 'STEP 2: GET_LAYER_COUNT');
  log('log', '----------------------------------------');

  const response = await sendCommand(
    new Uint8Array([VIA.GET_LAYER_COUNT]),
    data => data[0] === VIA.GET_LAYER_COUNT,
    'GET_LAYER_COUNT'
  );

  currentLayerCount = response[1];

  if (els.layers) {
    els.layers.textContent = String(currentLayerCount);
  }

  log('log', `Layer count = ${currentLayerCount}`);
  assertLayerReady();
}

// ============================================================
// GET_KEYCODE
// ============================================================

async function getKeycode(layer, row, column) {
  assertProtocolReady();
  assertLayerReady();

  if (
    !Number.isInteger(layer) ||
    !Number.isInteger(row) ||
    !Number.isInteger(column)
  ) {
    throw new Error(
      `GET_KEYCODE座標が整数ではありません: layer=${layer}, row=${row}, column=${column}`
    );
  }

  if (layer < 0 || layer >= currentLayerCount) {
    throw new Error(`layer範囲外: ${layer}`);
  }

  if (row < 0 || row >= JP60.matrixRows) {
    throw new Error(`row範囲外: ${row}`);
  }

  if (column < 0 || column >= JP60.matrixCols) {
    throw new Error(`column範囲外: ${column}`);
  }

  const response = await sendCommand(
    new Uint8Array([
      VIA.GET_KEYCODE,
      layer,
      row,
      column,
    ]),
    data =>
      data[0] === VIA.GET_KEYCODE &&
      data[1] === layer &&
      data[2] === row &&
      data[3] === column,
    `GET_KEYCODE L${layer} R${row} C${column}`
  );

  const keycode =
    (response[4] << 8) |
    response[5];

  log(
    'log',
    `READ L${layer} R${row} C${column} = ${hex16(keycode)}`
  );

  await sleep(TEST.interCommandDelayMs);

  return keycode;
}

// ============================================================
// Known KC_NO sanity check
// ============================================================

async function readKnownUnusedCells() {
  log('log', '========================================');
  log('log', 'STEP 3: READ KNOWN KC_NO CANDIDATES');
  log('log', '========================================');

  assertProtocolReady();
  assertLayerReady();

  const layer = JP60.baseLayer;

  if (layer >= currentLayerCount) {
    throw new Error(
      `baseLayer=${layer} が layer count=${currentLayerCount} の範囲外です。`
    );
  }

  const results = [];

  for (const [row, column] of JP60.knownUnusedCells) {
    const keycode = await getKeycode(layer, row, column);

    const item = {
      layer,
      row,
      column,
      keycode: hex16(keycode),
      keycodeNumber: keycode,
      isKCNO: keycode === QMK.KC_NO,
    };

    results.push(item);

    if (item.isKCNO) {
      log('log', `R${row} C${column} = KC_NO`);
    } else {
      log('warn', `R${row} C${column} is NOT KC_NO`, item);
    }
  }

  const allKCNO = results.every(item => item.isKCNO);

  if (!allKCNO) {
    throw new Error(
      '既知KC_NOセルの確認に失敗しました。GET_BUFFER全読みに進みません。'
    );
  }

  log('log', 'Known KC_NO sanity check = PASS');

  return results;
}

// ============================================================
// GET_BUFFER geometry helpers
// ============================================================

function totalCells() {
  return JP60.matrixRows * JP60.matrixCols;
}

function bytesPerLayer() {
  return totalCells() * TEST.keycodeBytes;
}

function expectedChunkCountForLayer() {
  return Math.ceil(
    bytesPerLayer() / TEST.bufferChunkBytes
  );
}

function matrixCellToBufferOffset(layer, row, column) {
  if (
    !Number.isInteger(layer) ||
    !Number.isInteger(row) ||
    !Number.isInteger(column)
  ) {
    throw new Error(
      `buffer offset用座標が不正: layer=${layer}, row=${row}, column=${column}`
    );
  }

  return (
    (
      (
        layer * JP60.matrixRows +
        row
      ) *
      JP60.matrixCols +
      column
    ) *
    TEST.keycodeBytes
  );
}

function bufferBytesToMatrix(layer, rawBytes) {
  const expected = bytesPerLayer();

  if (rawBytes.length !== expected) {
    throw new Error(
      `L${layer} raw buffer長が不正: expected=${expected}, actual=${rawBytes.length}`
    );
  }

  const rows = [];

  for (let row = 0; row < JP60.matrixRows; row += 1) {
    const rowData = [];

    for (let column = 0; column < JP60.matrixCols; column += 1) {
      const localOffset =
        (row * JP60.matrixCols + column) * TEST.keycodeBytes;

      const high = rawBytes[localOffset];
      const low = rawBytes[localOffset + 1];
      const keycode = (high << 8) | low;

      rowData.push({
        layer,
        row,
        column,
        bufferOffset: matrixCellToBufferOffset(layer, row, column),
        keycode: hex16(keycode),
        keycodeNumber: keycode,
        rawBytes: [high, low],
        isKCNO: keycode === QMK.KC_NO,
      });
    }

    rows.push(rowData);
  }

  return rows;
}

// ============================================================
// GET_BUFFER single chunk
// ============================================================

async function getBufferChunk(offset, size, labelSuffix = '') {
  assertProtocolReady();
  assertLayerReady();

  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error(`GET_BUFFER offsetが不正: ${offset}`);
  }

  if (
    !Number.isInteger(size) ||
    size < 1 ||
    size > TEST.bufferChunkBytes
  ) {
    throw new Error(
      `GET_BUFFER sizeが不正: ${size} (1..${TEST.bufferChunkBytes})`
    );
  }

  // Keep GET_BUFFER strictly inside the dynamic-keymap region. This test
  // must never read macro storage or unrelated EEPROM bytes by accident.
  const dynamicKeymapBytes = bytesPerLayer() * currentLayerCount;
  if (offset + size > dynamicKeymapBytes) {
    throw new Error(
      `GET_BUFFER範囲外: offset=${offset}, size=${size}, dynamicKeymapBytes=${dynamicKeymapBytes}`
    );
  }

  const payload = new Uint8Array([
    VIA.GET_BUFFER,
    (offset >> 8) & 0xFF,
    offset & 0xFF,
    size,
  ]);

  const label =
    `GET_BUFFER offset=${offset} size=${size}` +
    (labelSuffix ? ` ${labelSuffix}` : '');

  const response = await sendCommand(
    payload,
    data =>
      (
        data[0] === VIA.GET_BUFFER ||
        data[0] === 0xFF
      ),
    label
  );

  // 0xFF is VIA id_unhandled. Treat it as a protocol-level failure
  // instead of waiting until timeout, because this gives a much more
  // useful diagnosis when an older/custom firmware does not expose
  // GET_BUFFER.
  if (response[0] === 0xFF) {
    throw new Error(
      `${label}: firmware returned VIA id_unhandled (0xFF). GET_BUFFER(0x12) がこのファームウェアでは未対応の可能性があります。`
    );
  }

  if (
    response[1] !== ((offset >> 8) & 0xFF) ||
    response[2] !== (offset & 0xFF) ||
    response[3] !== size
  ) {
    throw new Error(
      `${label}: 応答ヘッダ不一致。expected=[0x12,${hex8((offset >> 8) & 0xFF)},${hex8(offset & 0xFF)},${size}] actual=[${bytesHex(response.slice(0, 4))}]`
    );
  }

  // Response layout from QMK 0.18.x:
  // [0] command
  // [1] offset high
  // [2] offset low
  // [3] size
  // [4...] buffer data
  if (response.length < 4 + size) {
    throw new Error(
      `${label}: 応答長不足。expected>=${4 + size}, actual=${response.length}`
    );
  }

  const bytes = new Uint8Array(
    response.slice(4, 4 + size)
  );

  log('log', `GET_BUFFER OK offset=${offset} size=${size}`, {
    raw: bytesHex(bytes),
  });

  await sleep(TEST.interCommandDelayMs);

  return {
    offset,
    size,
    bytes,
    response: new Uint8Array(response),
  };
}

// ============================================================
// Read one whole layer using GET_BUFFER
// ============================================================

async function readLayerByBuffer(layer) {
  if (!Number.isInteger(layer)) {
    throw new Error(`readLayerByBuffer layerが不正: ${layer}`);
  }

  if (layer < 0 || layer >= currentLayerCount) {
    throw new Error(
      `readLayerByBuffer layer範囲外: ${layer}`
    );
  }

  const layerStartOffset =
    layer * bytesPerLayer();

  const chunks = [];
  const rawBytes = [];

  log('log', `READ L${layer} BY GET_BUFFER START`, {
    layerStartOffset,
    bytesPerLayer: bytesPerLayer(),
    chunkSize: TEST.bufferChunkBytes,
    chunkCount: expectedChunkCountForLayer(),
  });

  for (
    let localOffset = 0;
    localOffset < bytesPerLayer();
    localOffset += TEST.bufferChunkBytes
  ) {
    const remaining =
      bytesPerLayer() - localOffset;

    const size = Math.min(
      TEST.bufferChunkBytes,
      remaining
    );

    const absoluteOffset =
      layerStartOffset + localOffset;

    const chunk = await getBufferChunk(
      absoluteOffset,
      size,
      `L${layer} localOffset=${localOffset}`
    );

    chunks.push({
      index: chunks.length,
      localOffset,
      absoluteOffset,
      size,
      rawHex: bytesHex(chunk.bytes),
    });

    for (const byte of chunk.bytes) {
      rawBytes.push(byte);
    }
  }

  const raw = new Uint8Array(rawBytes);

  if (raw.length !== bytesPerLayer()) {
    throw new Error(
      `L${layer} GET_BUFFER総量が不正: expected=${bytesPerLayer()}, actual=${raw.length}`
    );
  }

  const matrix = bufferBytesToMatrix(layer, raw);

  return {
    layer,
    startOffset: layerStartOffset,
    byteLength: raw.length,
    chunkCount: chunks.length,
    chunks,
    raw,
    rawHex: bytesHex(raw),
    matrix,
  };
}

// ============================================================
// Buffer stability re-read
// ============================================================

async function verifyLayerBufferStability(layer, firstRead) {
  log('log', `VERIFY L${layer} BUFFER STABILITY START`);

  const secondRead = await readLayerByBuffer(layer);

  const identical = byteArraysEqual(
    firstRead.raw,
    secondRead.raw
  );

  if (!identical) {
    let firstMismatch = null;

    for (let i = 0; i < firstRead.raw.length; i += 1) {
      if (firstRead.raw[i] !== secondRead.raw[i]) {
        firstMismatch = {
          localByteOffset: i,
          first: firstRead.raw[i],
          second: secondRead.raw[i],
          absoluteBufferOffset: firstRead.startOffset + i,
        };
        break;
      }
    }

    log('error', `L${layer} BUFFER STABILITY = FAIL`, firstMismatch);

    throw new Error(
      `L${layer} GET_BUFFER再読で内容が一致しません: ${JSON.stringify(firstMismatch)}`
    );
  }

  log('log', `L${layer} BUFFER STABILITY = PASS`);

  return secondRead;
}

// ============================================================
// Cross-check all cells with GET_KEYCODE
// ============================================================

async function crossCheckLayer(layer, bufferMatrix) {
  if (!TEST.crossCheckEveryCell) {
    return {
      enabled: false,
      checked: 0,
      mismatches: [],
    };
  }

  log(
    'log',
    `CROSS-CHECK L${layer}: GET_BUFFER vs GET_KEYCODE`
  );

  const mismatches = [];
  let checked = 0;

  for (let row = 0; row < JP60.matrixRows; row += 1) {
    for (let column = 0; column < JP60.matrixCols; column += 1) {
      const bufferCell = bufferMatrix[row][column];

      const directKeycode = await getKeycode(
        layer,
        row,
        column
      );

      checked += 1;

      if (directKeycode !== bufferCell.keycodeNumber) {
        mismatches.push({
          layer,
          row,
          column,
          bufferOffset: bufferCell.bufferOffset,
          getBuffer: {
            keycode: bufferCell.keycode,
            keycodeNumber: bufferCell.keycodeNumber,
            rawBytes: bufferCell.rawBytes,
          },
          getKeycode: {
            keycode: hex16(directKeycode),
            keycodeNumber: directKeycode,
          },
        });

        log(
          'error',
          `CROSS-CHECK MISMATCH L${layer} R${row} C${column}`,
          mismatches[mismatches.length - 1]
        );
      }
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `GET_BUFFERとGET_KEYCODEが${mismatches.length}セルで不一致です。`
    );
  }

  log(
    'log',
    `CROSS-CHECK L${layer} = PASS (${checked}/${totalCells()} cells)`
  );

  return {
    enabled: true,
    checked,
    mismatches,
  };
}

// ============================================================
// Read L0 full matrix
// ============================================================

async function readBaseLayerFull() {
  log('log', '========================================');
  log('log', 'STEP 4: READ L0 FULL MATRIX');
  log('log', '========================================');

  assertProtocolReady();
  assertLayerReady();

  const layer = JP60.baseLayer;

  if (layer >= currentLayerCount) {
    throw new Error(
      `baseLayer=${layer} が layer count=${currentLayerCount} の範囲外です。`
    );
  }

  const expected = {
    layer,
    rows: JP60.matrixRows,
    cols: JP60.matrixCols,
    cells: totalCells(),
    bytesPerLayer: bytesPerLayer(),
    chunkSize: TEST.bufferChunkBytes,
    chunkCount: expectedChunkCountForLayer(),
    bufferOrder: 'layer -> row -> column',
    keycodeEndian: 'big-endian 16-bit',
  };

  log('log', 'READ PLAN', expected);

  // First complete buffer read.
  const firstRead = await readLayerByBuffer(layer);

  // Optional second complete buffer read for stability.
  let stableRead = firstRead;

  if (TEST.verifyBufferStability) {
    stableRead = await verifyLayerBufferStability(
      layer,
      firstRead
    );
  }

  // Cross-check every cell through the independent GET_KEYCODE command.
  const crossCheck = await crossCheckLayer(
    layer,
    stableRead.matrix
  );

  const rawSha256 =
    await sha256Hex(stableRead.raw);

  const result = {
    testVersion: 'v4.1',
    readOnly: true,
    writeCommandsImplemented: [],
    device: {
      productName: device?.productName || null,
      vendorId: device ? hex16(device.vendorId) : null,
      productId: device ? hex16(device.productId) : null,
      usagePage: JP60.viaUsagePage,
      usage: JP60.viaUsage,
      outputReportId: reportId,
    },
    via: {
      protocol: currentProtocol,
      protocolHex: currentProtocol === null ? null : hex16(currentProtocol),
      layerCount: currentLayerCount,
      commandGetProtocol: hex8(VIA.GET_PROTOCOL_VERSION),
      commandGetKeycode: hex8(VIA.GET_KEYCODE),
      commandGetLayerCount: hex8(VIA.GET_LAYER_COUNT),
      commandGetBuffer: hex8(VIA.GET_BUFFER),
    },
    geometry: {
      matrixRows: JP60.matrixRows,
      matrixCols: JP60.matrixCols,
      totalCells: totalCells(),
      bytesPerKeycode: TEST.keycodeBytes,
      bytesPerLayer: bytesPerLayer(),
      getBufferMaxBytesPerRequest: TEST.bufferChunkBytes,
      expectedChunkCount: expectedChunkCountForLayer(),
    },
    stability: {
      enabled: TEST.verifyBufferStability,
      pass: true,
    },
    crossCheck,
    rawSha256,
    chunks: stableRead.chunks,
    rawBufferHex: stableRead.rawHex,
    matrix: stableRead.matrix,
  };

  if (els.readResult) {
    els.readResult.textContent = JSON.stringify(
      result,
      null,
      2
    );
  }

  log('log', '========================================');
  log('log', 'L0 FULL MATRIX READ = SUCCESS');
  log('log', '========================================');
  log('log', 'RESULT SUMMARY', {
    cells: result.geometry.totalCells,
    bytes: result.geometry.bytesPerLayer,
    chunks: result.geometry.expectedChunkCount,
    stability: result.stability.pass,
    crossCheck: result.crossCheck.checked,
    sha256: result.rawSha256,
  });

  setStatus(
    'L0全70セル読み取り・照合成功（書き込みなし）',
    'ok'
  );

  return result;
}

// ============================================================
// Connect
// ============================================================

async function connectJP60() {
  if (device?.opened) {
    log('warn', 'すでにJP60へ接続されています。');
    setStatus('すでに接続済み', 'ok');
    return;
  }

  log('log', '========================================');
  log('log', 'CONNECT START');
  log('log', '========================================');

  assertWebHidAvailable();

  const authorized = await navigator.hid.getDevices();

  log('log', `navigator.hid.getDevices() = ${authorized.length}件`);

  const viaDevices = authorized.filter(
    d => !!getViaCollection(d)
  );

  if (viaDevices.length > 0) {
    log(
      'log',
      'Authorized VIA devices:',
      viaDevices.map(d => ({
        productName: d.productName,
        vendorId: hex16(d.vendorId),
        productId: hex16(d.productId),
      }))
    );
  }

  const selected = await navigator.hid.requestDevice({
    filters: [
      {
        vendorId: JP60.expectedVendorId,
        productId: JP60.expectedProductId,
        usagePage: JP60.viaUsagePage,
        usage: JP60.viaUsage,
      },
    ],
  });

  if (!selected || selected.length === 0) {
    throw new Error('デバイスが選択されませんでした。');
  }

  const selectedDevice = selected[0];

  log('log', 'Selected device:', {
    productName: selectedDevice.productName,
    vendorId: hex16(selectedDevice.vendorId),
    productId: hex16(selectedDevice.productId),
  });

  const collection = getViaCollection(selectedDevice);

  if (!collection) {
    throw new Error(
      '選択されたデバイスにVIA HID collectionがありません。'
    );
  }

  if (
    selectedDevice.vendorId !== JP60.expectedVendorId ||
    selectedDevice.productId !== JP60.expectedProductId
  ) {
    throw new Error('JP60のVID/PIDと一致しません。');
  }

  log('log', 'JP60 expected VID/PID confirmed.');

  device = selectedDevice;
  reportId = findOutputReportId(device, collection);
  inputReportIds = (collection.inputReports || [])
    .map(report => report.reportId)
    .filter(Number.isInteger);

  if (inputReportIds.length === 0) {
    throw new Error(
      'VIA HID collectionにInput Report IDがありません。'
    );
  }

  log('log', 'Input Report IDs', inputReportIds);

  if (els.productName) {
    els.productName.textContent = device.productName || '-';
  }

  if (els.vendorId) {
    els.vendorId.textContent = hex16(device.vendorId);
  }

  if (els.productId) {
    els.productId.textContent = hex16(device.productId);
  }

  if (els.usageInfo) {
    els.usageInfo.textContent =
      `${hex16(collection.usagePage)} / ${hex8(collection.usage)}`;
  }

  if (els.reportId) {
    els.reportId.textContent = hex8(reportId);
  }

  dumpDeviceInfo(device);

  inputReportHandler = handleInputReport;
  device.addEventListener('inputreport', inputReportHandler);

  try {
    await ensureOpen();

    setStatus('接続済み', 'ok');

    await checkProtocol();
    await checkLayerCount();

    if (els.readUnusedBtn) {
      els.readUnusedBtn.disabled = false;
    }
    if (els.connectBtn) els.connectBtn.disabled = true;
    if (els.disconnectBtn) els.disconnectBtn.disabled = false;

    log('log', 'CONNECT SUCCESS');
  } catch (error) {
    await disconnectJP60();
    throw error;
  }
}

// ============================================================
// Disconnect
// ============================================================

async function disconnectJP60() {
  log('log', 'DISCONNECT START');

  if (pending) {
    clearTimeout(pending.timer);

    try {
      pending.reject(
        new Error('HID接続が解除されました。')
      );
    } catch (_) {
      // ignore
    }

    pending = null;
  }

  if (device && inputReportHandler) {
    try {
      device.removeEventListener(
        'inputreport',
        inputReportHandler
      );
    } catch (error) {
      log(
        'warn',
        'inputreport listener解除失敗',
        error?.message || error
      );
    }
  }

  if (device) {
    try {
      if (device.opened) {
        await device.close();
        log('log', 'HID device closed.');
      }
    } catch (error) {
      log(
        'error',
        'device.close() failed',
        error?.message || error
      );
    }
  }

  device = null;
  reportId = 0;
  currentProtocol = null;
  currentLayerCount = null;
  inputReportHandler = null;
  inputReportIds = [];

  if (els.protocol) els.protocol.textContent = '-';
  if (els.layers) els.layers.textContent = '-';
  if (els.reportId) els.reportId.textContent = '-';

  if (els.readUnusedBtn) {
    els.readUnusedBtn.disabled = true;
  }
  if (els.connectBtn) els.connectBtn.disabled = false;
  if (els.disconnectBtn) els.disconnectBtn.disabled = true;

  setStatus('未接続');
  log('log', 'DISCONNECT FINISHED');
}

// ============================================================
// UI events
// ============================================================

if (els.connectBtn) {
  els.connectBtn.addEventListener('click', async () => {
    if (readInProgress) {
      log('warn', '読み取り中のため、新しい接続要求を無視します。');
      return;
    }

    if (connecting) {
      log('warn', '接続処理中のため、重複した接続要求を無視します。');
      return;
    }

    connecting = true;
    els.connectBtn.disabled = true;

    try {
      await connectJP60();
    } catch (error) {
      log(
        'error',
        'CONNECT FAILED',
        error?.message || error
      );

      setStatus('接続/診断失敗', 'error');
    } finally {
      connecting = false;
      els.connectBtn.disabled = Boolean(device?.opened);
    }
  });
}

if (els.disconnectBtn) {
  els.disconnectBtn.addEventListener('click', async () => {
    await disconnectJP60();
  });
}

if (els.readUnusedBtn) {
  els.readUnusedBtn.addEventListener('click', async () => {
    if (readInProgress) {
      log('warn', '読み取り試験中のため、重複した要求を無視します。');
      return;
    }

    if (!device?.opened) {
      log('error', '読み取り開始不可: JP60が接続されていません。');
      setStatus('先にJP60へ接続してください。', 'error');
      return;
    }

    readInProgress = true;
    els.readUnusedBtn.disabled = true;
    if (els.connectBtn) els.connectBtn.disabled = true;

    try {
      await readKnownUnusedCells();
      await readBaseLayerFull();
    } catch (error) {
      log(
        'error',
        'READ TEST FAILED',
        error?.message || error
      );

      setStatus(
        '読み取りテスト失敗（書き込みなし）',
        'error'
      );
    } finally {
      readInProgress = false;
      if (els.readUnusedBtn) {
        els.readUnusedBtn.disabled = !device?.opened;
      }
      if (els.connectBtn) {
        els.connectBtn.disabled = Boolean(device?.opened) || connecting;
      }
    }
  });
}

// ============================================================
// HID disconnect event
// ============================================================

if ('hid' in navigator) {
  navigator.hid.addEventListener('disconnect', event => {
    if (
      device &&
      event.device === device
    ) {
      log(
        'warn',
        'HID device was disconnected externally.'
      );

      if (pending) {
        const waiting = pending;
        clearTimeout(waiting.timer);
        pending = null;
        waiting.reject(new Error('HIDデバイスが読み取り中に切断されました。'));
      }

      device = null;
      reportId = 0;
      currentProtocol = null;
      currentLayerCount = null;
      inputReportHandler = null;
      inputReportIds = [];

      if (els.protocol) els.protocol.textContent = '-';
      if (els.layers) els.layers.textContent = '-';
      if (els.reportId) els.reportId.textContent = '-';

      if (els.readUnusedBtn) {
        els.readUnusedBtn.disabled = true;
      }
      if (els.connectBtn) els.connectBtn.disabled = false;
      if (els.disconnectBtn) els.disconnectBtn.disabled = true;

      setStatus(
        'キーボードが切断されました。',
        'error'
      );
    }
  });
}

// ============================================================
// START
// ============================================================

setReadButtonLabel();
if (els.connectBtn) els.connectBtn.disabled = false;
if (els.disconnectBtn) els.disconnectBtn.disabled = true;
if (els.readUnusedBtn) els.readUnusedBtn.disabled = true;

log('log', '========================================');
log('log', 'JP60 VIA READ-ONLY TEST v4.1');
log('log', 'L0 = 5x14 = 70 cells');
log('log', 'GET_BUFFER max chunk = 28 bytes');
log('log', 'BUFFER STABILITY CHECK = ON');
log('log', 'ALL-CELL GET_KEYCODE CROSS-CHECK = ON');
log('log', 'WRITE COMMANDS ARE NOT IMPLEMENTED.');
log('log', 'VIA 0x0009 / 0x000A supported.');
log('log', '========================================');

setStatus('未接続');
