import { notFound } from "next/navigation";
import { one } from "@/lib/db";
import { AUTOMATION_SELECT, type Automation } from "@/lib/engine";
import { loadMedia } from "@/app/(app)/automations/media";
import { AutomationForm } from "@/components/AutomationForm";

export default async function EditAutomation({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const a = await one<Automation>(`${AUTOMATION_SELECT} WHERE a.id = ?`, [Number((await params).id)]);
  if (!a) notFound();
  const { media, username, error } = await loadMedia();
  return <AutomationForm a={a} media={media} username={username} mediaError={error} msg={(await searchParams).msg} />;
}
