# JP60 / QMK 0.18 / VIA 0x0A 隔離テスト

既存のARMSTRONG本体コードには接続しない、JP60専用のWebHID検証ページです。

## 目的

1. WebHIDでJP60を選べるか確認
2. VIA protocol 0x000Aを確認
3. layer countを読み取る
4. JP60の公式LAYOUT上でKC_NOになっているmatrixセルを読み取る
5. その中の `[layer 0, row 3, column 1]` だけを一時的に `KC_A` に変更
6. GET_KEYCODEで変更を確認
7. 元の `KC_NO` に即時復元
8. 復元をGET_KEYCODEで確認

## 重要な安全上の制限

- 本番の `common.js` / `result.js` / `edit.js` は変更していません。
- `DYNAMIC_KEYMAP_RESET (0x06)` は送信しません。
- `EEPROM_RESET (0x0A)` は送信しません。
- `BOOTLOADER_JUMP (0x0B)` は送信しません。
- `DYNAMIC_KEYMAP_SET_BUFFER (0x13)` は送信しません。
- マクロ書き込みコマンドは送信しません。
- Base Layer以外には書き込みません。
- 実書き込みは明示チェック + `JP60 WRITE` の入力が必要です。
- 書き込み対象は、事前に `KC_NO (0x0000)` と確認した未使用matrixセルだけです。
- 書き込み後は必ずGETで確認し、直ちに元へ戻します。
- 途中で失敗した場合はロールバックを試みます。

## 実行条件

GitHub PagesなどHTTPSで公開するか、開発中は `http://localhost/...` で実行してください。WebHIDはSecure Contextが必要です。

Chrome / Edge系ブラウザを前提にしています。

## 実行前

JP60をRemap、VIA、QMK Toolboxなど別のアプリで同時に操作しないでください。

まず `jp60-via-test.html` を開き、「1. 接続・診断」→「2. 読み取り専用チェック」まで行ってください。

書き込みテストは、そのログを確認してから明示的に有効化します。
