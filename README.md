# matsu-bff

`matsu-front` 専用の Backend for Frontend（BFF）です。ブラウザからのリクエストを受け、ログインとセッションを仲介し、家計簿・Toolbox・Arcade の各 API を呼び分けます。

サービスの責務と境界は [BFF 設計](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/components/bff.md) を参照してください。

## 必要な環境

- Docker Desktop または Docker Engine
- Docker Compose
- Node.js 22 と npm（ホストで品質チェックや生成処理を行う場合）

画面操作を含む一連の機能を確認するには、Front、各 API、各認証サーバーも必要です。ワークスペース全体の起動方法は親リポジトリの `README.md` と `DEVELOPMENT.md` を参照してください。

## 環境構築と起動

このリポジトリで次を実行します。

```bash
docker compose up --build bff
```

`bff` と開発用 Redis が起動し、ソース変更は自動で反映されます。

- BFF: <http://localhost:18082>
- ヘルスチェック: <http://localhost:18082/health>
- OpenAPI: <http://localhost:18082/openapi.json>
- Swagger UI: <http://localhost:18082/docs>

停止するには次を実行します。通常の停止では Redis の named volume を削除しません。

```bash
docker compose down
```

## 開発方法

依存関係をホストへインストールする場合は次を実行します。

```bash
npm ci
```

主なコマンドは次のとおりです。Windows PowerShell で `npm.ps1` が拒否される場合は、`npm` の代わりに `npm.cmd` を使ってください。

| コマンド                   | 用途                                         |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | 開発サーバーを起動する                       |
| `npm run check`            | lint、型検査、フォーマット検査をまとめて行う |
| `npm test`                 | コントラクトのスモークテストを行う           |
| `npm run build`            | TypeScript をビルドする                      |
| `npm run openapi:generate` | OpenAPI の生成物を更新する                   |
| `npm run openapi:check`    | OpenAPI の生成物が最新か確認する             |

ホストで `npm run dev` を使う場合は、Redis と接続先サービスを別途起動し、必要な環境変数を実行環境へ設定してください。

## 設定

設定項目とローカル既定値は `.env.example`、Docker 開発環境の設定は `docker-compose.yml` を参照してください。主な設定カテゴリは次のとおりです。

- BFF の公開 URL と許可する Front の Origin
- 家計簿・Toolbox・Arcade API の接続先
- 通常認証・Arcade 認証サーバーの接続先
- Redis、セッション Cookie、有効期限、上流タイムアウト

リポジトリ内のクライアントシークレットはローカル開発専用です。本番用の秘密情報をコミットしないでください。

## API 契約

ブラウザ向け API を変更した場合は、実装と同じ変更で `npm run openapi:generate` を実行し、生成済みの `openapi/openapi.json` を更新してください。契約の管理方針は [API 契約](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/architecture/api-contracts.md) を参照してください。

## 品質確認と CI

Pull Request の作成前に、CI と同じ主要な確認を実行します。

```bash
npm run check
npm run openapi:check
npm test
npm run build
```

依存関係をホストへ入れずに静的解析を実行する場合は、次のコマンドも利用できます。

```bash
docker compose run --rm --no-deps bff npm run check
```

GitHub Actions は `develop` または `main` 向けの Pull Request で実行されます。全体の品質ゲート方針は [品質ゲート](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/architecture/quality-gates.md) を参照してください。

## 最低限の運用

稼働確認には `/health`、ログ確認には次のコマンドを使います。

```bash
docker compose logs -f bff
```

認証やセッションに関する問題を調査する前に、BFF、Redis、接続先サービスが起動していることと、`docker-compose.yml` の接続先が環境に合っていることを確認してください。

## 関連ドキュメント

- [BFF 設計](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/components/bff.md)
- [API 契約](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/architecture/api-contracts.md)
- [認証とセッション](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/architecture/authentication.md)
- [品質ゲート](https://github.com/shu-matsukubo/matsu-docs/blob/main/docs/architecture/quality-gates.md)
