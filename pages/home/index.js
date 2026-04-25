import { fetchHomeData, markNotificationsRead, saveMomentNotificationSubscription, updateRelationshipStartDate } from '../../api/relationship';
import { getMomentNotificationConfig } from '../../config/notification';
import { STORAGE_KEYS, consumeDirtyFlag, formatDate, getDaysBetween } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

function shouldLoadHomePage(page) {
  return page.data.loading || !page.data.moments.length || consumeDirtyFlag(STORAGE_KEYS.HOME_DIRTY);
}

function getMomentNotificationText(notification = {}) {
  if (notification.enabled) return '微信提醒已开启';
  if (!notification.templateId) return '尚未配置订阅模板';
  if (notification.status === 'reject') return '你还没有开启微信提醒';
  return '开启微信提醒后，对方发记录时会收到微信通知';
}

function isUnknownCloudActionError(error) {
  const message = `${(error && error.message) || ''} ${(error && error.errMsg) || ''}`;
  return message.includes('UNKNOWN_ACTION:saveMomentNotificationSubscription');
}

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
    notifications: [],
    unreadNotificationCount: 0,
    momentNotification: {
      enabled: false,
      templateId: '',
      status: 'unknown',
    },
    momentNotificationText: getMomentNotificationText(),
    memoryFocusIndex: 0,
    petIslandHint: '宠物岛功能暂未开启，先把今天的回忆好好存起来。',
    notificationSaving: false,
    loading: true,
    errorMessage: '',
  },

  async onShow() {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;

    if (shouldLoadHomePage(this)) {
      await this.loadHomeData({ silent: !this.data.loading });
    }
    this.showPendingNotice();
  },

  async loadHomeData(options = {}) {
    const { silent = false } = options;
    if (silent) {
      this.setData({ errorMessage: '' });
    } else {
      this.setData({ loading: true, errorMessage: '' });
    }

    try {
      const { moments = [], notifications = [], unreadNotificationCount = 0, momentNotification = {}, space = {} } = await fetchHomeData();
      const startDate = space.startDate || '';
      const today = formatDate(new Date());
      const sortedMoments = [...moments].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));

      const recentMoments = sortedMoments.slice(0, 3).map((item) => ({
        id: item._id,
        cover: item.cover || '',
        coverImage: item.cover || (item.images && item.images.length ? item.images[0] : ''),
        title: item.title || '今天的记录',
        content: item.content || '写下了一段新的回忆。',
        summary: (item.content || '写下了一段新的回忆。').slice(0, 42),
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
        notifications,
        unreadNotificationCount,
        momentNotification,
        momentNotificationText: getMomentNotificationText(momentNotification),
        memoryFocusIndex: 0,
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

  handleMemorySwiperChange(e) {
    this.setData({
      memoryFocusIndex: e.detail.current || 0,
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

  async enableMomentNotification() {
    if (this.data.notificationSaving) return;
    const notificationConfig = getMomentNotificationConfig();
    if (!notificationConfig.templateId) {
      wx.showToast({
        title: '请先配置订阅模板 ID',
        icon: 'none',
      });
      return;
    }

    this.setData({ notificationSaving: true });
    try {
      const subscribeResult = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: [notificationConfig.templateId],
          success: resolve,
          fail: reject,
        });
      });
      const status = subscribeResult[notificationConfig.templateId] || 'unknown';
      if (status !== 'accept') {
        this.setData({
          momentNotification: {
            ...this.data.momentNotification,
            status,
          },
          momentNotificationText: '你这次没有开启微信提醒',
        });
        wx.showToast({
          title: '已取消开启提醒',
          icon: 'none',
        });
        return;
      }

      const result = await saveMomentNotificationSubscription(status);
      const momentNotification = result.momentNotification || this.data.momentNotification;
      this.setData({
        momentNotification,
        momentNotificationText: getMomentNotificationText(momentNotification),
      });
      wx.showToast({
        title: status === 'accept' ? '微信提醒已开启' : '暂未开启微信提醒',
        icon: 'none',
      });
    } catch (error) {
      if (isUnknownCloudActionError(error)) {
        wx.showToast({
          title: '请先重新部署 relationship 云函数',
          icon: 'none',
        });
        return;
      }
      wx.showToast({
        title: error.message || '订阅请求失败',
        icon: 'none',
      });
    } finally {
      this.setData({ notificationSaving: false });
    }
  },

  async handleNotificationTap(e) {
    const { id, momentId, isRead } = e.currentTarget.dataset;
    if (!momentId) return;

    if (!isRead && id) {
      const result = await markNotificationsRead([id]);
      this.setData({
        notifications: result.notifications || this.data.notifications,
        unreadNotificationCount: result.unreadNotificationCount || 0,
      });
    }

    wx.navigateTo({
      url: `/pages/moment/detail?id=${momentId}`,
    });
  },

  async markAllNotificationsRead() {
    const unreadIds = this.data.notifications.filter((item) => !item.isRead).map((item) => item.id);
    if (!unreadIds.length) return;

    try {
      const result = await markNotificationsRead(unreadIds);
      this.setData({
        notifications: result.notifications || [],
        unreadNotificationCount: result.unreadNotificationCount || 0,
      });
      wx.showToast({
        title: '提醒已标记为已读',
        icon: 'none',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '操作失败，请稍后重试',
        icon: 'none',
      });
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
