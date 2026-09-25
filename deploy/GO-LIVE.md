# 对半切 · 便宜上线（Cloudflare Pages + R2）

不需要买 VPS。域名买来后把 DNS 交给 Cloudflare。

## 0. 压模型（本机先做完）

```bash
cd "/Users/jayden/Documents/Small Games"
npm install
npm run compress-glb
```

贴图缩到 1024 并做 Draco 压缩，**不减面**，外形跟导出时一样。先 `npm run restore-glb`（从 Downloads 里那批原始 GLB 拷回），再 `npm run compress-glb`。

## 1. 账号

1. 注册 [Cloudflare](https://dash.cloudflare.com/sign-up)（免费）。
2. 买便宜域名（Porkbun / Cloudflare Registrar 均可）。
3. 域名 DNS 加进 Cloudflare（免费代理开着）。
4. 本机：`npx wrangler login`

## 2. 上网页（推荐）

压完后每个 GLB 远小于 25MB，**可以直接整包上 Pages，不必先开 R2**。R2 只在以后还要丢更大文件时再用。

```bash
npm run deploy:pages
```

第一次会提示创建 Pages 项目 `precise-cut`。然后在 Pages 里加自定义域名（apex 或 `www`）。

## 3. 模型仍太大时：R2

```bash
npx wrangler r2 bucket create precise-cut-assets
npx wrangler r2 bucket cors set precise-cut-assets --file deploy/r2-cors.json
npm run deploy:r2
```

Dashboard → R2 → 该桶 → Settings → **Custom Domains** → 绑 `cdn.你的域名`。

然后二选一：

- 改 `src/config.js` 的 `assetBase` 为 `https://cdn.你的域名` 再 `npm run deploy:pages`
- 或在 `index.html` 里设 `window.ASSET_BASE = "https://cdn.你的域名"`

R2 走自定义域名时，Cloudflare 出站流量免费。不要用 `*.r2.dev` 当正式地址（有限速）。

## 4. 本地预览

```bash
python3 -m http.server 8765
```

`assetBase` 留空，继续读 `./assets`。

## 授权

Tripo 模型、豆包摊位图不是 CC0。公开站点前核对导出时的条款。广告 SDK 仍未接。
