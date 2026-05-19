export const getBrowserBrands = () => {
  const brands = navigator.userAgentData?.brands || [];
  return brands.map((brand) => brand.brand);
};

export const isMobileDevice = () => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  if (typeof navigator.userAgentData?.mobile === 'boolean') {
    return navigator.userAgentData.mobile;
  }

  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone|BlackBerry|Tablet/i.test(ua);
};

export const isChromeOrEdge = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const brands = getBrowserBrands();

  if (brands.length > 0) {
    const hasChrome = brands.includes('Google Chrome');
    const hasEdge = brands.includes('Microsoft Edge');
    return hasChrome || hasEdge;
  }

  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';

  const isEdge = /Edg\//.test(ua);
  const isChrome =
    /Chrome\//.test(ua) &&
    /Google Inc\.?/.test(vendor) &&
    !/Edg\//.test(ua) &&
    !/OPR\//.test(ua) &&
    !/Opera/.test(ua) &&
    !/SamsungBrowser/.test(ua) &&
    !/YaBrowser/.test(ua) &&
    !/Vivaldi/.test(ua) &&
    !/DuckDuckGo/.test(ua) &&
    !/QQBrowser/.test(ua) &&
    !/Quark/.test(ua) &&
    !/MicroMessenger/.test(ua);

  return isChrome || isEdge;
};

export const isDesktopChromeOrEdge = () => {
  return isChromeOrEdge() && !isMobileDevice();
};
