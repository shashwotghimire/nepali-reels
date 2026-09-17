import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChannelStyles, useCreateChannelStyle, useDeleteChannelStyle, useGenerationEntitlements } from "@/hooks/api/usePipeline";

export default function ChannelStyleManager() {
  const { data: styles = [] } = useChannelStyles();
  const { data: access } = useGenerationEntitlements();
  const create = useCreateChannelStyle(); const remove = useDeleteChannelStyle();
  const [name, setName] = useState(""); const [channelName, setChannelName] = useState(""); const [preset, setPreset] = useState("default"); const [logo, setLogo] = useState<File | null>(null);
  const slots = access?.plan.styleSlots ?? 0;
  return <div className="space-y-4"><div><h2 className="font-semibold">Channel styles</h2><p className="text-sm text-muted-foreground">Saved {styles.length} of {slots}. The selected style is composited into the delivered video.</p></div>
    {slots > 0 && <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(); form.set("name", name); form.set("channelName", channelName); form.set("captionPreset", preset); if (logo) form.set("logo", logo); create.mutate(form, { onSuccess: () => { setName(""); setChannelName(""); setLogo(null); } }); }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Style name" required /><Input value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Channel name" required />
      <Select value={preset} onValueChange={(value) => value && setPreset(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Default captions</SelectItem><SelectItem value="bold">Bold captions</SelectItem><SelectItem value="minimal">Minimal captions</SelectItem></SelectContent></Select>
      <Input type="file" accept="image/png,image/jpeg" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /><Button disabled={create.isPending || styles.length >= slots}>Save style</Button>
    </form>}
    <div className="space-y-2">{styles.map((style) => <div key={style.id} className="flex items-center justify-between rounded border p-3"><div><p className="font-medium">{style.name}</p><p className="text-sm text-muted-foreground">{style.channelName} · {style.captionPreset}</p></div><Button variant="outline" size="sm" onClick={() => remove.mutate(style.id)}>Delete</Button></div>)}</div>
  </div>;
}
