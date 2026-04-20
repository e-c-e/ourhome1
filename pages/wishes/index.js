import { addWish, fetchMemorialData, removeWish, toggleWish } from '../../api/relationship';
import { formatDate } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

Page({
  data: {
    wishText: '',
    wishes: [],
    summary: {
      total: 0,
      completed: 0,
      pending: 0,
      completionRate: 0,
    },
    heroTip: '把喜欢的未来一件件存起来。',
    nextWish: '',
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
      const normalizedWishes = wishes
        .map((item, index) => ({
          ...item,
          id: item._id,
          order: index + 1,
          isCompleted: Boolean(item.isCompleted),
          completedLabel: item.isCompleted ? `完成于 ${item.completedTime}` : '点一下左侧圆点，就把它变成已经实现的小事。',
          cardTag: item.isCompleted ? '已实现' : '待实现',
        }))
        .sort((left, right) => Number(left.isCompleted) - Number(right.isCompleted));
      const completed = normalizedWishes.filter((item) => item.isCompleted).length;
      const total = normalizedWishes.length;
      const pending = total - completed;
      const nextWish = normalizedWishes.find((item) => !item.isCompleted);

      this.setData({
        wishes: normalizedWishes,
        summary: {
          total,
          completed,
          pending,
          completionRate: total ? Math.round((completed / total) * 100) : 0,
        },
        heroTip: completed
          ? `已经一起实现 ${completed} 个小愿望啦，再去点亮下一个。`
          : '从第一个小小心愿开始，把普通日子变得更值得期待。',
        nextWish: nextWish ? nextWish.content : '',
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

    try {
      await addWish(content);
      this.setData({ wishText: '' });
      await this.loadPageData();
      wx.showToast({
        title: '心愿收好啦',
        icon: 'success',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '新增失败',
        icon: 'none',
      });
    }
  },

  async toggleWish(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await toggleWish(id, formatDate(new Date()));
      await this.loadPageData();
    } catch (error) {
      wx.showToast({
        title: error.message || '更新失败',
        icon: 'none',
      });
    }
  },

  async removeWish(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await removeWish(id);
      await this.loadPageData();
      wx.showToast({
        title: '已经移出啦',
        icon: 'none',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '移除失败',
        icon: 'none',
      });
    }
  },
});