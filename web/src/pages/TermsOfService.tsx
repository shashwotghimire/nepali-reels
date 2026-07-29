export default function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 pb-20 text-sm leading-relaxed text-foreground">
      <h1 className="mb-1 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-muted-foreground">Last updated: July 10, 2026</p>

      <p className="mb-6">
        These Terms of Service ("Terms") govern your access to and use of Nepali Reels (the
        "Service"), an automated content pipeline that generates, fact-checks, produces, and
        publishes short-form video content to connected third-party platforms including TikTok,
        YouTube, and Instagram. By using the Service, you agree to these Terms.
      </p>

      <Section title="1. Eligibility">
        <p>
          You must be at least 13 years old (or the minimum age required by the platforms you
          connect) and have the legal authority to connect the accounts you link to the Service.
        </p>
      </Section>

      <Section title="2. Account Connection & Authorization">
        <ul>
          <li>
            You may connect one or more TikTok, YouTube, or Instagram accounts to the Service via
            each platform's official OAuth authorization flow.
          </li>
          <li>
            By connecting an account, you grant the Service permission to access and publish content
            to that account, limited to the scopes you approve during authorization.
          </li>
          <li>
            You are responsible for maintaining the security of your connected accounts and for any
            activity that occurs through them via the Service.
          </li>
          <li>You may disconnect any account at any time, which will revoke the Service's access.</li>
        </ul>
      </Section>

      <Section title="3. Description of the Service">
        <p>
          The Service uses automated and AI-assisted processes to generate video scripts, perform
          fact-checking against source material, produce video content, and publish that content to
          your connected accounts. The Service also collects performance analytics from connected
          platforms to refine future content.
        </p>
      </Section>

      <Section title="4. Content Responsibility">
        <ul>
          <li>
            While we apply automated fact-checking, you remain responsible for reviewing and
            approving content before it is published where such review is made available, and for
            ensuring published content complies with the terms and community guidelines of each
            connected platform.
          </li>
          <li>
            You retain ownership of content published through your connected accounts, subject to
            the licenses each underlying platform requires from its users.
          </li>
          <li>
            We reserve the right to decline to generate or publish content that violates these
            Terms, applicable law, or the policies of TikTok, YouTube, or Instagram.
          </li>
        </ul>
      </Section>

      <Section title="5. Prohibited Uses">
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>
            Publish false, misleading, defamatory, or illegal content, or content that infringes
            third-party intellectual property rights.
          </li>
          <li>
            Circumvent or violate the terms of service, community guidelines, or API policies of
            TikTok, YouTube, Instagram, or any connected platform.
          </li>
          <li>Engage in spam, coordinated inauthentic behavior, or artificial engagement manipulation.</li>
          <li>
            Attempt to reverse-engineer, disrupt, or gain unauthorized access to the Service's
            infrastructure.
          </li>
        </ul>
      </Section>

      <Section title="6. Third-Party Platforms">
        <p>
          The Service relies on the APIs of TikTok, YouTube, and Instagram to publish content and
          retrieve analytics. Your use of the Service is also subject to each platform's own terms
          of service and developer policies. We are not responsible for changes, outages,
          restrictions, or account actions taken by these third-party platforms.
        </p>
      </Section>

      <Section title="7. Disclaimer of Warranties">
        <p>
          The Service is provided "as is" and "as available," without warranties of any kind,
          express or implied. We do not guarantee that fact-checking will identify every inaccuracy,
          that content will perform in any particular way, or that publishing will be uninterrupted
          or error-free.
        </p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Nepali Reels and its operators shall not be
          liable for any indirect, incidental, special, or consequential damages, including loss of
          data, revenue, or account access, arising from your use of the Service.
        </p>
      </Section>

      <Section title="9. Termination">
        <p>
          We may suspend or terminate your access to the Service at any time for violation of these
          Terms. You may stop using the Service and disconnect your accounts at any time.
        </p>
      </Section>

      <Section title="10. Changes to These Terms">
        <p>
          We may update these Terms from time to time. Continued use of the Service after changes
          take effect constitutes acceptance of the updated Terms.
        </p>
      </Section>

      <Section title="11. Contact Us">
        <div className="rounded-lg bg-muted px-5 py-4">
          <p>If you have questions about these Terms, contact us at:</p>
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
