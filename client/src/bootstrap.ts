// client/src/bootstrap.ts
import { bootstrapUser } from "@/lib/user-bootstrap";

export async function initApp() {
  try {
    const userId = await bootstrapUser();
    console.log("Bootstrapped user ID:", userId);
  } catch (err) {
    console.error("Bootstrap failed:", err);
  }
}

// أول ما يشتغل التطبيق
initApp();