export const RE_PRICE = /^\d+(\.\d{1,9})?$/;
export const RE_TG_USER = /^[a-z0-9_]{5,32}$/;      // تيليجرام بدون .
export const RE_GENERIC = /^[a-z0-9._]{2,15}$/;     // تويتر/انستا/ديسكورد/سناب
export const RE_TIKTOK = /^[a-z0-9._]{3,15}$/;      // تيك توك 3–15
export const RE_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;  // YYYY-MM