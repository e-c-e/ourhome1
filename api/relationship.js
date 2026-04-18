import { callCloudFunction, uploadImagesToCloud } from '../utils/cloud';

export function loginToSpace() {
  return callCloudFunction('auth');
}

export function fetchHomeData() {
  return callCloudFunction('relationship', { action: 'getHomeData' });
}

export function fetchMomentDetail(id) {
  return callCloudFunction('relationship', {
    action: 'getMomentDetail',
    data: { id },
  });
}

export function deleteMoment(id) {
  return callCloudFunction('relationship', {
    action: 'deleteMoment',
    data: { id },
  });
}

export function updateRelationshipStartDate(startDate) {
  return callCloudFunction('relationship', {
    action: 'setStartDate',
    data: { startDate },
  }).then(async (result) => {
    const verifyResult = await fetchHomeData();
    const savedStartDate = (verifyResult.space && verifyResult.space.startDate) || '';

    if (savedStartDate !== startDate) {
      throw new Error('在一起日期未成功写入云数据库，请重新部署 relationship 云函数后再试');
    }

    return {
      ...result,
      startDate: savedStartDate,
    };
  });
}

export function fetchMemorialData() {
  return callCloudFunction('relationship', { action: 'getMemorialData' });
}

export function addAnniversary(name, date) {
  return callCloudFunction('relationship', {
    action: 'addAnniversary',
    data: { name, date },
  });
}

export function removeAnniversary(id) {
  return callCloudFunction('relationship', {
    action: 'removeAnniversary',
    data: { id },
  });
}

export function addWish(content) {
  return callCloudFunction('relationship', {
    action: 'addWish',
    data: { content },
  });
}

export function toggleWish(id, completedTime) {
  return callCloudFunction('relationship', {
    action: 'toggleWish',
    data: { id, completedTime },
  });
}

export function removeWish(id) {
  return callCloudFunction('relationship', {
    action: 'removeWish',
    data: { id },
  });
}

export async function createMoment(payload) {
  const uploadedImages = await uploadImagesToCloud(payload.images || []);
  return callCloudFunction('relationship', {
    action: 'createMoment',
    data: {
      ...payload,
      images: uploadedImages,
    },
  });
}

export function fetchSpaceData() {
  return callCloudFunction('relationship', { action: 'getSpaceData' });
}

export function saveSpaceProfile(profile) {
  return callCloudFunction('relationship', {
    action: 'saveSpace',
    data: profile,
  });
}

export function clearCloudData() {
  return callCloudFunction('relationship', { action: 'clearAllData' });
}