// client/src/lib/telegram.ts
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready?(): void;
        close?(): void;
        expand?(): void;
        enableClosingConfirmation?(): void;
        disableClosingConfirmation?(): void;
        onEvent?(eventType: string, eventHandler: () => void): void;
        offEvent?(eventType: string, eventHandler: () => void): void;
        sendData?(data: string): void;
        switchInlineQuery?(query: string, choose_chat_types?: string[]): void;
        openLink?(url: string, options?: { try_instant_view?: boolean }): void;
        openTelegramLink?(url: string): void;
        openInvoice?(url: string, callback?: (status: string) => void): void;
        showPopup?(
          params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text: string }> },
          callback?: (buttonId: string) => void
        ): void;
        showAlert?(message: string, callback?: () => void): void;
        showConfirm?(message: string, callback?: (confirmed: boolean) => void): void;
        showScanQrPopup?(params: { text?: string }, callback?: (text: string) => void): void;
        closeScanQrPopup?(): void;
        readTextFromClipboard?(callback?: (text: string) => void): void;
        requestWriteAccess?(callback?: (granted: boolean) => void): void;
        requestContact?(callback?: (granted: boolean) => void): void;
        invokeCustomMethod?(method: string, params: any, callback?: (error: any, result: any) => void): void;

        setHeaderColor?(color: string): void;
        setBackgroundColor?(color: string): void;

        initData?: string;
        initDataUnsafe?: {
          auth_date: number;
          hash: string;
          query_id?: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
          chat?: { id: number; type: string; title?: string; username?: string; photo_url?: string };
          chat_type?: string;
          chat_instance?: string;
          start_param?: string;
          can_send_after?: number;
          receiver?: any;
        };
        version?: string;
        platform?: string;
        colorScheme?: "light" | "dark";
        themeParams?: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
          header_bg_color?: string;
          accent_text_color?: string;
          section_bg_color?: string;
          section_header_text_color?: string;
          subtitle_text_color?: string;
          destructive_text_color?: string;
        };
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        isClosingConfirmationEnabled?: boolean;
        headerColor?: string;
        backgroundColor?: string;

        BackButton?: {
          isVisible: boolean;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
          show(): void;
          hide(): void;
        };
        MainButton?: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isProgressVisible: boolean;
          isActive: boolean;
          setText(text: string): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          showProgress(leaveActive?: boolean): void;
          hideProgress(): void;
          setParams(params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }): void;
        };
        SecondaryButton?: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isProgressVisible: boolean;
          isActive: boolean;
          setText(text: string): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          showProgress(leaveActive?: boolean): void;
          hideProgress(): void;
          setParams(params: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }): void;
        };
        SettingsButton?: {
          isVisible: boolean;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
          show(): void;
          hide(): void;
        };
        HapticFeedback?: {
          impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
          notificationOccurred(type: "error" | "success" | "warning"): void;
          selectionChanged(): void;
        };
        CloudStorage?: {
          setItem(key: string, value: string, cb?: (error: any, success: boolean) => void): void;
          getItem(key: string, cb: (error: any, value?: string) => void): void;
          getItems(keys: string[], cb: (error: any, values?: Record<string, string>) => void): void;
          removeItem(key: string, cb?: (error: any, success: boolean) => void): void;
          removeItems(keys: string[], cb?: (error: any, success: boolean) => void): void;
          getKeys(cb: (error: any, keys?: string[]) => void): void;
        };
        BiometricManager?: {
          isInited: boolean;
          isBiometricAvailable: boolean;
          biometricType: "finger" | "face" | "unknown";
          isAccessRequested: boolean;
          isAccessGranted: boolean;
          isBiometricTokenSaved: boolean;
          deviceId: string;
          init(cb?: () => void): void;
          requestAccess(params: { reason?: string }, cb?: (granted: boolean) => void): void;
          authenticate(params: { reason?: string }, cb?: (success: boolean, token?: string) => void): void;
          updateBiometricToken(token: string, cb?: (success: boolean) => void): void;
          openSettings(): void;
        };
      };
    };
  }
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export class TelegramWebApp {
  private static instance: TelegramWebApp;
  private initialized = false;

  static getInstance(): TelegramWebApp {
    if (!TelegramWebApp.instance) TelegramWebApp.instance = new TelegramWebApp();
    return TelegramWebApp.instance;
  }

  private get wa() {
    return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  }

  get isAvailable(): boolean {
    return !!this.wa;
  }

  get webApp() {
    return this.wa;
  }

  get user(): TelegramUser | undefined {
    return this.wa?.initDataUnsafe?.user;
  }

  get username(): string | undefined {
    return this.user?.username;
  }

  get initData(): string | undefined {
    return this.wa?.initData;
  }

  get themeParams() {
    return this.wa?.themeParams ?? {};
  }

  get colorScheme() {
    return this.wa?.colorScheme ?? "light";
  }

  private hasFn<K extends keyof NonNullable<Window["Telegram"]>["WebApp"]>(name: K): boolean {
    const w = this.wa as any;
    return !!(w && typeof w[name as string] === "function");
  }

  private versionAtLeast(min: number): boolean {
    const v = this.wa?.version;
    const num = v ? parseFloat(v) : 0;
    return num >= min;
  }

  initialize(): void {
    if (this.initialized) return;
    if (!this.isAvailable) {
      console.warn("Telegram Web App is not available");
      return;
    }

    this.hasFn("ready") && this.wa!.ready!();
    this.hasFn("expand") && this.wa!.expand!();

    const tp = this.wa!.themeParams ?? {};
    if (tp.header_bg_color && this.hasFn("setHeaderColor")) this.wa!.setHeaderColor!(tp.header_bg_color);
    if (tp.bg_color && this.hasFn("setBackgroundColor")) this.wa!.setBackgroundColor!(tp.bg_color);

    if (this.versionAtLeast(6.0) && this.hasFn("enableClosingConfirmation")) {
      this.wa!.enableClosingConfirmation!();
    }

    this.applyTheme();
    this.initialized = true;
  }

  private applyTheme(): void {
    if (!this.wa) return;
    const root = document.documentElement;
    const theme = this.wa.themeParams ?? {};

    if (theme.bg_color) root.style.setProperty("--tg-bg-color", theme.bg_color);
    if (theme.text_color) root.style.setProperty("--tg-text-color", theme.text_color);
    if (theme.button_color) root.style.setProperty("--tg-button-color", theme.button_color);
    if (theme.button_text_color) root.style.setProperty("--tg-button-text-color", theme.button_text_color);
  }

  showMainButton(text: string, callback: () => void): void {
    const mb = this.wa?.MainButton;
    if (!mb) return;
    try { mb.offClick?.(callback); } catch {}
    mb.setText(text);
    mb.onClick(callback);
    mb.show();
  }

  hideMainButton(): void {
    this.wa?.MainButton?.hide();
  }

  showBackButton(callback: () => void): void {
    const bb = this.wa?.BackButton;
    if (!bb) return;
    try { bb.offClick?.(callback); } catch {}
    bb.onClick(callback);
    bb.show();
  }

  hideBackButton(): void {
    this.wa?.BackButton?.hide();
  }

  hapticFeedback(
    type: "impact" | "notification" | "selection",
    style?: "light" | "medium" | "heavy" | "error" | "success" | "warning"
  ): void {
    const hf = this.wa?.HapticFeedback;
    if (!hf) return;
    if (type === "impact") hf.impactOccurred((style as any) || "medium");
    else if (type === "notification") hf.notificationOccurred((style as any) || "success");
    else hf.selectionChanged();
  }

  showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.hasFn("showAlert")) {
        window.alert?.(message);
        return resolve();
      }
      this.wa!.showAlert!(message, () => resolve());
    });
  }

  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.hasFn("showConfirm")) {
        return resolve(window.confirm?.(message) ?? true);
      }
      this.wa!.showConfirm!(message, (confirmed) => resolve(confirmed));
    });
  }

  close(): void {
    this.hasFn("close") && this.wa!.close!();
  }

  sendData(data: any): void {
    this.hasFn("sendData") && this.wa!.sendData!(JSON.stringify(data));
  }
}

export const telegramWebApp = TelegramWebApp.getInstance();
export function ensureTelegramReady() {
  telegramWebApp.initialize();
  return telegramWebApp;
}