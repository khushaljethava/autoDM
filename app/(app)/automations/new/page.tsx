import { loadMedia } from "@/app/(app)/automations/media";
import { AutomationForm } from "@/components/AutomationForm";

export default async function NewAutomation({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { media, error } = await loadMedia();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">New automation</h1>
      <AutomationForm media={media} mediaError={error} msg={(await searchParams).msg} />
    </div>
  );
}
