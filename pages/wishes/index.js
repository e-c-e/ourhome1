import { addWish, fetchMemorialData, removeWish, toggleWish } from '../../api/relationship';
import { formatDate } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

Page({
  data: {
    wishText: '',
    wishes: [],
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
      const { wishes = [] } = await fetchMemorialData();
      this.setData({
        wishes: wishes.map((item) => ({
          ...item,
          id: item._id,
          completedLabel: item.isCompleted ? `完成于 ${item.completedTime}` : '点击左侧圆点可标记完成',
        })),
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '心愿单加载失败，请稍后重试。',
      });
    }
  },

  handleWishInput(e) {
    this.setData({
      wishText: e.detail.value,
    });
  },

  async addWish() {
    const content = this.data.wishText.trim();
    if (!content) {
      wx.showToast({
        title: '先写一个心愿',
        icon: 'none',
      });
      return;
    }

    await addWish(content);
    this.setData({ wishText: '' });
    await this.loadPageData();
  },

  async toggleWish(e) {
    const { id } = e.currentTarget.dataset;
    await toggleWish(id, formatDate(new Date()));
    await this.loadPageData();
  },

  async removeWish(e) {
    const { id } = e.currentTarget.dataset;
    await removeWish(id);
    await this.loadPageData();
  },
});