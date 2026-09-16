import ChannelStyleManager from "@/components/pipeline/ChannelStyleManager";

function Settings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Settings</h1>
      <p className="text-muted-foreground">Manage your account and preferences.</p>
      <div className="mt-8 max-w-3xl"><ChannelStyleManager /></div>
    </div>
  );
}

export default Settings;
