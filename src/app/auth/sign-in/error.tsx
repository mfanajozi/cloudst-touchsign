'use client';
export default function SignInError({ reset }: { reset: () => void }) {
 return <main><section className="auth-card"><p className="eyebrow">CLOUDST TOUCHSIGN</p><h1>Sign-in unavailable.</h1><p>We couldn’t connect to the authentication service. Please try again.</p><button className="button" onClick={reset}>Try again</button></section></main>;
}
