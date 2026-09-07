/**
 * The bot-challenge battery: constructed bodies covering real-world wall
 * wording (Cloudflare, PerimeterX, DataDome, Imperva, Anubis, Google, Amazon,
 * Bloomberg, eur-lex, Vercel) plus the adjacent open class of 2xx pages that
 * are NOT bot checks (paywall stub, soft-404, geo-block, consent wall) and
 * two false-positive probes (a short legitimate page, an article ABOUT bot
 * walls) that must never be misclassified as walls.
 *
 * This file used to import a classifier from a sibling repo at a hard-coded
 * absolute path (<origin repo path withheld>/scripts/lib/source-fetch.mjs)
 * and is not portable that way. It no longer imports anything from outside
 * this repo: it now writes each constructed body out as its own HTML file
 * under fixtures/challenge/<name>.html, for the fixture corpus that
 * fixtures/corpus.json indexes. Classification into "challenge" vs "omit"
 * happens by hand in fixtures/corpus.json, not in this file - see
 * .superpowers/sdd/2026-09-06-plan-1-core/task-3-report.md for the reasoning
 * behind each case.
 *
 *   node fixtures/challenge-battery.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";

// Each case: [name, isBotCheck, text]. isBotCheck records whether a bot-check
// classifier (Task 5's job) should fire on this body - it is NOT the same
// question as "is this a readable document". A paywall stub is
// isBotCheck=false but is still not a readable document; see the corpus
// classification notes in the task-3 report.
export const cases = [
  // --- shipped-fix regression checks (should HIT) ---
  ["eurlex-202 (the fixture)", true,
   "JavaScript is disabled In order to continue, we need to verify that you're not a robot. This requires JavaScript. Enable JavaScript and then reload the page."],
  ["bloomberg wall", true,
   "Are you a robot? Please make sure your browser supports JavaScript and cookies and that you are not blocking them from loading. For more information you can review our Terms of Service and Cookie Policy. Block reference ID:"],
  ["cloudflare turnstile checkbox page", true,
   "Just a moment... Verify you are human by completing the action below. www.example.com needs to review the security of your connection before proceeding. Ray ID: 8c1a2b3c4d5e6f70 Performance & security by Cloudflare"],
  ["cloudflare retired pre-2023 wording", true,
   "Checking your browser before accessing example.com. This process is automatic. Your browser will redirect to your requested content shortly. Please allow up to 5 seconds. DDoS protection by Cloudflare"],
  ["stock react/vite noscript shell", true,
   "You need to enable JavaScript to run this app."],

  // --- the next defeats (constructed from current live wording) ---
  ["cloudflare managed challenge, -ing form", true,
   "Just a moment... Verifying you are human. This may take a few seconds. www.example.com needs to review the security of your connection before proceeding. Verification successful Waiting for www.example.com to respond... Ray ID: 8c1a2b3c4d5e6f70 Performance & security by Cloudflare"],
  ["cloudflare noscript line", true,
   "Just a moment... Enable JavaScript and cookies to continue"],
  ["google sorry page", true,
   "About this page Our systems have detected unusual traffic from your computer network. This page checks to see if it's really you sending the requests, and not a robot. Why did this happen? This page appears when Google automatically detects requests coming from your computer network which appear to be in violation of the Terms of Service. IP address: 203.0.113.7 Time: 2026-09-06T18:22:31Z URL:"],
  ["amazon robot check", true,
   "Sorry, we just need to make sure you're not a robot. For best results, please make sure your browser is accepting cookies. Type the characters you see in this image:"],
  ["perimeterx / human press-and-hold", true,
   "Press & Hold to confirm you are a human (and not a bot). Reference ID 8f2c1e0a-9b7d-4c3e-a1f2-0d9e8c7b6a5f"],
  ["perimeterx block page", true,
   "Access to this page has been denied. Access to this page has been denied because we believe you are using automation tools to browse the website. This may happen as a result of the following: Javascript is disabled or blocked by an extension (ad blockers for example) Your browser does not support cookies Please make sure that Javascript and cookies are enabled on your browser and that you are not blocking them from loading. Reference ID: #8f2c1e0a-9b7d-4c3e-a1f2"],
  ["datadome block", true,
   "Please enable JS and disable any ad blocker"],
  ["imperva incapsula", true,
   "Request unsuccessful. Incapsula incident ID: 466000330001296131-1234567890123456"],
  ["anubis (foss-site bot wall)", true,
   "Making sure you're not a bot! Loading... Sadly, you must enable JavaScript to get past this challenge. This is required because AI companies have changed the social contract around how website hosting works."],
  ["eur-lex, french", true,
   "JavaScript est desactive. Afin de pouvoir continuer, nous devons verifier que vous n'etes pas un robot. Cela necessite JavaScript. Activez JavaScript, puis rechargez la page."],
  ["vercel security checkpoint", true,
   "Vercel Security Checkpoint Verifying your browser... We are checking your browser. This process is automatic and only takes a few moments."],

  // --- length-cap bypass: a real challenge padded past 800 chars by boilerplate ---
  ["cloudflare turnstile + cookie/privacy boilerplate (>800 chars)", true,
   "Just a moment... Verify you are human by completing the action below. www.example.com needs to review the security of your connection before proceeding. " +
   "This website uses cookies to ensure you get the best experience. By continuing to browse the site you are agreeing to our use of cookies. Cookies are small text files stored on your device that help us understand how visitors interact with our website and allow us to remember your preferences. We use both session cookies, which expire when you close your browser, and persistent cookies, which remain until deleted. You can manage your cookie preferences at any time in your browser settings, although disabling some cookies may affect site functionality. For more information please review our Privacy Policy, our Terms of Service, and our Cookie Policy, each of which is linked in the footer of this page and describes in detail the categories of data we collect. Ray ID: 8c1a2b3c4d5e6f70 Performance & security by Cloudflare"],

  // --- the adjacent open class: 2xx non-documents that are NOT bot checks ---
  ["paywall stub at 200", false,
   "Subscribe to continue reading. Already a subscriber? Sign in. Get unlimited digital access for $1 for 6 months."],
  ["soft-404 served at 200", false,
   "Sorry, the page you're looking for cannot be found. It may have been moved or deleted. Try searching, or return to the homepage."],
  ["gdpr geo-block at 200", false,
   "This content is not available in your region. We are working to bring our content to all readers worldwide."],
  ["cookie consent wall at 200", false,
   "We value your privacy. We and our 847 partners store and access information on your device to provide personalised ads and content. Accept all. Reject all. Manage preferences."],

  // --- false-positive probes (must stay false) ---
  ["short legit page", false, "It shall apply from 20 January 2027."],
  ["short article about bot walls", false,
   "The regulator's new site now asks visitors to verify they are human, a change publishers criticised this week."],
];

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Wrap a constructed wall/stub body as a minimal HTML page. A <script> tag
 *  is included so toText's script-stripping is exercised by these fixtures
 *  too; nothing else is added that would inflate the extracted character
 *  count past the raw text length (Task 4's floor arithmetic depends on
 *  these extracting to close to their raw text length, not more). */
function wrap(text) {
  return `<!doctype html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n<script>var ping = 1;</script>\n<p>${text}</p>\n</body>\n</html>\n`;
}

mkdirSync("fixtures/challenge", { recursive: true });

for (const [name, , text] of cases) {
  const path = `fixtures/challenge/${slug(name)}.html`;
  writeFileSync(path, wrap(text), "utf8");
  console.log(`wrote ${path} (${text.length} raw chars)`);
}

console.log(`\n${cases.length} constructed bodies written to fixtures/challenge/`);
console.log("Classification into corpus.json kinds happens by hand - see task-3-report.md.");
