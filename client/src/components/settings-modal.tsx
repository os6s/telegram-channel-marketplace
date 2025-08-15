import * as Dialog from "@radix-ui/react-dialog";
import { useTheme } from "@/contexts/theme-context";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();            // ← صار يدعم "system"
  const { language, setLanguage, t } = useLanguage();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <Dialog.Title className="text-lg font-semibold">{t("settings.title")}</Dialog.Title>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Language */}
          <div className="mb-4">
            <div className="text-sm mb-2">{t("settings.language")}</div>
            <div className="flex gap-2">
              <Button variant={language === "en" ? "default" : "outline"} onClick={() => setLanguage("en")}>EN</Button>
              <Button variant={language === "ar" ? "default" : "outline"} onClick={() => setLanguage("ar")}>AR</Button>
            </div>
          </div>

          {/* Theme */}
          <div className="mb-2">
            <div className="text-sm mb-2">{t("settings.theme")}</div>
            <div className="flex gap-2">
              <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
                {t("settings.light")}
              </Button>
              <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
                {t("settings.dark")}
              </Button>
              <Button variant={theme === "system" ? "default" : "outline"} onClick={() => setTheme("system")}>
                {t("settings.system")}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => onOpenChange(false)}>{t("settings.close")}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}