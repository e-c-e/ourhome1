Page({
  data: {
    status: 'loading',
    title: '正在连接你们的空间',
    desc: '首次进入时会自动完成白名单校验。',
  },

  onShow() {
    this.runAuthCheck();
  },

  async runAuthCheck(force = false) {
    const app = getApp();

    this.setData({
      status: 'loading',
      title: '正在连接你们的空间',
      desc: '首次进入时会自动完成白名单校验。',
    });

    try {
      const result = force ? await app.refreshAuth() : await app.ensureAuthorized();

      if (result.authorized) {
        this.setData({
          status: 'success',
          title: '欢迎回来',
          desc: result.message || '空间验证通过，马上进入首页。',
        });

        wx.switchTab({
          url: '/pages/home/index',
        });
        return;
      }

      this.setData({
        status: 'denied',
        title: '暂时无法进入',
        desc: result.message || '这个空间暂未对当前微信账号开放。',
      });
    } catch (error) {
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