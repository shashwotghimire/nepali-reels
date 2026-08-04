import Footer from "@/components/common/Footer";
import logoSrc from "@/assets/logo.svg";
import { Link } from "react-router-dom";

/* Hallmark · macrostructure: Bento Grid · genre: playful · theme: Brutal
 * nav: N7 Brutal Slab · footer: Ft5 Statement · enrichment: Tier-B SVG
 * axes: light / display-heavy / warm */

function PhoneIllo() {
  return (
    <svg
      className="lnd-hero-illo"
      viewBox="0 0 280 380"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* phone body */}
      <rect x="20" y="10" width="240" height="360" rx="24" fill="var(--lnd-paper)" stroke="var(--lnd-ink)" strokeWidth="3"/>
      {/* screen */}
      <rect x="34" y="36" width="212" height="308" rx="10" fill="var(--lnd-accent)" stroke="var(--lnd-ink)" strokeWidth="2"/>
      {/* TikTok-style vertical video bars */}
      <rect x="48" y="52" width="184" height="276" rx="6" fill="oklch(0.15 0 0)" stroke="var(--lnd-ink)" strokeWidth="1.5"/>
      {/* waveform decoration */}
      <rect x="62" y="180" width="8" height="40" rx="3" fill="var(--lnd-accent)" opacity="0.9"/>
      <rect x="76" y="162" width="8" height="74" rx="3" fill="var(--lnd-accent)" opacity="0.9"/>
      <rect x="90" y="172" width="8" height="54" rx="3" fill="var(--lnd-accent)" opacity="0.9"/>
      <rect x="104" y="155" width="8" height="88" rx="3" fill="var(--lnd-green)" opacity="0.9"/>
      <rect x="118" y="168" width="8" height="62" rx="3" fill="var(--lnd-accent)" opacity="0.9"/>
      <rect x="132" y="150" width="8" height="98" rx="3" fill="var(--lnd-green)" opacity="0.9"/>
      <rect x="146" y="175" width="8" height="48" rx="3" fill="var(--lnd-accent)" opacity="0.9"/>
      <rect x="160" y="160" width="8" height="78" rx="3" fill="var(--lnd-accent)" opacity="0.9"/>
      <rect x="174" y="182" width="8" height="34" rx="3" fill="var(--lnd-green)" opacity="0.9"/>
      {/* "live" pill */}
      <rect x="62" y="58" width="42" height="18" rx="9" fill="oklch(0.62 0.22 25)" stroke="var(--lnd-ink)" strokeWidth="1.5"/>
      <text x="83" y="71" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="800" fill="white">LIVE</text>
      {/* fake username */}
      <rect x="62" y="290" width="90" height="10" rx="3" fill="oklch(0.7 0 0)" opacity="0.5"/>
      <rect x="62" y="306" width="130" height="8" rx="3" fill="oklch(0.5 0 0)" opacity="0.4"/>
      {/* side action icons */}
      <circle cx="214" cy="250" r="16" fill="oklch(0.25 0 0)" stroke="var(--lnd-ink)" strokeWidth="1.5"/>
      <path d="M207 250 L221 250 M214 243 L214 257" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="214" cy="290" r="16" fill="oklch(0.25 0 0)" stroke="var(--lnd-ink)" strokeWidth="1.5"/>
      <path d="M208 290 C208 286 212 283 214 283 C216 283 220 286 220 290 C220 294 216 297 214 297 C212 297 208 294 208 290Z" fill="none" stroke="white" strokeWidth="2"/>
      {/* home indicator */}
      <rect x="110" y="352" width="60" height="4" rx="2" fill="var(--lnd-ink)" opacity="0.25"/>
    </svg>
  );
}

function RocketIllo() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="64" height="64" aria-hidden="true">
      <circle cx="40" cy="40" r="38" fill="var(--lnd-green)" stroke="var(--lnd-ink)" strokeWidth="2"/>
      <path d="M40 14 C40 14 50 24 50 38 L40 48 L30 38 C30 24 40 14 40 14Z" fill="var(--lnd-ink)"/>
      <circle cx="40" cy="34" r="5" fill="var(--lnd-paper)" stroke="var(--lnd-ink)" strokeWidth="1.5"/>
      <path d="M30 38 L22 46 L30 44Z" fill="var(--lnd-ink)"/>
      <path d="M50 38 L58 46 L50 44Z" fill="var(--lnd-ink)"/>
      <path d="M34 48 L36 58 L40 54 L44 58 L46 48" fill="var(--lnd-accent)" stroke="var(--lnd-ink)" strokeWidth="1.5"/>
    </svg>
  );
}

function NepaliIllo() {
  return (
    <svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="80" height="60" aria-hidden="true">
      {/* simplified Devanagari-ish glyph for flavor, not real text */}
      <text x="8" y="44" fontFamily="serif" fontSize="38" fontWeight="900" fill="var(--lnd-ink)" opacity="0.15">न</text>
      <rect x="6" y="8" width="68" height="44" rx="8" fill="none" stroke="var(--lnd-ink)" strokeWidth="2" strokeDasharray="6 4"/>
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="lnd-root">
      {/* N7 Brutal Slab Nav */}
      <nav className="lnd-nav" aria-label="Main navigation">
        <a href="/" className="lnd-nav-brand">
          <img src={logoSrc} alt="" style={{ width: 28, height: 28 }} />
          Nepali Reels
        </a>
        <a href="#get-started" className="lnd-nav-cta">
          Sign in
        </a>
      </nav>

      {/* Hero — left text, right phone illustration */}
      <section className="lnd-hero" aria-labelledby="hero-heading">
        <div className="lnd-hero-left">
          <h1 className="lnd-hero-h1" id="hero-heading">
            Type a topic.{" "}
            <span className="accent-word">Get a TikTok.</span>{" "}
            In Nepali.
          </h1>
          <p className="lnd-hero-sub">
            A multi-agent AI pipeline writes the script, generates the
            voiceover, edits the video, and posts it to your TikTok — all
            from one sentence. You just press go.
          </p>
          <div className="lnd-hero-actions">
            <a href="#get-started" className="lnd-btn-primary">
              Make my first reel →
            </a>
            <a href="#how-it-works" className="lnd-btn-secondary">
              See how it works
            </a>
          </div>
        </div>
        <div className="lnd-hero-right">
          <PhoneIllo />
        </div>
      </section>

      {/* Bento Grid */}
      <main id="how-it-works">
        <div className="lnd-bento-wrap">
          <div className="lnd-bento">

            {/* Tile: Pitch */}
            <article className="lnd-tile lnd-tile--pitch">
              <p className="lnd-tile-label">What it does</p>
              <h2 className="lnd-tile-heading" style={{ fontSize: "clamp(1.4rem, 2.5vw, 2rem)" }}>
                You think of the idea.<br />
                We handle the rest.
              </h2>
              <p className="lnd-tile-body" style={{ marginTop: "0.75rem" }}>
                Script → voice → edit → post. The whole pipeline runs
                automatically. You review before it goes live — that's it.
              </p>
            </article>

            {/* Tile: Speed */}
            <article className="lnd-tile lnd-tile--free" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <p className="lnd-tile-label">Time to publish</p>
                <h3 className="lnd-tile-heading" style={{ fontSize: "1.25rem" }}>
                  Topic in.<br />TikTok out.
                </h3>
                <p className="lnd-tile-body">No editing software. No recording booth. No captions to type. The pipeline does it.</p>
              </div>
              <RocketIllo />
            </article>

            {/* Tile: Nepali-first — full width */}
            <article className="lnd-tile lnd-tile--nepali" style={{ display: "flex", alignItems: "center", gap: "var(--lnd-space-lg)", flexWrap: "wrap" }}>
              <NepaliIllo />
              <div>
                <p className="lnd-tile-label">Language</p>
                <h3 className="lnd-tile-heading" style={{ fontSize: "1.25rem" }}>Built for Nepali content.</h3>
                <p className="lnd-tile-body" style={{ maxWidth: "52ch" }}>
                  Not a translator bolted onto an English tool. The voiceover, script style,
                  and cultural framing are Nepali-first.
                </p>
              </div>
            </article>

            {/* Steps — user action */}
            <article className="lnd-tile lnd-tile--step1">
              <div className="lnd-step-num" aria-hidden="true">1</div>
              <h3 className="lnd-tile-heading" style={{ fontSize: "1.1rem" }}>Enter any topic</h3>
              <p className="lnd-tile-body">
                "The history of Mustang" · "How to make sel roti" · "Why ChatGPT is everywhere" —
                anything works.
              </p>
            </article>

            {/* Pipeline step A — AI */}
            <article className="lnd-tile lnd-tile--pipe-a">
              <div className="lnd-step-num lnd-step-num--auto" aria-hidden="true">2</div>
              <h3 className="lnd-tile-heading" style={{ fontSize: "1.1rem" }}>Script written by AI</h3>
              <p className="lnd-tile-body">
                A dedicated agent researches your topic and writes a punchy Nepali-language script
                optimised for short-form attention spans.
              </p>
            </article>

            {/* Pipeline step B — AI */}
            <article className="lnd-tile lnd-tile--pipe-b">
              <div className="lnd-step-num lnd-step-num--auto" aria-hidden="true">3</div>
              <h3 className="lnd-tile-heading" style={{ fontSize: "1.1rem" }}>Voiceover generated</h3>
              <p className="lnd-tile-body">
                A voice agent converts the script to audio — natural-sounding Nepali speech,
                timed to the video length.
              </p>
            </article>

            {/* Pipeline step C — AI */}
            <article className="lnd-tile lnd-tile--pipe-c">
              <div className="lnd-step-num lnd-step-num--auto" aria-hidden="true">4</div>
              <h3 className="lnd-tile-heading" style={{ fontSize: "1.1rem" }}>Video assembled</h3>
              <p className="lnd-tile-body">
                Another agent stitches the visuals, syncs the audio, and renders the final clip —
                captions included.
              </p>
            </article>

            {/* Step 5 — user action */}
            <article className="lnd-tile lnd-tile--step2">
              <div className="lnd-step-num" aria-hidden="true">5</div>
              <h3 className="lnd-tile-heading" style={{ fontSize: "1.1rem" }}>Review your reel</h3>
              <p className="lnd-tile-body">
                Preview the full video before anything is posted. Nothing goes live without your
                sign-off.
              </p>
            </article>

            {/* Step 6 — user action */}
            <article className="lnd-tile lnd-tile--step3">
              <div className="lnd-step-num" aria-hidden="true">6</div>
              <h3 className="lnd-tile-heading" style={{ fontSize: "1.1rem" }}>One-tap publish</h3>
              <p className="lnd-tile-body">
                Hit publish and it goes straight to your connected TikTok account via the official
                API. Done.
              </p>
            </article>

            {/* Sign in tile */}
            <article className="lnd-tile lnd-tile--signin" id="get-started">
              <p className="lnd-tile-label" style={{ color: "oklch(0.75 0.08 303)" }}>Ready?</p>
              <h2 className="lnd-tile-heading" style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)" }}>
                Sign in and make something.
              </h2>
              <p className="lnd-tile-body">
                Your TikTok account, your ideas. We just do the boring production work.
              </p>
              <div style={{ marginTop: "var(--lnd-space-md)" }}>
                <button
                  className="lnd-google-btn"
                  onClick={() => {
                    import("@/lib/auth-client").then(({ signIn }) =>
                      signIn.social({ provider: "google", callbackURL: `${window.location.origin}/dashboard` })
                    );
                  }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
              </div>
              <p style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "oklch(0.80 0.04 303)" }}>
                By continuing you agree to our{" "}
                <Link to="/terms" style={{ color: "oklch(0.92 0.06 303)", textUnderlineOffset: "3px", textDecoration: "underline" }}>
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy" style={{ color: "oklch(0.92 0.06 303)", textUnderlineOffset: "3px", textDecoration: "underline" }}>
                  Privacy Policy
                </Link>
                .
              </p>
            </article>

            {/* No-skills tile */}
            <article className="lnd-tile lnd-tile--noskills">
              <p className="lnd-tile-label">Who it's for</p>
              <h3 className="lnd-tile-heading" style={{ fontSize: "1.2rem" }}>
                Zero video production skills needed.
              </h3>
              <p className="lnd-tile-body">
                If you can type a sentence, you can have a Nepali TikTok up today. No editing,
                no voiceover recording, no captions.
              </p>
            </article>

          </div>
        </div>
      </main>

      {/* Contact */}
      <div className="lnd-contact">
        <p>
          Questions? Email{" "}
          <a href="mailto:gshashwot@gmail.com">
            gshashwot@gmail.com
          </a>
        </p>
      </div>

      {/* Ft5 Statement Footer */}
      <footer className="lnd-footer" aria-label="Site footer">
        <p className="lnd-footer-statement">
          Nepali ideas deserve a{" "}
          <span className="accent-word">bigger audience.</span>
        </p>
        <div className="lnd-footer-bottom">
          <span>© 2026 Nepali Reels</span>
          <nav className="lnd-footer-links" aria-label="Footer links">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <a href="mailto:gshashwot@gmail.com">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
