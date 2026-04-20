const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const SPACE_COLLECTION = 'space';
const USERS_COLLECTION = 'users';
const MOMENTS_COLLECTION = 'moments';
const ANNIVERSARIES_COLLECTION = 'anniversaries';
const WISHES_COLLECTION = 'wishes';
const SPACE_DOC_ID = 'main';

const PET_PRESETS = [
  {
    id: 'pet-sugar',
    name: '奶糖',
    species: 'cat',
    avatar: '🐱',
    mood: '等你抱抱',
  },
  {
    id: 'pet-chestnut',
    name: '栗子',
    species: 'dog',
    avatar: '🐶',
    mood: '想一起散步',
  },
];

const PET_SKINS = {
  cat: [
    { name: '奶油围巾', emoji: '🐱', desc: '软乎乎的奶油色小围巾。' },
    { name: '草莓披风', emoji: '😺', desc: '一看就是今天心情很好。' },
    { name: '云朵睡衣', emoji: '🐈', desc: '抱起来像棉花糖。' },
  ],
  dog: [
    { name: '焦糖围兜', emoji: '🐶', desc: '尾巴摇得像小风扇。' },
    { name: '旅行背带', emoji: '🐕', desc: '随时想陪你去散步。' },
    { name: '派对领结', emoji: '🦮', desc: '今天也是会撒娇的主角。' },
  ],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonth(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildDefaultReminderSettings() {
  return {
    enabled: false,
    daysBefore: 3,
    inAppEnabled: true,
    serviceEnabled: false,
    updatedAt: Date.now(),
  };
}

function buildDefaultPet(index) {
  const preset = PET_PRESETS[index] || PET_PRESETS[0];
  return {
    id: preset.id,
    name: preset.name,
    species: preset.species,
    avatar: preset.avatar,
    mood: preset.mood,
    intimacy: index === 0 ? 32 : 28,
    satiety: index === 0 ? 76 : 72,
    skinIndex: 0,
    lastFedAt: 0,
    lastInteractAt: 0,
    updatedAt: Date.now(),
  };
}

function buildPetSkinOptions(species) {
  return PET_SKINS[species] || PET_SKINS.cat;
}

function normalizeReminderSettings(settings = {}) {
  const base = buildDefaultReminderSettings();
  return {
    ...base,
    ...settings,
    enabled: Boolean(settings.enabled),
    inAppEnabled: settings.inAppEnabled !== false,
    serviceEnabled: Boolean(settings.serviceEnabled),
    daysBefore: clamp(Number(settings.daysBefore) || base.daysBefore, 1, 7),
    updatedAt: settings.updatedAt || base.updatedAt,
  };
}

function normalizePet(pet = {}, index = 0) {
  const base = buildDefaultPet(index);
  const merged = {
    ...base,
    ...pet,
  };
  const skins = buildPetSkinOptions(merged.species);
  const skinIndex = clamp(Number(merged.skinIndex) || 0, 0, skins.length - 1);
  const intimacy = clamp(Number(merged.intimacy) || 0, 0, 999);
  const satiety = clamp(Number(merged.satiety) || 0, 0, 100);
  const level = Math.max(1, Math.floor(intimacy / 120) + 1);
  const progressBase = (level - 1) * 120;
  const progressPercent = clamp(Math.round(((intimacy - progressBase) / 120) * 100), 0, 100);

  return {
    ...merged,
    intimacy,
    satiety,
    skinIndex,
    level,
    progressPercent,
    nextLevelIntimacy: level * 120,
    skin: skins[skinIndex],
    skins,
    stageLabel: level >= 5 ? '陪伴大师' : level >= 3 ? '元气伙伴' : '撒娇新手',
  };
}

function buildDefaultSpace() {
  return {
    spaceName: '我们的空间',
    partnerA: '我',
    partnerB: '你',
    intro: '把普通日子慢慢写成回忆。',
    startDate: '',
    reminderSettings: buildDefaultReminderSettings(),
    pets: [buildDefaultPet(0), buildDefaultPet(1)],
    collectionsReady: false,
    updatedAt: Date.now(),
  };
}

function sanitizeSpaceData(space = {}) {
  const { _id, _openid, ...rest } = space;
  return rest;
}

function buildSpaceState(space = {}) {
  const base = buildDefaultSpace();
  const source = sanitizeSpaceData(space);
  const pets = Array.isArray(source.pets) ? source.pets : [];

  return {
    ...base,
    ...source,
    reminderSettings: normalizeReminderSettings(source.reminderSettings || {}),
    pets: PET_PRESETS.map((item, index) => normalizePet(pets[index] || { id: item.id }, index)),
  };
}

function buildLocation(data = {}) {
  if (!data || !data.name) return null;
  return {
    name: data.name,
    address: data.address || '',
    latitude: Number(data.latitude) || 0,
    longitude: Number(data.longitude) || 0,
  };
}

function normalizeComment(comment = {}, moment, user) {
  return {
    id: comment.id || createId('comment'),
    content: comment.content || '',
    userId: comment.userId || '',
    userRole: comment.userRole || 'partner',
    userNickname: comment.userNickname || (comment.userRole === 'owner' ? '我' : '你'),
    createdAt: comment.createdAt || Date.now(),
    creatorLabel: comment.userRole === 'owner' ? '我' : '你',
    canDelete: Boolean(user && (comment.userId === user._id || moment.createUserId === user._id)),
  };
}

function normalizeMomentRecord(item = {}, user) {
  const images = Array.isArray(item.images) ? item.images : [];
  const likeUserIds = Array.isArray(item.likeUserIds) ? item.likeUserIds : [];
  const moment = {
    ...item,
    images,
    likeUserIds,
    comments: Array.isArray(item.comments) ? item.comments : [],
    location: buildLocation(item.location),
  };
  const comments = moment.comments
    .map((comment) => normalizeComment(comment, moment, user))
    .sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0));

  return {
    ...moment,
    cover: moment.cover || images[0] || '',
    previewImages: images.slice(0, 3),
    imageCount: images.length,
    likeCount: likeUserIds.length,
    commentCount: comments.length,
    likedByMe: Boolean(user && likeUserIds.includes(user._id)),
    comments,
    canDelete: Boolean(user && moment.createUserId === user._id),
    creatorLabel: moment.createUserRole === 'owner' ? '我' : '你',
  };
}

function calculateIslandLevel(pets = []) {
  if (!pets.length) return 1;
  const totalLevels = pets.reduce((sum, item) => sum + (item.level || 1), 0);
  return Math.max(1, Math.round(totalLevels / pets.length));
}

function getMonthRange(monthText = formatMonth()) {
  const normalized = /^\d{4}-\d{2}$/.test(monthText) ? monthText : formatMonth();
  const [yearText, monthValue] = normalized.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthValue) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    month: normalized,
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

async function ensureAuthorizedUser() {
  const { OPENID } = cloud.getWXContext();
  let userResult = { data: [] };
  try {
    userResult = await db.collection(USERS_COLLECTION).where({ openid: OPENID }).limit(1).get();
  } catch (error) {
    userResult = { data: [] };
  }
  if (!userResult.data.length) {
    throw new Error('NOT_AUTHORIZED');
  }
  return userResult.data[0];
}

async function safeList(collectionName, options = {}) {
  try {
    let query = db.collection(collectionName);
    if (options.orderField) {
      query = query.orderBy(options.orderField, options.orderDirection || 'desc');
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const { data } = await query.get();
    return data;
  } catch (error) {
    return [];
  }
}

async function safeCount(collectionName, where = null) {
  try {
    const collection = where ? db.collection(collectionName).where(where) : db.collection(collectionName);
    const { total } = await collection.count();
    return total;
  } catch (error) {
    return 0;
  }
}

async function getSpace() {
  try {
    const { data } = await db.collection(SPACE_COLLECTION).doc(SPACE_DOC_ID).get();
    return buildSpaceState(data);
  } catch (error) {
    const data = buildSpaceState(buildDefaultSpace());
    await db.collection(SPACE_COLLECTION).doc(SPACE_DOC_ID).set({ data: sanitizeSpaceData(data) });
    return data;
  }
}

async function saveSpacePatch(patch = {}) {
  const current = await getSpace();
  const nextData = buildSpaceState({
    ...sanitizeSpaceData(current),
    ...sanitizeSpaceData(patch),
    reminderSettings: patch.reminderSettings
      ? {
          ...current.reminderSettings,
          ...patch.reminderSettings,
        }
      : current.reminderSettings,
    pets: Array.isArray(patch.pets) ? patch.pets : current.pets,
    updatedAt: Date.now(),
  });
  await db.collection(SPACE_COLLECTION).doc(SPACE_DOC_ID).set({
    data: sanitizeSpaceData(nextData),
  });
  return nextData;
}

async function removeAllDocuments(collectionName) {
  const collection = db.collection(collectionName);
  const { data } = await collection.limit(100).get();
  if (!data.length) return [];

  await Promise.all(data.map((item) => collection.doc(item._id).remove()));

  if (data.length === 100) {
    const nextBatch = await removeAllDocuments(collectionName);
    return data.concat(nextBatch);
  }

  return data;
}

async function getHomeData() {
  const space = await getSpace();
  const user = await ensureAuthorizedUser();
  const moments = await safeList(MOMENTS_COLLECTION, { orderField: 'createdAt', orderDirection: 'desc', limit: 100 });
  return {
    space,
    moments: moments.map((item) => normalizeMomentRecord(item, user)),
  };
}

async function createMoment(data, user) {
  const moment = {
    title: data.title || '今天的记录',
    content: data.content || '',
    date: data.date,
    mood: data.mood || '日常',
    images: data.images || [],
    cover: (data.images || [])[0] || '',
    location: buildLocation(data.location),
    likeUserIds: [],
    comments: [],
    createUserId: user._id,
    createUserRole: user.role,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const createResult = await db.collection(MOMENTS_COLLECTION).add({ data: moment });
  return {
    ...moment,
    _id: createResult._id,
  };
}

async function getMomentDetail(id, user) {
  const { data } = await db.collection(MOMENTS_COLLECTION).doc(id).get();
  return {
    moment: normalizeMomentRecord(data, user),
  };
}

async function deleteMomentById(id, user) {
  const { data } = await db.collection(MOMENTS_COLLECTION).doc(id).get();
  if (data.createUserId !== user._id) {
    throw new Error('NO_PERMISSION');
  }

  await db.collection(MOMENTS_COLLECTION).doc(id).remove();
  if (data.images && data.images.length) {
    await cloud.deleteFile({ fileList: data.images });
  }

  return { success: true };
}

async function getMemorialData() {
  const space = await getSpace();
  const anniversaries = await safeList(ANNIVERSARIES_COLLECTION, { orderField: 'date', orderDirection: 'asc' });
  const wishes = await safeList(WISHES_COLLECTION, { orderField: 'createTime', orderDirection: 'desc' });

  return {
    space,
    anniversaries,
    wishes,
  };
}

async function getSpaceData() {
  const space = await getSpace();
  const [momentCount, anniversaryCount, wishCount, completedWishCount] = await Promise.all([
    safeCount(MOMENTS_COLLECTION),
    safeCount(ANNIVERSARIES_COLLECTION),
    safeCount(WISHES_COLLECTION),
    safeCount(WISHES_COLLECTION, { isCompleted: true }),
  ]);

  return {
    profile: space,
    reminderSettings: space.reminderSettings,
    pets: space.pets,
    stats: {
      momentCount,
      anniversaryCount,
      wishCount,
      completedWishCount,
    },
  };
}

async function toggleMomentLike(id, user) {
  const momentDoc = await db.collection(MOMENTS_COLLECTION).doc(id).get();
  const current = normalizeMomentRecord(momentDoc.data, user);
  const likeUserIds = current.likeUserIds || [];
  const likedByMe = likeUserIds.includes(user._id);
  const nextLikeUserIds = likedByMe ? likeUserIds.filter((item) => item !== user._id) : likeUserIds.concat(user._id);

  await db.collection(MOMENTS_COLLECTION).doc(id).update({
    data: {
      likeUserIds: nextLikeUserIds,
      updatedAt: Date.now(),
    },
  });

  return {
    liked: !likedByMe,
    likeCount: nextLikeUserIds.length,
  };
}

async function addMomentComment(id, content, user) {
  const text = (content || '').trim();
  if (!text) {
    throw new Error('COMMENT_EMPTY');
  }

  const momentDoc = await db.collection(MOMENTS_COLLECTION).doc(id).get();
  const current = normalizeMomentRecord(momentDoc.data, user);
  const comment = {
    id: createId('comment'),
    content: text,
    userId: user._id,
    userRole: user.role,
    userNickname: user.nickname || (user.role === 'owner' ? '我' : '你'),
    createdAt: Date.now(),
  };
  const comments = current.comments.concat([normalizeComment(comment, current, user)]);

  await db.collection(MOMENTS_COLLECTION).doc(id).update({
    data: {
      comments: comments.map(({ canDelete, creatorLabel, ...rest }) => rest),
      updatedAt: Date.now(),
    },
  });

  return {
    comment: normalizeComment(comment, current, user),
    commentCount: comments.length,
  };
}

async function removeMomentComment(momentId, commentId, user) {
  const momentDoc = await db.collection(MOMENTS_COLLECTION).doc(momentId).get();
  const current = normalizeMomentRecord(momentDoc.data, user);
  const comment = current.comments.find((item) => item.id === commentId);
  if (!comment) {
    return { success: true };
  }
  if (comment.userId !== user._id && current.createUserId !== user._id) {
    throw new Error('NO_PERMISSION');
  }

  const comments = current.comments.filter((item) => item.id !== commentId);
  await db.collection(MOMENTS_COLLECTION).doc(momentId).update({
    data: {
      comments: comments.map(({ canDelete, creatorLabel, ...rest }) => rest),
      updatedAt: Date.now(),
    },
  });

  return {
    success: true,
    commentCount: comments.length,
  };
}

async function saveReminderSettings(settings = {}) {
  const space = await saveSpacePatch({
    reminderSettings: normalizeReminderSettings(settings),
  });

  return {
    reminderSettings: space.reminderSettings,
  };
}

async function updatePet(petId, updater) {
  const space = await getSpace();
  const pets = space.pets.map((item, index) => normalizePet(item, index));
  const petIndex = pets.findIndex((item) => item.id === petId);
  if (petIndex < 0) {
    throw new Error('PET_NOT_FOUND');
  }

  const nextPet = normalizePet(
    {
      ...pets[petIndex],
      ...updater(pets[petIndex]),
      updatedAt: Date.now(),
    },
    petIndex,
  );
  pets.splice(petIndex, 1, nextPet);
  const nextSpace = await saveSpacePatch({ pets });
  return {
    pet: nextSpace.pets[petIndex],
    pets: nextSpace.pets,
    islandLevel: calculateIslandLevel(nextSpace.pets),
  };
}

async function getPetData() {
  const space = await getSpace();
  const [momentCount, anniversaryCount, wishCount] = await Promise.all([
    safeCount(MOMENTS_COLLECTION),
    safeCount(ANNIVERSARIES_COLLECTION),
    safeCount(WISHES_COLLECTION),
  ]);

  return {
    profile: space,
    pets: space.pets,
    islandLevel: calculateIslandLevel(space.pets),
    stats: {
      momentCount,
      anniversaryCount,
      wishCount,
    },
  };
}

async function feedPet(petId) {
  return updatePet(petId, (pet) => ({
    satiety: clamp((pet.satiety || 0) + 18, 0, 100),
    intimacy: clamp((pet.intimacy || 0) + 8, 0, 999),
    mood: '吃得饱饱，正想蹭蹭你',
    lastFedAt: Date.now(),
  }));
}

async function interactPet(petId, interactionType = 'hug') {
  const actionMap = {
    hug: {
      intimacy: 10,
      satiety: -3,
      mood: '被抱抱之后变得更黏人了',
    },
    play: {
      intimacy: 12,
      satiety: -6,
      mood: '玩得尾巴都摇起来了',
    },
  };
  const action = actionMap[interactionType] || actionMap.hug;
  return updatePet(petId, (pet) => ({
    satiety: clamp((pet.satiety || 0) + action.satiety, 0, 100),
    intimacy: clamp((pet.intimacy || 0) + action.intimacy, 0, 999),
    mood: action.mood,
    lastInteractAt: Date.now(),
  }));
}

async function changePetSkin(petId) {
  return updatePet(petId, (pet) => {
    const skins = buildPetSkinOptions(pet.species);
    return {
      skinIndex: (Number(pet.skinIndex) + 1) % skins.length,
      mood: '换上新皮肤，今天格外想贴贴',
    };
  });
}

async function getDiaryData(month) {
  const user = await ensureAuthorizedUser();
  const range = getMonthRange(month);
  let query = db
    .collection(MOMENTS_COLLECTION)
    .where({
      date: _.gte(range.startDate).and(_.lte(range.endDate)),
    })
    .orderBy('date', 'desc')
    .limit(200);

  let data = [];
  try {
    const result = await query.get();
    data = result.data || [];
  } catch (error) {
    data = [];
  }

  const moments = data.map((item) => normalizeMomentRecord(item, user));
  const activeDayMap = {};
  let photoCount = 0;

  moments.forEach((item) => {
    activeDayMap[item.date] = true;
    photoCount += item.imageCount || 0;
  });

  return {
    month: range.month,
    moments,
    summary: {
      recordCount: moments.length,
      activeDays: Object.keys(activeDayMap).length,
      photoCount,
    },
  };
}

exports.main = async (event) => {
  const user = await ensureAuthorizedUser();
  const { action, data = {} } = event;

  switch (action) {
    case 'getHomeData':
      return getHomeData();
    case 'setStartDate':
      return saveSpacePatch({ startDate: data.startDate || '' });
    case 'createMoment':
      return createMoment(data, user);
    case 'toggleMomentLike':
      return toggleMomentLike(data.id, user);
    case 'addMomentComment':
      return addMomentComment(data.id, data.content, user);
    case 'removeMomentComment':
      return removeMomentComment(data.momentId, data.commentId, user);
    case 'getMomentDetail':
      return getMomentDetail(data.id, user);
    case 'deleteMoment':
      return deleteMomentById(data.id, user);
    case 'getMemorialData':
      return getMemorialData();
    case 'addAnniversary': {
      const result = await db.collection(ANNIVERSARIES_COLLECTION).add({
        data: {
          name: data.name,
          date: data.date,
          createdAt: Date.now(),
          createUserId: user._id,
        },
      });
      return { _id: result._id };
    }
    case 'removeAnniversary':
      await db.collection(ANNIVERSARIES_COLLECTION).doc(data.id).remove();
      return { success: true };
    case 'addWish': {
      const result = await db.collection(WISHES_COLLECTION).add({
        data: {
          content: data.content,
          isCompleted: false,
          completedTime: '',
          createTime: Date.now(),
          createUserId: user._id,
        },
      });
      return { _id: result._id };
    }
    case 'toggleWish': {
      const current = await db.collection(WISHES_COLLECTION).doc(data.id).get();
      const isCompleted = !current.data.isCompleted;
      await db.collection(WISHES_COLLECTION).doc(data.id).update({
        data: {
          isCompleted,
          completedTime: isCompleted ? data.completedTime || '' : '',
        },
      });
      return { success: true };
    }
    case 'removeWish':
      await db.collection(WISHES_COLLECTION).doc(data.id).remove();
      return { success: true };
    case 'getSpaceData':
      return getSpaceData();
    case 'getPetData':
      return getPetData();
    case 'feedPet':
      return feedPet(data.petId);
    case 'interactPet':
      return interactPet(data.petId, data.interactionType);
    case 'changePetSkin':
      return changePetSkin(data.petId);
    case 'saveReminderSettings':
      return saveReminderSettings(data);
    case 'getDiaryData':
      return getDiaryData(data.month);
    case 'saveSpace':
      return saveSpacePatch({
        spaceName: data.spaceName,
        partnerA: data.partnerA,
        partnerB: data.partnerB,
        intro: data.intro,
      });
    case 'clearAllData': {
      const removedMoments = await removeAllDocuments(MOMENTS_COLLECTION);
      const allFileIds = removedMoments.reduce((result, item) => result.concat(item.images || []), []);
      if (allFileIds.length) {
        await cloud.deleteFile({ fileList: allFileIds });
      }
      await removeAllDocuments(ANNIVERSARIES_COLLECTION);
      await removeAllDocuments(WISHES_COLLECTION);
      await saveSpacePatch(buildDefaultSpace());
      return { success: true };
    }
    default:
      throw new Error(`UNKNOWN_ACTION:${action}`);
  }
};