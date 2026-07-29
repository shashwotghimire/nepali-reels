export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 pb-20 text-sm leading-relaxed text-foreground">
      <h1 className="mb-1 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-muted-foreground">Last updated: July 10, 2026</p>

      <p className="mb-6">
        Nepali Reels ("we", "us", or "our") operates an automated content pipeline that generates,
        fact-checks, produces, and publishes short-form video content to third-party platforms
        including TikTok, YouTube, and Instagram, on behalf of connected accounts. This Privacy
        Policy explains what information we collect, how we use it, and the choices you have.
      </p>

      <Section title="1. Information We Collect">
        <ul>
          <li>
            <strong>Account & authorization data:</strong> When you connect a TikTok, YouTube, or
            Instagram account, we receive OAuth access tokens, refresh tokens, and basic profile
            information (such as your username, display name, and profile picture) as permitted by
            the scopes you approve.
          </li>
          <li>
            <strong>Content data:</strong> Scripts, source material used for fact-checking,
            generated video files, thumbnails, captions, and metadata associated with content we
            create and publish on your behalf.
          </li>
          <li>
            <strong>Analytics data:</strong> Publicly available performance metrics returned by
            connected platforms' APIs, such as views, likes, comments, shares, and watch time, used
            to improve future content generation.
          </li>
          <li>
            <strong>Technical data:</strong> Log data such as IP address, device/browser type, and
            timestamps, collected automatically when you use our dashboard.
          </li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul>
          <li>To authenticate and publish content to the platforms you've connected.</li>
          <li>To generate, fact-check, and refine video scripts and content.</li>
          <li>
            To analyze performance and improve the relevance and quality of future content through
            an analytics feedback loop.
          </li>
          <li>To maintain, secure, and troubleshoot our service.</li>
          <li>
            To comply with legal obligations and the platform policies of TikTok, YouTube, and
            Instagram.
          </li>
        </ul>
      </Section>

      <Section title="3. How We Share Your Information">
        <p>We do not sell your personal information. We share data only in the following circumstances:</p>
        <ul>
          <li>
            <strong>With connected platforms:</strong> Content and required metadata are transmitted
            to TikTok, YouTube, and Instagram through their official APIs solely to publish content
            on your behalf.
          </li>
          <li>
            <strong>Service providers:</strong> We may use third-party infrastructure providers
            (e.g., cloud hosting, AI model providers) strictly to operate our pipeline. These
            providers are bound by confidentiality obligations and do not use your data for their
            own purposes.
          </li>
          <li>
            <strong>Legal requirements:</strong> If required by law, regulation, or valid legal
            process.
          </li>
        </ul>
      </Section>

      <Section title="4. Data Retention">
        <p>
          We retain OAuth tokens for as long as your account remains connected. You may disconnect
          your account at any time, which revokes our access and stops further use of associated
          tokens. Generated content and analytics data may be retained for a reasonable period to
          support the content pipeline and are deleted or anonymized when no longer needed.
        </p>
      </Section>

      <Section title="5. Your Rights and Choices">
        <ul>
          <li>
            You may disconnect any linked TikTok, YouTube, or Instagram account at any time via our
            dashboard or directly through the respective platform's app permissions settings.
          </li>
          <li>
            You may request access to, correction of, or deletion of your personal data by
            contacting us at the email below.
          </li>
          <li>
            Revoking platform authorization stops future publishing but does not automatically
            delete already-published content, which remains subject to the relevant platform's own
            policies.
          </li>
        </ul>
      </Section>

      <Section title="6. Data Security">
        <p>
          We use industry-standard safeguards, including encrypted storage of access tokens and
          restricted internal access, to protect your information. No method of transmission or
          storage is 100% secure, and we cannot guarantee absolute security.
        </p>
      </Section>

      <Section title="7. Third-Party Platforms">
        <p>
          Our use of information received from TikTok's, YouTube's, and Instagram's APIs is subject
          to each platform's own developer policies and terms, in addition to this Privacy Policy.
          We encourage you to review those platforms' own privacy policies.
        </p>
      </Section>

      <Section title="8. Children's Privacy">
        <p>
          Nepali Reels is not directed at individuals under the age of 13 (or the applicable
          minimum age in your jurisdiction), and we do not knowingly collect personal information
          from children.
        </p>
      </Section>

      <Section title="9. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be reflected
          by updating the "Last updated" date above.
        </p>
      </Section>

      <Section title="10. Contact Us">
        <div className="rounded-lg bg-muted px-5 py-4">
          <p>
            If you have questions about this Privacy Policy or wish to exercise your data rights,
            contact us at:
          </p>
          <p className="mt-1">
            Email:{" "}
            <a href="mailto:gshashwot@gmail.com" className="text-primary hover:underline">
              gshashwot@gmail.com
            </a>
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 border-b pb-1 text-lg font-semibold">{title}</h2>
      <div className="space-y-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{children}</div>
    </section>
  );
}
