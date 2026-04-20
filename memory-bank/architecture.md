# Architecture

## 总体结构

项目采用“微信小程序前端 + 微信云开发云函数 + 云数据库”的结构。

### 前端层

- `app.js`：应用启动、云初始化、登录引导、全局鉴权状态维护
- `pages/`：页面层，负责展示与交互
- `components/`：通用 UI 组件
- `api/relationship.js`：业务请求封装，统一调用云函数
- `utils/cloud.js`：云能力初始化
- `utils/pageAuth.js`：页面级授权兜底
- `utils/couple.js`：日期、关系时长等业务工具

### 后端层

- `cloudfunctions/auth`：白名单登录、空间初始化
- `cloudfunctions/relationship`：空间业务读写入口

### 数据层

- `users`：成员身份
- `space`：空间主文档
- `moments`：回忆记录
- `anniversaries`：纪念日
- `wishes`：心愿单

## 关键数据流

### 启动链路

1. `app.js` 调用 `initCloud()`
2. 云环境初始化成功后调用 `loginToSpace()`
3. 云函数返回用户身份与授权状态
4. 页面通过 `ensureAuthorizedPage()` 决定是否继续加载业务数据

### 业务读写链路

1. 页面层触发操作
2. `api/relationship.js` 封装参数并调用云函数
3. `relationship` 云函数校验成员身份与操作权限
4. 云函数写入数据库
5. 前端重新拉取页面数据，保证视图一致

## 页面划分原则

- 首页负责概览，不承担重编辑流程
- 时光墙承载回忆记录主线
- 纪念日和心愿单拆成独立页面，不再合并
- 日历日记是辅助浏览与回写入口，不放进底部 Tab
- 宠物岛是次要玩法页面

## 当前明确边界

- 业务敏感逻辑不放在前端直接写库
- 旧的“纪念与心愿合并页”已废弃
- 视觉装饰只作为背景层，不应影响主要信息可读性