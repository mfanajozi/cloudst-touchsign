'use client';
export default function DashboardError({ reset }: { reset: () => void }) {
 return <main><section className="auth-card"><h1>Workspace unavailable.</h1><p>We couldn’t verify your access or load your agreements. Please try again.</p><button className="button" onClick={reset}>Try again</button><p><a href="/auth/sign-in">Return to sign in</a></p></section></main>;
}
