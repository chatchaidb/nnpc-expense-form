"use client";

import { MoonStar, Palette, Settings2, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { LOCALE_LABELS, type Locale, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ThemeSettingsSheetProps = {
  userEmail?: string;
  className?: string;
};

export function ThemeSettingsSheet({
  userEmail,
  className,
}: ThemeSettingsSheetProps) {
  const { locale, setLocale, t } = useI18n();
  const { setTheme, theme } = useTheme();
  const isDarkMode = theme === "dark";
  const locales = Object.keys(LOCALE_LABELS) as Locale[];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={cn(
            "rounded-full border-white/10 bg-background/70 px-4 text-foreground shadow-none backdrop-blur-xl hover:bg-background/90",
            className,
          )}
          size="sm"
          variant="outline"
        >
          <Settings2 className="size-4" />
          {t("common.settings")}
        </Button>
      </SheetTrigger>

      <SheetContent className="border-border/60 bg-background/95 sm:max-w-md">
        <SheetHeader className="space-y-3 border-b border-border/60 px-6 py-6">
          <Badge className="w-fit rounded-full px-3 py-1" variant="secondary">
            {t("settings.workspaceControls")}
          </Badge>
          <SheetTitle className="font-serif text-2xl tracking-tight">
            {t("settings.displaySettings")}
          </SheetTitle>
          <SheetDescription className="max-w-xs text-sm leading-6">
            {t("settings.description")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-6">
          <Card className="premium-panel rounded-3xl border-border/70 py-0 shadow-none">
            <CardHeader className="gap-3 px-5 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{t("settings.themeMode")}</CardTitle>
                  <CardDescription>
                    {t("settings.themeDescription")}
                  </CardDescription>
                </div>
                <Switch
                  aria-label="Toggle dark mode"
                  checked={isDarkMode}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-4 px-5 pb-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    isDarkMode
                      ? "border-primary/40 bg-primary/12 text-foreground"
                      : "border-border/70 bg-background/70 text-muted-foreground hover:bg-accent/60",
                  )}
                  type="button"
                  onClick={() => setTheme("dark")}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MoonStar className="size-4" />
                    {t("settings.dark")}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("settings.darkScreenMode")}
                  </p>
                </button>

                <button
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    !isDarkMode
                      ? "border-primary/40 bg-primary/12 text-foreground"
                      : "border-border/70 bg-background/70 text-muted-foreground hover:bg-accent/60",
                  )}
                  type="button"
                  onClick={() => setTheme("light")}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <SunMedium className="size-4" />
                    {t("settings.light")}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("settings.defaultStartupMode")}
                  </p>
                </button>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="text-sm font-medium text-foreground">
                  {t("common.language")}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("settings.languageDescription")}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {locales.map((nextLocale) => (
                    <button
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-sm transition",
                        locale === nextLocale
                          ? "border-primary/40 bg-primary/12 text-foreground"
                          : "border-border/70 bg-background/70 text-muted-foreground hover:bg-accent/60",
                      )}
                      key={nextLocale}
                      type="button"
                      onClick={() => setLocale(nextLocale)}
                    >
                      {LOCALE_LABELS[nextLocale]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Palette className="size-4 text-primary" />
                  {t("settings.brandPalette")}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="size-6 rounded-full border border-black/10 bg-[#1f4d39]" />
                  <span className="size-6 rounded-full border border-black/10 bg-[#f7faf5]" />
                  <span className="size-6 rounded-full border border-black/10 bg-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 py-0 shadow-none">
            <CardHeader className="gap-2 px-5 pt-5">
              <CardTitle className="text-base">{t("settings.session")}</CardTitle>
              <CardDescription>
                {t("settings.sessionDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <p className="text-sm text-muted-foreground">
                {userEmail ?? t("settings.signInSession")}
              </p>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
