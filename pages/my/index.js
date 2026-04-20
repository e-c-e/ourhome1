import { clearCloudData, fetchSpaceData, saveSpaceProfile } from '../../api/relationship';
import { ensureAuthorizedPage } from '../../utils/pageAuth';
import { STORAGE_KEYS } from '../../utils/couple';

Page({
  data: {
    profile: {
      spaceName: '我们的空间',
      partnerA: '我',
      partnerB: '你',
      intro: '把普通日子慢慢写成回忆。',
    },
    stats: {
      momentCount: 0,
      anniversaryCount: 0,
      wishCount: 0,
      completedWishCount: 0,
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
        errorMessage: error.message || '空间数据加载失败，请稍后重试。',
      });
    }
  },

  handleInput(e) {
    const field = e.currentTarget.dataset.field || e.detail.field;
    const { value } = e.detail;
    this.setData({
      [`profile.${field}`]: value,
    });
  },

  async saveProfile() {
    await saveSpaceProfile(this.data.profile);
    wx.showToast({
      title: '空间信息已保存',
      icon: 'success',
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({
          url: '/pages/home/index',
        });
      },
    });
  },

  clearAllData() {
    wx.showModal({
      title: '确认清空',
      content: '会清空回忆、纪念日、心愿和空间信息。',
      success: async ({ confirm }) => {
        if (!confirm) return;

        await clearCloudData();
        wx.removeStorageSync(STORAGE_KEYS.DRAFT);
        wx.removeStorageSync(STORAGE_KEYS.NOTICE);

        await this.loadPageData();
        wx.showToast({
          title: '已清空',
          icon: 'success',
        });
      },
    });
  },
});
