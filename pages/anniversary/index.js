import { addAnniversary, fetchMemorialData, removeAnniversary, updateRelationshipStartDate } from '../../api/relationship';
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
      const { space = {}, anniversaries = [] } = await fetchMemorialData();
      const startDate = space.startDate || '';

      this.setData({
        today,
        startDate,
        startDateLabel: startDate ? `从 ${startDate} 开始` : '还没有设置相识日期',
        startDatePickerValue: startDate || today,
        startDateActionLabel: startDate ? '修改在一起日期' : '设置在一起日期',
        relationshipDays: startDate ? getDaysBetween(startDate, today) : 0,
        anniversaryDate: today,
        anniversaries: anniversaries
          .map((item) => {
            const diff = getDateDistance(item.date, today);
            return {
              ...item,
              id: item._id,
              diffLabel: diff >= 0 ? `还有 ${diff + 1} 天` : `已经过去 ${Math.abs(diff) - 1} 天`,
            };
          })
          .sort((left, right) => left.date.localeCompare(right.date)),
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '纪念日加载失败，请稍后重试。',
      });
    }
  },

  async handleStartDateChange(e) {
    const { value } = e.detail;

    try {
      const result = await updateRelationshipStartDate(value);
      const savedStartDate = result.startDate || value;
      const today = formatDate(new Date());

      this.setData({
        startDate: savedStartDate,
        startDateLabel: `从 ${savedStartDate} 开始`,
        startDatePickerValue: savedStartDate,
        startDateActionLabel: '修改在一起日期',
        relationshipDays: getDaysBetween(savedStartDate, today),
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
    this.setData({
      anniversaryName: e.detail.value,
    });
  },

  handleAnniversaryDateChange(e) {
    this.setData({
      anniversaryDate: e.detail.value,
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
    this.setData({ anniversaryName: '' });
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
});