import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function AccountForm({ form, L, platform }:{
  form:any; L:any; platform:string;
}) {
  return (
    <>
      <FormField name="platform" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{L.platform}</FormLabel>
          <FormControl><Input {...field} readOnly value={platform} className="bg-background" /></FormControl>
        </FormItem>
      )}/>
      <FormField name="username" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{L.usernameLabel}</FormLabel>
          <FormControl><Input {...field} placeholder="handle" className="bg-background" /></FormControl>
          <FormMessage />
        </FormItem>
      )}/>
      <FormField name="createdAt" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>YYYY-MM</FormLabel>
          <FormControl><Input type="month" {...field} className="bg-background" /></FormControl>
          <FormMessage />
        </FormItem>
      )}/>
      {(platform==="twitter"||platform==="instagram"||platform==="tiktok") && (
        <FormField name="followersCount" control={form.control} render={({field})=>(
          <FormItem>
            <FormLabel>{L.followers}</FormLabel>
            <FormControl><Input type="number" min={0} {...field} className="bg-background" /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )}
    </>
  );
}
