import { loadMedia } from "@/app/(app)/automations/media";
import { AutomationForm } from "@/components/AutomationForm";

export default async function NewAutomation({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { media, username, error } = await loadMedia();
  return <AutomationForm media={media} username={username} mediaError={error} msg={(await searchParams).msg} />;
}
