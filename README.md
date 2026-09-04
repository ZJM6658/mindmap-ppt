# Mindmap PPT

把文章、报告、演讲稿或笔记交给 Agent，生成一个可播放的思维导图 PPT。

你只需要关心“要讲什么、讲给谁、想要什么风格”。Agent 会负责拆结构、写导图内容、整理配图、启动预览和检查结果。

在线演示：[https://agegr.github.io/mindmap-ppt/](https://agegr.github.io/mindmap-ppt/)

## 推荐用法

1. 准备你的原始材料：文章、会议纪要、产品文档、课程笔记、汇报提纲都可以。
2. 让 Agent 使用 `mindmap-ppt-builder` 生成 Mindmap PPT。可以指定目标受众、演示时长、希望风格、重点信息等。
3. 打开本地预览，继续让 Agent 调整结构、文案或配图。

如果需要手动修改思维导图的内容，可以编辑：

- `project/source.js`：导图内容
- `project/` 下的图片素材：节点插图

## 安装 Agent Skill

安装到当前环境：

```bash
npx skills add ZJM6658/mindmap-ppt --skill mindmap-ppt-builder
```

安装到 Codex 全局 skill：

```bash
npx skills add ZJM6658/mindmap-ppt --skill mindmap-ppt-builder --agent codex --global
```


## 本地预览

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5173/
```

## 播放操作

- 上一个 / 下一个逻辑单元：方向键、Page Up / Page Down、空格 / Shift + 空格，或底部箭头按钮
- 跳到指定逻辑单元：拖动进度滑条
- 浏览画布：在空白处拖动，或直接使用鼠标滚轮 / 触控板平移
- 调整画布大小：拖动缩放滑条，或使用 Ctrl / Command + 滚轮；移动端支持双指缩放
- 查看全局：点击“适应画布”，缩放范围会根据当前内容动态调整
- 临时查看节点：点击画布中的节点，只在节点完全离开视野时轻推视角，不改变播放进度

Agent 会用 `@unit` 标记讲述节拍。一次翻页会展开当前逻辑单元中的全部节点；单元和内部节点都可以继续使用 `@image` 添加图片。没有 `@unit` 的旧内容仍按节点逐个播放。

画布采用持久视角：翻页后会保留你刚才的缩放和位置，只有新单元完全跑出视野时才做最小幅度的校正。这样既能按节奏讲，也能随时拉远看全局或拖到局部讨论。

## 部署

这是一个静态网页项目。确认预览效果后，可以直接部署到 GitHub Pages、Netlify、Vercel Static、Nginx、对象存储或任意 CDN。
