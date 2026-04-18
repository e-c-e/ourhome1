import {
  addAnniversary,
  addWish,
  fetchMemorialData,
  removeAnniversary,
  removeWish,
  toggleWish,
  updateRelationshipStartDate,
} from '../../api/relationship';
import { formatDate, getDateDistance, getDaysBetween } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

Page({
  data: {
    today: formatDate(new Date()),
    startDate: '',
    startDateLabel: '还没有设置相识日期',
    startDatePickerValue: formatDate(new Date()),
    startDateActionLabel: '设置在一起日期',
    relationshipDays: 0,
    anniversaryName: '',
    anniversaryDate: formatDate(new Date()),
    anniversaries: [],
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
      const today = formatDate(new Date());
      const { space = {}, anniversaries = [], wishes = [] } = await fetchMemorialData();
      const startDate = space.startDate || '';
      const relationshipDays = startDate ? getDaysBetween(startDate, today) : 0;
      const nextAnniversaries = anniversaries
        .map((item) => {
          const diff = getDateDistance(item.date, today);
          return {
            ...item,
            id: item._id,
            diffLabel: diff >= 0 ? `还有 ${diff + 1} 天` : `已经过去 ${Math.abs(diff) - 1} 天`,
            isUpcoming: diff >= 0,
          };
        })
        .sort((left, right) => left.date.localeCompare(right.date));

      this.setData({
        today,
        startDate,
        startDateLabel: startDate ? `从 ${startDate} 开始` : '还没有设置相识日期',
        startDatePickerValue: startDate || today,
        startDateActionLabel: startDate ? '修改在一起日期' : '设置在一起日期',
        relationshipDays,
        anniversaryDate: today,
        anniversaries: nextAnniversaries,
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
        errorMessage: error.message || '纪念日和心愿加载失败，请稍后重试。',
      });
    }
  },

  async handleStartDateChange(e) {
    const { value } = e.detail;
    try {
      const result = await updateRelationshipStartDate(value);
      const savedStartDate = result.startDate || value;
      const today = formatDate(new Date());
      const relationshipDays = getDaysBetween(savedStartDate, today);

      this.setData({
        startDate: savedStartDate,
        startDateLabel: `从 ${savedStartDate} 开始`,
        startDatePickerValue: savedStartDate,
        startDateActionLabel: '修改在一起日期',
        relationshipDays,
      });

      wx.showToast({
        title: '在一起日期已更新',
        icon: 'success',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
      await this.loadPageData();
    }
  },

  handleAnniversaryNameInput(e) {
    const { value } = e.detail;
    this.setData({
      anniversaryName: value,
    });
  },

  handleAnniversaryDateChange(e) {
    const { value } = e.detail;
    this.setData({
      anniversaryDate: value,
    });
  },

  async addAnniversary() {
    const name = this.data.anniversaryName.trim();
    if (!name) {
      wx.showToast({
        title: '先写纪念日名称',
        icon: 'none',
      });
      return;
    }

    await addAnniversary(name, this.data.anniversaryDate);
    this.setData({
      anniversaryName: '',
    });
    await this.loadPageData();
    wx.showToast({
      title: '纪念日已添加',
      icon: 'success',
    });
  },

  async removeAnniversary(e) {
    const { id } = e.currentTarget.dataset;
    await removeAnniversary(id);
    await this.loadPageData();
  },

  handleWishInput(e) {
    const { value } = e.detail;
    this.setData({
      wishText: value,
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
    this.setData({
      wishText: '',
    });
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
