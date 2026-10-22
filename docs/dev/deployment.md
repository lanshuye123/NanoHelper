# 构建与部署

## 构建

```bash
npm install
npm run build
```

产物在 `dist/`，包括：

```text
dist/
├─ index.html
├─ assets/*.js, *.css
├─ samples/DEMO06.dif
├─ favicon.svg
└─ …
```

## 本地预览

```bash
npm run preview
# 或
npx serve dist
```

不要用 `file://` 直接打开：ES module 与 `fetch` 会被浏览器阻止。

## 本项目实际部署

| 项 | 值 |
|---|---|
| 仓库 | `lanshuye123/NanoHelper` |
| 站点 | <https://nano.jamaccao.cn> |
| 自定义域名 | `public/CNAME` → `nano.jamaccao.cn` |
| Pages 源 | GitHub Actions |
| 构建命令 | `npm ci && npm run test:unit && npm run build` |

推送 `main` 后，`.github/workflows/deploy.yml` 会自动构建并发布。自定义域名是根路径，因此 `VITE_BASE_PATH=/`。

## 子路径

若部署在 `https://example.com/NanoHelper/`，构建时设置：

```bash
VITE_BASE_PATH=/NanoHelper/ npm run build
```

Vite 会把 `base` 注入资源路径；示例文件通过 `import.meta.env.BASE_URL` 访问，自动带上前缀。

路由使用 **hash 模式**（`#/data/import`），因此不需要服务器 404 回退；静态托管即可。

## GitHub Pages

1. 推送到 `main`；
2. 仓库 Settings → Pages → Source 选 GitHub Actions；
3. 自定义域名填写 `nano.jamaccao.cn`（`public/CNAME` 也会在构建产物中保留）；
4. 使用官方 Pages workflow，或自建：

```yaml
name: deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run test:unit
      - run: npm run build
        env:
          VITE_BASE_PATH: /
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

本项目使用自定义域名根路径，因此 `VITE_BASE_PATH=/`。若改用 `username.github.io/NanoHelper` 形式，则设为 `/NanoHelper/`。

## 自定义域名

1. 在 `public/CNAME` 写入域名（构建后复制到 `dist/CNAME`）；
2. DNS 添加 `CNAME` 记录指向 `<user>.github.io`；
3. Pages 设置中填写域名并启用 HTTPS。

使用自定义域名时，`VITE_BASE_PATH` 设为 `/`。

## 其他静态托管

| 平台 | 要点 |
|---|---|
| Netlify | Build `npm run build`，Publish `dist` |
| Vercel | 同上，Framework 选 Vite |
| 内网 Nginx | 把 `dist/` 复制到站点目录；无需 rewrite |
| 对象存储 | 开启静态网站托管；MIME 正确（`.js` → `text/javascript`） |

## 缓存

- 带 hash 的 `assets/*` 可长期缓存；
- `index.html` 建议 `no-cache`，确保新版本生效；
- `samples/*.dif` 可缓存 1 天。

## 常见问题

**页面空白**

- 路径前缀错误：检查 `VITE_BASE_PATH`；
- MIME 类型错误：`.js` 被当成 `text/plain`；
- 直接 `file://` 打开。

**示例 DIF 404**

- `public/samples/DEMO06.dif` 未随构建复制；
- 子路径下 `BASE_URL` 不匹配。

**刷新后 404**

- 本项目使用 hash 路由，不应出现；若改了 history 路由，需要服务器回退到 `index.html`。

**文档图片不显示**

- `docs/` 中的相对图片需要放在 `public/` 并用绝对路径，或改用 `public/docs/`；
- 构建后检查图片是否在 `dist` 中。

## 发布检查

- [ ] `npm run build` 通过；
- [ ] `dist/` 中包含 `index.html`、`samples/DEMO06.dif`、`favicon.svg`；
- [ ] 子路径下刷新任意 hash 路由正常；
- [ ] 示例数据、文档、导出按钮可用；
- [ ] 控制台无 404/错误。
