# Performance and accessibility baseline

## Phase 6 mobile audit

The production build was audited locally with Chrome Lighthouse using mobile emulation.

- Accessibility: 92 before remediation
- SEO: 100
- Agentic browsing: 100
- Cumulative Layout Shift: 0.00

The audit identified disabled page zoom, a skipped heading level, a Firestore permission error on the public landing page, and third-party cookie/browser issues from an unused globally loaded advertising script. Phase 6 removes those causes, uses an optimized priority image for the landing logo, and retains explicit image dimensions to protect layout stability.

The same mobile navigation audit after rebuilding scored Accessibility 100 and SEO 100. The only remaining best-practices findings came from the Google API cookie loaded by Firebase Authentication; the unused advertising dependency and its associated requests were removed.

Repeat the audit against the deployed production URL because local unthrottled measurements do not represent real-user Core Web Vitals. Monitor LCP, INP, and CLS using production telemetry and test authenticated routes separately.
