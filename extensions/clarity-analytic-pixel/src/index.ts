import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser, init, settings }) => {
  // Bootstrap and insert pixel script tag here

  // Sample subscribe to page view
  analytics.subscribe("all_events", (event) => {
    // Transform the event payload to fit your schema (optional)

    // Send events to third-party servers
    console.log("QHEF(IHWEOUIF");
    console.log("Page viewed", event);
  });
});
