import { createMoment } from '../../api/relationship';
import { STORAGE_KEYS, formatDate } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

const MOODS = ['开心', '想你', '纪念', '旅行', '日常', '惊喜'];

Page({
  data: {
    title: '',
    content: '',
    recordDate: formatDate(new Date()),
    selectedMoodIndex: 0,
    moods: MOODS,
    imageFiles: [],
    saving: false,
  },

  async onLoad() {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;

    const draft = wx.getStorageSync(STORAGE_KEYS.DRAFT);
    if (draft) {
      this.setData({
        title: draft.title || '',
        content: draft.content || '',
        recordDate: draft.recordDate || formatDate(new Date()),
        selectedMoodIndex: draft.selectedMoodIndex || 0,
        imageFiles: draft.imageFiles || [],
      });
    }
  },

  handleTitleInput(e) {
    this.setData({
      title: e.detail.value,
    });
  },

  handleContentInput(e) {
    this.setData({
      content: e.detail.value,
    });
  },

  handleDateChange(e) {
    this.setData({
      recordDate: e.detail.value,
    });
  },

  chooseImages() {
    const remainCount = Math.max(0, 9 - this.data.imageFiles.length);
    if (!remainCount) return;

    wx.chooseMedia({
      count: remainCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: ({ tempFiles }) => {
        const imageFiles = tempFiles.map((item) => ({
          url: item.tempFilePath,
        }));
        this.setData({
          imageFiles: this.data.imageFiles.concat(imageFiles),
        });
      },
    });
  },

  previewImage(e) {
    const { current } = e.currentTarget.dataset;
    const urls = this.data.imageFiles.map((item) => item.url);
    wx.previewImage({
      current,
      urls,
    });
  },

  removeImage(e) {
    const { index } = e.currentTarget.dataset;
    const imageFiles = [...this.data.imageFiles];
    imageFiles.splice(index, 1);
    this.setData({ imageFiles });
  },

  selectMood(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      selectedMoodIndex: Number(index),
    });
  },

  saveDraft() {
    const draft = this.buildMomentPayload();
    wx.setStorageSync(STORAGE_KEYS.DRAFT, draft);
    wx.showToast({
      title: '草稿已保存',
      icon: 'success',
    });
  },

  publishMoment() {
    const content = this.data.content.trim();
    if (!content && !this.data.imageFiles.length) {
      wx.showToast({
        title: '至少写点文字或选一张照片',
        icon: 'none',
      });
      return;
    }


    this.submitMoment();
  },

  async submitMoment() {
    this.setData({ saving: true });

    try {
      await createMoment(this.buildMomentPayload());
      wx.removeStorageSync(STORAGE_KEYS.DRAFT);
      wx.setStorageSync(STORAGE_KEYS.NOTICE, '回忆已保存');
      wx.switchTab({
        url: '/pages/home/index',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ saving: false });
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

  buildMomentPayload() {
    const mood = this.data.moods[this.data.selectedMoodIndex] || '日常';

    return {
      title: this.data.title.trim() || '今天的记录',
      content: this.data.content.trim(),
      date: this.data.recordDate,
      mood,
      images: this.data.imageFiles.map((item) => item.url),
      imageFiles: this.data.imageFiles,
    };
  },
});
