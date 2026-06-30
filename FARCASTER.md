# Farcaster Mini App 対応メモ（Wise World 3）

このリポジトリは GitHub Pages 公開のWebアプリを **Farcaster Mini App** としても動くように改修済み。

## 追加・変更したもの
- `index.html` `<head>`：`fc:miniapp` メタタグ（＋旧クライアント互換の `fc:frame`）。タイムラインで画像＋ボタンのカードになり、タップで起動する。
- `index.html` `</body>` 直前：`@farcaster/miniapp-sdk` を esm.sh から動的importし `sdk.actions.ready()` を呼ぶモジュールスクリプト。Farcaster外の通常ブラウザ・オフライン時は try/catch で無害にスキップ。
- `icons/farcaster-embed.png`：埋め込みカード用 3:2 画像（1200×800・紫グラデ＋アプリアイコン）。生成は scratchpad の `gen-embed.js`（sharp使用）。
- `.well-known/farcaster.json`：Mini App の身分証（**未署名**）。

## 残作業（ユーザー操作が必要）
1. **manifest の署名**：`https://farcaster.xyz/~/developers/mini-apps/manifest` で署名し、`farcaster.json` に `accountAssociation`（header / payload / signature）を追記する。※Farcasterアカウント（FID）が必要。
2. **ドメインの注意**：`farcaster.json` は **ドメイン直下**（`https://<ドメイン>/.well-known/farcaster.json`）でないと「アプリ追加・通知・発見」が有効にならない。現状は GitHub Pages のサブパス（`.../wise_world_web_3/`）配下なので、カード表示＆起動は機能するが、完全な独立公開には独自ドメイン/サブドメインが要る。
3. **検証**：`https://farcaster.xyz/~/developers/mini-apps/embed`（Embed/Frame Validator）に公開URLを貼って表示確認。
4. **git push** して GitHub Pages に反映。

## 確認済み
- ローカルプレビュー（:3014）でホーム画面が正常描画・コンソールエラーなし・`fc:miniapp` メタタグのJSONが正しく解析される（version 1 / action launch_miniapp / URL正）こと。
