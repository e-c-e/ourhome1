import { fetchSpaceData } from '../../api/relationship';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

Page({
  data: {
    profile: {
      spaceName: '我们的空间',
      partnerA: '我',
      partnerB: '你',
    },
    stats: {
      momentCount: 0,
      anniversaryCount: 0,
      wishCount: 0,
    },
    loading: true,
    errorMessage: '',
  },

  async onShow() {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;
    await this.loadPageData();
  },

  async loadPageData() {
    this.setData({ loading: true, errorMessage: '' });

    try {
      const { profile, stats } = await fetchSpaceData();
      this.setData({
        profile,
        stats,
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '宠物岛加载失败，请稍后重试。',
      });
    }
  },

  goSpaceSettings() {
    wx.navigateTo({
      url: '/pages/my/index',
    });
  },
});