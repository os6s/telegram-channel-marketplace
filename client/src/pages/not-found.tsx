import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">404</div>
      <h1 className="text-xl mb-2">الصفحة غير موجودة / Page Not Found</h1>
      <p className="text-muted-foreground mb-6">
        الرابط الذي طلبته غير متاح.
      </p>
      <Button onClick={() => navigate("/")}>العودة للسوق / Back to Marketplace</Button>
    </div>
  );
}
