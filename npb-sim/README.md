# NPB球団経営シミュレーション（開発中）

ブラウザだけで動く、架空選手による日本プロ野球の球団経営シミュレーションです。設計は [docs/PLAN.md](docs/PLAN.md)。

```
npm install
npm run dev       # 開発サーバー（http://localhost:5173）
npm run build     # dist/ に書き出し
npm test          # テスト
npx vite-node scripts/fit-tuning.ts   # リーグ平均への自動調整
```
