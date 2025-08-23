import { z } from "zod";
import { normalizeUsername } from "./normalize";
import { RE_PRICE, RE_TG_USER, RE_GENERIC, RE_TIKTOK, RE_MONTH } from "./regex";

// ملاحظات:
// - نخلي الأكواد بالmessage حتى نترجمها بـ i18n (مثال: errors.PRICE, errors.TG ...)
// - نطبق superRefine للشرطيات المركّبة بين الحقول

const baseCommon = {
  price: z.string().regex(RE_PRICE, "PRICE"),
  currency: z.enum(["TON", "USDT"]),
  description: z.string().optional(),
};

// -------- Username --------
export const usernameSchema = z
  .object({
    type: z.literal("username"),
    platform: z.enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"]),
    username: z.preprocess((v) => normalizeUsername(String(v ?? "")), z.string().min(1, "USERNAME_REQ")),
    tgUserType: z.enum(["NFT", "NORMAL"]).optional(),
    ...baseCommon,
  })
  .superRefine((val, ctx) => {
    const u = String(val.username || "");

    if (val.platform === "telegram") {
      if (!RE_TG_USER.test(u)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TG", path: ["username"] });
      }
      if (!val.tgUserType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TG_USER_TYPE_REQ", path: ["tgUserType"] });
      }
    } else if (val.platform === "tiktok") {
      if (!RE_TIKTOK.test(u)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TT", path: ["username"] });
      }
    } else {
      if (!RE_GENERIC.test(u)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GEN", path: ["username"] });
      }
    }
  });

// -------- Account --------
export const accountSchema = z.object({
  type: z.literal("account"),
  platform: z.enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"]),
  username: z.preprocess((v) => normalizeUsername(String(v ?? "")), z.string().regex(RE_GENERIC, "GEN")),
  createdAt: z.string().regex(RE_MONTH, "MONTH"),
  followersCount: z.coerce.number().min(0).optional(),
  ...baseCommon,
});

// -------- Channel --------
export const channelSchema = z
  .object({
    type: z.literal("channel"),
    channelMode: z.enum(["subscribers", "gifts"]),
    link: z.string().optional(),
    channelUsername: z.string().optional(),
    subscribersCount: z.coerce.number().min(1).optional(),
    giftsCount: z.coerce.number().min(1).optional(),
    giftKind: z.enum(["upgraded", "regular", "both"]).optional(),
    ...baseCommon,
  })
  .superRefine((val, ctx) => {
    const link = val.link?.trim();
    const uname = val.channelUsername?.trim();

    if (!link && !uname) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NEED_LINK_OR_USER", path: ["link"] });
      return;
    }

    const candidate = normalizeUsername(link || uname || "");
    if (!RE_TG_USER.test(candidate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "TG",
        path: link ? ["link"] : ["channelUsername"],
      });
    }

    if (val.channelMode === "subscribers") {
      if (!val.subscribersCount || Number(val.subscribersCount) < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SUBS", path: ["subscribersCount"] });
      }
    } else {
      if (!val.giftsCount || Number(val.giftsCount) < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GIFS", path: ["giftsCount"] });
      }
      if (!val.giftKind) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GIFT_KIND", path: ["giftKind"] });
      }
    }
  });

// -------- Service --------
// ✅ target مطابق للباك: "telegram" وليس "telegram_channel/group"
export const serviceSchema = z
  .object({
    type: z.literal("service"),
    serviceType: z.enum(["followers", "members", "boost_channel", "boost_group"]),
    target: z.enum(["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"]),
    count: z.coerce.number().min(1, "COUNT_MIN"),
    ...baseCommon,
  })
  .superRefine((val, ctx) => {
    // followers: فقط instagram/twitter
    if (val.serviceType === "followers" && !["instagram", "twitter"].includes(val.target)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TARGET_MISMATCH", path: ["target"] });
    }
    // members/boost_channel/boost_group: لازم telegram
    if (["members", "boost_channel", "boost_group"].includes(val.serviceType) && val.target !== "telegram") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TARGET_MISMATCH", path: ["target"] });
    }
  });