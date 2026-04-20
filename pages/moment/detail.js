import { addMomentComment, deleteMoment, fetchMomentDetail, removeMomentComment, toggleMomentLike } from '../../api/relationship';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

function formatTimeLabel(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

function mapComments(comments = []) {
  return comments.map((item) => ({
    ...item,
    timeLabel: formatTimeLabel(item.createdAt),
  }));
}

Page({
  data: {
    id: '',
    moment: null,
    loading: true,
    errorMessage: '',
    deleting: false,
    likeLoading: false,
    commenting: false,
    commentText: '',
    currentImage: '',
  },

  async onLoad(options) {
    const authResult = await ensureAuthorizedPage();
    if (!authResult) return;

    const id = options.id || '';
    this.setData({ id });
    if (!id) {
      this.setData({
        loading: false,
        errorMessage: '没有找到这条回忆。',
      });
      return;
    }

    await this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const { moment } = await fetchMomentDetail(this.data.id);
      this.setData({
        moment: {
          ...moment,
          images: moment.images || [],
          comments: mapComments(moment.comments || []),
          content: moment.content || '这一天没有留下文字，但留下了想念。',
          title: moment.title || '今天的记录',
          mood: moment.mood || '日常',
          date: moment.date || '',
        },
        currentImage: (moment.images && moment.images[0]) || '',
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '回忆加载失败，请稍后再试。',
      });
    }
  },

  previewImage(e) {
    const { current } = e.currentTarget.dataset;
    const images = (this.data.moment && this.data.moment.images) || [];
    if (!images.length) return;
    wx.previewImage({
      current,
      urls: images,
    });
  },

  selectImage(e) {
    const { src } = e.currentTarget.dataset;
    if (!src) return;

    this.setData({ currentImage: src });
  },

  async toggleLike() {
    if (!this.data.id || !this.data.moment || this.data.likeLoading) return;

    this.setData({ likeLoading: true });
    try {
      const result = await toggleMomentLike(this.data.id);
      this.setData({
        moment: {
          ...this.data.moment,
          likedByMe: result.liked,
          likeCount: result.likeCount,
        },
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '操作失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ likeLoading: false });
    }
  },

  handleCommentInput(e) {
    this.setData({
      commentText: e.detail.value,
    });
  },

  async submitComment() {
    const content = this.data.commentText.trim();
    if (!content || this.data.commenting) return;

    this.setData({ commenting: true });
    try {
      const result = await addMomentComment(this.data.id, content);
      this.setData({
        commentText: '',
        moment: {
          ...this.data.moment,
          comments: mapComments((this.data.moment.comments || []).concat(result.comment)),
          commentCount: result.commentCount,
        },
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '评论失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ commenting: false });
    }
  },

  async removeComment(e) {
    const { commentId } = e.currentTarget.dataset;
    if (!commentId) return;

    try {
      const result = await removeMomentComment(this.data.id, commentId);
      this.setData({
        moment: {
          ...this.data.moment,
          comments: (this.data.moment.comments || []).filter((item) => item.id !== commentId),
          commentCount: result.commentCount,
        },
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '删除评论失败',
        icon: 'none',
      });
    }
  },

  async deleteMoment() {
    if (!this.data.moment || !this.data.moment.canDelete || this.data.deleting) return;

    wx.showModal({
      title: '删除回忆',
      content: '删除后图片和文字都不会保留，确认删除吗？',
      success: async ({ confirm }) => {
        if (!confirm) return;

        this.setData({ deleting: true });
        try {
          await deleteMoment(this.data.id);
          wx.setStorageSync('couple_notice', '回忆已删除');
          wx.switchTab({
            url: '/pages/home/index',
          });
        } finally {
          this.setData({ deleting: false });
        }
      },
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({ url: '/pages/home/index' });
      },
    });
  },
});