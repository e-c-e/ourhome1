import { fetchHomeData, markNotificationsRead, saveDailyTipsText, saveMomentNotificationSubscription, updateRelationshipStartDate } from '../../api/relationship';
import { getMomentNotificationConfig } from '../../config/notification';
import { STORAGE_KEYS, consumeDirtyFlag, formatDate, getDaysBetween } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

function shouldLoadHomePage(page) {
  return page.data.loading || !page.data.homeReady || consumeDirtyFlag(STORAGE_KEYS.HOME_DIRTY);
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
    homeReady: false,
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
    homeSnapshot: {
      partnerVisit: {
        title: '今天还没有等到对方来过',
        desc: '等对方打开首页后，这里会显示今天来过的时间。',
      },
      dailyTip: '今天记得多喝水，也记得多说一句想你。',
      anniversary: {
        title: '还没有设置纪念日',
        desc: '去纪念日页设一个重要的日子吧。',
      },
      latestActivity: {
        title: '今天还没有新的互动',
        desc: '可以先写一条记录，或者去时光墙看看对方。',
        items: [],
      },
    },
    notifications: [],
    unreadNotificationCount: 0,
    momentNotification: {
      enabled: false,
      templateId: '',
      status: 'unknown',
    },
    momentNotificationText: getMomentNotificationText(),
    petIslandHint: '宠物岛功能暂未开启，先把今天的回忆好好存起来。',
    dailyTipsText: '',
    dailyTipDraft: '',
    tipEditorVisible: false,
    tipSaving: false,
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
      const { moments = [], homeSnapshot = {}, notifications = [], unreadNotificationCount = 0, momentNotification = {}, space = {} } = await fetchHomeData();
      const startDate = space.startDate || '';
      const today = formatDate(new Date());
      const sortedMoments = [...moments].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));

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
        homeSnapshot: {
          ...this.data.homeSnapshot,
          ...homeSnapshot,
        },
        notifications,
        unreadNotificationCount,
        momentNotification,
        momentNotificationText: getMomentNotificationText(momentNotification),
        petIslandHint,
        dailyTipsText: space.dailyTipsText || '',
        dailyTipDraft: space.dailyTipsText || '',
        homeReady: true,
        loading: false,
      });
    } catch (error) {
      this.setData({
        homeReady: true,
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

  goMy() {
    wx.switchTab({
      url: '/pages/my/index',
    });
  },

  goActivityFeed() {
    wx.navigateTo({
      url: '/pages/activity/index',
    });
  },

  goTipsPage() {
    wx.navigateTo({
      url: '/pages/tips/index',
    });
  },

  openTipEditor() {
    this.setData({
      tipEditorVisible: true,
      dailyTipDraft: this.data.dailyTipsText || '',
    });
  },

  cancelTipEditor() {
    this.setData({
      tipEditorVisible: false,
      dailyTipDraft: this.data.dailyTipsText || '',
    });
  },

  handleTipDraftInput(e) {
    this.setData({
      dailyTipDraft: e.detail.value || '',
    });
  },

  async saveHomeTips() {
    if (this.data.tipSaving) return;
    this.setData({ tipSaving: true });
    try {
      const result = await saveDailyTipsText(this.data.dailyTipDraft);
      this.setData({
        tipSaving: false,
        tipEditorVisible: false,
        dailyTipsText: result.dailyTipsText || '',
        dailyTipDraft: result.dailyTipsText || '',
        homeSnapshot: {
          ...this.data.homeSnapshot,
          dailyTip: result.dailyTip || this.data.homeSnapshot.dailyTip,
        },
      });
      wx.showToast({
        title: '首页提示已保存',
        icon: 'success',
      });
    } catch (error) {
      this.setData({ tipSaving: false });
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
    }
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
