import {
  changePetSkin as changePetSkinRequest,
  feedPet as feedPetRequest,
  fetchPetData,
  interactPet as interactPetRequest,
} from '../../api/relationship';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

Page({
  data: {
    profile: {
      spaceName: '我们的空间',
      partnerA: '我',
      partnerB: '你',
    },
    stats: {
      momentCount: 0,
      anniversaryCount: 0,
      wishCount: 0,
    },
    pets: [],
    activePetIndex: 0,
    islandLevel: 1,
    actionKey: '',
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
      const { profile, stats, pets = [], islandLevel = 1 } = await fetchPetData();
      this.setData({
        profile,
        stats,
        pets,
        activePetIndex: 0,
        islandLevel,
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '宠物岛加载失败，请稍后重试。',
      });
    }
  },

  goSpaceSettings() {
    wx.navigateTo({
      url: '/pages/my/index',
    });
  },

  handlePetSwiperChange(e) {
    this.setData({
      activePetIndex: e.detail.current || 0,
    });
  },

  async runPetAction(actionKey, request) {
    if (this.data.actionKey) return;
    this.setData({ actionKey });
    try {
      const result = await request();
      this.setData({
        pets: result.pets || this.data.pets,
        islandLevel: result.islandLevel || this.data.islandLevel,
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '宠物互动失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ actionKey: '' });
    }
  },

  handleFeedPet(e) {
    const { id } = e.currentTarget.dataset;
    this.runPetAction(`feed-${id}`, () => feedPetRequest(id));
  },

  handleInteractPet(e) {
    const { id } = e.currentTarget.dataset;
    this.runPetAction(`hug-${id}`, () => interactPetRequest(id, 'hug'));
  },

  handleChangeSkin(e) {
    const { id } = e.currentTarget.dataset;
    this.runPetAction(`skin-${id}`, () => changePetSkinRequest(id));
  },
});