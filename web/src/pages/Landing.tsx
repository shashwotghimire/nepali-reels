import Login from "@/components/Login";

function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Nepali Reels</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <Login />
      </div>
    </div>
  );
}

export default Landing;
