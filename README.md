# Wise World 3

世界中の、学校に通えない子どもたちが「幸せに・健康に生きるための基礎知識」を学ぶための、**軽量・完全オフライン**のクイズアプリ「Wise World」三部作の**完結編**です（対象：9〜12歳）。

- 素の HTML / CSS / JavaScript（PWA）。インストール不要・ブラウザだけで動作。
- 完全オフライン対応（Service Worker でアプリ一式をキャッシュ）。
- 12言語対応・4択クイズ・読了でEXP獲得・レベルアップ。日本語は総ルビ（ふりがな）。
- 配色はバイオレット（Wise World 3 のテーマ）。

## 公開（GitHub Pages）

このリポジトリのルートをそのまま配信すれば動きます（ビルド不要）。

## 構成

- `index.html` … 画面・ロジック・CSS 一式
- `i18n.js` … 全言語のUI文言
- `questions.<言語コード>.js` … 言語別クイズデータ（選択言語のみ遅延読込）
- `audio.js` … Web Audio 合成のBGM/効果音（音声ファイル不要）
- `manifest.webmanifest` / `sw.js` / `icons/` … PWA関連

---

アプリ開発：介護と支援の相談どころ「そよぎ」 https://soyogi.hp.peraichi.com/top
