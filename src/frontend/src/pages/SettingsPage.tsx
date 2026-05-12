import { Settings } from "lucide-react";

export function SettingsPage() {
  return (
    <div
      className="flex flex-col gap-6 px-4 py-6 max-w-lg mx-auto pb-24"
      data-ocid="settings.page"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Settings
          </h1>
          <p className="text-xs text-muted-foreground">App preferences</p>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-card card-neumorphic border border-border/40">
        <p className="text-sm text-muted-foreground text-center py-6">
          Settings and preferences coming soon.
        </p>
      </div>
    </div>
  );
}
