# PRE Secure — public explainer site

A static, dependency-free explainer for **PRE Secure**, the sandboxed-by-default,
audit-first agentic AI platform. Built for GitHub Pages: plain HTML/CSS/JS, no
build step, no frameworks.

This is the **public** companion to the private architecture document. It
deliberately omits deployment-specific details (hostnames, internal endpoints,
user identities, host paths beyond what the architecture itself requires).

## Structure

| File | Purpose |
|---|---|
| `index.html` | All content and inline SVG diagrams |
| `style.css` | Theme (validated dark palette), layout, keyframe animations |
| `app.js` | Scroll reveals, request-flow stepper, approval-gate demo, PII scrub demo |

## Local preview

Any static server works:

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

## Deploy

Push to the default branch and enable **Settings → Pages → Deploy from a
branch** (root). The `.nojekyll` file is present so Pages serves files as-is.
