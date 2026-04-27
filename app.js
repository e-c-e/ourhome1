import { loginToSpace, trackMiniProgramVisit } from './api/relationship';
import { initCloud } from './utils/cloud';

App({
  onLaunch() {
    this.bootstrapPromise = this.bootstrap();

    const updateManager = wx.getUpdateManager();

    updateManager.onCheckForUpdate((res) => {
      // console.log(res.hasUpdate)
    });

    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success(res) {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        },
      });
    });
  },

  onShow(options = {}) {
    this.trackAppVisit(options).catch(() => {});
  },

  globalData: {
    userInfo: null,
    isAuthorized: false,
    authStatus: 'loading',
    authMessage: '',
    cloudReady: false,
  },

  async bootstrap(force = false) {
    if (this.bootstrapPromise && !force) {
      return this.bootstrapPromise;
    }

    this.globalData.authStatus = 'loading';

    this.bootstrapPromise = (async () => {
      try {
        await initCloud();
        this.globalData.cloudReady = true;

        const authResult = await loginToSpace();
        this.globalData.userInfo = authResult.user || null;
        this.globalData.isAuthorized = !!authResult.authorized;
        this.globalData.authStatus = authResult.authorized ? 'ready' : 'denied';
        this.globalData.authMessage = authResult.message || '';
        return authResult;
      } catch (error) {
        this.globalData.isAuthorized = false;
        this.globalData.authStatus = 'error';
        this.globalData.authMessage = error.message || '云开发初始化失败';
        throw error;
      }
    })();

    return this.bootstrapPromise;
  },

  ensureAuthorized() {
    return this.bootstrap();
  },

  refreshAuth() {
    this.bootstrapPromise = null;
    return this.bootstrap(true);
  },

  async trackAppVisit(options = {}) {
    try {
      const authResult = await this.bootstrap();
      if (!authResult || !authResult.authorized) return;
      await trackMiniProgramVisit(options.path || 'pages/home/index');
    } catch (error) {
      // ignore tracking failures to avoid blocking app startup
    }
  },
});
