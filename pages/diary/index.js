import { fetchDiaryData } from '../../api/relationship';
import { formatDate } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

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
      cover: dayMoments[0] && dayMoments[0].cover,
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
    loading: true,
    errorMessage: '',
  },

  async onLoad(options) {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;

    const month = options.month || formatMonthValue(new Date());
    const selectedDate = options.date || `${month}-01`;
    this.setData({ month, selectedDate });
    await this.loadDiaryData(month, selectedDate);
  },

  async loadDiaryData(month = this.data.month, preferredDate = '') {
    this.setData({ loading: true, errorMessage: '' });
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
        dayMoments: momentsByDate[fallbackDate] || [],
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '日历加载失败，请稍后重试。',
      });
    }
  },

  async switchMonth(delta) {
    const month = shiftMonth(this.data.month, delta);
    await this.loadDiaryData(month, `${month}-01`);
  },

  prevMonth() {
    this.switchMonth(-1);
  },

  nextMonth() {
    this.switchMonth(1);
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
      dayMoments: (this.data.dayMoments && this.data.dayMoments.filter(() => false)) || [],
    });

    this.loadDiaryData(this.data.month, date);
  },

  goMomentDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/moment/detail?id=${id}`,
    });
  },

  goRelease() {
    wx.navigateTo({
      url: `/pages/release/index?date=${this.data.selectedDate}`,
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({
          url: '/pages/wall/index',
        });
      },
    });
  },
});