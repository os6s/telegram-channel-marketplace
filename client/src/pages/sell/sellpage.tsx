import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { telegramWebApp } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";
import UsernameForm from "./parts/UsernameForm";
import AccountForm from "./parts/AccountForm";
import ChannelForm from "./parts/ChannelForm";
import ServiceForm from "./parts/ServiceForm";
import { usernameSchema, accountSchema, channelSchema, serviceSchema } from "./utils/schemas";

const T = {
  ar: { title:"بيع / Sell", chooseType:"اختر نوع الإعلان", sellUsername:"بيع يوزر", sellAccount:"بيع حساب", sellChannel:"بيع", sellService:"بيع خدمة",
        platform:"المنصة", usernameLabel:"اسم/رابط", tgUserType:"نوع اليوزر", NFT:"NFT", NORMAL:"عادي",
        price:"السعر", currency:"العملة", desc:"الوصف (اختياري)", post:"نشر", back:"رجوع",
        channelMode:"نوع القناة", modeSubscribers:"قناة مشتركين", modeGifts:"قناة هدايا",
        channelLinkOpt:"رابط القناة (اختياري)", channelUserOpt:"يوزر القناة (اختياري)",
        subsCount:"عدد المشتركين", giftsCount:"عدد الهدايا", giftKind:"نوع الهدايا",
        upgraded:"مطوّرة", regular:"غير مطوّرة", both:"الاثنان",
        serviceType:"نوع الخدمة", followers:"متابعين", members:"مشتركين",
        boostCh:"تعزيز قناة تيليجرام", boostGp:"تعزيز مجموعة تيليجرام", target:"الهدف", count:"العدد" },
  en: { title:"Sell", chooseType:"Choose listing type", sellUsername:"Sell Username", sellAccount:"Sell Account", sellChannel:"Sell", sellService:"Sell Service",
        platform:"Platform", usernameLabel:"Username/Link", tgUserType:"Username type", NFT:"NFT", NORMAL:"Normal",
        price:"Price", currency:"Currency", desc:"Description (optional)", post:"Publish", back:"Back",
        channelMode:"Channel mode", modeSubscribers:"Subscribers channel", modeGifts:"Gifts channel",
        channelLinkOpt:"Channel link (optional)", channelUserOpt:"Channel username (optional)",
        subsCount:"Subscribers count", giftsCount:"Gifts count", giftKind:"Gift kind",
        upgraded:"Upgraded", regular:"Regular", both:"Both",
        serviceType:"Service type", followers:"Followers", members:"Members",
        boostCh:"Boost Telegram Channel", boostGp:"Boost Telegram Group", target:"Target", count:"Count" },
};

function getSchema(kind:string){
  if (kind==="username") return usernameSchema;
  if (kind==="account")  return accountSchema;
  if (kind==="channel")  return channelSchema;
  if (kind==="service")  return serviceSchema;
  return undefined as any;
}

export default function SellPage() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const L = language==="ar" ? T.ar : T.en;

  const [kind, setKind] = useState<"username"|"account"|"channel"|"service"|null>(null);
  const [platform, setPlatform] = useState<"telegram"|"twitter"|"instagram"|"discord"|"snapchat"|"tiktok"|"">("");

  useEffect(()=>{ try{ telegramWebApp?.expand?.(); }catch{} }, []);

  const schema = useMemo(()=> getSchema(kind||""), [kind]);
  const form = useForm<any>({
    resolver: schema ? zodResolver(schema) : undefined,
    mode: "onChange",
    defaultValues: {
      type: kind||undefined, platform: platform||"",
      // common
      price:"", currency:"TON", description:"",
      // username
      username:"", tgUserType:"",
      // account
      createdAt:"", followersCount:"",
      // channel
      channelMode:"subscribers", link:"", channelUsername:"",
      subscribersCount:"", giftsCount:"", giftKind:"regular",
      // service
      serviceType:"followers", target:"instagram", count:"",
    },
  });

  useEffect(()=>{
    const v = form.getValues();
    form.reset({ ...v, type: kind||undefined, platform: platform||"" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, platform]);

  const numericKeyGuard = (e: React.KeyboardEvent<HTMLInputElement>)=>{
    const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End","Enter","."];
    const isNumber = e.key>="0" && e.key<="9";
    if (!isNumber && !allowed.includes(e.key)) e.preventDefault();
  };

  const submit = async (data:any)=>{
    if (!telegramWebApp?.user) { toast({ title:"خطأ", description:"افتح من تيليجرام", variant:"destructive" }); return; }

    const payload = { ...data, telegramId: telegramWebApp.user.id };
    if (data.type==="channel") {
      // توحيد إدخال القناة للباك
      payload.username = (data.channelUsername || data.link || "").trim();
      delete payload.link; delete payload.channelUsername;
    }
    const url = data.type==="channel" ? "/api/sell" : "/api/listings";
    try {
      const r = await apiRequest("POST", url, payload);
      // apiRequest يرجّع JSON مباشر
      toast({ title:"OK", description: language==="ar" ? "تم إرسال الإعلان" : "Listing submitted" });
      form.reset(); setKind(null); setPlatform("");
    } catch(e:any){
      toast({ title:"خطأ", description: e?.message || "Error", variant:"destructive" });
    }
  };

  // اختيار النوع
  if (!kind) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{L.title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={()=>setKind("username")}>{L.sellUsername}</Button>
          <Button className="w-full" onClick={()=>setKind("account")}>{L.sellAccount}</Button>
          <Button className="w-full" onClick={()=>setKind("channel")}>{L.sellChannel}</Button>
          <Button className="w-full" onClick={()=>setKind("service")}>{L.sellService}</Button>
        </CardContent>
      </Card>
    );
  }

  // اختيار المنصّة لليوزر/الحساب
  if ((kind==="username" || kind==="account") && !platform) {
    const list = ["telegram","twitter","instagram","discord","snapchat","tiktok"];
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{L.platform}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {list.map(p=>(
            <Button key={p} className="w-full bg-background border" onClick={()=>setPlatform(p as any)}>{p}</Button>
          ))}
          <Button variant="secondary" onClick={()=>setKind(null)}>{L.back}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4 min-h-screen p-4">
        <Card className="p-4 space-y-3">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={()=>{ setKind(null); setPlatform(""); form.reset(); }}>
              {L.back}
            </Button>
            <div className="ml-auto text-sm opacity-70">{kind} {platform && `· ${platform}`}</div>
          </div>

          {kind==="username" && <UsernameForm form={form} L={L} platform={platform}/>}
          {kind==="account"  && <AccountForm  form={form} L={L} platform={platform}/>}
          {kind==="channel"  && <ChannelForm  form={form} L={L}/>}
          {kind==="service"  && <ServiceForm  form={form} L={L}/>}

          {/* السعر + العملة + الوصف */}
          <div className="grid grid-cols-3 gap-3">
            <FormField name="price" control={form.control} render={({field})=>(
              <FormItem className="col-span-2">
                <FormLabel>{L.price}</FormLabel>
                <FormControl>
                  <Input {...field} inputMode="decimal" placeholder="0.0" className="bg-background" onKeyDown={numericKeyGuard}/>
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>
            <FormField name="currency" control={form.control} render={({field})=>(
              <FormItem>
                <FormLabel>{L.currency}</FormLabel>
                <FormControl>
                  <select {...field} className="w-full rounded-md border px-3 py-2 bg-background text-foreground">
                    <option value="TON">TON</option>
                    <option value="USDT">USDT</option>
                  </select>
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>
          </div>

          <FormField name="description" control={form.control} render={({field})=>(
            <FormItem>
              <FormLabel>{L.desc}</FormLabel>
              <FormControl><Textarea {...field} className="bg-background" rows={3}/></FormControl>
              <FormMessage/>
            </FormItem>
          )}/>

          <div className="flex justify-between">
            <Button type="button" variant="secondary" onClick={()=>{ setKind(null); setPlatform(""); form.reset(); }}>
              {L.back}
            </Button>
            <Button type="submit" disabled={!form.formState.isValid}>{L.post}</Button>
          </div>
        </Card>
      </form>
    </Form>
  );
}
