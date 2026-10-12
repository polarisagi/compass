#!/bin/sh
# 部署到 Cloudflare Pages。只上传站点需要的文件，不上传文档、测试和 .git。
# 第一次使用：npx wrangler login，然后 npx wrangler pages project create compass --production-branch main
set -e
cd "$(dirname "$0")/.."
node --test
rm -rf dist && mkdir dist
cp -R index.html _headers css js dist/
npx --yes wrangler@4 pages deploy dist --project-name "${PAGES_PROJECT:-compass}" --branch main --commit-dirty=true
