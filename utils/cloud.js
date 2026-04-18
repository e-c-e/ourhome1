import config from '../config';

let initialized = false;

function resolveEnvId() {
  if (!config.cloudEnvId || config.cloudEnvId === 'DYNAMIC_CURRENT_ENV') {
    return wx.cloud.DYNAMIC_CURRENT_ENV;
  }
  return config.cloudEnvId;
}

export async function initCloud() {
  if (initialized) return true;

  if (!wx.cloud) {
    throw new Error('当前基础库不支持云开发，请在微信开发者工具中开启云开发能力');
  }

  wx.cloud.init({
    env: resolveEnvId(),
    traceUser: true,
  });

  initialized = true;
  return true;
}

export async function callCloudFunction(name, data = {}) {
  await initCloud();

  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: ({ result }) => resolve(result),
      fail: reject,
    });
  });
}

function uploadSingleImage(filePath, index) {
  if (filePath.startsWith('cloud://')) return Promise.resolve(filePath);

  const extension = (filePath.match(/\.[^.?#]+$/) || ['.jpg'])[0];
  const cloudPath = `moments/${Date.now()}-${index}${extension}`;

  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: ({ fileID }) => resolve(fileID),
      fail: reject,
    });
  });
}

export async function uploadImagesToCloud(filePaths = []) {
  await initCloud();
  return Promise.all(filePaths.map((filePath, index) => uploadSingleImage(filePath, index)));
}