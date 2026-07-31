export function welcomeEmailTemplate(name: string) {
  return {
    subject: "Welcome to Nepali Reels",
    html: `
      <h2>Welcome, ${name}!</h2>
      <p>We're glad to have you. Start by creating your first reel.</p>
    `,
  };
}

export function reelReadyEmailTemplate(name: string, topic: string) {
  return {
    subject: `Your reel is ready to publish — "${topic}"`,
    html: `
      <h2>Your reel is ready, ${name}!</h2>
      <p>Your reel on <strong>${topic}</strong> has been generated and is ready to be published.</p>
      <p>Head over to your dashboard to review and publish it.</p>
    `,
  };
}
