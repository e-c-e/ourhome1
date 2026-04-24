# Tech Stack

## 前端技术栈

- 微信小程序原生框架
- WXML + WXSS/LESS
- 自定义 `custom-tab-bar`
- `tdesign-miniprogram` 组件库
- 自研暖色 UI 组件：`warm-navbar`、`warm-button`、`warm-input`、`warm-status-card`、`warm-empty-state`

## 运行与构建

- 包管理：npm
- 依赖安装后由微信开发者工具构建 `miniprogram_npm`
- lint：ESLint + Prettier
- 当前 `package.json` 仍保留模板名称 `tdesign-miniprogram-starter`，属于后续可整理项

## 云开发

- 已启用 `cloud: true`
- 当前配置使用 `DYNAMIC_CURRENT_ENV`
- 前端启动时会先初始化云环境，再执行登录校验

## 关键依赖

- `tdesign-miniprogram`
- `eslint`
- `prettier`
- `husky`
- `lint-staged`

## 项目约束

- 所有核心业务写操作应通过云函数完成，不直接从前端写数据库
- 页面样式使用 LESS，并遵循当前暖色、梦幻、轻装饰的视觉方向
- 这是双人空间，不做多人协作设计
- 成员数量必须严格限制为 2 人，第三个人无论从哪个入口进入都必须在登录阶段被拒绝
- 新增功能时优先保证“记录”主线，不为玩法扩展牺牲主题聚焦
- 当前提醒能力先收敛到“记录今天”入口：一方发布后只通知另一方，不做群通知、不做多模块统一提醒框架