export async function ensureAuthorizedPage() {
  const app = getApp();
  const authResult = await app.ensureAuthorized();

  if (authResult.authorized) return authResult;

  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  if (currentPage && currentPage.route !== 'pages/auth/index') {
    wx.reLaunch({
      url: '/pages/auth/index',
    });
  }

  return null;
}