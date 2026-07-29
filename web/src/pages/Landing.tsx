import { buttonVariants } from "@/components/ui/button";
import Login from "@/components/auth/Login";
import Footer from "@/components/common/Footer";
import logoSrc from "@/assets/logo.png";
import { Link } from "react-router-dom";

const steps = [
  {
    number: "01",
    title: "Enter a topic",
    description: "Give Nepali Reels a topic or idea. The AI writes a script, generates voiceover, and assembles the video.",
  },
  {
    number: "02",
    title: "Review your reel",
    description: "Preview the generated video in full before anything is published. You stay in control — nothing goes live without your sign-off.",
  },
  {
    number: "03",
    title: "Publish to TikTok",
    description: "With one click, the video is pushed directly to your connected TikTok account via the official TikTok API.",
  },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="Nepali Reels" className="size-7 rounded-md" />
            <span className="font-semibold tracking-tight">Nepali Reels</span>
          </div>
          <a href="#get-started" className={buttonVariants({ size: "sm" })}>
            Sign in
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-green-500" />
            Available now · Free to use
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Turn any topic into a<br />Nepali-language TikTok
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Nepali Reels is an AI-powered pipeline that writes, voices, and edits short-form videos in Nepali —
            then publishes them directly to TikTok after your review.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="#get-started" className={buttonVariants({ size: "lg" })}>
              Get started
            </a>
            <a href="#how-it-works" className={buttonVariants({ size: "lg", variant: "outline" })}>
              See how it works
            </a>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t bg-card">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2 className="mb-12 text-center text-2xl font-semibold tracking-tight">How it works</h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {steps.map((s) => (
                <div key={s.number} className="flex flex-col gap-3">
                  <span className="text-3xl font-bold text-primary/30">{s.number}</span>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Who is it for?</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nepali Reels is built for Nepali-language content creators, educators, and anyone who wants to
            grow a TikTok audience without spending hours on video production. The platform is open to the
            public — no invite required.
          </p>
        </section>

        {/* Get started */}
        <section id="get-started" className="border-t bg-card">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-5 px-6 py-20">
            <div className="flex flex-col items-center gap-1 text-center">
              <img src={logoSrc} alt="Nepali Reels" className="mb-1 size-10 rounded-xl" />
              <h2 className="text-xl font-semibold tracking-tight">Sign in to Nepali Reels</h2>
              <p className="text-sm text-muted-foreground">
                By continuing you agree to our{" "}
                <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
            <Login />
          </div>
        </section>

        {/* Contact */}
        <section className="border-t">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="mb-3 text-xl font-semibold tracking-tight">Questions or support?</h2>
            <p className="text-sm text-muted-foreground">
              Reach us at{" "}
              <a
                href="mailto:shashwotghimire.sg@gmail.com"
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                shashwotghimire.sg@gmail.com
              </a>
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
