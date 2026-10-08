'use strict';

/*
 * ============================================================
 * JP60 / QMK 0.18.x / VIA READ-ONLY TEST v2
 * ============================================================
 *
 * 【重要】
 * このファイルにはキーボードへの書き込み処理を入れていません。
 *
 * 使用するVIAコマンド:
 *   0x01 GET_PROTOCOL_VERSION
 *   0x04 GET_KEYCODE
 *   0x11 GET_LAYER_COUNT
 *
 * 使用しないVIAコマンド:
 *   0x03 SET_KEYBOARD_VALUE
 *   0x05 SET_KEYCODE
 *   0x06 DYNAMIC_KEYMAP_RESET
 *   0x0A EEPROM_RESET
 *   0x0B BOOTLOADER_JUMP
 *   0x13 DYNAMIC_KEYMAP_SET_BUFFER
 *
 * このテストの目的:
 *   1. WebHID接続
 *   2. VIA protocol確認
 *   3. Layer数取得
 *   4. JP60のKC_NO想定セルを読み取り
 *
 * EEPROM書き換えは一切行わない。
 */

// ============================================================
// JP60 定義
// ============================================================

const JP60 = Object.freeze({
  name: 'JP60',

  // 既知のJP60識別情報
  expectedVendorId: 0xA103,
  expectedProductId: 0x0024,

  // Remap/VIA系Raw HID
  viaUsagePage: 0xFF60,
  viaUsage: 0x61,

  matrixRows: 5,
  matrixCols: 14,

  // JP60のVIA keymap / QMK LAYOUT上でKC_NOになっている想定セル
  // ここでは「読むだけ」に使用する。
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
// VIA command
// ============================================================

const VIA = Object.freeze({
  GET_PROTOCOL_VERSION: 0x01,
  GET_KEYBOARD_VALUE: 0x02,
  GET_KEYCODE: 0x04,
  GET_LAYER_COUNT: 0x11,
});

// ============================================================
// QMK basic values
// ============================================================

const QMK = Object.freeze({
  KC_NO: 0x0000,
});

// ============================================================
// 許可するVIA protocol
// ============================================================

/*
 * QMK 0.18.17以下向けRemap環境は
 * VIA protocol 0x0A以下を対象としている。
 *
 * 今回は実機で0x0009が返ってきたため、
 * 0x0009 / 0x000Aの両方を許可する。
 *
 * それ以外は読み取りを停止する。
 */
const SUPPORTED_VIA_PROTOCOLS = new Set([
  0x0009,
  0x000A,
]);

// ============================================================
// DOM
// ============================================================

const $ = id =>
  document.getElementById(id);

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
// 状態
// ============================================================

let device = null;
let reportId = 0;

let pending = null;

let currentProtocol = null;
let currentLayerCount = null;

let inputReportHandler = null;

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

function setStatus(
  text,
  type = 'normal'
) {
  if (!els.status) {
    return;
  }

  els.status.textContent = text;

  if (type === 'error') {
    els.status.style.color = '#c62828';
  } else if (type === 'ok') {
    els.status.style.color = '#2e7d32';
  } else {
    els.status.style.color = '';
  }
}

function log(
  level,
  message,
  data
) {
  const line =
    `[${now()}] [JP60-VIA] ${message}`;

  if (els.logView) {
    els.logView.textContent +=
      line +
      (
        data === undefined
          ? ''
          : ` ${JSON.stringify(data)}`
      ) +
      '\n';

    els.logView.scrollTop =
      els.logView.scrollHeight;
  }

  if (level === 'error') {
    console.error(
      line,
      data
    );
  } else if (level === 'warn') {
    console.warn(
      line,
      data
    );
  } else {
    console.log(
      line,
      data
    );
  }
}

// ============================================================
// Secure Context / WebHID
// ============================================================

function assertWebHidAvailable() {

  log(
    'log',
    'Checking WebHID availability...'
  );

  if (!window.isSecureContext) {
    throw new Error(
      'Secure Contextではありません。' +
      'GitHub Pages(HTTPS)またはlocalhostで実行してください。'
    );
  }

  if (!('hid' in navigator)) {
    throw new Error(
      'navigator.hid が存在しません。' +
      'WebHID対応ブラウザを使用してください。'
    );
  }

  log(
    'log',
    'WebHID is available.'
  );
}

// ============================================================
// HID collection
// ============================================================

function getViaCollection(
  hidDevice
) {
  const collections =
    hidDevice.collections || [];

  return (
    collections.find(
      collection =>
        collection.usagePage ===
          JP60.viaUsagePage &&
        collection.usage ===
          JP60.viaUsage
    ) || null
  );
}

// ============================================================
// Output Report ID
// ============================================================

function findOutputReportId(
  hidDevice,
  collection
) {
  const outputReports =
    collection?.outputReports || [];

  if (
    outputReports.length > 0 &&
    outputReports[0].reportId !==
      undefined
  ) {
    return outputReports[0].reportId;
  }

  log(
    'warn',
    'Output Report IDが取得できなかったため0x00を使用します。'
  );

  return 0x00;
}

// ============================================================
// Device info
// ============================================================

function dumpDeviceInfo(
  hidDevice
) {
  const collection =
    getViaCollection(hidDevice);

  const info = {
    productName:
      hidDevice.productName,

    vendorId:
      hex16(hidDevice.vendorId),

    productId:
      hex16(hidDevice.productId),

    opened:
      hidDevice.opened,

    usagePage:
      collection
        ? hex16(collection.usagePage)
        : null,

    usage:
      collection
        ? hex8(collection.usage)
        : null,

    collections:
      (
        hidDevice.collections || []
      ).map(c => ({
        usagePage:
          hex16(c.usagePage),

        usage:
          hex8(c.usage),

        inputReports:
          (
            c.inputReports || []
          ).map(
            report =>
              report.reportId
          ),

        outputReports:
          (
            c.outputReports || []
          ).map(
            report =>
              report.reportId
          ),

        featureReports:
          (
            c.featureReports || []
          ).map(
            report =>
              report.reportId
          ),
      })),
  };

  log(
    'log',
    'DEVICE INFO',
    info
  );

  console.table(
    info.collections
  );
}

// ============================================================
// Input report
// ============================================================

function handleInputReport(
  event
) {
  const data =
    new Uint8Array(
      event.data.buffer
    );

  log(
    'log',
    'INPUT REPORT',
    {
      eventReportId:
        event.reportId,

      bytes:
        bytesHex(data),
    }
  );

  if (!pending) {
    log(
      'warn',
      '待機中コマンドがないため入力レポートを無視します。'
    );

    return;
  }

  const current =
    pending;

  if (
    !current.matcher(data)
  ) {
    log(
      'warn',
      `${current.label} に一致しない入力レポートを無視します。`
    );

    return;
  }

  pending = null;

  clearTimeout(
    current.timer
  );

  current.resolve(
    data
  );
}

// ============================================================
// Device open
// ============================================================

async function ensureOpen() {

  if (!device) {
    throw new Error(
      'HID deviceがありません。'
    );
  }

  if (!device.opened) {
    log(
      'log',
      'Opening HID device...'
    );

    await device.open();

    log(
      'log',
      'HID device opened.'
    );
  }
}

// ============================================================
// Send command
// ============================================================

function sendCommand(
  payload,
  matcher,
  label,
  timeoutMs = 1500
) {
  return new Promise(
    async (resolve, reject) => {

      try {

        await ensureOpen();

        if (pending) {
          reject(
            new Error(
              `別のVIAコマンド待ち中です: ${pending.label}`
            )
          );

          return;
        }

        /*
         * Remapと同じ考え方で
         * 32byte reportを使用。
         */
        const report =
          new Uint8Array(32);

        report.set(payload);

        log(
          'log',
          `SEND ${label}`,
          {
            reportId:
              hex8(reportId),

            payload:
              bytesHex(payload),
          }
        );

        const timer =
          setTimeout(
            () => {

              if (
                pending &&
                pending.label === label
              ) {

                const current =
                  pending;

                pending = null;

                log(
                  'error',
                  `TIMEOUT ${label}`
                );

                current.reject(
                  new Error(
                    `${label}: ${timeoutMs}ms以内に応答がありません。`
                  )
                );
              }

            },
            timeoutMs
          );

        pending = {
          label,
          matcher,
          resolve,
          reject,
          timer,
        };

        try {

          await device.sendReport(
            reportId,
            report
          );

          log(
            'log',
            `sendReport OK: ${label}`
          );

        } catch (error) {

          if (
            pending &&
            pending.label === label
          ) {
            clearTimeout(
              pending.timer
            );

            pending = null;
          }

          log(
            'error',
            `sendReport FAILED: ${label}`,
            error?.message ||
              error
          );

          reject(
            error
          );
        }

      } catch (error) {

        reject(
          error
        );
      }
    }
  );
}

// ============================================================
// Connect
// ============================================================

async function connectJP60() {

  log(
    'log',
    '========================================'
  );

  log(
    'log',
    'CONNECT START'
  );

  log(
    'log',
    '========================================'
  );

  assertWebHidAvailable();

  const authorized =
    await navigator.hid.getDevices();

  log(
    'log',
    `navigator.hid.getDevices() = ${authorized.length}件`
  );

  /*
   * 既に許可済みのデバイスを表示。
   * 自動選択はせず、今回は明示選択にする。
   */
  const viaDevices =
    authorized.filter(
      device =>
        !!getViaCollection(device)
    );

  if (
    viaDevices.length > 0
  ) {

    log(
      'log',
      'Authorized VIA devices:',
      viaDevices.map(d => ({
        productName:
          d.productName,

        vendorId:
          hex16(d.vendorId),

        productId:
          hex16(d.productId),
      }))
    );
  }

  /*
   * requestDeviceはユーザー操作から呼ぶ。
   */
  const selected =
    await navigator.hid.requestDevice({
      filters: [
        {
          usagePage:
            JP60.viaUsagePage,

          usage:
            JP60.viaUsage,
        },
      ],
    });

  if (
    !selected ||
    selected.length === 0
  ) {
    throw new Error(
      'デバイスが選択されませんでした。'
    );
  }

  const selectedDevice =
    selected[0];

  log(
    'log',
    'Selected device:',
    {
      productName:
        selectedDevice.productName,

      vendorId:
        hex16(
          selectedDevice.vendorId
        ),

      productId:
        hex16(
          selectedDevice.productId
        ),
    }
  );

  const collection =
    getViaCollection(
      selectedDevice
    );

  if (!collection) {
    throw new Error(
      '選択されたデバイスにVIA HID collectionがありません。'
    );
  }

  /*
   * JP60のVID/PID確認。
   * 今回は一致しなくても「読み取りだけ」は可能にするが、
   * Consoleでは警告を出す。
   */
  const expectedId =
    selectedDevice.vendorId ===
      JP60.expectedVendorId &&
    selectedDevice.productId ===
      JP60.expectedProductId;

  if (expectedId) {

    log(
      'log',
      'JP60 expected VID/PID confirmed.'
    );

  } else {

    log(
      'warn',
      'VID/PIDが既知のJP60値と一致しません。',
      {
        expected:
          {
            vendorId:
              hex16(
                JP60.expectedVendorId
              ),

            productId:
              hex16(
                JP60.expectedProductId
              ),
          },

        actual:
          {
            vendorId:
              hex16(
                selectedDevice.vendorId
              ),

            productId:
              hex16(
                selectedDevice.productId
              ),
          },
      }
    );
  }

  device =
    selectedDevice;

  reportId =
    findOutputReportId(
      device,
      collection
    );

  /*
   * UI
   */
  if (els.productName) {
    els.productName.textContent =
      device.productName ||
      '-';
  }

  if (els.vendorId) {
    els.vendorId.textContent =
      hex16(device.vendorId);
  }

  if (els.productId) {
    els.productId.textContent =
      hex16(device.productId);
  }

  if (els.usageInfo) {
    els.usageInfo.textContent =
      `${hex16(collection.usagePage)} / ${hex8(collection.usage)}`;
  }

  if (els.reportId) {
    els.reportId.textContent =
      hex8(reportId);
  }

  dumpDeviceInfo(device);

  /*
   * inputreportイベント登録
   */
  inputReportHandler =
    handleInputReport;

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

    /*
     * STEP 1
     */
    await checkProtocol();

    /*
     * STEP 2
     */
    await checkLayerCount();

    /*
     * 読み取りボタン有効化
     */
    if (els.readUnusedBtn) {
      els.readUnusedBtn.disabled =
        false;
    }

    log(
      'log',
      'CONNECT SUCCESS'
    );

  } catch (error) {

    await disconnectJP60();

    throw error;
  }
}

// ============================================================
// VIA protocol
// ============================================================

async function checkProtocol() {

  log(
    'log',
    '----------------------------------------'
  );

  log(
    'log',
    'STEP 1: GET_PROTOCOL_VERSION'
  );

  log(
    'log',
    '----------------------------------------'
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

  /*
   * VIA protocol version
   *
   * response:
   *   [0] command
   *   [1] high
   *   [2] low
   */
  const version =
    (response[1] << 8) |
    response[2];

  currentProtocol =
    version;

  if (els.protocol) {
    els.protocol.textContent =
      hex16(version);
  }

  if (
    SUPPORTED_VIA_PROTOCOLS.has(
      version
    )
  ) {

    log(
      'log',
      `SUPPORTED VIA PROTOCOL: ${hex16(version)}`
    );

  } else {

    log(
      'error',
      `UNSUPPORTED VIA PROTOCOL: ${hex16(version)}`,
    );

    throw new Error(
      `VIA protocol ${hex16(version)} はこのテスト対象外です。`
    );
  }
}

// ============================================================
// Layer count
// ============================================================

async function checkLayerCount() {

  log(
    'log',
    '----------------------------------------'
  );

  log(
    'log',
    'STEP 2: GET_LAYER_COUNT'
  );

  log(
    'log',
    '----------------------------------------'
  );

  /*
   * command 0x11
   */
  const response =
    await sendCommand(
      new Uint8Array([
        VIA.GET_LAYER_COUNT
      ]),

      data =>
        data[0] ===
        VIA.GET_LAYER_COUNT,

      'GET_LAYER_COUNT'
    );

  /*
   * response:
   *   [0] command
   *   [1] layer count
   */
  currentLayerCount =
    response[1];

  if (els.layers) {
    els.layers.textContent =
      String(
        currentLayerCount
      );
  }

  log(
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
      `Layer countが不正です: ${currentLayerCount}`
    );
  }
}

// ============================================================
// GET_KEYCODE
// ============================================================

async function getKeycode(
  layer,
  row,
  column
) {

  /*
   * 念のため範囲確認
   */
  if (
    !Number.isInteger(layer) ||
    !Number.isInteger(row) ||
    !Number.isInteger(column)
  ) {
    throw new Error(
      `GET_KEYCODE座標が整数ではありません: layer=${layer}, row=${row}, column=${column}`
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
    row >= JP60.matrixRows
  ) {
    throw new Error(
      `row範囲外: ${row}`
    );
  }

  if (
    column < 0 ||
    column >= JP60.matrixCols
  ) {
    throw new Error(
      `column範囲外: ${column}`
    );
  }

  /*
   * GET_KEYCODE:
   *
   * [0] 0x04
   * [1] layer
   * [2] row
   * [3] column
   */
  const response =
    await sendCommand(
      new Uint8Array([
        VIA.GET_KEYCODE,
        layer,
        row,
        column,
      ]),

      data =>
        data[0] ===
          VIA.GET_KEYCODE &&
        data[1] === layer &&
        data[2] === row &&
        data[3] === column,

      `GET_KEYCODE L${layer} R${row} C${column}`
    );

  /*
   * response:
   *
   * [4] keycode high
   * [5] keycode low
   */
  const keycode =
    (response[4] << 8) |
    response[5];

  log(
    'log',
    `READ L${layer} R${row} C${column} = ${hex16(keycode)}`
  );

  return keycode;
}

// ============================================================
// JP60 KC_NO candidate read
// ============================================================

async function readKnownUnusedCells() {

  log(
    'log',
    '========================================'
  );

  log(
    'log',
    'STEP 3: READ JP60 KC_NO CANDIDATES'
  );

  log(
    'log',
    '========================================'
  );

  if (
    currentProtocol === null
  ) {
    throw new Error(
      'VIA protocolが未確認です。'
    );
  }

  if (
    currentLayerCount === null ||
    currentLayerCount < 1
  ) {
    throw new Error(
      'Layer countが未確認です。'
    );
  }

  const results = [];

  for (
    const [
      row,
      column
    ]
    of JP60.knownUnusedCells
  ) {

    log(
      'log',
      `Reading candidate cell: R${row} C${column}`
    );

    const keycode =
      await getKeycode(
        JP60.baseLayer,
        row,
        column
      );

    const isKCNO =
      keycode ===
      QMK.KC_NO;

    const item = {
      layer:
        JP60.baseLayer,

      row,
      column,

      keycode:
        hex16(keycode),

      keycodeNumber:
        keycode,

      isKCNO,
    };

    results.push(
      item
    );

    if (isKCNO) {

      log(
        'log',
        `R${row} C${column} = KC_NO`
      );

    } else {

      log(
        'warn',
        `R${row} C${column} is NOT KC_NO`,
        item
      );
    }
  }

  /*
   * 表示
   */
  if (els.readResult) {
    els.readResult.textContent =
      JSON.stringify(
        results,
        null,
        2
      );
  }

  /*
   * 全部KC_NOか確認
   */
  const allKCNO =
    results.every(
      item =>
        item.isKCNO
    );

  if (allKCNO) {

    log(
      'log',
      'ALL KC_NO CANDIDATES MATCH KC_NO.'
    );

    setStatus(
      '読み取りテスト成功',
      'ok'
    );

  } else {

    log(
      'warn',
      'KC_NO想定セルの一部がKC_NOではありません。'
    );

    setStatus(
      '読み取り完了（一部KC_NOではありません）',
      'error'
    );
  }

  log(
    'log',
    'READ-ONLY TEST FINISHED.'
  );

  return results;
}

// ============================================================
// Disconnect
// ============================================================

async function disconnectJP60() {

  log(
    'log',
    'DISCONNECT START'
  );

  /*
   * pending commandを止める
   */
  if (pending) {

    clearTimeout(
      pending.timer
    );

    try {
      pending.reject(
        new Error(
          'HID接続が解除されました。'
        )
      );
    } catch (_) {
      // ignore
    }

    pending = null;
  }

  /*
   * inputreport解除
   */
  if (
    device &&
    inputReportHandler
  ) {

    try {

      device.removeEventListener(
        'inputreport',
        inputReportHandler
      );

    } catch (error) {

      log(
        'warn',
        'inputreport listener解除失敗',
        error?.message ||
          error
      );
    }
  }

  /*
   * close
   */
  if (device) {

    try {

      if (
        device.opened
      ) {

        await device.close();

        log(
          'log',
          'HID device closed.'
        );
      }

    } catch (error) {

      log(
        'error',
        'device.close() failed',
        error?.message ||
          error
      );
    }
  }

  device = null;
  reportId = 0;
  currentProtocol = null;
  currentLayerCount = null;
  inputReportHandler = null;

  if (els.protocol) {
    els.protocol.textContent = '-';
  }

  if (els.layers) {
    els.layers.textContent = '-';
  }

  if (els.reportId) {
    els.reportId.textContent = '-';
  }

  if (els.readUnusedBtn) {
    els.readUnusedBtn.disabled =
      true;
  }

  setStatus(
    '未接続'
  );

  log(
    'log',
    'DISCONNECT FINISHED'
  );
}

// ============================================================
// UI event
// ============================================================

if (els.connectBtn) {

  els.connectBtn.addEventListener(
    'click',
    async () => {

      try {

        await connectJP60();

      } catch (error) {

        log(
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
}

if (els.disconnectBtn) {

  els.disconnectBtn.addEventListener(
    'click',
    async () => {

      await disconnectJP60();

    }
  );
}

if (els.readUnusedBtn) {

  /*
   * このボタンはREAD ONLY。
   *
   * SET_KEYCODEはここでは呼ばれない。
   */
  els.readUnusedBtn.addEventListener(
    'click',
    async () => {

      try {

        await readKnownUnusedCells();

      } catch (error) {

        log(
          'error',
          'READ TEST FAILED',
          error?.message ||
            error
        );

        setStatus(
          '読み取りテスト失敗',
          'error'
        );
      }

    }
  );
}

// ============================================================
// HID disconnect event
// ============================================================

if (
  'hid' in navigator
) {

  navigator.hid.addEventListener(
    'disconnect',
    event => {

      if (
        device &&
        event.device ===
          device
      ) {

        log(
          'warn',
          'HID device was disconnected externally.'
        );

        device = null;

        setStatus(
          'キーボードが切断されました。',
          'error'
        );
      }
    }
  );
}

// ============================================================
// START
// ============================================================

log(
  'log',
  '========================================'
);

log(
  'log',
  'JP60 VIA READ-ONLY TEST v2'
);

log(
  'log',
  'WRITE COMMANDS ARE NOT IMPLEMENTED.'
);

log(
  'log',
  '========================================'
);

setStatus(
  '未接続'
);
