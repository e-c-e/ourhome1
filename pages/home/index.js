import { fetchHomeData, updateRelationshipStartDate } from '../../api/relationship';
import { STORAGE_KEYS, formatDate, getDaysBetween } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

Page({
  data: {
    today: formatDate(new Date()),
    relationshipStartDate: '',
    relationshipDateLabel: '还没有设置在一起日期',
    pickerDateValue: formatDate(new Date()),
    relationshipActionLabel: '设置在一起日期',
    relationshipDays: 0,
    momentCount: 0,
    latestMood: '未记录',
    latestText: '还没有新的回忆',
    latestDate: '',
    moments: [],
    recentMoments: [],
    petIslandHint: '宠物岛功能暂未开启，先把今天的回忆好好存起来。',
    loading: true,
    errorMessage: '',
  },

  async onShow() {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;

    await this.loadHomeData();
    this.showPendingNotice();
  },

  async loadHomeData() {
    this.setData({ loading: true, errorMessage: '' });

    try {
      const { moments = [], space = {} } = await fetchHomeData();
      const startDate = space.startDate || '';
      const today = formatDate(new Date());
      const sortedMoments = [...moments].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));

      const recentMoments = sortedMoments.slice(0, 3).map((item) => ({
        id: item._id,
        cover: item.cover || '',
        title: item.title || '今天的记录',
        content: item.content || '写下了一段新的回忆。',
        images: item.images || [],
        date: item.date || this.data.today,
        mood: item.mood || '日常',
        previewImages: (item.images || []).slice(0, 3),
        locationText: item.location && item.location.name ? item.location.name : '',
      }));

      const latestMoment = sortedMoments[0];
      const petIslandHint = sortedMoments.length
        ? '你们今天已经留下新的回忆啦，宠物岛的亲密度也在偷偷变好。'
        : '先记录第一条回忆，之后再慢慢扩展更多互动。';

      this.setData({
        relationshipStartDate: startDate,
        relationshipDateLabel: startDate ? `在一起：${startDate}` : '还没有设置在一起日期',
        pickerDateValue: startDate || today,
        relationshipActionLabel: startDate ? '修改日期' : '设置日期',
        relationshipDays: startDate ? getDaysBetween(startDate, today) : 0,
        momentCount: sortedMoments.length,
        latestMood: latestMoment ? latestMoment.mood || '日常' : '未记录',
        latestText: latestMoment ? latestMoment.content.slice(0, 24) : '还没有新的回忆',
        latestDate: latestMoment ? latestMoment.date : '',
        moments: sortedMoments,
        recentMoments,
        petIslandHint,
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '回忆加载失败，请稍后再试。',
      });
    }
  },

  showPendingNotice() {
    const notice = wx.getStorageSync(STORAGE_KEYS.NOTICE);
    if (!notice) return;

    wx.removeStorageSync(STORAGE_KEYS.NOTICE);
    wx.showToast({
      title: notice,
      icon: 'success',
    });
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

  async handleStartDateChange(e) {
    const startDate = e.detail.value;

    try {
      const result = await updateRelationshipStartDate(startDate);
      const savedStartDate = result.startDate || startDate;
      const today = formatDate(new Date());

      this.setData({
        relationshipStartDate: savedStartDate,
        relationshipDateLabel: `在一起：${savedStartDate}`,
        pickerDateValue: savedStartDate,
        relationshipActionLabel: '修改日期',
        relationshipDays: getDaysBetween(savedStartDate, today),
      });

      wx.showToast({
        title: '在一起日期已保存',
        icon: 'success',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
      await this.loadHomeData();
    }
  },

  previewMoment(e) {
    const { images } = e.currentTarget.dataset;
    if (!images || !images.length) return;

    wx.previewImage({
      current: images[0],
      urls: images,
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
