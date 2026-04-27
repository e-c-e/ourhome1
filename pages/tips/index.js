import { fetchHomeData, saveDailyTipsText } from '../../api/relationship';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

const DEFAULT_TIPS = [
  '今天记得多喝水，也记得多说一句想你。',
  '如果今天有一点点开心，别忘了给对方留个记录。',
  '今晚适合问一句：今天过得怎么样？',
  '先把普通的一天写下来，它以后会变成很特别的回忆。',
  '如果今天有点累，就给彼此留一句轻一点的晚安。',
  '今天的小提示：忙完也记得照顾好自己。',
  '哪怕只是一张照片，今天也值得被认真记住。',
];

function getCustomTips(text = '') {
  return `${text}`
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTipSections(todayTip, customTips = []) {
  const sections = [
    {
      key: 'today',
      title: '今日提示',
      desc: '首页当前展示的就是这一条。',
      items: todayTip ? [todayTip] : [],
    },
    {
      key: 'custom',
      title: '你的提示库',
      desc: customTips.length ? '这些是你自己维护的小提示，会按日期轮换。' : '你还没有写自己的提示，当前会使用系统提示。',
      items: customTips,
    },
    {
      key: 'default',
      title: '系统提示库',
      desc: '当你的提示为空时，会从这里轮换显示。',
      items: DEFAULT_TIPS,
    },
  ];

  return sections.filter((item) => item.items.length || item.key !== 'today');
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    todayTip: '',
    dailyTipsText: '',
    dailyTipDraft: '',
    sections: [],
    saving: false,
  },

  async onShow() {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;
    await this.loadPageData();
  },

  async loadPageData() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const { homeSnapshot = {}, space = {} } = await fetchHomeData();
      const dailyTipsText = space.dailyTipsText || '';
      const customTips = getCustomTips(dailyTipsText);
      this.setData({
        todayTip: homeSnapshot.dailyTip || '',
        dailyTipsText,
        dailyTipDraft: dailyTipsText,
        sections: buildTipSections(homeSnapshot.dailyTip || '', customTips),
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '小提示加载失败，请稍后重试。',
      });
    }
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({
          url: '/pages/home/index',
        });
      },
    });
  },

  handleDraftInput(e) {
    this.setData({
      dailyTipDraft: e.detail.value || '',
    });
  },

  async saveTips() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const result = await saveDailyTipsText(this.data.dailyTipDraft);
      const dailyTipsText = result.dailyTipsText || '';
      const customTips = getCustomTips(dailyTipsText);
      const todayTip = result.dailyTip || this.data.todayTip;
      this.setData({
        saving: false,
        todayTip,
        dailyTipsText,
        dailyTipDraft: dailyTipsText,
        sections: buildTipSections(todayTip, customTips),
      });
      wx.showToast({
        title: '提示库已更新',
        icon: 'success',
      });
    } catch (error) {
      this.setData({ saving: false });
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
    }
  },
});