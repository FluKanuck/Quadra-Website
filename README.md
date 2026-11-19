# Quadra Utility Locating website

Hand-coded static site for quadralocating.com. Plain HTML, one CSS file, one small JavaScript file. No framework and no dependencies.

Built to Google Chrome's [Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance) (v1.0).

## Run it

Needs Node 20 or newer.

```
npm run preview     # builds, then serves http://localhost:4173
npm run build       # writes the finished site to dist/
npm run check       # Modern Web Guidance legacy-pattern scan of src/
```

## Where things are

| Path | What it is |
|---|---|
| `src/pages/*.html` | One file per page. The `<!--meta {...} -->` block at the top holds the URL, title and description. |
| `src/services.json` | The 8 services. Each entry becomes a page at `/services/<slug>` and a card on Home, Services and Commercial. |
| `src/templates/service.html` | Layout shared by the 8 service pages. |
| `src/partials/` | Shared pieces: hero, call-to-action band, steps, job posting, BC 1 Call note. |
| `src/layout.html` | Head, header, navigation, footer. |
| `src/site.json` | Phone numbers, address, Google tag IDs, form endpoint. |
| `src/css/site.css`, `src/js/site.js` | All styling and behaviour. |
| `public/` | Copied to the site as is: photos, fonts, icons, `_headers`, `_redirects`, `llms.txt`. |
| `build.mjs` | The build. Stitches pages into `dist/`, adds hashed CSS/JS names, sitemap and robots.txt. |
| `tools/images.py` | Regenerates the AVIF/WebP photo sizes from full-size originals. Only needed when photos change. |

In a page, `<x-img name="gpr" sizes="...">` becomes a full `<picture>` with AVIF, WebP, width, height and lazy loading. `<x-include src="cta">` pulls in a partial.

## Hosting

Any static host works. Build command `node build.mjs`, output folder `dist`. Cloudflare Pages and Netlify both read `public/_headers` and `public/_redirects` and serve `about-us.html` at `/about-us`, so every old Squarespace URL keeps working.

## Before launch

1. **Forms do not send yet.** Pick a form backend and put its URL in `formEndpoint` in `src/site.json`. Until then the forms run in demo mode: they validate, then go to the thank-you page, and nothing is sent. The backend must accept file uploads (drawing up to 15 MB, resume) and redirect to `/quote-thank-you` or `/application-received`.
2. Add `public/privacy-policy.pdf` (the current `Quadra-PIPA.pdf` from Squarespace).
3. Google Ads: the "Quote form submitted" conversion fires on a page load whose URL contains `quote-thank-you`. That URL is kept, so no change is needed in Ads.
4. Add the form backend's origin to `form-action` in `public/_headers`.
5. After a clean week on HTTPS, raise `Strict-Transport-Security` and move the report-only Content-Security-Policy to the enforced header.
6. Photos still wanted: a real VAPOR PIN® installation photo (the card uses a placeholder).

## What the Chrome guidance changed

- Semantic HTML with one `h1` per page, landmarks, skip link, labelled navs, breadcrumbs with structured data.
- Navigation is a native popover while collapsed and an inline row when it fits. The script measures the row, so there is no fixed breakpoint. Browsers without popover get a plain show/hide menu.
- CSS in cascade layers with design tokens, logical properties, nesting, `rem` type with `clamp()`, and no universal reset.
- Photos are real `<img>` elements (AVIF then WebP) with width and height. The hero is preloaded with high priority; everything else lazy-loads.
- Fonts are self-hosted and preloaded.
- Forms use native validation styled with `:user-invalid`, labels above fields, `autocomplete` on every contact field, and screen reader error announcements.
- Page-to-page view transitions and scroll reveal run only when the visitor has not asked for reduced motion.
- Speculation rules prefetch the next page on hover.
- The Google tag loads at low priority from the site script and is left off the job application pages.
- Security headers in `public/_headers`; the stricter Content-Security-Policy ships report-only first.
- Dark theme only, declared with `color-scheme: dark`, with forced-colours and higher-contrast support.
