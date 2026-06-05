"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Locale = "en" | "th";

type TranslationValues = Record<string, number | string>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
};

const I18N_STORAGE_KEY = "nnpc-expense-locale";
const I18N_STORAGE_EVENT = "nnpc-expense-locale-change";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  th: "ไทย",
};

const en = {
  "common.accountState": "Account state",
  "common.active": "Active",
  "common.admin": "Admin",
  "common.backToDashboard": "Back to dashboard",
  "common.cancel": "Cancel",
  "common.centralAdmin": "Central Admin",
  "common.companyAddress": "Company address",
  "common.companyLogo": "Company logo",
  "common.companyName": "Company name",
  "common.companyTaxId": "Company Tax ID",
  "common.create": "Create",
  "common.date": "Date",
  "common.days": "Days",
  "common.department": "Department",
  "common.edit": "Edit",
  "common.email": "Email",
  "common.fullName": "Full name",
  "common.language": "Language",
  "common.loading": "Loading...",
  "common.logo": "Logo",
  "common.logout": "Log out",
  "common.month": "Month",
  "common.noSpend": "No Spend",
  "common.open": "Open",
  "common.password": "Password",
  "common.preview": "Preview",
  "common.reference": "Reference",
  "common.role": "Role",
  "common.saveChanges": "Save changes",
  "common.saving": "Saving...",
  "common.settings": "Settings",
  "common.status": "Status",
  "common.taxId": "Tax ID {taxId}",
  "common.total": "Total",
  "common.tryAgain": "Try again",
  "common.update": "Update",
  "common.user": "User",
  "nav.admin": "Admin",
  "nav.companies": "Company details",
  "nav.expenseInsight": "Reports",
  "nav.expenses": "My Expenses",
  "nav.primary": "Primary",
  "nav.profile": "My profile",
  "nav.setup": "Setup",
  "nav.userManagement": "Manage users",
  "nav.workspace": "Workspace",
  "settings.brandPalette": "Brand palette",
  "settings.cleanReviewMode": "Clean review mode",
  "settings.dark": "Dark",
  "settings.darkScreenMode": "Darker screen",
  "settings.defaultStartupMode": "Default startup mode",
  "settings.description":
    "Light mode is the default corporate view. Use the theme switch only when you prefer a darker screen.",
  "settings.displaySettings": "Display settings",
  "settings.languageDescription":
    "Choose the interface language for navigation, forms, and system messages.",
  "settings.light": "Light",
  "settings.session": "Session",
  "settings.sessionDescription": "This prototype stores reports and assets in SQL Server.",
  "settings.signInSession": "Sign in to load a user session.",
  "settings.themeDescription":
    "Toggle the interface between the standard light workspace and a darker view.",
  "settings.themeMode": "Theme mode",
  "settings.workspaceControls": "Workspace controls",
  "auth.accessDenied.description":
    "Your account is approved, but this section is only available to admin roles.",
  "auth.accessDenied.title": "Access denied",
  "auth.accessDisabled.description":
    "This account has been disabled and cannot use the main system right now.",
  "auth.accessDisabled.title": "Access disabled",
  "auth.accessWorkflow": "Access workflow",
  "auth.accessWorkflowDescription":
    "New account requests stay pending until an admin approves them.",
  "auth.accountCreated":
    "Access request sent. An admin must approve your account before you can use the app.",
  "auth.accountCreatedConfirm":
    "Account created. If email confirmation is enabled, confirm your email first, then log in.",
  "auth.accountLoadError": "Your account status could not be loaded.",
  "auth.accountUnavailable.description":
    "Your account status could not be resolved. Try again once the account record is available.",
  "auth.accountUnavailable.title": "Account unavailable",
  "auth.accountStatusCheckError":
    "We could not check your account status. Please wait a moment, then try again.",
  "auth.authIssue": "Sign-in problem",
  "auth.awaitingApproval.description":
    "Your account is signed in, but access stays blocked until an admin approves it.",
  "auth.awaitingApproval.title": "Awaiting approval",
  "auth.confirmNewPassword": "Confirm new password",
  "auth.createAccount": "Request account",
  "auth.createWorkspace": "Create your workspace",
  "auth.emailAndPasswordRequired": "Email and password are required.",
  "auth.emailConfirmed":
    "Email confirmed. Access stays pending until an admin approves your account.",
  "auth.alreadyApproved": "Already approved?",
  "auth.developedBy": "Developed by NNPC AI",
  "auth.forgotPassword": "Reset Password",
  "auth.initializing": "Initializing",
  "auth.loadingSecureWorkspace": "Loading secure workspace",
  "auth.login": "Log in",
  "auth.loginDescription": "Use your approved company account to open the expense form.",
  "auth.loginSucceededNoToken": "Login succeeded but no session token was returned.",
  "auth.missingRecoveryLink":
    "The recovery link is missing. Request a new password reset email.",
  "auth.missingSupabase": "Missing database URL in .env.local.",
  "auth.newPassword": "New password",
  "auth.nextStep": "Next step",
  "auth.passwordRecovery": "Password recovery",
  "auth.passwordResetEmailSent":
    "Password reset email sent. Open the link from your inbox to choose a new password.",
  "auth.passwordsDoNotMatch": "The password confirmation does not match.",
  "auth.passwordUpdated": "Password updated. Log in with your new password.",
  "auth.passwordPlaceholder": "At least 8 characters",
  "auth.preparingWorkspace":
    "Preparing the expense console and restoring your access state.",
  "auth.productTitle": "Expense Form",
  "auth.recoveryDescription":
    "Save a new password here, then log back in.",
  "auth.recoveryInvalid":
    "The recovery link is invalid or expired. Request a new password reset email.",
  "auth.recoveryPrompt": "Choose a new password to finish resetting your account.",
  "auth.refreshStatus": "Refresh status",
  "auth.requestAccess": "Request access",
  "auth.requestAccessDescription":
    "Create an account request. You can use the app after an admin approves it.",
  "auth.requestSupabaseError":
    "The request could not reach the app database. Check your database URL and network access.",
  "auth.resetDescription":
    "Enter the email for the account. The auth service will send a recovery link so the user can set a new password.",
  "auth.resetEmailRequired": "Enter the email address for the account you want to reset.",
  "auth.resetIssue": "Reset issue",
  "auth.resetPassword": "Reset password",
  "auth.resetSupabaseError":
    "The reset request could not reach the auth service. Check your database URL and network access.",
  "auth.resettingAccessFor": "Resetting access for {email}.",
  "auth.saveNewPassword": "Save new password",
  "auth.savingNewPassword": "Saving new password...",
  "auth.sendResetLink": "Send reset link",
  "auth.sending": "Sending...",
  "auth.sessionExpired": "Your session expired. Log in again.",
  "auth.setNewPassword": "Set a new password",
  "auth.signup": "Request access",
  "auth.supabaseAuthOnly":
    "Email/password authentication only. New accounts enter a pending approval queue before they can use the app.",
  "auth.needAccess": "Need access?",
  "auth.useEightChars": "Use at least 8 characters for the new password.",
  "auth.working": "Working...",
  "dashboard.createForDate": "Create expense for this date",
  "dashboard.description": "Create, view, and edit your daily expense claims.",
  "dashboard.errorLoadSummaries":
    "We could not load your expense list. Please try again, or contact your admin if this keeps happening.",
  "dashboard.expenseDate": "Expense date",
  "dashboard.loadingReports": "Loading your expenses...",
  "dashboard.noSavedDates": "No expenses saved yet.",
  "dashboard.noSavedDatesDescription":
    "Choose a date above and create your first expense form.",
  "dashboard.openForDate": "Open expense for this date",
  "dashboard.recentExpenses": "Recent expenses",
  "dashboard.title": "My Expenses",
  "company.addCompany": "Add company",
  "company.companyCouldNotSave": "The company could not be saved to the database.",
  "company.companyCouldNotUpdate": "The company could not be updated in the database.",
  "company.editCompany": "Edit company",
  "company.exportReady": "Export ready",
  "company.headerPreview": "Header preview",
  "company.headerPrinted": "This exact header is printed on the export form.",
  "company.headerReused":
    "This header will show anywhere the saved company is reused for export.",
  "company.keepCurrentLogo": "Keep current logo",
  "company.library": "Library",
  "company.libraryDescription":
    "Save reusable company names and logos once, then edit or reuse them from each day sheet before export.",
  "company.loadError": "Saved companies could not be loaded from the database.",
  "company.loading": "Loading saved companies from the database...",
  "company.logoPreview": "Company logo preview",
  "company.nameAppears": "Your saved company name appears here",
  "company.nameRequired": "Company name is required.",
  "company.newHeader": "New header",
  "company.noCompanies": "No companies saved yet.",
  "company.noTaxId": "No tax ID saved",
  "company.replaceLogo": "Replace company logo",
  "company.replacementLogoReadError": "The replacement logo could not be read.",
  "company.saveCompany": "Save company",
  "company.savedCount": "{count} saved",
  "company.savedHeader": "Saved header",
  "company.savedMessage": "Company header saved. It is ready for the export selector.",
  "company.saveFullHeader":
    "Save the full PDF header once, including the address that prints in the top-right area.",
  "company.selectedLogoReadError": "The selected logo could not be read.",
  "company.updateDescription":
    "Update the saved company name, tax ID, address, or logo. The changes will be available in the export selector right away.",
  "company.updated": "{companyName} updated.",
  "company.updatedPreview": "Updated preview",
  "company.uploadLogoRequired": "Upload a company logo before saving.",
  "profile.blankDepartment": "Blank until you add one",
  "profile.defaultDepartment": "Default department",
  "profile.defaultEmployeeName": "Default employee name",
  "profile.defaultFormValues": "Default form values",
  "profile.formDescription":
    "These values prefill new expense pages. You can still adjust them per report.",
  "profile.loadError": "Your profile could not be loaded from the database.",
  "profile.loading": "Loading your profile from the database...",
  "profile.nameFallback": "Will fall back to your email name",
  "profile.profileIssue": "Profile issue",
  "profile.profileSaved": "Profile saved",
  "profile.saveError": "Your profile could not be saved.",
  "profile.saveProfile": "Save profile",
  "profile.savedMessage": "Profile saved. New expense pages will use these defaults.",
  "profile.userProfile": "User profile",
  "profile.yourDepartmentPlaceholder": "Your department for new expense forms",
  "profile.yourNamePlaceholder": "Your name for new expense forms",
  "admin.abilities": "Abilities",
  "admin.activeInPeriod": "{count} active in {period}",
  "admin.adminDashboard": "Admin Dashboard",
  "admin.adminDashboardUnavailable": "Admin Dashboard Unavailable",
  "admin.dashboardLoadError": "The admin expense dashboard could not be loaded.",
  "admin.monthTotal": "Month Total",
  "admin.noDashboardData": "No admin dashboard data available.",
  "admin.noSyncedUsers": "No synced user accounts were found.",
  "admin.openUserDetail": "Open",
  "admin.userList": "User List",
  "admin.userListDescription":
    "Quick summary only. Open a user to view daily expense detail.",
  "admin.users": "Users",
  "admin.yearTotal": "Year Total",
  "admin.yearTotalColumn": "{year} Total",
} as const;

const th: Record<keyof typeof en, string> = {
  "common.accountState": "สถานะบัญชี",
  "common.active": "ใช้งานอยู่",
  "common.admin": "ผู้ดูแล",
  "common.backToDashboard": "กลับไปแดชบอร์ด",
  "common.cancel": "ยกเลิก",
  "common.centralAdmin": "ผู้ดูแลส่วนกลาง",
  "common.companyAddress": "ที่อยู่บริษัท",
  "common.companyLogo": "โลโก้บริษัท",
  "common.companyName": "ชื่อบริษัท",
  "common.companyTaxId": "เลขประจำตัวผู้เสียภาษี",
  "common.create": "สร้าง",
  "common.date": "วันที่",
  "common.days": "วัน",
  "common.department": "แผนก",
  "common.edit": "แก้ไข",
  "common.email": "อีเมล",
  "common.fullName": "ชื่อ-นามสกุล",
  "common.language": "ภาษา",
  "common.loading": "กำลังโหลด...",
  "common.logo": "โลโก้",
  "common.logout": "ออกจากระบบ",
  "common.month": "เดือน",
  "common.noSpend": "ไม่มีค่าใช้จ่าย",
  "common.open": "เปิด",
  "common.password": "รหัสผ่าน",
  "common.preview": "ตัวอย่าง",
  "common.reference": "เลขอ้างอิง",
  "common.role": "บทบาท",
  "common.saveChanges": "บันทึกการแก้ไข",
  "common.saving": "กำลังบันทึก...",
  "common.settings": "ตั้งค่า",
  "common.status": "สถานะ",
  "common.taxId": "เลขผู้เสียภาษี {taxId}",
  "common.total": "รวม",
  "common.tryAgain": "ลองอีกครั้ง",
  "common.update": "อัปเดต",
  "common.user": "ผู้ใช้",
  "nav.admin": "ผู้ดูแล",
  "nav.companies": "ข้อมูลบริษัท",
  "nav.expenseInsight": "รายงาน",
  "nav.expenses": "ค่าใช้จ่ายของฉัน",
  "nav.primary": "หลัก",
  "nav.profile": "โปรไฟล์ของฉัน",
  "nav.setup": "ตั้งค่า",
  "nav.userManagement": "จัดการผู้ใช้",
  "nav.workspace": "พื้นที่ทำงาน",
  "settings.brandPalette": "พาเลตแบรนด์",
  "settings.cleanReviewMode": "โหมดตรวจทานสว่าง",
  "settings.dark": "มืด",
  "settings.darkScreenMode": "หน้าจอมืดกว่า",
  "settings.defaultStartupMode": "โหมดเริ่มต้น",
  "settings.description":
    "ค่าเริ่มต้นเป็นโหมดสว่างสำหรับงานองค์กร ใช้สวิตช์ธีมเมื่อคุณต้องการหน้าจอที่มืดกว่า",
  "settings.displaySettings": "ตั้งค่าการแสดงผล",
  "settings.languageDescription": "เลือกภาษาของเมนู แบบฟอร์ม และข้อความระบบ",
  "settings.light": "สว่าง",
  "settings.session": "เซสชัน",
  "settings.sessionDescription": "ต้นแบบนี้จัดเก็บรายงานและไฟล์ใน SQL Server",
  "settings.signInSession": "เข้าสู่ระบบเพื่อโหลดเซสชันผู้ใช้",
  "settings.themeDescription": "สลับอินเทอร์เฟซระหว่างพื้นที่ทำงานโหมดสว่างและมุมมองที่มืดกว่า",
  "settings.themeMode": "โหมดธีม",
  "settings.workspaceControls": "การควบคุมพื้นที่ทำงาน",
  "auth.accessDenied.description":
    "บัญชีของคุณได้รับอนุมัติแล้ว แต่ส่วนนี้เปิดให้เฉพาะบทบาทผู้ดูแลเท่านั้น",
  "auth.accessDenied.title": "ไม่มีสิทธิ์เข้าถึง",
  "auth.accessDisabled.description": "บัญชีนี้ถูกปิดใช้งานและยังไม่สามารถใช้ระบบหลักได้",
  "auth.accessDisabled.title": "การเข้าถึงถูกปิด",
  "auth.accessWorkflow": "ขั้นตอนการเข้าถึง",
  "auth.accessWorkflowDescription":
    "คำขอบัญชีใหม่จะรอจนกว่าผู้ดูแลอนุมัติ",
  "auth.accountCreated":
    "ส่งคำขอเข้าใช้งานแล้ว ผู้ดูแลต้องอนุมัติบัญชีก่อนจึงจะใช้แอปได้",
  "auth.accountCreatedConfirm":
    "สร้างบัญชีแล้ว หากเปิดยืนยันอีเมล ให้ยืนยันอีเมลก่อนแล้วค่อยเข้าสู่ระบบ",
  "auth.accountLoadError": "ไม่สามารถโหลดสถานะบัญชีของคุณ",
  "auth.accountUnavailable.description":
    "ไม่สามารถตรวจสอบสถานะบัญชีได้ ลองอีกครั้งเมื่อมีข้อมูลบัญชีพร้อมใช้งาน",
  "auth.accountUnavailable.title": "บัญชีไม่พร้อมใช้งาน",
  "auth.accountStatusCheckError":
    "ยังตรวจสอบสถานะบัญชีไม่ได้ โปรดรอสักครู่แล้วลองอีกครั้ง",
  "auth.authIssue": "ปัญหาการเข้าสู่ระบบ",
  "auth.awaitingApproval.description":
    "บัญชีของคุณเข้าสู่ระบบแล้ว แต่ยังถูกบล็อกจนกว่าผู้ดูแลจะอนุมัติ",
  "auth.awaitingApproval.title": "รอการอนุมัติ",
  "auth.confirmNewPassword": "ยืนยันรหัสผ่านใหม่",
  "auth.createAccount": "ขอบัญชี",
  "auth.createWorkspace": "สร้างพื้นที่ทำงาน",
  "auth.emailAndPasswordRequired": "ต้องกรอกอีเมลและรหัสผ่าน",
  "auth.emailConfirmed": "ยืนยันอีเมลแล้ว สิทธิ์เข้าใช้งานยังรอให้ผู้ดูแลอนุมัติ",
  "auth.alreadyApproved": "ได้รับอนุมัติแล้ว?",
  "auth.developedBy": "พัฒนาโดย NNPC AI",
  "auth.forgotPassword": "รีเซ็ตรหัสผ่าน",
  "auth.initializing": "กำลังเริ่มต้น",
  "auth.loadingSecureWorkspace": "กำลังโหลดพื้นที่ทำงานที่ปลอดภัย",
  "auth.login": "เข้าสู่ระบบ",
  "auth.loginDescription": "ใช้บัญชีบริษัทที่ได้รับอนุมัติเพื่อเปิดฟอร์มค่าใช้จ่าย",
  "auth.loginSucceededNoToken": "เข้าสู่ระบบสำเร็จ แต่ไม่ได้รับโทเคนเซสชัน",
  "auth.missingRecoveryLink": "ไม่พบลิงก์กู้คืน โปรดขออีเมลรีเซ็ตรหัสผ่านใหม่",
  "auth.missingSupabase": "ไม่มี database URL ใน .env.local",
  "auth.newPassword": "รหัสผ่านใหม่",
  "auth.nextStep": "ขั้นตอนถัดไป",
  "auth.passwordRecovery": "กู้คืนรหัสผ่าน",
  "auth.passwordResetEmailSent":
    "ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว เปิดลิงก์ในกล่องจดหมายเพื่อเลือกรหัสผ่านใหม่",
  "auth.passwordsDoNotMatch": "รหัสผ่านยืนยันไม่ตรงกัน",
  "auth.passwordUpdated": "อัปเดตรหัสผ่านแล้ว เข้าสู่ระบบด้วยรหัสผ่านใหม่",
  "auth.passwordPlaceholder": "อย่างน้อย 8 ตัวอักษร",
  "auth.preparingWorkspace": "กำลังเตรียมคอนโซลค่าใช้จ่ายและกู้คืนสถานะการเข้าถึง",
  "auth.productTitle": "Expense Form",
  "auth.recoveryDescription":
    "บันทึกรหัสผ่านใหม่ที่นี่ แล้วเข้าสู่ระบบอีกครั้ง",
  "auth.recoveryInvalid": "ลิงก์กู้คืนไม่ถูกต้องหรือหมดอายุ โปรดขออีเมลรีเซ็ตรหัสผ่านใหม่",
  "auth.recoveryPrompt": "เลือกรหัสผ่านใหม่เพื่อรีเซ็ตบัญชีให้เสร็จ",
  "auth.refreshStatus": "รีเฟรชสถานะ",
  "auth.requestAccess": "ขอเข้าใช้งาน",
  "auth.requestAccessDescription":
    "สร้างคำขอบัญชี คุณจะใช้แอปได้หลังจากผู้ดูแลอนุมัติ",
  "auth.requestSupabaseError":
    "คำขอเชื่อมต่อฐานข้อมูลแอปไม่สำเร็จ ตรวจสอบ database URL และเครือข่าย",
  "auth.resetDescription":
    "กรอกอีเมลของบัญชี ระบบยืนยันตัวตนจะส่งลิงก์กู้คืนเพื่อให้ผู้ใช้ตั้งรหัสผ่านใหม่",
  "auth.resetEmailRequired": "กรอกอีเมลของบัญชีที่ต้องการรีเซ็ต",
  "auth.resetIssue": "ปัญหาการรีเซ็ต",
  "auth.resetPassword": "รีเซ็ตรหัสผ่าน",
  "auth.resetSupabaseError":
    "ส่งคำขอรีเซ็ตไม่ถึงระบบยืนยันตัวตน ตรวจสอบ database URL และเครือข่าย",
  "auth.resettingAccessFor": "กำลังรีเซ็ตการเข้าถึงสำหรับ {email}",
  "auth.saveNewPassword": "บันทึกรหัสผ่านใหม่",
  "auth.savingNewPassword": "กำลังบันทึกรหัสผ่านใหม่...",
  "auth.sendResetLink": "ส่งลิงก์รีเซ็ต",
  "auth.sending": "กำลังส่ง...",
  "auth.sessionExpired": "เซสชันหมดอายุ โปรดเข้าสู่ระบบอีกครั้ง",
  "auth.setNewPassword": "ตั้งรหัสผ่านใหม่",
  "auth.signup": "ขอเข้าใช้งาน",
  "auth.supabaseAuthOnly":
    "ใช้การยืนยันตัวตนด้วยอีเมล/รหัสผ่านเท่านั้น บัญชีใหม่จะเข้าคิวรออนุมัติก่อนใช้แอป",
  "auth.needAccess": "ต้องการเข้าใช้งาน?",
  "auth.useEightChars": "ใช้รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร",
  "auth.working": "กำลังทำงาน...",
  "dashboard.createForDate": "สร้างค่าใช้จ่ายสำหรับวันที่นี้",
  "dashboard.description": "สร้าง ดู และแก้ไขคำขอเบิกค่าใช้จ่ายรายวันของคุณ",
  "dashboard.errorLoadSummaries":
    "ไม่สามารถโหลดรายการค่าใช้จ่ายของคุณ โปรดลองอีกครั้ง หรือติดต่อผู้ดูแลหากยังเกิดปัญหา",
  "dashboard.expenseDate": "วันที่ค่าใช้จ่าย",
  "dashboard.loadingReports": "กำลังโหลดค่าใช้จ่ายของคุณ...",
  "dashboard.noSavedDates": "ยังไม่มีค่าใช้จ่ายที่บันทึก",
  "dashboard.noSavedDatesDescription":
    "เลือกวันที่ด้านบนแล้วสร้างฟอร์มค่าใช้จ่ายแรกของคุณ",
  "dashboard.openForDate": "เปิดค่าใช้จ่ายสำหรับวันที่นี้",
  "dashboard.recentExpenses": "ค่าใช้จ่ายล่าสุด",
  "dashboard.title": "ค่าใช้จ่ายของฉัน",
  "company.addCompany": "เพิ่มบริษัท",
  "company.companyCouldNotSave": "ไม่สามารถบันทึกบริษัทไปยังฐานข้อมูล",
  "company.companyCouldNotUpdate": "ไม่สามารถอัปเดตบริษัทในฐานข้อมูล",
  "company.editCompany": "แก้ไขบริษัท",
  "company.exportReady": "พร้อมส่งออก",
  "company.headerPreview": "ตัวอย่างหัวเอกสาร",
  "company.headerPrinted": "หัวเอกสารนี้จะถูกพิมพ์ในฟอร์มส่งออก",
  "company.headerReused": "หัวเอกสารนี้จะแสดงทุกที่ที่นำบริษัทที่บันทึกไว้ไปใช้ส่งออก",
  "company.keepCurrentLogo": "ใช้โลโก้เดิม",
  "company.library": "คลังข้อมูล",
  "company.libraryDescription":
    "บันทึกชื่อบริษัทและโลโก้ที่ใช้ซ้ำได้ครั้งเดียว แล้วแก้ไขหรือนำไปใช้จากชีทรายวันก่อนส่งออก",
  "company.loadError": "ไม่สามารถโหลดบริษัทที่บันทึกจากฐานข้อมูล",
  "company.loading": "กำลังโหลดบริษัทที่บันทึกจากฐานข้อมูล...",
  "company.logoPreview": "ตัวอย่างโลโก้บริษัท",
  "company.nameAppears": "ชื่อบริษัทที่บันทึกจะแสดงที่นี่",
  "company.nameRequired": "ต้องกรอกชื่อบริษัท",
  "company.newHeader": "หัวเอกสารใหม่",
  "company.noCompanies": "ยังไม่มีบริษัทที่บันทึก",
  "company.noTaxId": "ยังไม่ได้บันทึกเลขผู้เสียภาษี",
  "company.replaceLogo": "เปลี่ยนโลโก้บริษัท",
  "company.replacementLogoReadError": "ไม่สามารถอ่านโลโก้ใหม่ที่เลือก",
  "company.saveCompany": "บันทึกบริษัท",
  "company.savedCount": "บันทึกแล้ว {count} รายการ",
  "company.savedHeader": "หัวเอกสารที่บันทึก",
  "company.savedMessage": "บันทึกหัวบริษัทแล้ว พร้อมใช้ในตัวเลือกส่งออก",
  "company.saveFullHeader":
    "บันทึกหัวเอกสาร PDF แบบครบถ้วนครั้งเดียว รวมถึงที่อยู่ที่จะพิมพ์ด้านขวาบน",
  "company.selectedLogoReadError": "ไม่สามารถอ่านโลโก้ที่เลือก",
  "company.updateDescription":
    "อัปเดตชื่อบริษัท เลขผู้เสียภาษี ที่อยู่ หรือโลโก้ การเปลี่ยนแปลงจะพร้อมใช้ในตัวเลือกส่งออกทันที",
  "company.updated": "อัปเดต {companyName} แล้ว",
  "company.updatedPreview": "ตัวอย่างที่อัปเดต",
  "company.uploadLogoRequired": "อัปโหลดโลโก้บริษัทก่อนบันทึก",
  "profile.blankDepartment": "ว่างจนกว่าจะเพิ่มข้อมูล",
  "profile.defaultDepartment": "แผนกเริ่มต้น",
  "profile.defaultEmployeeName": "ชื่อพนักงานเริ่มต้น",
  "profile.defaultFormValues": "ค่าเริ่มต้นของฟอร์ม",
  "profile.formDescription": "ค่านี้จะเติมในหน้าค่าใช้จ่ายใหม่ และยังแก้ไขได้ในแต่ละรายงาน",
  "profile.loadError": "ไม่สามารถโหลดโปรไฟล์ของคุณจากฐานข้อมูล",
  "profile.loading": "กำลังโหลดโปรไฟล์จากฐานข้อมูล...",
  "profile.nameFallback": "จะใช้ชื่อจากอีเมลของคุณแทน",
  "profile.profileIssue": "ปัญหาโปรไฟล์",
  "profile.profileSaved": "บันทึกโปรไฟล์แล้ว",
  "profile.saveError": "ไม่สามารถบันทึกโปรไฟล์ของคุณ",
  "profile.saveProfile": "บันทึกโปรไฟล์",
  "profile.savedMessage": "บันทึกโปรไฟล์แล้ว หน้าเบิกค่าใช้จ่ายใหม่จะใช้ค่านี้เป็นค่าเริ่มต้น",
  "profile.userProfile": "โปรไฟล์ผู้ใช้",
  "profile.yourDepartmentPlaceholder": "แผนกของคุณสำหรับฟอร์มใหม่",
  "profile.yourNamePlaceholder": "ชื่อของคุณสำหรับฟอร์มใหม่",
  "admin.abilities": "ความสามารถ",
  "admin.activeInPeriod": "ใช้งาน {count} คนใน {period}",
  "admin.adminDashboard": "แดชบอร์ดผู้ดูแล",
  "admin.adminDashboardUnavailable": "แดชบอร์ดผู้ดูแลไม่พร้อมใช้งาน",
  "admin.dashboardLoadError": "ไม่สามารถโหลดแดชบอร์ดค่าใช้จ่ายผู้ดูแล",
  "admin.monthTotal": "รวมประจำเดือน",
  "admin.noDashboardData": "ไม่มีข้อมูลแดชบอร์ดผู้ดูแล",
  "admin.noSyncedUsers": "ไม่พบบัญชีผู้ใช้ที่ซิงก์",
  "admin.openUserDetail": "เปิด",
  "admin.userList": "รายชื่อผู้ใช้",
  "admin.userListDescription": "แสดงสรุปอย่างรวดเร็ว เปิดผู้ใช้เพื่อดูรายละเอียดค่าใช้จ่ายรายวัน",
  "admin.users": "ผู้ใช้",
  "admin.yearTotal": "รวมประจำปี",
  "admin.yearTotalColumn": "รวมปี {year}",
};

export type TranslationKey = keyof typeof en;

const dictionaries = { en, th } satisfies Record<
  Locale,
  Record<TranslationKey, string>
>;

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  return window.localStorage.getItem(I18N_STORAGE_KEY) === "th" ? "th" : "en";
}

function readServerLocale(): Locale {
  return "en";
}

function subscribeLocaleChange(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(I18N_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(I18N_STORAGE_EVENT, onStoreChange);
  };
}

function interpolate(template: string, values?: TranslationValues) {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocaleChange, readStoredLocale, readServerLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(I18N_STORAGE_KEY, nextLocale);
    window.dispatchEvent(new Event(I18N_STORAGE_EVENT));
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => interpolate(dictionaries[locale][key], values),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }

  return context;
}
