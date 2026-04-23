import { addWish, fetchMemorialData, removeWish, setWishStored, toggleWish } from '../../api/relationship';
import { formatDate } from '../../utils/couple';
import { ensureAuthorizedPage } from '../../utils/pageAuth';

const TREE_SLOT_PATTERN = [1, 5, 9, 2, 8, 3, 7, 4, 6, 10, 11, 12];

const TREE_STAGES = [
  {
    level: 1,
    min: 0,
    max: 2,
    name: '幼芽期',
    desc: '树枝刚刚舒展开，适合先把最想实现的小心愿挂上去。',
  },
  {
    level: 2,
    min: 3,
    max: 5,
    name: '抽枝期',
    desc: '已经开始有果子成熟了，树冠也在一点点变得丰盈。',
  },
  {
    level: 3,
    min: 6,
    max: 9,
    name: '繁茂期',
    desc: '枝叶慢慢铺开，完成的愿望会让整棵树更有存在感。',
  },
  {
    level: 4,
    min: 10,
    max: 14,
    name: '丰收期',
    desc: '已经是一棵会结果的心愿树了，每次摘取都像一次认真收藏。',
  },
  {
    level: 5,
    min: 15,
    max: Infinity,
    name: '纪念树',
    desc: '你们一起把很多期待变成了真实回忆，这棵树会一直记住。',
  },
];

function getTreeStage(completedCount) {
  const stage = TREE_STAGES.find((item) => completedCount >= item.min && completedCount <= item.max) || TREE_STAGES[TREE_STAGES.length - 1];
  const nextStage = TREE_STAGES.find((item) => item.level === stage.level + 1);
  const progressPercent = stage.max === Infinity
    ? 100
    : Math.min(100, Math.max(20, Math.round(((completedCount - stage.min + 1) / (stage.max - stage.min + 1)) * 100)));

  return {
    ...stage,
    progressPercent,
    progressText: nextStage
      ? `再完成 ${Math.max(0, nextStage.min - completedCount)} 个心愿，就会长到${nextStage.name}`
      : '这棵树已经长成你们专属的纪念树了',
  };
}

function decorateTreeNodes(wishes, nodeType, startOffset = 0) {
  return wishes.map((item, index) => ({
    ...item,
    nodeType,
    treeSlot: TREE_SLOT_PATTERN[(index + startOffset) % TREE_SLOT_PATTERN.length],
    isExpanded: false,
    cardTag: nodeType === 'ripe' ? '成熟的果实' : '等待实现的花苞',
  }));
}

function decorateCabinetItems(wishes) {
  return wishes.map((item) => ({
    ...item,
    isExpanded: false,
    cardTag: '已经收藏进收获匣',
  }));
}

function toggleExpandedItems(list, id, shouldExpand) {
  return list.map((item) => ({
    ...item,
    isExpanded: shouldExpand && item.id === id,
  }));
}

Page({
  data: {
    wishText: '',
    treeNodes: [],
    storedWishes: [],
    summary: {
      total: 0,
      completed: 0,
      pending: 0,
      ripe: 0,
      stored: 0,
    },
    treeStage: getTreeStage(0),
    heroTip: '把想一起完成的事挂到树上，等它们慢慢长成果实。',
    cabinetHint: '完成的果实摘下后，会被安静放进下面的收获匣。',
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
      const { wishes = [] } = await fetchMemorialData();
      const normalizedWishes = wishes.map((item) => ({
        ...item,
        id: item._id,
        isCompleted: Boolean(item.isCompleted),
        isStored: Boolean(item.isStored),
        completedTime: item.completedTime || '',
        storedTime: item.storedTime || '',
        createTime: Number(item.createTime) || 0,
        isExpanded: false,
      }));

      const pendingWishes = normalizedWishes
        .filter((item) => !item.isCompleted)
        .sort((left, right) => right.createTime - left.createTime);

      const ripeWishes = normalizedWishes
        .filter((item) => item.isCompleted && !item.isStored)
        .sort((left, right) => `${right.completedTime || ''}`.localeCompare(`${left.completedTime || ''}`));

      const storedWishes = normalizedWishes
        .filter((item) => item.isCompleted && item.isStored)
        .sort((left, right) => `${right.storedTime || ''}`.localeCompare(`${left.storedTime || ''}`));

      const completedCount = ripeWishes.length + storedWishes.length;
      const treeStage = getTreeStage(completedCount);

      this.setData({
        treeNodes: decorateTreeNodes(ripeWishes, 'ripe').concat(decorateTreeNodes(pendingWishes, 'bud', ripeWishes.length)),
        storedWishes: decorateCabinetItems(storedWishes),
        summary: {
          total: normalizedWishes.length,
          completed: completedCount,
          pending: pendingWishes.length,
          ripe: ripeWishes.length,
          stored: storedWishes.length,
        },
        treeStage,
        heroTip: completedCount
          ? `已经有 ${completedCount} 个心愿长出了果实，成熟的果子会先挂在最显眼的枝头。`
          : '先从一个很小的愿望开始，把未来一点点挂满整棵树。',
        cabinetHint: storedWishes.length
          ? `收获匣里已经收藏了 ${storedWishes.length} 颗果实，它们会在这里慢慢变成纪念。`
          : '成熟的果实摘下后，会被安静放进下面的收获匣。',
        loading: false,
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: error.message || '心愿树加载失败，请稍后重试。',
      });
    }
  },

  handleWishInput(e) {
    this.setData({ wishText: e.detail.value });
  },

  toggleWishDetail(e) {
    const { id } = e.currentTarget.dataset;
    const currentItem = this.data.treeNodes.find((item) => item.id === id) || this.data.storedWishes.find((item) => item.id === id);
    const shouldExpand = !(currentItem && currentItem.isExpanded);

    this.setData({
      treeNodes: toggleExpandedItems(this.data.treeNodes, id, shouldExpand),
      storedWishes: toggleExpandedItems(this.data.storedWishes, id, shouldExpand),
    });
  },

  async addWish() {
    const content = this.data.wishText.trim();
    if (!content) {
      wx.showToast({ title: '先写一个心愿', icon: 'none' });
      return;
    }

    try {
      await addWish(content);
      this.setData({ wishText: '' });
      await this.loadPageData();
      wx.showToast({ title: '心愿已经挂上树枝', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message || '新增失败', icon: 'none' });
    }
  },

  async toggleWish(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await toggleWish(id, formatDate(new Date()));
      await this.loadPageData();
    } catch (error) {
      wx.showToast({ title: error.message || '更新失败', icon: 'none' });
    }
  },

  async storeWishFruit(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await setWishStored(id, true);
      await this.loadPageData();
      wx.showToast({ title: '果实已放进收获匣', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message || '收藏失败', icon: 'none' });
    }
  },

  async restoreWishFruit(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await setWishStored(id, false);
      await this.loadPageData();
      wx.showToast({ title: '果实重新挂回树上', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message || '恢复失败', icon: 'none' });
    }
  },

  async removeWish(e) {
    const { id } = e.currentTarget.dataset;
    try {
      await removeWish(id);
      await this.loadPageData();
      wx.showToast({ title: '已经从树上取下', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error.message || '移除失败', icon: 'none' });
    }
  },
});