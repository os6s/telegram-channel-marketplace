// ... نفس الإعدادات أعلاه (CORS, parsers, logger)

(async () => {
  const server = await registerRoutes(app);

  // ⚠️ احذف هندلر 404 القديم الخاص بالـSPA

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("[ERROR]", err);
    res.status(status).json({ message });
  });

  // ✅ أولاً: ستاتيك/فيت
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);                 // يجب أن يقدّم dist/public ويعيد index.html
  }

  // ✅ ثانياً: 404 عادي بعد الستاتيك
  app.use((req: Request, res: Response) => {
    // إذا وصلنا هنا فالستاتيك ما لقَى ملف. API/WEBHOOK مو شغل الستاتيك أصلاً.
    if (req.path.startsWith("/api") || req.path.startsWith("/webhook")) {
      return res.status(404).json({ error: "Not Found" });
    }
    // لباقي مسارات SPA، خلِّ الستاتيك يتكفّل بإرجاع index.html عبر history fallback
    // إن ما عندك fallback داخل serveStatic، استعمل:
    // res.sendFile(path.resolve("dist/public/index.html"));
    return res.status(404).json({ error: "Not Found" });
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => log(`serving on port ${port}`));
})();