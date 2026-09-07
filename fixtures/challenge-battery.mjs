import { pathToFileURL } from "node:url";
const mod = await import(pathToFileURL("<origin repo path withheld>/scripts/lib/source-fetch.mjs").href);
const { isChallengePage, classify2xxBody } = mod;

// Each case: [name, expectedChallenge, text]. Copy is the real-world wording of
// each wall as served in 2025-2026, in text-extracted form.
const cases = [
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

let rows = [];
for (const [name, expected, text] of cases) {
  const got = isChallengePage(text);
  const verdictPath = got ? "unreachable (safe)" : "read -> all claims miss -> UNSUPPORTED";
  const mark = got === expected ? "  ok " : "MISS ";
  rows.push(`${mark} | detected=${got} wanted=${expected} | ${name} | len=${text.length}` + (got === expected ? "" : ` | consequence: ${verdictPath}`));
}
console.log(rows.join("\n"));

// classify2xxBody shape checks
const ch = classify2xxBody({ text: "JavaScript is disabled In order to continue, we need to verify that you're not a robot.", method: "fetch", status: 202, bytes: 159 });
console.log("\nclassify2xxBody on challenge:", JSON.stringify(ch));
const rd = classify2xxBody({ text: "A long real document body...", method: "fetch", status: 200, bytes: 90000 });
console.log("classify2xxBody on document:", JSON.stringify(rd));
