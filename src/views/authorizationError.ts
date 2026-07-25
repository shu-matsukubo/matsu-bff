export const authorizationErrorPage = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ログインをやり直してください | matsu</title>
    <style>
      :root{font-family:Inter,"Noto Sans JP",system-ui,sans-serif;color:#172033;background:#f4f6f8}
      *{box-sizing:border-box}
      body{margin:0}
      .auth-page{min-height:100vh;display:grid;place-items:center;padding:24px}
      .auth-panel{width:min(100%,420px);padding:32px;border:1px solid #dce2e8;border-radius:14px;background:#fff;box-shadow:0 18px 50px rgba(23,32,51,.09)}
      .auth-header{margin-bottom:24px}
      .eyebrow{margin:0 0 8px;color:#2c6e63;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
      h1{margin:0;font-size:26px;line-height:1.3}
      .description{margin:10px 0 0;color:#617083;font-size:14px;line-height:1.6}
      .primary{display:flex;min-height:44px;align-items:center;justify-content:center;border:1px solid #2c6e63;border-radius:8px;color:#fff;background:#2c6e63;font-weight:700;text-decoration:none}
      .primary:hover{background:#245b53}
      .footnote{margin:18px 0 0;color:#7b8797;font-size:12px;text-align:center}
      @media(max-width:480px){.auth-page{padding:16px}.auth-panel{padding:24px}}
    </style>
  </head>
  <body>
    <main class="auth-page">
      <section class="auth-panel" aria-labelledby="auth-title">
        <header class="auth-header">
          <p class="eyebrow">matsu</p>
          <h1 id="auth-title">ログインをやり直してください</h1>
          <p class="description">ログイン情報の有効期限が切れたか、処理を完了できませんでした。</p>
        </header>
        <a class="primary" href="/auth/login">もう一度ログイン</a>
        <p class="footnote">この画面を閉じて、アプリからやり直すこともできます。</p>
      </section>
    </main>
  </body>
</html>`;
