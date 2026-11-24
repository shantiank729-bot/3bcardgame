# 手を動かして学ぶ 量子コンピュータ入門（Qiskit）

大学1年生（線形代数は勉強中・量子力学は未習）向けの、Jupyterノートブック教材です。
全部パソコンの中のシミュレーター（Qiskit Aer）で動きます。最後の回だけ、IBMの本物の量子コンピュータ（無料のOpen Plan）を使います。

## 教材の一覧

| # | ノートブック | 内容 | 状態 |
|---|---|---|---|
| 1 | `notebooks/01_qubit.ipynb` | 量子ビットとは何か・重ね合わせ・測定・ブロッホ球 | ✅ |
| 2 | 量子ゲート（X, H, Z など） | 行列と図でゲートの働きを見る | 準備中 |
| 3 | 量子もつれ（ベル状態） | 何千回も測定して「必ずそろう」を確かめる | 準備中 |
| 4 | 量子テレポーテーション | | 準備中 |
| 5 | ドイチ・ジョザのアルゴリズム | | 準備中 |
| 6 | グローバーの探索アルゴリズム | 古典的な探索と回数を比べる | 準備中 |
| 7 | ノイズの影響 | シミュレーターでノイズを再現する | 準備中 |
| 8 | IBMの本物の量子コンピュータ | 無料のOpen Planだけで動かす | 準備中 |

練習問題の解答は `solutions/` フォルダにあります。まず自分で解いてから見てください。

## 環境の準備（最初に1回だけ）

Python 3.11 以上が必要です（3.13 で動作確認済み）。ターミナル（Windowsなら「PowerShell」）を開いて、このフォルダ `quantum-tutorial` に移動してから、次を順に実行します。

### 1. 仮想環境を作る

仮想環境とは「この教材専用のPythonの部屋」です。ほかのプロジェクトとライブラリが混ざらないようにします。

```bash
# Mac / Linux
python3 -m venv .venv
source .venv/bin/activate

# Windows (PowerShell)
py -m venv .venv
.venv\Scripts\Activate.ps1
```

うまくいくと、ターミナルの行頭に `(.venv)` と表示されます。
（Windowsで「スクリプトの実行が無効」と出たら、一度だけ `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` を実行してから、もう一度試してください。）

### 2. ライブラリを入れる

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

入るもの:
- `qiskit` … 量子回路を作るためのライブラリ本体（`[visualization]` は図を描くための追加部品）
- `qiskit-aer` … パソコンの中で量子コンピュータの動きを再現するシミュレーター
- `matplotlib` … グラフを描くライブラリ
- `jupyterlab` … ノートブックを開いて実行するアプリ

確認:

```bash
python -c "import qiskit, qiskit_aer; print(qiskit.__version__, qiskit_aer.__version__)"
```

`2.6.2 0.18.4` のように、Qiskit が `2.` で始まる数字になっていればOKです。

### 3. ノートブックを開く

```bash
jupyter lab
```

ブラウザが開くので、`notebooks/01_qubit.ipynb` をダブルクリック。上のセルから順に `Shift + Enter` で実行していきます。

次回からは、ターミナルでこのフォルダに移動し、`source .venv/bin/activate`（Windowsは `.venv\Scripts\Activate.ps1`）→ `jupyter lab` だけでOKです。

## この教材で使う「新しい書き方」について

Qiskit は 2024年の 1.0、2025年の 2.0 で大きく書き方が変わりました。ネットで見かける古い記事のコードは、今の Qiskit では **動きません**。

| 古い書き方（使わない） | この教材の書き方 |
|---|---|
| `from qiskit import Aer, execute` | `from qiskit_aer import AerSimulator` |
| `execute(qc, backend).result().get_counts()` | `SamplerV2().run([回路], shots=...).result()[0].data.meas.get_counts()` |
| `transpile(qc, backend)`（今も使えるが） | `generate_preset_pass_manager(...)` で作った `pm.run(qc)` |
| `qiskit.providers.aer` | `qiskit_aer` |

古い記事のコードを試してエラーが出たら、まずこの表を思い出してください。
