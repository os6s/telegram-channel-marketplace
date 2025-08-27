// remote-logger.ts
function sendLog(level: string, args: any[]) {
  try {
    fetch("/api/log-client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        args: args.map((a) =>
          typeof a === "object" ? JSON.stringify(a) : String(a)
        ),
        userAgent: navigator.userAgent,
        url: window.location.href,
        ts: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // silent fail
  }
}

export function installRemoteLogger() {
  // patch console.log
  const origLog = console.log;
  console.log = (...args: any[]) => {
    sendLog("log", args);
    origLog(...args);
  };

  // patch console.error
  const origErr = console.error;
  console.error = (...args: any[]) => {
    sendLog("error", args);
    origErr(...args);
  };

  // catch global errors
  window.addEventListener("error", (e) =>
    sendLog("globalError", [e.message || e.error])
  );
  window.addEventListener("unhandledrejection", (e: any) =>
    sendLog("unhandledRejection", [e.reason])
  );
}