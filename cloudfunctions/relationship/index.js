const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const SPACE_COLLECTION = 'space';
const USERS_COLLECTION = 'users';
const MOMENTS_COLLECTION = 'moments';
const ANNIVERSARIES_COLLECTION = 'anniversaries';
const WISHES_COLLECTION = 'wishes';
const SPACE_DOC_ID = 'main';

function buildDefaultSpace() {
  return {
    spaceName: '我们的空间',
    partnerA: '我',
    partnerB: '你',
    intro: '把普通日子慢慢写成回忆。',
    startDate: '',
    collectionsReady: false,
    updatedAt: Date.now(),
  };
}

function sanitizeSpaceData(space = {}) {
  const { _id, _openid, ...rest } = space;
  return rest;
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
    return {
      ...buildDefaultSpace(),
      ...sanitizeSpaceData(data),
    };
  } catch (error) {
    const data = buildDefaultSpace();
    await db.collection(SPACE_COLLECTION).doc(SPACE_DOC_ID).set({ data });
    return data;
  }
}

async function saveSpacePatch(patch = {}) {
  const current = await getSpace();
  const nextData = {
    ...sanitizeSpaceData(current),
    ...patch,
    updatedAt: Date.now(),
  };
  await db.collection(SPACE_COLLECTION).doc(SPACE_DOC_ID).set({
    data: sanitizeSpaceData(nextData),
  });
  return sanitizeSpaceData(nextData);
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
  const moments = await safeList(MOMENTS_COLLECTION, { orderField: 'createdAt', orderDirection: 'desc', limit: 20 });
  return {
    space,
    moments,
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
    moment: {
      ...data,
      canDelete: data.createUserId === user._id,
      creatorLabel: data.createUserRole === 'owner' ? '我' : '你',
    },
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
    stats: {
      momentCount,
      anniversaryCount,
      wishCount,
      completedWishCount,
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