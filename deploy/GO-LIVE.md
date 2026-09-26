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
广告与排行：

1. 排行榜走 Cloudflare D1 + Pages Function `/api/board`，按 IP 国家分榜。昵称可自设。账号 = 该浏览器 localStorage 里的随机 id，换设备即新号。
2. 广告用 Google H5 Ad Placement API。游戏代码已接好；你还需要 AdSense 发布商号，步骤如下。

## 5. 接入 Google 广告（详细）

游戏侧已经写好：商店激励视频、暂停与静音。`ca-pub-6491556738882383` 已写进首页和隐私页。`ads.txt` 已上线。还缺 AdSense 网站审核通过。

### A. 开 AdSense

1. 用 Google 账号打开 [AdSense](https://www.google.com/adsense/)。
2. 国家、收款、税务按提示填完。审核未过之前不会出钱。
3. 添加网站：`5050cut.com`（不要只填 www，apex 和 www 都会被爬）。
4. 按后台提示把站点验证码或 meta 标签加上。需要我改 `index.html` 时把验证码原文发过来。

### B. 放 ads.txt（必做）

1. AdSense → 网站 → `5050cut.com` → 复制 ads.txt 那一行，形如：

   `google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0`

2. 把这一行发给我，我会放到站点根目录 `https://5050cut.com/ads.txt`（必须 HTTP 200，不能 404）。
3. 回到 AdSense 点「检查更新」。状态变成 **已获授权** 后再申请审核。

### C. 开通 H5 游戏广告

1. 在 AdSense 帮助里确认产品名是 **H5 Games Ads / Ad Placement API**（网页小游戏，不是手机 App 的 AdMob 插屏单元）。
2. 找到发布商 ID：`ca-pub-` 开头那串。
3. 把 `ca-pub-…` **发给我**。我会写进 `index.html` 的 `window.AD_CLIENT`，再部署一次。没有这串，商店会显示「未开放」，线上不会请求广告。
4. 官方说明：把 AdSense 脚本和 `adBreak` / `adConfig` 放在**游戏同一个 HTML 文档**里（我们已经这样做，不要再套一层外站 iframe 播广告）。

参考：

- [将 AdSense 代码添加到游戏页面](https://support.google.com/adsense/answer/9955214?hl=zh-Hans)
- [Ad Placement API](https://developers.google.com/ad-placement/apis)
- [ads.txt](https://support.google.com/adsense/answer/7532444?hl=zh-Hans)

### D. 站点审核

1. ads.txt 已授权、首页能打开、隐私页 `/privacy` 能打开。
2. 在 AdSense 申请网站审核。常见要等几天到几周。
3. 被拒时把拒因发我（常见：内容少、政策、ads.txt 不对、站点还在建设）。

### E. 填上 pub 之后游戏里会发生什么

| 位置 | 行为 |
|---|---|
| 首次进入 | 首页加载 AdSense 脚本（给 Google 验证站点）。不弹同意框，也不自动播广告。 |
| 商店「看广告」 | 激励视频；看完才给 3 币。没填充会提示「暂时没有广告」，不给币。审核没过或没 ads.txt 时常常没填充。 |
| 一局结束点「再来一局」或回菜单 | 不播插屏。 |
| 本机 `localhost` | 不请求正式广告，商店广告用短模拟，方便试代币。 |

### F. 你这边要准备的材料（发我就行）

1. `ca-pub-` 发布商 ID  
2. AdSense 给出的 **ads.txt 整行**  
3. 如有站点验证 meta / HTML 文件，原文  

不要把 AdSense 登录密码发到聊天里。

### G. 出广告之后怎么确认

1. 无痕打开 `https://5050cut.com/`，完成同意横幅。
2. 商店不再写「未开放」。
3. 电脑可在 URL 临时加 Google 测试参数（我部署 pub 时会按官方 `data-adbreak-test` 说明来）。
4. AdSense 报告里出现请求/展示会再晚一些，没填充时游戏会走 no-fill，属正常。

没有填 pub id 时，正式站不会播广告；本机商店「看广告」用短模拟以便试代币。
