import { addAnniversary, fetchMemorialData, removeAnniversary, saveReminderSettings, updateRelationshipStartDate } from '../../api/relationship';
import {
  formatDate,
  getDateDistance,
  getDaysBetween,
  markDirtyFlags,
  STORAGE_KEYS,
} from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

const ONE_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_REMINDER_SETTINGS = {
  enabled: false,
  daysBefore: 3,
  inAppEnabled: true,
  serviceEnabled: false,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toDateValue(dateText) {
  return new Date(`${dateText}T00:00:00`).getTime();
}

function buildAnnualProgress(dateText, today) {
  const todayValue = toDateValue(today);
  const todayDate = new Date(`${today}T00:00:00`);
  const original = new Date(`${dateText}T00:00:00`);
  let next = new Date(todayDate.getFullYear(), original.getMonth(), original.getDate());
  if (next.getTime() < todayValue) {
    next = new Date(next.getFullYear() + 1, original.getMonth(), original.getDate());
  }
  if (next.getTime() < original.getTime()) {
    next = new Date(original.getTime());
  }
  let prev = new Date(next.getFullYear() - 1, original.getMonth(), original.getDate());

  const totalDays = Math.max(1, Math.round((next.getTime() - prev.getTime()) / ONE_DAY));
  const currentDays = clamp(Math.round((todayValue - prev.getTime()) / ONE_DAY), 0, totalDays);
  const daysLeft = Math.max(0, Math.round((next.getTime() - todayValue) / ONE_DAY));
  const rawPercent = Math.floor((currentDays / totalDays) * 1000) / 10;
  const progressPercent = daysLeft > 0 ? Math.min(rawPercent, 99.9) : 100;

  return {
    progressPercent,
    progressLabel: daysLeft === 0 ? '今天就是纪念日' : `距下一次还有 ${daysLeft} 天`,
    daysLeft,
  };
}

function buildMilestoneProgress(days) {
  if (!days) {
    return {
      prevMilestone: 0,
      nextMilestone: 100,
      walkedDays: 0,
      milestoneLabel: '先设定在一起日期，再慢慢走到第一个 100 天。',
    };
  }

  const nextMilestone = Math.ceil(days / 100) * 100;
  const prevMilestone = Math.max(0, nextMilestone - 100);
  const walkedDays = Math.max(0, days - prevMilestone);
  const remainDays = Math.max(0, nextMilestone - days);

  return {
    prevMilestone,
    nextMilestone,
    walkedDays,
    milestoneLabel: remainDays ? `再过 ${remainDays} 天，就会来到第 ${nextMilestone} 天。` : `已经来到第 ${nextMilestone} 天。`,
  };
}

function buildReminderTips(startDate, anniversaries, settings, today) {
  if (!settings.enabled) return [];
  const tips = [];

  if (startDate) {
    const progress = buildAnnualProgress(startDate, today);
    if (progress.daysLeft <= settings.daysBefore) {
      tips.push({
        id: 'start-date',
        title: '在一起纪念日',
        desc: progress.daysLeft === 0 ? '今天就是你们的纪念日。' : `还有 ${progress.daysLeft} 天就到在一起纪念日。`,
      });
    }
  }

  anniversaries.forEach((item) => {
    const progress = buildAnnualProgress(item.date, today);
    if (progress.daysLeft <= settings.daysBefore) {
      tips.push({
        id: item.id,
        title: item.name,
        desc: progress.daysLeft === 0 ? '今天就是这个纪念日。' : `还有 ${progress.daysLeft} 天就到 ${item.name}。`,
      });
    }
  });

  return tips;
}

function normalizeAnniversary(item, today) {
  const diff = getDateDistance(item.date, today);
  const annualProgress = buildAnnualProgress(item.date, today);
  return {
    ...item,
    id: item._id || item.id,
    diffLabel: diff >= 0 ? `还有 ${diff + 1} 天` : `已经过去 ${Math.abs(diff) - 1} 天`,
    anniversaryDaysText: `已经一起记住 ${getDaysBetween(item.date, today)} 天`,
    daysLeft: annualProgress.daysLeft,
    progressPercent: annualProgress.progressPercent,
    progressPercentText: `${annualProgress.progressPercent.toFixed(1)}%`,
    progressLabel: annualProgress.progressLabel,
  };
}

function sortAnniversaries(list) {
  return [...list].sort((left, right) => {
    if (left.daysLeft !== right.daysLeft) {
      return left.daysLeft - right.daysLeft;
    }
    return left.date.localeCompare(right.date);
  });
}

function buildAnniversaryState({ today, startDate, anniversaries, reminderSettings }, currentData = {}) {
  const relationshipDays = startDate ? getDaysBetween(startDate, today) : 0;
  const milestone = buildMilestoneProgress(relationshipDays);
  const anniversaryList = sortAnniversaries(anniversaries.map((item) => normalizeAnniversary(item, today)));

  return {
    rawAnniversaries: anniversaries.map((item) => ({
      ...item,
      id: item._id || item.id,
    })),
    today,
    startDate,
    startDateLabel: startDate ? `从 ${startDate} 开始` : '还没有设置相识日期',
    startDatePickerValue: startDate || today,
    startDateActionLabel: startDate ? '修改在一起日期' : '设置在一起日期',
    relationshipDays,
    anniversaryDate: currentData.anniversaryDate || today,
    anniversaries: anniversaryList,
    prevMilestone: milestone.prevMilestone,
    nextMilestone: milestone.nextMilestone,
    walkedDays: milestone.walkedDays,
    milestoneLabel: milestone.milestoneLabel,
    reminderSettings,
    reminderTips: buildReminderTips(startDate, anniversaryList, reminderSettings, today),
  };
}

Page({
  data: {
    today: formatDate(new Date()),
    startDate: '',
    rawAnniversaries: [],
    startDateLabel: '还没有设置相识日期',
    startDatePickerValue: formatDate(new Date()),
    startDateActionLabel: '设置在一起日期',
    relationshipDays: 0,
    anniversaryName: '',
    anniversaryDate: formatDate(new Date()),
    anniversaries: [],
    anniversaryEditorVisible: false,
    reminderPanelExpanded: false,
    milestonePercent: 0,
    nextMilestone: 100,
    prevMilestone: 0,
    walkedDays: 0,
    milestoneLabel: '',
    reminderSettings: DEFAULT_REMINDER_SETTINGS,
    reminderTips: [],
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
      const reminderSettings = {
        ...DEFAULT_REMINDER_SETTINGS,
        ...(space.reminderSettings || {}),
      };

      this.setData({
        ...buildAnniversaryState({
          today,
          startDate,
          anniversaries,
          reminderSettings,
        }, this.data),
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
        ...buildAnniversaryState({
          today,
          startDate: savedStartDate,
          anniversaries: this.data.rawAnniversaries,
          reminderSettings: this.data.reminderSettings,
        }, this.data),
      });
      markDirtyFlags(STORAGE_KEYS.HOME_DIRTY);

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

  toggleAnniversaryEditor() {
    this.setData({
      anniversaryEditorVisible: !this.data.anniversaryEditorVisible,
    });
  },

  toggleReminderPanel() {
    this.setData({
      reminderPanelExpanded: !this.data.reminderPanelExpanded,
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

    const result = await addAnniversary(name, this.data.anniversaryDate);
    const nextRawAnniversaries = [
      {
        id: result._id,
        name,
        date: this.data.anniversaryDate,
      },
      ...this.data.rawAnniversaries,
    ];
    this.setData({
      anniversaryName: '',
      anniversaryEditorVisible: false,
      ...buildAnniversaryState({
        today: this.data.today,
        startDate: this.data.startDate,
        anniversaries: nextRawAnniversaries,
        reminderSettings: this.data.reminderSettings,
      }, this.data),
    });
    markDirtyFlags(STORAGE_KEYS.HOME_DIRTY);
    wx.showToast({
      title: '纪念日已添加',
      icon: 'success',
    });
  },

  async removeAnniversary(e) {
    const { id } = e.currentTarget.dataset;
    await removeAnniversary(id);
    this.setData(buildAnniversaryState({
      today: this.data.today,
      startDate: this.data.startDate,
      anniversaries: this.data.rawAnniversaries.filter((item) => item.id !== id),
      reminderSettings: this.data.reminderSettings,
    }, this.data));
    markDirtyFlags(STORAGE_KEYS.HOME_DIRTY);
  },

  async toggleReminderEnabled() {
    const nextReminderSettings = {
      ...this.data.reminderSettings,
      enabled: !this.data.reminderSettings.enabled,
    };
    await saveReminderSettings(nextReminderSettings);
    this.setData(buildAnniversaryState({
      today: this.data.today,
      startDate: this.data.startDate,
      anniversaries: this.data.rawAnniversaries,
      reminderSettings: nextReminderSettings,
    }, this.data));
  },

  async cycleReminderWindow() {
    const current = Number(this.data.reminderSettings.daysBefore) || 3;
    const next = current === 1 ? 3 : current === 3 ? 7 : 1;
    const nextReminderSettings = {
      ...this.data.reminderSettings,
      daysBefore: next,
    };
    await saveReminderSettings(nextReminderSettings);
    this.setData(buildAnniversaryState({
      today: this.data.today,
      startDate: this.data.startDate,
      anniversaries: this.data.rawAnniversaries,
      reminderSettings: nextReminderSettings,
    }, this.data));
  },
});