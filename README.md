# ai-spec-driven-documents

AIエージェ  ントとの協働開発のためのテンプレートリポジトリ。仕様書駆動開発を支援
するルール・ドキュメント構成を提供。

## 🎯 概要

このテンプレートは、LLMベースのAIエージェントと効率的に協働開発を行うための標準構成を提供します。

## 📁 ディレクトリ構成

```
├── _llm-rules/        # AI動作制御ルール
├── _llm-docs/         # プロジェクト仕様書
├── _llm-memories/     # 学習記録
└── README.md          # このファイル
```

## 🚀 使い方

1. このリポジトリをテンプレートとして使用
2. **GitHub Projects設定**: [`_llm-docs/github-projects-config.md`](_llm-docs/github-projects-config.md) の初期設定手順に従ってGitHub Projectsを設定
3. `_llm-docs/` にプロジェクト仕様を配置
4. 必要に応じて `_llm-rules/` をカスタマイズ
5. Claude Codeで開発開始

## 📝 カスタマイズ

- **プロジェクト仕様**: `_llm-docs/requirements_definition.md` を編集
- **用語統一**: `_llm-docs/dictionary.md` に用語を追加
- **開発ルール**: `_llm-rules/` 内のファイルを調整

## 💐 謝辞

このテンプレートは以下のプロジェクトから多くを学ばせていただきました：

- [Next-Stage](https://next-stage-demo.vercel.app/) - `_llm-docs`と`_llm-rules`構成の基盤設計や、`core_rules.md`のコアルール。
