import { addWish, fetchMemorialData, removeWish, toggleWish } from '../../api/relationship';
import { formatDate } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

const FLOWER_EMOJIS = ['🌸', '🌷', '🌼', '🌺', '🌻', '💮'];
const GARDEN_LANE_PATTERN = [2, 1, 3, 1, 3, 2, 2, 1, 3];
const GARDEN_HEIGHT_PATTERN = [2, 1, 2, 1, 2, 1, 1, 2, 1];
const POT_STYLE_PATTERN = [1, 2, 3, 2, 1, 3, 1, 3, 2];

function decorateWishGroup(wishes, completedOffset = 0) {
  return wishes.map((item, index) => ({
    ...item,
    potStyle: POT_STYLE_PATTERN[(index + completedOffset) % POT_STYLE_PATTERN.length],
    gardenLane: GARDEN_LANE_PATTERN[index % GARDEN_LANE_PATTERN.length],
    gardenHeight: GARDEN_HEIGHT_PATTERN[(index + completedOffset) % GARDEN_HEIGHT_PATTERN.length],
    isExpanded: false,
    contentPreview: (item.content || '').slice(0, 6),
  }));
}

Page({
  data: {
    wishText: '',
    wishes: [],
    pendingWishList: [],
    summary: {
      total: 0,
      completed: 0,
      pending: 0,
      completionRate: 0,
    },
    heroTip: '把喜欢的未来一件件种进来，等着一起去实现。',
    progressText: '花园还在等待第一朵花盛开 🌱',
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
      const normalizedWishes = wishes.map((item, index) => ({
          ...item,
          id: item._id,
          order: index + 1,
          isCompleted: Boolean(item.isCompleted),
          flowerEmoji: FLOWER_EMOJIS[index % FLOWER_EMOJIS.length],
          isFirstBloom: false,
          isExpanded: false,
          contentPreview: (item.content || '').slice(0, 6),
        }));

      const pendingWishes = decorateWishGroup(
        normalizedWishes.filter((item) => !item.isCompleted),
      );
      const completedWishes = decorateWishGroup(
        normalizedWishes.filter((item) => item.isCompleted),
        2,
      );

      const displayWishes = pendingWishes.concat(completedWishes);

      // Mark the earliest completed wish as the first-ever bloom (easter egg)
      if (completedWishes.length > 0) {
        const firstBloom = completedWishes.reduce((a, b) =>
          (a.completedTime || '') <= (b.completedTime || '') ? a : b,
        );
        displayWishes.forEach((w) => {
          if (w.id === firstBloom.id) w.isFirstBloom = true;
        });
      }

      const completed = completedWishes.length;
      const total = displayWishes.length;
      const pending = total - completed;
      this.setData({
        wishes: displayWishes,
        pendingWishList: pendingWishes.map((item) => item.content),
        summary: {
          total,
          completed,
          pending,
          completionRate: total ? Math.round((completed / total) * 100) : 0,
        },
        heroTip: completed
          ? `已经一起实现 ${completed} 个小愿望啦，再去点亮下一个。`
          : '从第一个小小心愿开始，把普通日子变得更值得期待。',
        progressText: completed > 0
          ? `花园里有 ${completed} 朵盛开的小花啦 🌸`
          : '花园还在等待第一朵花盛开 🌱',
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
    this.setData({ wishText: e.detail.value });
  },

  toggleWishDetail(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({
      wishes: this.data.wishes.map((item) => ({
        ...item,
        isExpanded: item.id === id ? !item.isExpanded : false,
      })),
    });
  },

  async addWish() {
    const content = this.data.wishText.trim();
    if (!content) {
      wx.showToast({ title: '先写一个心愿', icon: 'none' });
      return;
    }

    try {
      await addWish(content);
      this.setData({ wishText: '' });
      await this.loadPageData();
      wx.showToast({ title: '心愿种下啦 🌱', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message || '新增失败', icon: 'none' });
    }
  },

  async toggleWish(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await toggleWish(id, formatDate(new Date()));
      await this.loadPageData();
    } catch (error) {
      wx.showToast({ title: error.message || '更新失败', icon: 'none' });
    }
  },

  async removeWish(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await removeWish(id);
      await this.loadPageData();
      wx.showToast({ title: '已经移出啦', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message || '移除失败', icon: 'none' });
    }
  },
});