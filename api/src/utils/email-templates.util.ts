export function welcomeEmailTemplate(name: string) {
  return {
    subject: "Welcome to Nepali Reels",
    html: `
      <h2>Welcome, ${name}!</h2>
      <p>We're glad to have you. Start by creating your first reel.</p>
    `,
  };
}
