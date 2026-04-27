import { fetchActivityFeed } from '../../api/relationship';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'moment', label: '记录' },
  { value: 'comment', label: '评论' },
  { value: 'like', label: '点赞' },
];

function formatDateText(timestamp = 0) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getGroupLabel(timestamp = 0) {
  if (!timestamp) return '更早';
  const target = new Date(timestamp);
  const today = new Date();
  const targetText = formatDateText(timestamp);
  const todayText = formatDateText(today.getTime());
  if (targetText === todayText) return '今天';
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (targetText === formatDateText(yesterday.getTime())) return '昨天';
  return '更早';
}

function buildActivitySections(activityFeed = [], activeFilter = 'all') {
  const filtered = (activityFeed || []).filter((item) => activeFilter === 'all' || item.type === activeFilter);
  const groups = [
    { key: '今天', title: '今天', items: [] },
    { key: '昨天', title: '昨天', items: [] },
    { key: '更早', title: '更早', items: [] },
  ];

  filtered.forEach((item) => {
    const label = getGroupLabel(item.createdAt);
    const group = groups.find((entry) => entry.key === label);
    if (group) {
      group.items.push(item);
    }
  });

  return groups.filter((item) => item.items.length);
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    activityFeed: [],
    filterOptions: FILTER_OPTIONS,
    activeFilter: 'all',
    activitySections: [],
  },

  async onShow() {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;
    await this.loadPageData();
  },

  async loadPageData() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const result = await fetchActivityFeed();
      const activityFeed = result.activityFeed || [];
      this.setData({
        activityFeed,
        activitySections: buildActivitySections(activityFeed, this.data.activeFilter),
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '最近动态加载失败，请稍后重试。',
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

  openActivityTarget(e) {
    const { momentId } = e.currentTarget.dataset;
    if (!momentId) return;
    wx.navigateTo({
      url: `/pages/moment/detail?id=${momentId}`,
    });
  },

  handleFilterChange(e) {
    const { filter } = e.currentTarget.dataset;
    const activeFilter = filter || 'all';
    this.setData({
      activeFilter,
      activitySections: buildActivitySections(this.data.activityFeed, activeFilter),
    });
  },
});