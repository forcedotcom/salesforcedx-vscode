---
title: Aura コンポーネントの記述
lang: ja
---

## 構文の強調表示

Aura コンポーネント拡張機能は、.cmp、.component、.app などのファイルの Aura マークアップ、HTML、CSS、JavaScript の構文を強調表示します。次の例では、JavaScript の構文が強調表示されています。

![Aura バンドルにある .js ファイルの構文の色分けされた強調表示](./images/V2_lightning_syntax.png)

## コード補完

Aura マークアップで作業中に Ctrl+スペースキーを押すと、コード補完が起動します。タグの名前や属性に関する追加情報が直接エディタに表示されます。

#### タグ

![Aura のタグ補完](./images/V2_aura_tag_completion.png)

- **注意:** ワークスペースに Lightning Web コンポーネントがある場合は、それらのコンポーネントも補完候補のリストに表示されます。適切な Aura 構文とともに、Lightning Web コンポーネントの候補が表示されます。

#### 属性

![Aura の属性補完](./images/V2_aura_attribute_completion.png)

## カーソルを置くとコンポーネントドキュメントを表示

コンポーネントの名前または属性にカーソルを置くと、エディタにコンポーネントのドキュメントと、コンポーネントライブラリへのリンクが表示されます。Aura コンポーネントや、Aura コンポーネント内にネストされている Lightning Web コンポーネントの参照ドキュメントを確認できます。

以下は、`lightning:card` コンポーネントの参照ドキュメントです。
![Aura コンポーネントの参照](./images/V2_comp_reference_aura.png)

## 定義の表示または定義への移動

次の定義をプレビューや表示したり、定義に移動することができます。

- Aura タグ
- LWC タグ
- JavaScript
  - メソッド
  - 変数

定義をプレビューするには、Ctrl キー \(Windows、Linux\) または Cmd キー \(macOS\) を押したまま、定義を表示する項目にカーソルを置きます。

定義を表示するには、項目を右クリックして [Peek Definition \(定義をここに表示\)] を選択するか、Alt+F12 キーを押します。

定義の場所に移動するには、項目を右クリックして [Go to Definition \(定義へ移動\)] を選択するか、F12 キーを押します。

## アウトラインビュー

[Outline \(アウトライン\)] ビューでは、コンポーネントのアウトライン \(HTML のタグ、JavaScript のプロパティなど\) を確認できます。Windows または Linux は Ctrl+Shift+O キー、Mac は Cmd+Shift+O キーで起動します。

![Aura バンドルにある .js ファイルの記号のリスト](./images/V2_outline_view.png)
