import { SettingsClient } from "@/components/settings/settings-client";
import { getSettings } from "@/lib/actions/dashboard";

export default async function SettingsPage() {
  const settings = await getSettings();
  return <SettingsClient settings={settings} />;
}
