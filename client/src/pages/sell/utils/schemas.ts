import { z } from "zod";
import { normalizeUsername } from "./normalize";
import { RE_PRICE, RE_TG_USER, RE_GENERIC, RE_TIKTOK, RE_MONTH } from "./regex";

const baseCommon = {
  price: z.string().regex(RE_PRICE, "PRICE"),
  currency: z.enum(["TON","USDT"]),
  description: z.string().optional(),
};

export const usernameSchema = z.object({
  type: z.literal("username"),
  platform: z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]),
  username: z.preprocess((v)=>normalizeUsername(String(v??"")), z.string().min(1)),
  tgUserType: z.enum(["NFT","NORMAL"]).optional(),
  ...baseCommon,
}).superRefine((val, ctx)=>{
  const u = String(val.username||"");
  if (val.platform==="telegram") {
    if (!RE_TG_USER.test(u)) ctx.addIssue({code:z.ZodIssueCode.custom, message:"TG", path:["username"]});
  } else if (val.platform==="tiktok") {
    if (!RE_TIKTOK.test(u)) ctx.addIssue({code:z.ZodIssueCode.custom, message:"TT", path:["username"]});
  } else {
    if (!RE_GENERIC.test(u)) ctx.addIssue({code:z.ZodIssueCode.custom, message:"GEN", path:["username"]});
  }
});

export const accountSchema = z.object({
  type: z.literal("account"),
  platform: z.enum(["telegram","twitter","instagram","discord","snapchat","tiktok"]),
  username: z.preprocess((v)=>normalizeUsername(String(v??"")), z.string().regex(RE_GENERIC,"GEN")),
  createdAt: z.string().regex(RE_MONTH,"MONTH"),
  followersCount: z.coerce.number().min(0).optional(),
  ...baseCommon,
});

export const channelSchema = z.object({
  type: z.literal("channel"),
  channelMode: z.enum(["subscribers","gifts"]),
  link: z.string().optional(),
  channelUsername: z.string().optional(),
  subscribersCount: z.coerce.number().min(1).optional(),
  giftsCount: z.coerce.number().min(1).optional(),
  giftKind: z.enum(["upgraded","regular","both"]).optional(),
  ...baseCommon,
}).superRefine((val, ctx)=>{
  const link = val.link?.trim();
  const uname = val.channelUsername?.trim();
  if (!link && !uname) {
    ctx.addIssue({code:z.ZodIssueCode.custom, message:"NEED_LINK_OR_USER", path:["link"]});
    return;
  }
  const candidate = normalizeUsername(link || uname || "");
  if (!RE_TG_USER.test(candidate)) {
    ctx.addIssue({code:z.ZodIssueCode.custom, message:"TG", path: link?["link"]:["channelUsername"]});
  }
  if (val.channelMode==="subscribers") {
    if (!val.subscribersCount || Number(val.subscribersCount)<1)
      ctx.addIssue({code:z.ZodIssueCode.custom, message:"SUBS", path:["subscribersCount"]});
  } else {
    if (!val.giftsCount || Number(val.giftsCount)<1)
      ctx.addIssue({code:z.ZodIssueCode.custom, message:"GIFS", path:["giftsCount"]});
    if (!val.giftKind)
      ctx.addIssue({code:z.ZodIssueCode.custom, message:"GIFT_KIND", path:["giftKind"]});
  }
});

export const serviceSchema = z.object({
  type: z.literal("service"),
  serviceType: z.enum(["followers","members","boost_channel","boost_group"]),
  target: z.enum(["instagram","twitter","telegram_channel","telegram_group"]),
  count: z.coerce.number().min(1),
  ...baseCommon,
});
