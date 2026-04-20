const AUTH_LOADING_STEPS = [
  '微信身份确认',
  '白名单校验中',
  '伴侣空间匹配',
  '云端资料核验',
];

const MIN_AUTH_LOADING_MS = 2400;
const STEP_INTERVAL_MS = 520;
const SUCCESS_STAY_MS = 480;

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildLoadingSteps(activeIndex = 0, completed = false) {
  return AUTH_LOADING_STEPS.map((label, index) => ({
    label,
    status: completed ? 'done' : (index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending'),
  }));
}

function buildLoadingMeta(activeIndex = 0, completed = false) {
  const safeIndex = Math.max(0, Math.min(activeIndex, AUTH_LOADING_STEPS.length - 1));
  const completedCount = completed ? AUTH_LOADING_STEPS.length : safeIndex;
  const progress = completed ? 100 : Math.floor(((safeIndex + 1) / AUTH_LOADING_STEPS.length) * 100);

  return {
    loadingHint: completed ? '全部核验步骤已完成' : `正在执行：${AUTH_LOADING_STEPS[safeIndex]}`,
    loadingCountText: `${completedCount}/${AUTH_LOADING_STEPS.length} 项已完成`,
    loadingProgress: progress,
  };
}

Page({
  data: {
    status: 'loading',
    title: '正在连接你们的空间',
    desc: '首次进入时会自动完成白名单校验。',
    loadingSteps: buildLoadingSteps(0),
    loadingHint: '正在执行：微信身份确认',
    loadingCountText: '0/4 项已完成',
    loadingProgress: 25,
  },

  onShow() {
    this.runAuthCheck();
  },

  onHide() {
    this.clearAuthTimers();
  },

  onUnload() {
    this.clearAuthTimers();
  },

  clearAuthTimers() {
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (this.navigateTimer) {
      clearTimeout(this.navigateTimer);
      this.navigateTimer = null;
    }
  },

  startLoadingSequence() {
    this.clearAuthTimers();
    let activeIndex = 0;
    this.setData({
      loadingSteps: buildLoadingSteps(activeIndex),
      ...buildLoadingMeta(activeIndex),
    });

    this.loadingTimer = setInterval(() => {
      activeIndex = Math.min(activeIndex + 1, AUTH_LOADING_STEPS.length - 1);
      this.setData({
        loadingSteps: buildLoadingSteps(activeIndex),
        ...buildLoadingMeta(activeIndex),
      });
    }, STEP_INTERVAL_MS);
  },

  finishLoadingSequence() {
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
      this.loadingTimer = null;
    }
    this.setData({
      loadingSteps: buildLoadingSteps(AUTH_LOADING_STEPS.length - 1, true),
      ...buildLoadingMeta(AUTH_LOADING_STEPS.length - 1, true),
    });
  },

  async runAuthCheck(force = false) {
    const app = getApp();
    const startedAt = Date.now();

    this.setData({
      status: 'loading',
      title: '正在确认进入权限',
      desc: '正在依次完成微信身份、白名单、空间绑定与云端资料核验。',
      loadingSteps: buildLoadingSteps(0),
      ...buildLoadingMeta(0),
    });
    this.startLoadingSequence();

    try {
      const result = force ? await app.refreshAuth() : await app.ensureAuthorized();
      const remaining = Math.max(0, MIN_AUTH_LOADING_MS - (Date.now() - startedAt));
      if (remaining) {
        await wait(remaining);
      }
      this.finishLoadingSequence();

      if (result.authorized) {
        this.setData({
          status: 'success',
          title: '身份核验通过',
          desc: result.message || '你们的空间已经核验完成，马上为你打开首页。',
        });

        this.navigateTimer = setTimeout(() => {
          wx.switchTab({
            url: '/pages/home/index',
          });
        }, SUCCESS_STAY_MS);
        return;
      }

      this.setData({
        status: 'denied',
        title: '暂时无法进入',
        desc: result.message || '这个空间暂未对当前微信账号开放。',
      });
    } catch (error) {
      const remaining = Math.max(0, MIN_AUTH_LOADING_MS - (Date.now() - startedAt));
      if (remaining) {
        await wait(remaining);
      }
      this.finishLoadingSequence();
      this.setData({
        status: 'error',
        title: '连接失败',
        desc: error.message || '请检查云开发环境、云函数部署状态，以及数据库集合是否已创建。',
      });
    }
  },

  retryAuth() {
    this.runAuthCheck(true);
  },
});