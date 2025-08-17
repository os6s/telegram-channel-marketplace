// client/src/bootstrap.ts
import { bootstrapUser } from "@/lib/user-bootstrap";

// يعمل مرّة عند تحميل التطبيق
bootstrapUser().catch(() => {});