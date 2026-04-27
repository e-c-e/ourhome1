const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const SPACE_COLLECTION = 'space';
const USERS_COLLECTION = 'users';
const MOMENTS_COLLECTION = 'moments';
const ANNIVERSARIES_COLLECTION = 'anniversaries';
const WISHES_COLLECTION = 'wishes';
const NOTIFICATIONS_COLLECTION = 'notifications';
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

function isCollectionMissingError(error) {
  const message = `${(error && error.message) || ''} ${(error && error.errMsg) || ''}`;
  return message.includes('database collection not exists') || message.includes('DATABASE_COLLECTION_NOT_EXIST');
}

function formatTimeText(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatClockText(timestamp = 0) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function toDateValue(dateText) {
  return new Date(`${dateText}T00:00:00`).getTime();
}

function getDaysLeftFromToday(targetDate, today = formatDate()) {
  if (!targetDate) return 0;
  return Math.max(0, Math.round((toDateValue(targetDate) - toDateValue(today)) / (1000 * 60 * 60 * 24)));
}

function getNextAnnualDate(targetDate, today = formatDate()) {
  if (!targetDate) return '';
  const todayDate = new Date(`${today}T00:00:00`);
  const sourceDate = new Date(`${targetDate}T00:00:00`);
  let nextDate = new Date(todayDate.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
  if (nextDate.getTime() < todayDate.getTime()) {
    nextDate = new Date(todayDate.getFullYear() + 1, sourceDate.getMonth(), sourceDate.getDate());
  }
  return formatDate(nextDate);
}

function getDefaultDailyTips() {
  return [
    '今天记得多喝水，也记得多说一句想你。',
    '如果今天有一点点开心，别忘了给对方留个记录。',
    '今晚适合问一句：今天过得怎么样？',
    '先把普通的一天写下来，它以后会变成很特别的回忆。',
    '如果今天有点累，就给彼此留一句轻一点的晚安。',
    '今天的小提示：忙完也记得照顾好自己。',
    '哪怕只是一张照片，今天也值得被认真记住。',
  ];
}

function normalizeDailyTipsText(text = '') {
  return `${text}`
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join('\n');
}

function getDailyTipList(space = {}) {
  const customTips = normalizeDailyTipsText(space.dailyTipsText || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return customTips.length ? customTips : getDefaultDailyTips();
}

function getDailyTip(space = {}, today = formatDate()) {
  const tips = getDailyTipList(space);
  const numeric = Number(today.replace(/-/g, '')) || Date.now();
  return tips[numeric % tips.length];
}

function getSenderDisplayName(sender = {}) {
  return sender.nickname || (sender.role === 'owner' ? '我' : '你') || '对方';
}

function getMomentReminderContent(moment = {}) {
  const sourceText = `${moment.title || ''}`.trim() || `${moment.content || ''}`.trim() || '给你留了一条新的小记录';
  return sourceText.slice(0, 20);
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
    dailyTipsText: '',
    activityFeed: [],
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
  const activityFeed = Array.isArray(source.activityFeed) ? source.activityFeed : [];

  return {
    ...base,
    ...source,
    dailyTipsText: normalizeDailyTipsText(source.dailyTipsText || ''),
    activityFeed,
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

function normalizeMomentNotificationSubscription(record = {}) {
  return {
    enabled: Boolean(record.enabled),
    templateId: record.templateId || '',
    status: record.status || 'unknown',
    updatedAt: Number(record.updatedAt) || 0,
    lastAcceptedAt: Number(record.lastAcceptedAt) || 0,
  };
}

function normalizeNotificationRecord(item = {}) {
  return {
    id: item._id,
    type: item.type || 'moment-created',
    title: item.title || '你收到一条新提醒',
    content: item.content || '',
    momentId: item.momentId || '',
    senderUserId: item.senderUserId || '',
    senderUserRole: item.senderUserRole || '',
    senderNickname: item.senderNickname || '',
    targetUserId: item.targetUserId || '',
    isRead: Boolean(item.isRead),
    createdAt: Number(item.createdAt) || 0,
    createdAtText: formatTimeText(item.createdAt),
    readAt: Number(item.readAt) || 0,
    page: item.page || 'pages/home/index',
    channel: {
      inApp: item.channel ? item.channel.inApp !== false : true,
      subscribeAttempted: Boolean(item.channel && item.channel.subscribeAttempted),
      subscribeSent: Boolean(item.channel && item.channel.subscribeSent),
      subscribeError: (item.channel && item.channel.subscribeError) || '',
    },
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
    likeActivities: Array.isArray(item.likeActivities) ? item.likeActivities : [],
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

async function resolveCloudFileUrls(fileList = []) {
  const normalized = Array.isArray(fileList) ? fileList.filter(Boolean) : [];
  const cloudFileIds = normalized.filter((item) => typeof item === 'string' && item.startsWith('cloud://'));

  if (!cloudFileIds.length) {
    return normalized;
  }

  const tempUrlMap = {};
  for (let index = 0; index < cloudFileIds.length; index += 50) {
    const batch = cloudFileIds.slice(index, index + 50);
    try {
      const result = await cloud.getTempFileURL({
        fileList: batch,
      });
      const tempFiles = (result && result.fileList) || [];
      tempFiles.forEach((item) => {
        if (item.fileID && item.tempFileURL) {
          tempUrlMap[item.fileID] = item.tempFileURL;
        }
      });
    } catch (error) {
      return normalized;
    }
  }

  return normalized.map((item) => tempUrlMap[item] || item);
}

async function prepareMomentForClient(item = {}, user) {
  const record = normalizeMomentRecord(item, user);
  const images = Array.isArray(record.images) ? record.images : [];
  const shouldResolveCover = record.cover && !images.includes(record.cover);
  const sourceList = shouldResolveCover ? images.concat(record.cover) : images;
  const resolvedList = await resolveCloudFileUrls(sourceList);
  const resolvedImages = resolvedList.slice(0, images.length);
  const resolvedCover = shouldResolveCover
    ? (resolvedList[resolvedList.length - 1] || record.cover || resolvedImages[0] || '')
    : (resolvedImages[images.indexOf(record.cover)] || record.cover || resolvedImages[0] || '');

  return {
    ...record,
    images: resolvedImages,
    cover: resolvedCover,
    previewImages: resolvedImages.slice(0, 3),
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

async function ensureNotificationCollection() {
  try {
    const marker = await db.collection(NOTIFICATIONS_COLLECTION).add({
      data: {
        bootstrap: true,
        createdAt: Date.now(),
      },
    });
    await db.collection(NOTIFICATIONS_COLLECTION).doc(marker._id).remove();
  } catch (error) {
    if (!isCollectionMissingError(error)) {
      throw error;
    }
    throw error;
  }
}

async function getPartnerUser(user) {
  try {
    const result = await db.collection(USERS_COLLECTION).limit(2).get();
    const users = result.data || [];
    return users.find((item) => item._id !== user._id) || null;
  } catch (error) {
    return null;
  }
}

function getRouteLabel(route = '') {
  const routeMap = {
    'pages/home/index': '首页',
    'pages/wall/index': '时光墙',
    'pages/anniversary/index': '纪念日',
    'pages/pet/index': '宠物岛',
    'pages/wishes/index': '心愿单',
    'pages/my/index': '我的',
    'pages/release/index': '记录今天',
    'pages/diary/index': '日历日记',
    'pages/moment/detail': '回忆详情',
    'pages/activity/index': '最近动态',
  };
  return routeMap[route] || '你们的空间';
}

function getRelativeDayLabel(timestamp, today = formatDate()) {
  if (!timestamp) return '';
  const targetDate = formatDate(new Date(timestamp));
  if (targetDate === today) return '今天';

  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (targetDate === formatDate(yesterday)) return '昨天';

  return targetDate;
}

function normalizeActivityItem(item = {}) {
  const createdAt = Number(item.createdAt) || Date.now();
  return {
    id: item.id || createId('activity'),
    type: item.type || 'unknown',
    badge: item.badge || '动态',
    title: item.title || '有一条新的动态',
    desc: item.desc || '',
    userId: item.userId || '',
    userRole: item.userRole || 'partner',
    userNickname: item.userNickname || (item.userRole === 'owner' ? '我' : '你'),
    momentId: item.momentId || '',
    route: item.route || '',
    routeLabel: item.routeLabel || getRouteLabel(item.route),
    createdAt,
    createdAtText: formatTimeText(createdAt),
    timeText: formatClockText(createdAt),
  };
}

async function appendActivityItem(activity = {}) {
  const space = await getSpace();
  const activityFeed = [normalizeActivityItem(activity)]
    .concat(Array.isArray(space.activityFeed) ? space.activityFeed.map(normalizeActivityItem) : [])
    .slice(0, 80);
  await saveSpacePatch({ activityFeed });
  return activityFeed;
}

async function trackMiniProgramVisit(path = 'pages/home/index', user) {
  const now = Date.now();
  const today = formatDate(new Date(now));
  await db.collection(USERS_COLLECTION).doc(user._id).update({
    data: {
      lastMiniProgramVisitAt: now,
      lastMiniProgramVisitDate: today,
      lastMiniProgramPath: path,
      updatedAt: now,
    },
  });
  await appendActivityItem({
    type: 'visit',
    badge: '进入小程序',
    title: `${getSenderDisplayName(user)}进入了小程序`,
    desc: `在 ${formatTimeText(now)} 进入了小程序，落在${getRouteLabel(path)}。`,
    userId: user._id,
    userRole: user.role,
    userNickname: getSenderDisplayName(user),
    route: path,
    routeLabel: getRouteLabel(path),
    createdAt: now,
  });
  return {
    success: true,
    visitedAt: now,
    path,
  };
}

function buildPartnerVisitSummary(partnerUser, today = formatDate()) {
  if (!partnerUser) {
    return {
      title: '今天还没有等到对方进入小程序',
      desc: '等对方进入小程序后，这里会显示进入时间。',
      hasVisitedToday: false,
      items: [],
    };
  }

  const nickname = partnerUser.nickname || (partnerUser.role === 'owner' ? '我' : '你') || '对方';
  const visitAt = Number(partnerUser.lastMiniProgramVisitAt) || 0;
  const relativeDay = getRelativeDayLabel(visitAt, today);
  const hasVisitedToday = relativeDay === '今天';
  if (!visitAt) {
    return {
      title: `${nickname}今天还没有进入小程序`,
      desc: '等对方进入后，这里会记录今天进入的时间。',
      hasVisitedToday: false,
      items: [],
    };
  }

  const visitItem = {
    id: `visit-${visitAt}`,
    timeText: formatClockText(visitAt),
    routeLabel: getRouteLabel(partnerUser.lastMiniProgramPath),
    dayLabel: relativeDay,
  };

  if (relativeDay === '昨天') {
    return {
      title: `${nickname}昨天进入过小程序`,
      desc: `昨天 ${formatClockText(visitAt)} 进入，在${getRouteLabel(partnerUser.lastMiniProgramPath)}停留。`,
      hasVisitedToday: false,
      timeText: formatClockText(visitAt),
      items: [visitItem],
    };
  }

  if (!hasVisitedToday) {
    return {
      title: `${nickname}今天还没有进入小程序`,
      desc: `上一次是在 ${relativeDay} ${formatClockText(visitAt)} 进入。`,
      hasVisitedToday: false,
      timeText: formatClockText(visitAt),
      items: [visitItem],
    };
  }

  return {
    title: `${nickname}今天进入过小程序`,
    desc: `今天 ${formatClockText(visitAt)} 进入，在${getRouteLabel(partnerUser.lastMiniProgramPath)}停留。`,
    hasVisitedToday: true,
    timeText: formatClockText(visitAt),
    items: [visitItem],
  };
}

function buildAnniversarySummary(space, anniversaries, today = formatDate()) {
  const candidates = [];
  if (space && space.startDate) {
    candidates.push({
      title: '在一起纪念日',
      date: getNextAnnualDate(space.startDate, today),
    });
  }
  anniversaries.forEach((item) => {
    if (item.date) {
      candidates.push({
        title: item.name || '纪念日',
        date: getNextAnnualDate(item.date, today),
      });
    }
  });

  if (!candidates.length) {
    return {
      title: '还没有设置纪念日',
      desc: '去纪念日页设一个重要的日子吧。',
      daysLeft: 0,
    };
  }

  const nextItem = candidates
    .map((item) => ({
      ...item,
      daysLeft: getDaysLeftFromToday(item.date, today),
    }))
    .sort((left, right) => left.daysLeft - right.daysLeft)[0];

  if (nextItem.daysLeft > 30) {
    return {
      title: `下一次重要节点是${nextItem.title}`,
      desc: `还有 ${nextItem.daysLeft} 天，进入 30 天内会开始提醒你。`,
      daysLeft: nextItem.daysLeft,
      name: nextItem.title,
      reminderActive: false,
    };
  }

  return {
    title: nextItem.daysLeft === 0 ? `今天就是${nextItem.title}` : `还有 ${nextItem.daysLeft} 天到${nextItem.title}`,
    desc: nextItem.daysLeft === 0 ? '别忘了给今天留一条正式的纪念。' : `已经进入提醒期，记得提前准备 ${nextItem.title}。`,
    daysLeft: nextItem.daysLeft,
    name: nextItem.title,
    reminderActive: true,
  };
}

function buildLatestPartnerActivity(activityFeed = [], partnerUser) {
  const partnerUserId = partnerUser ? partnerUser._id : '';
  const partnerFeed = (Array.isArray(activityFeed) ? activityFeed : [])
    .map(normalizeActivityItem)
    .filter((item) => item.userId === partnerUserId && item.type !== 'visit')
    .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))
    .slice(0, 4);

  if (!partnerFeed.length) {
    return {
      title: '今天还没有新的互动',
      desc: '可以先写一条记录，或者去时光墙看看对方。',
      createdAt: 0,
      type: 'empty',
      items: [],
    };
  }

  const latestItem = partnerFeed[0];
  const relativeDay = getRelativeDayLabel(latestItem.createdAt);
  if (relativeDay === '昨天') {
    const yesterdayTitleMap = {
      visit: '对方昨天进入过小程序',
      like: '对方昨天点过赞',
      comment: '对方昨天写过评论',
      moment: '对方昨天写过记录',
    };

    return {
      ...latestItem,
      title: yesterdayTitleMap[latestItem.type] || '对方昨天有过动态',
      desc: `昨天 ${latestItem.timeText}，${latestItem.desc}`,
      items: partnerFeed,
    };
  }

  if (relativeDay && relativeDay !== '今天') {
    return {
      ...latestItem,
      title: `对方最近一次动态在${relativeDay}`,
      desc: `${relativeDay} ${latestItem.timeText}，${latestItem.desc}`,
      items: partnerFeed,
    };
  }

  return {
    ...latestItem,
    items: partnerFeed,
  };
}

async function getActivityFeed() {
  const space = await getSpace();
  return {
    activityFeed: (space.activityFeed || []).map(normalizeActivityItem).filter((item) => item.type !== 'visit'),
  };
}

async function getNotificationsForUser(user, limit = 10) {
  try {
    const result = await db.collection(NOTIFICATIONS_COLLECTION)
      .where({ targetUserId: user._id })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return (result.data || []).map(normalizeNotificationRecord);
  } catch (error) {
    return [];
  }
}

function buildSubscribeMessageData(notificationConfig = {}, moment = {}, sender = {}) {
  const fields = notificationConfig.fields || {};
  const payload = {};
  const timeField = fields.time;
  const contentField = fields.content || fields.title;
  const senderField = fields.sender || fields.note;
  const senderName = getSenderDisplayName(sender);

  if (contentField) {
    payload[contentField] = {
      value: getMomentReminderContent(moment),
    };
  }
  if (timeField) {
    payload[timeField] = {
      value: formatTimeText(moment.createdAt || Date.now()),
    };
  }
  if (senderField) {
    payload[senderField] = {
      value: `${senderName}刚刚想你`.slice(0, 20),
    };
  }

  return payload;
}

async function trySendMomentSubscribeMessage(targetUser, sender, moment, notificationConfig = {}) {
  const subscription = normalizeMomentNotificationSubscription(
    targetUser && targetUser.subscriptions && targetUser.subscriptions.momentCreated,
  );
  const templateId = subscription.templateId || notificationConfig.templateId || '';

  if (!targetUser || !targetUser.openid || !subscription.enabled || !templateId) {
    return {
      attempted: false,
      sent: false,
      error: subscription.enabled ? 'TEMPLATE_NOT_CONFIGURED' : 'TARGET_NOT_SUBSCRIBED',
    };
  }

  try {
    await cloud.openapi.subscribeMessage.send({
      touser: targetUser.openid,
      templateId,
      page: notificationConfig.page || 'pages/home/index',
      miniprogramState: 'developer',
      lang: 'zh_CN',
      data: buildSubscribeMessageData(notificationConfig, moment, sender),
    });
    return {
      attempted: true,
      sent: true,
      error: '',
    };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      error: error.message || error.errMsg || 'SUBSCRIBE_SEND_FAILED',
    };
  }
}

async function createMomentNotification(moment, sender, notificationConfig = {}) {
  const targetUser = await getPartnerUser(sender);
  if (!targetUser) {
    return { created: false, reason: 'PARTNER_NOT_FOUND' };
  }

  const subscribeResult = await trySendMomentSubscribeMessage(targetUser, sender, moment, notificationConfig);
  const senderName = getSenderDisplayName(sender);
  const notification = {
    type: 'moment-created',
    title: `${senderName}给你留了一条新记录`,
    content: `刚刚把《${moment.title || '今天的记录'}》放进了你们的回忆里，点开看看。`,
    page: 'pages/home/index',
    momentId: moment._id,
    senderUserId: sender._id,
    senderUserRole: sender.role,
    senderNickname: senderName,
    targetUserId: targetUser._id,
    targetUserRole: targetUser.role,
    targetOpenid: targetUser.openid,
    isRead: false,
    createdAt: Date.now(),
    readAt: 0,
    channel: {
      inApp: true,
      subscribeAttempted: subscribeResult.attempted,
      subscribeSent: subscribeResult.sent,
      subscribeError: subscribeResult.error || '',
    },
  };

  try {
    await ensureNotificationCollection();
    const result = await db.collection(NOTIFICATIONS_COLLECTION).add({ data: notification });
    return {
      created: true,
      notificationId: result._id,
      subscribeResult,
    };
  } catch (error) {
    return {
      created: false,
      reason: isCollectionMissingError(error) ? 'NOTIFICATION_COLLECTION_MISSING' : 'NOTIFICATION_CREATE_FAILED',
      subscribeResult,
      error: error.message || error.errMsg || '',
    };
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
  const partnerUser = await getPartnerUser(user);
  const moments = await safeList(MOMENTS_COLLECTION, { orderField: 'createdAt', orderDirection: 'desc', limit: 100 });
  const anniversaries = await safeList(ANNIVERSARIES_COLLECTION, { orderField: 'date', orderDirection: 'asc', limit: 50 });
  const notifications = await getNotificationsForUser(user, 10);
  const unreadNotificationCount = notifications.filter((item) => !item.isRead).length;

  const homeSnapshot = {
    partnerVisit: buildPartnerVisitSummary(partnerUser, formatDate()),
    dailyTip: getDailyTip(space, formatDate()),
    anniversary: buildAnniversarySummary(space, anniversaries, formatDate()),
    latestActivity: buildLatestPartnerActivity(space.activityFeed, partnerUser),
  };

  return {
    space,
    homeSnapshot,
    notifications,
    unreadNotificationCount,
    momentNotification: normalizeMomentNotificationSubscription(user.subscriptions && user.subscriptions.momentCreated),
    moments: await Promise.all(moments.map((item) => prepareMomentForClient(item, user))),
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
  const createdMoment = {
    ...moment,
    _id: createResult._id,
  };
  const notification = await createMomentNotification(createdMoment, user, data.notificationConfig || {});
  await appendActivityItem({
    type: 'moment',
    badge: '写了记录',
    title: `${getSenderDisplayName(user)}发布了一条记录`,
    desc: `《${createdMoment.title || '今天的记录'}》已经放进回忆里了。`,
    userId: user._id,
    userRole: user.role,
    userNickname: getSenderDisplayName(user),
    momentId: createdMoment._id,
    route: 'pages/release/index',
    routeLabel: getRouteLabel('pages/release/index'),
    createdAt: createdMoment.createdAt,
  });
  return {
    moment: await prepareMomentForClient(createdMoment, user),
    notification,
  };
}

async function saveMomentNotificationSubscription(data, user) {
  const current = normalizeMomentNotificationSubscription(user.subscriptions && user.subscriptions.momentCreated);
  const status = data.status || 'unknown';
  const nextSubscription = {
    ...current,
    templateId: data.templateId || current.templateId || '',
    status,
    enabled: status === 'accept',
    updatedAt: Date.now(),
    lastAcceptedAt: status === 'accept' ? Date.now() : current.lastAcceptedAt,
  };

  await db.collection(USERS_COLLECTION).doc(user._id).update({
    data: {
      subscriptions: {
        ...(user.subscriptions || {}),
        momentCreated: nextSubscription,
      },
      updatedAt: Date.now(),
    },
  });

  return {
    momentNotification: nextSubscription,
  };
}

async function markNotificationsRead(ids, user) {
  const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : [];

  if (targetIds.length) {
    await Promise.all(targetIds.map(async (id) => {
      try {
        const doc = await db.collection(NOTIFICATIONS_COLLECTION).doc(id).get();
        if (!doc.data || doc.data.targetUserId !== user._id) return;
        await db.collection(NOTIFICATIONS_COLLECTION).doc(id).update({
          data: {
            isRead: true,
            readAt: Date.now(),
          },
        });
      } catch (error) {
        return null;
      }
      return null;
    }));
  } else {
    const unread = await getNotificationsForUser(user, 50);
    const unreadIds = unread.filter((item) => !item.isRead).map((item) => item.id);
    await Promise.all(unreadIds.map((id) => db.collection(NOTIFICATIONS_COLLECTION).doc(id).update({
      data: {
        isRead: true,
        readAt: Date.now(),
      },
    })));
  }

  const notifications = await getNotificationsForUser(user, 10);
  return {
    notifications,
    unreadNotificationCount: notifications.filter((item) => !item.isRead).length,
  };
}

async function getMomentDetail(id, user) {
  const { data } = await db.collection(MOMENTS_COLLECTION).doc(id).get();
  return {
    moment: await prepareMomentForClient(data, user),
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

async function saveDailyTipsText(text = '') {
  const dailyTipsText = normalizeDailyTipsText(text);
  const space = await saveSpacePatch({ dailyTipsText });
  return {
    dailyTipsText: space.dailyTipsText,
    dailyTip: getDailyTip(space, formatDate()),
  };
}

async function toggleMomentLike(id, user) {
  const momentDoc = await db.collection(MOMENTS_COLLECTION).doc(id).get();
  const current = normalizeMomentRecord(momentDoc.data, user);
  const likeUserIds = current.likeUserIds || [];
  const likeActivities = Array.isArray(current.likeActivities) ? current.likeActivities : [];
  const likedByMe = likeUserIds.includes(user._id);
  const nextLikeUserIds = likedByMe ? likeUserIds.filter((item) => item !== user._id) : likeUserIds.concat(user._id);
  const nextLikeActivities = likedByMe
    ? likeActivities.filter((item) => item.userId !== user._id)
    : likeActivities
      .filter((item) => item.userId !== user._id)
      .concat([{
        id: createId('like'),
        userId: user._id,
        userRole: user.role,
        userNickname: user.nickname || (user.role === 'owner' ? '我' : '你'),
        createdAt: Date.now(),
      }]);

  await db.collection(MOMENTS_COLLECTION).doc(id).update({
    data: {
      likeUserIds: nextLikeUserIds,
      likeActivities: nextLikeActivities,
      updatedAt: Date.now(),
    },
  });

  if (!likedByMe) {
    await appendActivityItem({
      type: 'like',
      badge: '点了喜欢',
      title: `${getSenderDisplayName(user)}点了一个喜欢`,
      desc: `给《${current.title || '今天的记录'}》留了一个喜欢。`,
      userId: user._id,
      userRole: user.role,
      userNickname: getSenderDisplayName(user),
      momentId: id,
      route: 'pages/moment/detail',
      routeLabel: getRouteLabel('pages/moment/detail'),
      createdAt: Date.now(),
    });
  }

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

  await appendActivityItem({
    type: 'comment',
    badge: '写了评论',
    title: `${getSenderDisplayName(user)}写了一条评论`,
    desc: `在《${current.title || '今天的记录'}》里留了一句：${text}`.slice(0, 52),
    userId: user._id,
    userRole: user.role,
    userNickname: getSenderDisplayName(user),
    momentId: id,
    route: 'pages/moment/detail',
    routeLabel: getRouteLabel('pages/moment/detail'),
    createdAt: comment.createdAt,
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

  const moments = await Promise.all(data.map((item) => prepareMomentForClient(item, user)));
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
    case 'getActivityFeed':
      return getActivityFeed();
    case 'trackMiniProgramVisit':
      return trackMiniProgramVisit(data.path, user);
    case 'setStartDate':
      return saveSpacePatch({ startDate: data.startDate || '' });
    case 'createMoment':
      return createMoment(data, user);
    case 'saveMomentNotificationSubscription':
      return saveMomentNotificationSubscription(data, user);
    case 'markNotificationsRead':
      return markNotificationsRead(data.ids, user);
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
          isStored: false,
          completedTime: '',
          storedTime: '',
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
          isStored: isCompleted ? false : false,
          completedTime: isCompleted ? data.completedTime || '' : '',
          storedTime: isCompleted ? '' : '',
        },
      });
      return { success: true };
    }
    case 'setWishStored': {
      const current = await db.collection(WISHES_COLLECTION).doc(data.id).get();
      if (!current.data.isCompleted && data.isStored) {
        throw new Error('WISH_NOT_COMPLETED');
      }
      await db.collection(WISHES_COLLECTION).doc(data.id).update({
        data: {
          isStored: !!data.isStored,
          storedTime: data.isStored ? Date.now() : '',
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
    case 'saveDailyTipsText':
      return saveDailyTipsText(data.dailyTipsText);
    case 'getDiaryData':
      return getDiaryData(data.month);
    case 'saveSpace':
      return saveSpacePatch({
        spaceName: data.spaceName,
        partnerA: data.partnerA,
        partnerB: data.partnerB,
        intro: data.intro,
        dailyTipsText: data.dailyTipsText,
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