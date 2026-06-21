"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, RotateCw } from "lucide-react";
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
import {
  completePasswordReset,
  getPasswordResetStatus,
  requestPasswordReset,
  type PasswordResetState,
} from "@/lib/user-account-data";
import { cn } from "@/lib/utils";

type ResetMessage = {
  text: string;
  tone: "error" | "info";
};

const RESET_EMAIL_STORAGE_KEY = "nnpc-password-reset-email";

function formatShortDate(rawDate: string | null) {
  if (!rawDate) return "Not set";

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return rawDate;

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function statusCopy(status: PasswordResetState["status"]) {
  switch (status) {
    case "approved":
      return {
        badge: "Approved",
        description: "Admin approval is ready. Set a new password below.",
        title: "Password reset approved",
      };
    case "pending":
      return {
        badge: "Pending",
        description:
          "Your request is waiting for an admin to approve it through User Management.",
        title: "Password reset pending",
      };
    default:
      return {
        badge: "Not requested",
        description: "Enter your account email to ask an admin for password reset approval.",
        title: "Request password reset",
      };
  }
}

export default function PasswordResetPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetState, setResetState] = useState<PasswordResetState>({
    approvedAt: null,
    requestedAt: null,
    status: "none",
  });
  const [message, setMessage] = useState<ResetMessage | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const copy = statusCopy(resetState.status);

  const rememberEmail = useCallback((nextEmail: string) => {
    const normalizedEmail = nextEmail.trim().toLowerCase();
    window.localStorage.setItem(RESET_EMAIL_STORAGE_KEY, normalizedEmail);

    const nextUrl = normalizedEmail
      ? `/password-reset?email=${encodeURIComponent(normalizedEmail)}`
      : "/password-reset";
    window.history.replaceState(null, "", nextUrl);

    return normalizedEmail;
  }, []);

  const refreshStatus = useCallback(async (targetEmail: string) => {
    const normalizedEmail = rememberEmail(targetEmail);

    if (!normalizedEmail) {
      setMessage({
        tone: "error",
        text: "Email is required.",
      });
      return;
    }

    setIsLoadingStatus(true);
    setMessage(null);

    try {
      const nextState = await getPasswordResetStatus(normalizedEmail);
      setResetState(nextState);
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Password reset status could not be loaded.",
      });
    } finally {
      setIsLoadingStatus(false);
    }
  }, [rememberEmail]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialEmail =
      params.get("email") ?? window.localStorage.getItem(RESET_EMAIL_STORAGE_KEY) ?? "";

    if (!initialEmail) return;

    setEmail(initialEmail);
    void refreshStatus(initialEmail);
  }, [refreshStatus]);

  const handleRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = rememberEmail(email);

    if (!normalizedEmail) {
      setMessage({
        tone: "error",
        text: "Email is required.",
      });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const nextState = await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setResetState(nextState);
      setMessage({
        tone: "info",
        text: "Your reset request is pending. Ask an admin to approve it, then refresh this page.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Password reset could not be requested.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = rememberEmail(email);

    if (!normalizedEmail) {
      setMessage({
        tone: "error",
        text: "Email is required.",
      });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const nextState = await completePasswordReset({
        confirmPassword,
        email: normalizedEmail,
        password,
      });
      setPassword("");
      setConfirmPassword("");
      setResetState(nextState);
      setMessage({
        tone: "info",
        text: "Your password has been reset. You can return to login with the new password.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Password could not be reset.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-shell min-h-screen">
      <div className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <ThemeSettingsSheet />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="w-full max-w-md">
          <div className="mb-7 text-center">
            <h1 className="font-serif text-4xl font-medium tracking-[-0.03em] text-foreground sm:text-5xl">
              NNPC Daily Expense
            </h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Password reset
            </p>
          </div>

          <Card className="premium-panel rounded-[1.75rem] border-border/70 py-0">
            <CardHeader className="gap-2 border-b border-border/60 px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="font-serif text-3xl tracking-tight">
                    {copy.title}
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6">
                    {copy.description}
                  </CardDescription>
                </div>
                <Badge className="rounded-full px-2.5 py-0.5" variant="outline">
                  {copy.badge}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="px-6 py-6">
              <form
                className="flex flex-col gap-5"
                onSubmit={
                  resetState.status === "approved"
                    ? handleCompleteSubmit
                    : handleRequestSubmit
                }
              >
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">Email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoComplete="email"
                      className="h-12 rounded-2xl bg-background/75 pl-11"
                      placeholder="name@company.com"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </label>

                {resetState.status === "approved" ? (
                  <>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-foreground">New password</span>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          autoComplete="new-password"
                          className="h-12 rounded-2xl bg-background/75 pl-11"
                          placeholder="At least 8 characters"
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                      </div>
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-foreground">
                        Confirm password
                      </span>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          autoComplete="new-password"
                          className="h-12 rounded-2xl bg-background/75 pl-11"
                          placeholder="Re-enter password"
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                        />
                      </div>
                    </label>
                  </>
                ) : null}

                {resetState.status !== "none" ? (
                  <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3 text-sm leading-6 text-muted-foreground">
                    Requested: {formatShortDate(resetState.requestedAt)}
                    {resetState.status === "approved"
                      ? ` · Approved: ${formatShortDate(resetState.approvedAt)}`
                      : ""}
                  </div>
                ) : null}

                {message ? (
                  <Alert
                    className={cn(
                      "rounded-2xl",
                      message.tone === "error"
                        ? "border-destructive/30 bg-destructive/10"
                        : "bg-background/70",
                    )}
                    variant={message.tone === "error" ? "destructive" : "default"}
                  >
                    <AlertTitle>
                      {message.tone === "error" ? "Password reset issue" : "Password reset"}
                    </AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  className="h-12 w-full rounded-2xl text-sm"
                  disabled={isSubmitting || isLoadingStatus}
                  type="submit"
                >
                  {isSubmitting
                    ? "Working..."
                    : resetState.status === "approved"
                      ? "Set new password"
                      : "Request password reset"}
                  <ArrowRight className="size-4" />
                </Button>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1 rounded-2xl"
                    disabled={isLoadingStatus || isSubmitting}
                    type="button"
                    variant="outline"
                    onClick={() => void refreshStatus(email)}
                  >
                    <RotateCw className="size-4" />
                    Refresh status
                  </Button>
                  <Button asChild className="flex-1 rounded-2xl" type="button" variant="outline">
                    <Link href="/">
                      <ArrowLeft className="size-4" />
                      Back to login
                    </Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
