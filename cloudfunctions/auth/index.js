const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const USERS_COLLECTION = 'users';
const SPACE_COLLECTION = 'space';
const MOMENTS_COLLECTION = 'moments';
const ANNIVERSARIES_COLLECTION = 'anniversaries';
const WISHES_COLLECTION = 'wishes';
const NOTIFICATIONS_COLLECTION = 'notifications';
const SPACE_DOC_ID = 'main';
const MAX_SPACE_MEMBERS = 2;

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
  const presets = [
    {
      id: 'pet-sugar',
      name: '奶糖',
      species: 'cat',
      avatar: '🐱',
      mood: '等你抱抱',
      intimacy: 32,
      satiety: 76,
    },
    {
      id: 'pet-chestnut',
      name: '栗子',
      species: 'dog',
      avatar: '🐶',
      mood: '想一起散步',
      intimacy: 28,
      satiety: 72,
    },
  ];

  const preset = presets[index] || presets[0];
  return {
    ...preset,
    skinIndex: 0,
    lastFedAt: 0,
    lastInteractAt: 0,
    updatedAt: Date.now(),
  };
}

function isCollectionMissingError(error) {
  const message = `${(error && error.message) || ''} ${(error && error.errMsg) || ''}`;
  return message.includes('database collection not exists') || message.includes('DATABASE_COLLECTION_NOT_EXIST');
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

async function ensureSpaceDocument() {
  const collection = db.collection(SPACE_COLLECTION);

  try {
    await collection.doc(SPACE_DOC_ID).get();
  } catch (error) {
    await collection.doc(SPACE_DOC_ID).set({
      data: buildDefaultSpace(),
    });
  }
}

async function ensureCollectionCreated(collectionName) {
  const collection = db.collection(collectionName);
  const marker = `__bootstrap__${Date.now()}`;
  const payload = {
    bootstrap: true,
    createdAt: Date.now(),
  };

  if (collectionName === MOMENTS_COLLECTION) {
    payload.title = 'bootstrap';
    payload.content = '';
    payload.date = '';
    payload.mood = '日常';
    payload.images = [];
    payload.cover = '';
    payload.createUserId = marker;
    payload.createUserRole = 'system';
    payload.updatedAt = Date.now();
  }

  if (collectionName === ANNIVERSARIES_COLLECTION) {
    payload.name = 'bootstrap';
    payload.date = '';
    payload.createUserId = marker;
  }

  if (collectionName === WISHES_COLLECTION) {
    payload.content = 'bootstrap';
    payload.isCompleted = false;
    payload.completedTime = '';
    payload.createTime = Date.now();
    payload.createUserId = marker;
  }

  const { _id } = await collection.add({ data: payload });
  await collection.doc(_id).remove();
}

async function ensureCollectionsReady() {
  const spaceDoc = await db.collection(SPACE_COLLECTION).doc(SPACE_DOC_ID).get();

  try {
    await ensureCollectionCreated(NOTIFICATIONS_COLLECTION);
  } catch (error) {
    if (!isCollectionMissingError(error)) {
      throw error;
    }
  }

  if (spaceDoc.data.collectionsReady) return;

  await ensureCollectionCreated(MOMENTS_COLLECTION);
  await ensureCollectionCreated(ANNIVERSARIES_COLLECTION);
  await ensureCollectionCreated(WISHES_COLLECTION);

  await db.collection(SPACE_COLLECTION).doc(SPACE_DOC_ID).update({
    data: {
      collectionsReady: true,
      updatedAt: Date.now(),
    },
  });
}

async function safeUserLookup(openid) {
  try {
    return await db.collection(USERS_COLLECTION).where({ openid }).limit(1).get();
  } catch (error) {
    return { data: [] };
  }
}

async function safeUserCount() {
  try {
    return await db.collection(USERS_COLLECTION).count();
  } catch (error) {
    return { total: 0 };
  }
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    await ensureSpaceDocument();
    await ensureCollectionsReady();

    const users = db.collection(USERS_COLLECTION);
    const userResult = await safeUserLookup(OPENID);
    if (userResult.data.length) {
      const [user] = userResult.data;
      return {
        authorized: true,
        user: {
          _id: user._id,
          openid: user.openid,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl || '',
          role: user.role,
        },
        message: '欢迎回来',
      };
    }

    const countResult = await safeUserCount();
    if (countResult.total >= MAX_SPACE_MEMBERS) {
      return {
        authorized: false,
        message: '这个空间已经绑定了两位成员，请使用已授权账号进入。',
      };
    }

    const role = countResult.total === 0 ? 'owner' : 'partner';
    const nickname = role === 'owner' ? '我' : '你';
    const newUser = {
      openid: OPENID,
      nickname,
      avatarUrl: '',
      role,
      subscriptions: {},
      lastMiniProgramVisitAt: 0,
      lastMiniProgramVisitDate: '',
      lastMiniProgramPath: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const createResult = await users.add({ data: newUser });

    return {
      authorized: true,
      user: {
        ...newUser,
        _id: createResult._id,
      },
      message: role === 'owner' ? '已创建第一位空间成员' : '已加入第二位空间成员',
    };
  } catch (error) {
    if (isCollectionMissingError(error)) {
      throw new Error('请先在云开发控制台的数据库中手动创建集合：users、space、moments、anniversaries、wishes、notifications');
    }
    throw error;
  }
};