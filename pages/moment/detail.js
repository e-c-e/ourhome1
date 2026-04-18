import { deleteMoment, fetchMomentDetail } from '../../api/relationship';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

Page({
  data: {
    id: '',
    moment: null,
    loading: true,
    errorMessage: '',
    deleting: false,
  },

  async onLoad(options) {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;

    const id = options.id || '';
    this.setData({ id });
    if (!id) {
      this.setData({
        loading: false,
        errorMessage: '没有找到这条回忆。',
      });
      return;
    }

    await this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const { moment } = await fetchMomentDetail(this.data.id);
      this.setData({
        moment: {
          ...moment,
          images: moment.images || [],
          content: moment.content || '这一天没有留下文字，但留下了想念。',
          title: moment.title || '今天的记录',
          mood: moment.mood || '日常',
          date: moment.date || '',
        },
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '回忆加载失败，请稍后再试。',
      });
    }
  },

  previewImage(e) {
    const { current } = e.currentTarget.dataset;
    const images = (this.data.moment && this.data.moment.images) || [];
    if (!images.length) return;
    wx.previewImage({
      current,
      urls: images,
    });
  },

  async deleteMoment() {
    if (!this.data.moment || !this.data.moment.canDelete || this.data.deleting) return;

    wx.showModal({
      title: '删除回忆',
      content: '删除后图片和文字都不会保留，确认删除吗？',
      success: async ({ confirm }) => {
        if (!confirm) return;

        this.setData({ deleting: true });
        try {
          await deleteMoment(this.data.id);
          wx.setStorageSync('couple_notice', '回忆已删除');
          wx.switchTab({
            url: '/pages/home/index',
          });
        } finally {
          this.setData({ deleting: false });
        }
      },
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({ url: '/pages/home/index' });
      },
    });
  },
});