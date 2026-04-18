import { fetchHomeData } from '../../api/relationship';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

const DEFAULT_COVER = '/static/home/card0.png';

Page({
  data: {
    moments: [],
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
      const { moments = [] } = await fetchHomeData();
      const sortedMoments = [...moments].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));

      this.setData({
        moments: sortedMoments.map((item) => ({
          id: item._id,
          title: item.title || '今天的记录',
          content: item.content || '写下了一段新的回忆。',
          mood: item.mood || '日常',
          date: item.date || '',
          cover: item.cover || DEFAULT_COVER,
          previewImages: (item.images || []).slice(0, 3),
          images: item.images || [],
        })),
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '时光墙加载失败，请稍后重试。',
      });
    }
  },

  goRelease() {
    wx.navigateTo({
      url: '/pages/release/index',
    });
  },

  goMomentDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/moment/detail?id=${id}`,
    });
  },

  previewMomentImages(e) {
    const { images, current } = e.currentTarget.dataset;
    if (!images || !images.length) return;

    wx.previewImage({
      current: current || images[0],
      urls: images,
    });
  },
});