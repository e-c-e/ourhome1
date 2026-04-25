import { fetchDiaryData, fetchHomeData, toggleMomentLike } from '../../api/relationship';
import { STORAGE_KEYS, consumeDirtyFlag, formatDate } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function shouldLoadWallPage(page) {
  return page.data.loading || !page.data.moments.length || consumeDirtyFlag(STORAGE_KEYS.WALL_DIRTY);
}

function formatMonthValue(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthDate(monthText) {
  const [yearText, monthTextValue] = monthText.split('-');
  return new Date(Number(yearText), Number(monthTextValue) - 1, 1);
}

function shiftMonth(monthText, delta) {
  const base = getMonthDate(monthText);
  base.setMonth(base.getMonth() + delta);
  return formatMonthValue(base);
}

function buildCalendarWeeks(monthText, momentsByDate, selectedDate) {
  const base = getMonthDate(monthText);
  const today = formatDate(new Date());
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const calendarDays = [];

  for (let index = 0; index < firstDay; index += 1) {
    calendarDays.push({
      id: `blank-start-${index}`,
      isBlank: true,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${monthText}-${`${day}`.padStart(2, '0')}`;
    const dayMoments = momentsByDate[date] || [];
    calendarDays.push({
      id: date,
      date,
      day,
      isToday: date === today,
      isSelected: date === selectedDate,
      recordCount: dayMoments.length,
    });
  }

  while (calendarDays.length % 7 !== 0) {
    calendarDays.push({
      id: `blank-end-${calendarDays.length}`,
      isBlank: true,
    });
  }

  const weeks = [];
  for (let index = 0; index < calendarDays.length; index += 7) {
    weeks.push(calendarDays.slice(index, index + 7));
  }
  return weeks;
}

function mapWallMoment(item) {
  return {
    id: item._id,
    title: item.title || '今天的记录',
    content: item.content || '写下了一段新的回忆。',
    mood: item.mood || '日常',
    date: item.date || '',
    cover: item.cover || '',
    previewImages: (item.images || []).slice(0, 3),
    images: item.images || [],
    imageCount: item.imageCount || (item.images || []).length,
    likeCount: item.likeCount || 0,
    commentCount: item.commentCount || 0,
    likedByMe: !!item.likedByMe,
    locationText: item.location && item.location.name ? item.location.name : '',
    activeImageIndex: 0,
  };
}

function mapDayMoment(item) {
  return {
    ...item,
    activeImageIndex: Number(item.activeImageIndex) || 0,
  };
}

Page({
  data: {
    weekLabels: WEEK_LABELS,
    month: formatMonthValue(new Date()),
    summary: {
      recordCount: 0,
      activeDays: 0,
      photoCount: 0,
    },
    calendarWeeks: [],
    selectedDate: formatDate(new Date()),
    dayMoments: [],
    moments: [],
    loading: true,
    errorMessage: '',
    likingId: '',
    reactionMomentId: '',
    reactionEmoji: '💗',
  },

  async onShow() {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;
    if (shouldLoadWallPage(this)) {
      await this.loadPageData({ silent: !this.data.loading });
    }
  },

  async loadPageData(options = {}) {
    const { silent = false } = options;
    if (silent) {
      this.setData({ errorMessage: '' });
    } else {
      this.setData({ loading: true, errorMessage: '' });
    }

    try {
      const currentMonth = this.data.month || formatMonthValue(new Date());
      const [homeResult, diaryResult] = await Promise.all([
        fetchHomeData(),
        fetchDiaryData(currentMonth),
      ]);
      const { moments = [] } = homeResult;
      const sortedMoments = [...moments].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
      const { moments: diaryMoments = [], summary = {}, month: resolvedMonth } = diaryResult;
      const momentsByDate = diaryMoments.reduce((result, item) => {
        const list = result[item.date] || [];
        list.push(item);
        result[item.date] = list;
        return result;
      }, {});
      const fallbackDate = (this.data.selectedDate && this.data.selectedDate.startsWith(resolvedMonth))
        ? this.data.selectedDate
        : (Object.keys(momentsByDate)[0] || `${resolvedMonth}-01`);

      this.setData({
        month: resolvedMonth,
        summary,
        selectedDate: fallbackDate,
        calendarWeeks: buildCalendarWeeks(resolvedMonth, momentsByDate, fallbackDate),
        dayMoments: (momentsByDate[fallbackDate] || []).map(mapDayMoment),
        moments: sortedMoments.map(mapWallMoment),
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
    const selectedDate = this.data.selectedDate || formatDate(new Date());
    wx.navigateTo({
      url: `/pages/release/index?date=${selectedDate}`,
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

  async loadDiaryPanel(month = this.data.month, preferredDate = '') {
    try {
      const { moments = [], summary = {}, month: resolvedMonth } = await fetchDiaryData(month);
      const momentsByDate = moments.reduce((result, item) => {
        const list = result[item.date] || [];
        list.push(item);
        result[item.date] = list;
        return result;
      }, {});
      const fallbackDate = preferredDate && preferredDate.startsWith(resolvedMonth)
        ? preferredDate
        : (Object.keys(momentsByDate)[0] || `${resolvedMonth}-01`);

      this.setData({
        month: resolvedMonth,
        summary,
        selectedDate: fallbackDate,
        calendarWeeks: buildCalendarWeeks(resolvedMonth, momentsByDate, fallbackDate),
        dayMoments: (momentsByDate[fallbackDate] || []).map(mapDayMoment),
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '日历加载失败，请稍后重试',
        icon: 'none',
      });
    }
  },

  prevMonth() {
    const nextMonth = shiftMonth(this.data.month, -1);
    this.loadDiaryPanel(nextMonth, `${nextMonth}-01`);
  },

  nextMonth() {
    const nextMonth = shiftMonth(this.data.month, 1);
    this.loadDiaryPanel(nextMonth, `${nextMonth}-01`);
  },

  selectDate(e) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;

    const calendarWeeks = this.data.calendarWeeks.map((week) => week.map((item) => ({
      ...item,
      isSelected: item.date === date,
    })));
    this.setData({
      selectedDate: date,
      calendarWeeks,
    });
    this.loadDiaryPanel(this.data.month, date);
  },

  async toggleLike(e) {
    const { id } = e.currentTarget.dataset;
    if (!id || this.data.likingId === id) return;

    this.setData({ likingId: id });
    try {
      const result = await toggleMomentLike(id);
      const reactionEmoji = result.liked ? '🥰' : '🫧';
      this.setData({
        reactionMomentId: id,
        reactionEmoji,
        moments: this.data.moments.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            likedByMe: result.liked,
            likeCount: result.likeCount,
          };
        }),
      });
      if (this.reactionTimer) {
        clearTimeout(this.reactionTimer);
      }
      this.reactionTimer = setTimeout(() => {
        this.setData({
          reactionMomentId: '',
        });
      }, 760);
    } catch (error) {
      wx.showToast({
        title: error.message || '点赞失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ likingId: '' });
    }
  },

  handleDaySwiperChange(e) {
    const { id } = e.currentTarget.dataset;
    const activeImageIndex = Number(e.detail.current) || 0;
    if (!id) return;

    this.setData({
      dayMoments: this.data.dayMoments.map((item) => (
        `${item._id}` === `${id}`
          ? {
            ...item,
            activeImageIndex,
          }
          : item
      )),
    });
  },

  handleWallSwiperChange(e) {
    const { id } = e.currentTarget.dataset;
    const activeImageIndex = Number(e.detail.current) || 0;
    if (!id) return;

    this.setData({
      moments: this.data.moments.map((item) => (
        item.id === id
          ? {
            ...item,
            activeImageIndex,
          }
          : item
      )),
    });
  },

  onUnload() {
    if (this.reactionTimer) {
      clearTimeout(this.reactionTimer);
      this.reactionTimer = null;
    }
  },
});