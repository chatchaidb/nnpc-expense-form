"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  BadgeCheck,
  Building2,
  FileText,
  LayoutPanelTop,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { type AccountRole } from "@/lib/user-account-data";
import { cn } from "@/lib/utils";

type RouteSection =
  | "expenses"
  | "companies"
  | "profile"
  | "expense-insight"
  | "user-management";

export function TopRouteTabs({
  activeSection,
  accountRole,
}: {
  activeSection: RouteSection;
  accountRole?: AccountRole | null;
}) {
  const { t } = useI18n();
  const showAdminRoutes = accountRole === "admin" || accountRole === "central_admin";

  if (!showAdminRoutes) {
    return null;
  }

  const tabGroups: Array<{
    labelKey: TranslationKey;
    tabs: Array<{
      href: string;
      icon: ComponentType<{ className?: string }>;
      key: RouteSection;
      labelKey: TranslationKey;
    }>;
  }> = [
    {
      labelKey: "nav.primary",
      tabs: [
        {
          href: "/dashboard",
          icon: FileText,
          key: "expenses",
          labelKey: "nav.expenses",
        },
      ],
    },
    {
      labelKey: "nav.setup",
      tabs: [
        {
          href: "/companies",
          icon: Building2,
          key: "companies",
          labelKey: "nav.companies",
        },
        {
          href: "/profile",
          icon: UserRound,
          key: "profile",
          labelKey: "nav.profile",
        },
      ],
    },
    ...(showAdminRoutes
      ? [
          {
            labelKey: "nav.admin" as const,
            tabs: [
              {
                href: "/admin/expenses",
                icon: LayoutPanelTop,
                key: "expense-insight" as const,
                labelKey: "nav.expenseInsight" as const,
              },
              {
                href: "/admin/users",
                icon: ShieldCheck,
                key: "user-management" as const,
                labelKey: "nav.userManagement" as const,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <nav aria-label={t("nav.primary")} className="mt-6 overflow-x-auto">
      <div className="flex min-w-max flex-col gap-3 lg:min-w-0 lg:flex-row lg:flex-wrap lg:items-end">
        {tabGroups.map((group) => (
          <div className="min-w-max" key={group.labelKey}>
            <p className="mb-2 px-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {group.labelKey === "nav.setup" ? (
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="size-3.5 text-primary" />
                  {t(group.labelKey)}
                </span>
              ) : (
                t(group.labelKey)
              )}
            </p>
            <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-background/65 p-1.5 backdrop-blur-sm">
              {group.tabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <Link
                    aria-current={activeSection === tab.key ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-[1rem] border px-4 py-2.5 text-sm font-medium transition",
                      activeSection === tab.key
                        ? "border-primary/30 bg-primary/10 text-foreground shadow-[0_12px_24px_-18px_rgba(26,57,43,0.45)]"
                        : "border-transparent text-muted-foreground hover:bg-background/65 hover:text-foreground",
                    )}
                    href={tab.href}
                    key={tab.key}
                  >
                    <Icon className="size-4" />
                    <span className="whitespace-nowrap">{t(tab.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
