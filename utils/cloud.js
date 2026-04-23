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

  const invoke = () => new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: ({ result }) => resolve(result),
      fail: reject,
    });
  });

  try {
    return await invoke();
  } catch (error) {
    const message = (error && (error.errMsg || error.message)) || '';
    const isTimeout = /timeout/i.test(message);
    if (!isTimeout) {
      throw error;
    }

    try {
      return await invoke();
    } catch (retryError) {
      const wrappedError = new Error('云端响应超时，请重新部署云函数后再试一次');
      wrappedError.cause = retryError;
      throw wrappedError;
    }
  }
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