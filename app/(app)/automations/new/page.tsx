import { loadMedia } from "@/app/(app)/automations/media";
import { AutomationForm } from "@/components/AutomationForm";
import { templateByKey } from "@/lib/templates";

export default async function NewAutomation({ searchParams }: { searchParams: Promise<{ msg?: string; template?: string }> }) {
  const [{ media, username, error }, sp] = await Promise.all([loadMedia(), searchParams]);
  return <AutomationForm t={templateByKey(sp.template)} media={media} username={username} mediaError={error} msg={sp.msg} />;
}
