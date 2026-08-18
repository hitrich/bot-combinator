/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_PORTAL_URL?: string;
  readonly VITE_PORTAL_DEMO_MODE?: string;
  readonly VITE_DESKTOP_VERSION?: string;
  readonly VITE_DESKTOP_MACOS_ARM64_URL?: string;
  readonly VITE_DESKTOP_MACOS_X64_URL?: string;
  readonly VITE_DESKTOP_WINDOWS_X64_URL?: string;
  readonly VITE_DESKTOP_WINDOWS_ARM64_URL?: string;
  readonly VITE_DESKTOP_LINUX_X64_URL?: string;
  readonly VITE_DESKTOP_LINUX_ARM64_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
