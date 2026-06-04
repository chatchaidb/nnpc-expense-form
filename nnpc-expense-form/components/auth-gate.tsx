"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { ThemeSettingsSheet } from "@/components/theme-settings-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import {
  LOCAL_DEVELOPMENT_ACCESS_TOKEN,
  LOCAL_DEVELOPMENT_USER_EMAIL,
  isDatabaseConfigured,
} from "@/lib/local-mode";
import {
  getCurrentUserAccount,
  type AccountRole,
  type UserAccount,
} from "@/lib/user-account-data";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

type AuthMessage = {
  text: string;
  tone: "error" | "info";
};

export type AuthSession = {
  accessToken: string;
  expiresAt: number | null;
  refreshToken: string;
  userEmail: string;
};

type BetterSessionData = {
  session?: {
    expiresAt?: Date | string;
  };
  user?: {
    email?: string;
    id?: string;
    name?: string;
  };
};

function readAuthErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const authError = error as {
    code?: string;
    message?: string;
    statusText?: string;
  };
  const detail = authError.message ?? authError.statusText ?? authError.code;

  if (!detail || detail === fallback) {
    return fallback;
  }

  return detail;
}

function buildLocalAuth() {
  const timestamp = new Date().toISOString();
  const session = {
    accessToken: LOCAL_DEVELOPMENT_ACCESS_TOKEN,
    expiresAt: null,
    refreshToken: "",
    userEmail: LOCAL_DEVELOPMENT_USER_EMAIL,
  } satisfies AuthSession;
  const account = {
    accessStatus: "approved",
    approvedAt: timestamp,
    approvedBy: "local-development",
    createdAt: timestamp,
    disabledAt: null,
    disabledBy: null,
    displayName: "Local reviewer",
    email: LOCAL_DEVELOPMENT_USER_EMAIL,
    role: "central_admin",
    updatedAt: timestamp,
    userId: "local-reviewer",
  } satisfies UserAccount;

  return { account, session };
}

function readSessionExpiry(expiresAt?: Date | string) {
  if (!expiresAt) {
    return null;
  }

  const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

  return Number.isNaN(expiryDate.getTime())
    ? null
    : Math.floor(expiryDate.getTime() / 1000);
}

function buildAuthSession(sessionData: BetterSessionData) {
  return {
    accessToken: sessionData.user?.id ?? "",
    expiresAt: readSessionExpiry(sessionData.session?.expiresAt),
    refreshToken: "",
    userEmail: sessionData.user?.email ?? "",
  } satisfies AuthSession;
}

export default function AuthGate({
  allowedRoles,
  children,
}: {
  allowedRoles?: AccountRole[];
  children: (auth: {
    account: UserAccount;
    logout: () => Promise<void>;
    refreshAccount: () => Promise<void>;
    session: AuthSession;
  }) => ReactNode;
}) {
  const { t } = useI18n();
  const isLocalMode = !isDatabaseConfigured();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<AuthMessage | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const sessionQuery = authClient.useSession();
  const sessionData = sessionQuery.data as BetterSessionData | null;
  const sessionUserId = sessionData?.user?.id;
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);

  const refreshAccount = async () => {
    const nextAccount = await getCurrentUserAccount("");
    setAccount(nextAccount);
    setAccountMessage(null);
  };

  useEffect(() => {
    if (isLocalMode || !sessionUserId) {
      setAccount(null);
      setAccountMessage(null);
      setIsLoadingAccount(false);
      return;
    }

    let isActive = true;

    const loadAccount = async () => {
      setIsLoadingAccount(true);
      try {
        const nextAccount = await getCurrentUserAccount("");

        if (!isActive) {
          return;
        }

        setAccount(nextAccount);
        setAccountMessage(null);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setAccount(null);
        setAccountMessage(error instanceof Error ? error.message : t("auth.authIssue"));
      } finally {
        if (isActive) {
          setIsLoadingAccount(false);
        }
      }
    };

    void loadAccount();

    return () => {
      isActive = false;
    };
  }, [isLocalMode, sessionUserId, t]);

  if (isLocalMode) {
    const localAuth = buildLocalAuth();

    return (
      <>
        {children({
          ...localAuth,
          logout: async () => undefined,
          refreshAccount: async () => undefined,
        })}
      </>
    );
  }

  const logout = async () => {
    await authClient.signOut();
    setAccount(null);
    await sessionQuery.refetch();
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setAuthMessage({
        tone: "error",
        text: t("auth.emailAndPasswordRequired"),
      });
      return;
    }

    setIsSubmittingAuth(true);
    setAuthMessage(null);

    try {
      const credentials = {
        email: email.trim(),
        password,
      };
      const result =
        authMode === "signup"
          ? await authClient.signUp.email({
              ...credentials,
              name: email.trim().split("@")[0] || email.trim(),
            })
          : await authClient.signIn.email(credentials);

      if (result.error) {
        setAuthMessage({
          tone: "error",
          text: readAuthErrorMessage(result.error, t("auth.requestSupabaseError")),
        });
        return;
      }

      setPassword("");
      if (authMode === "signup") {
        setAuthMessage({
          tone: "info",
          text: t("auth.accountCreated"),
        });
      }
      await sessionQuery.refetch();
    } catch (error) {
      setAuthMessage({
        tone: "error",
        text: error instanceof Error ? error.message : t("auth.requestSupabaseError"),
      });
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  if (sessionQuery.isPending || (sessionData?.user && isLoadingAccount)) {
    return (
      <div className="page-shell min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-8 sm:px-6">
          <Card className="premium-panel w-full max-w-lg rounded-[2rem] border-border/60 py-0">
            <CardContent className="px-6 py-12 text-center sm:px-10">
              <Badge className="rounded-full px-3 py-1" variant="secondary">
                {t("auth.initializing")}
              </Badge>
              <p className="mt-5 font-serif text-3xl tracking-tight text-foreground">
                {t("auth.loadingSecureWorkspace")}
              </p>
              <div className="mx-auto mt-6 max-w-sm space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                {t("auth.preparingWorkspace")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (sessionData?.user && accountMessage && !account) {
    return (
      <AccessStateShell userEmail={sessionData.user.email}>
        <AccessStateCard description={accountMessage} title={t("auth.authIssue")}>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refreshAccount();
              }}
            >
              {t("auth.refreshStatus")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void logout()}>
              <LogOut className="size-4" />
              {t("common.logout")}
            </Button>
          </div>
        </AccessStateCard>
      </AccessStateShell>
    );
  }

  if (!sessionData?.user || !account) {
    return (
      <div className="page-shell min-h-screen">
        <div className="mx-auto flex w-full max-w-7xl justify-end px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          <ThemeSettingsSheet />
        </div>

        <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 pb-8 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] lg:px-8 lg:pb-10">
          <section className="premium-panel rounded-[2rem] border border-border/60 p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-8">
              <div className="space-y-4">
                <Badge
                  className="rounded-full border-white/10 bg-white/5 px-4 py-1 text-[0.7rem] uppercase tracking-[0.28em] text-primary"
                  variant="outline"
                >
                  NNPC daily expense
                </Badge>

                <div className="space-y-4">
                  <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
                    {t("auth.heroEyebrow")}
                  </p>
                  <h1 className="max-w-3xl font-serif text-4xl tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
                    {t("auth.heroTitle")}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    {t("auth.heroDescription")}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FeatureCard
                  description={t("auth.featureDashboard.description")}
                  icon={<Wallet className="size-4" />}
                  title={t("auth.featureDashboard.title")}
                />
                <FeatureCard
                  description={t("auth.featureSecure.description")}
                  icon={<ShieldCheck className="size-4" />}
                  title={t("auth.featureSecure.title")}
                />
                <FeatureCard
                  description={t("auth.featureReceipt.description")}
                  icon={<Sparkles className="size-4" />}
                  title={t("auth.featureReceipt.title")}
                />
                <FeatureCard
                  description={t("auth.featureTheme.description")}
                  icon={<LockKeyhole className="size-4" />}
                  title={t("auth.featureTheme.title")}
                />
              </div>
            </div>
          </section>

          <Card className="premium-panel rounded-[2rem] border-border/60 py-0">
            <CardHeader className="gap-5 border-b border-border/60 px-6 py-6">
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-background/70 p-1">
                <Button
                  className={cn(
                    "h-10 flex-1 rounded-full px-4 shadow-none",
                    authMode !== "login" &&
                      "bg-transparent text-muted-foreground hover:bg-background/80 hover:text-foreground",
                  )}
                  type="button"
                  variant={authMode === "login" ? "default" : "ghost"}
                  onClick={() => {
                    setAuthMode("login");
                    setAuthMessage(null);
                  }}
                >
                  {t("auth.login")}
                </Button>
                <Button
                  className={cn(
                    "h-10 flex-1 rounded-full px-4 shadow-none",
                    authMode !== "signup" &&
                      "bg-transparent text-muted-foreground hover:bg-background/80 hover:text-foreground",
                  )}
                  type="button"
                  variant={authMode === "signup" ? "default" : "ghost"}
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthMessage(null);
                  }}
                >
                  {t("auth.signup")}
                </Button>
              </div>

              <div className="space-y-2">
                <CardTitle className="font-serif text-3xl tracking-tight">
                  {authMode === "login" ? t("auth.login") : t("auth.createWorkspace")}
                </CardTitle>
                <CardDescription className="text-sm leading-7">
                  {t("auth.supabaseAuthOnly")}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-6 py-6">
              <form className="space-y-5" onSubmit={handleAuthSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("common.email")}
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoComplete="email"
                      className="h-12 rounded-2xl border-white/10 bg-background/75 pl-11"
                      placeholder="name@company.com"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("common.password")}
                  </span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoComplete={authMode === "login" ? "current-password" : "new-password"}
                      className="h-12 rounded-2xl border-white/10 bg-background/75 pl-11"
                      placeholder="At least 8 characters"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                </label>

                {authMessage ? (
                  <Alert
                    className={cn(
                      "rounded-2xl border-white/10",
                      authMessage.tone === "error"
                        ? "border-destructive/30 bg-destructive/10"
                        : "bg-background/70",
                    )}
                    variant={authMessage.tone === "error" ? "destructive" : "default"}
                  >
                    <AlertTitle>
                      {authMessage.tone === "error" ? t("auth.authIssue") : t("auth.nextStep")}
                    </AlertTitle>
                    <AlertDescription>{authMessage.text}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  className="h-12 w-full rounded-2xl text-sm"
                  disabled={isSubmittingAuth}
                  type="submit"
                >
                  {isSubmittingAuth
                    ? t("auth.working")
                    : authMode === "login"
                      ? t("auth.login")
                      : t("auth.createAccount")}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (account.accessStatus === "pending") {
    return (
      <AccessStateShell userEmail={sessionData.user.email}>
        <AccessStateCard
          description={t("auth.awaitingApproval.description")}
          title={t("auth.awaitingApproval.title")}
        >
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void refreshAccount()}>
              {t("auth.refreshStatus")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void logout()}>
              <LogOut className="size-4" />
              {t("common.logout")}
            </Button>
          </div>
        </AccessStateCard>
      </AccessStateShell>
    );
  }

  if (account.accessStatus === "disabled") {
    return (
      <AccessStateShell userEmail={sessionData.user.email}>
        <AccessStateCard
          description={t("auth.accessDisabled.description")}
          title={t("auth.accessDisabled.title")}
        >
          <Button type="button" variant="outline" onClick={() => void logout()}>
            <LogOut className="size-4" />
            {t("common.logout")}
          </Button>
        </AccessStateCard>
      </AccessStateShell>
    );
  }

  if (allowedRoles && !allowedRoles.includes(account.role)) {
    return (
      <AccessStateShell userEmail={sessionData.user.email}>
        <AccessStateCard
          description={t("auth.accessDenied.description")}
          title={t("auth.accessDenied.title")}
        >
          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link href="/dashboard">{t("common.backToDashboard")}</Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => void logout()}>
              <LogOut className="size-4" />
              {t("common.logout")}
            </Button>
          </div>
        </AccessStateCard>
      </AccessStateShell>
    );
  }

  return (
    <>
      {children({
        account,
        logout,
        refreshAccount: async () => {
          await sessionQuery.refetch();
          await refreshAccount();
        },
        session: buildAuthSession(sessionData),
      })}
    </>
  );
}

function AccessStateShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail?: string;
}) {
  return (
    <div className="page-shell min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl justify-end px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <ThemeSettingsSheet userEmail={userEmail} />
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center px-4 pb-10 pt-4 sm:px-6">
        {children}
      </div>
    </div>
  );
}

function AccessStateCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  const { t } = useI18n();

  return (
    <Card className="premium-panel w-full max-w-xl rounded-[2rem] border-border/60 py-0">
      <CardContent className="space-y-6 px-6 py-10 sm:px-10">
        <Badge className="rounded-full px-3 py-1" variant="secondary">
          {t("common.accountState")}
        </Badge>
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function FeatureCard({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-background/65 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          {icon}
        </span>
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}
