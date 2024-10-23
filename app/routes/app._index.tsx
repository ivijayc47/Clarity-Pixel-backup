import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Link,
  InlineStack,
  TextField,
  Checkbox,
  Toast,
  Frame,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
// @ts-ignore
import { supabase } from "../supabase.server.ts";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("loader for app index pls work");

  const { session, admin } = await authenticate.admin(request);

  const { data: store, error } = await supabase
    .from("store")
    .select("*")
    .eq("id", session.shop)
    .single();

  // Fetch the current theme ID
  const themes = await admin.rest.resources.Theme.all({
    session: session,
  });
  const mainTheme = themes.data.find((theme) => theme.role === "main");
  const themeId = mainTheme ? mainTheme.id : null;

  const asset = await admin.rest.resources.Asset.all({
    session: session,
    theme_id: themeId,
    asset: { key: "config/settings_data.json" },
  });

  let doesAppEmbedExist = false;

  const settingsJson: any = JSON.parse(asset.data[0].value || "{}");

  const currentSettings = settingsJson?.current?.blocks;

  console.log(currentSettings);

  if (currentSettings) {
    doesAppEmbedExist = Object.values(currentSettings).some((block: any) => {
      return block.type && block.type.includes("clarity-pixel");
    });
  }

  return json({
    clarityId: store?.clarityId || null,
    details: session,
    doesAppEmbedExist,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();

  // Existing action logic for updating store data
  const clarityId = formData.get("clarityId") as string;
  const details = JSON.parse(formData.get("details") as string);

  const { data, error } = await supabase.from("store").upsert(
    {
      id: session.shop,
      clarityId,
      details,
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    console.error("Error updating store data:", error);
    return json({ success: false, error: error.message }, { status: 400 });
  }

  return json({ success: true });
};

export default function Index() {
  const {
    clarityId: initialClarityId,
    details: initialDetails,
    doesAppEmbedExist,
  } = useLoaderData<typeof loader>();

  const [clarityId, setClarityId] = useState<string | null>(initialClarityId);
  const [details, setDetails] = useState<any>(initialDetails || {});
  const [selectedEvents, setSelectedEvents] = useState({
    viewCategory: true,
    viewItem: true,
    search: true,
    addToCart: true,
    beginCheckout: true,
    purchase: true,
  });
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState("");

  const fetcher = useFetcher();
  const submit = useSubmit();

  const updateStore = useCallback(() => {
    if (clarityId !== null) {
      fetcher.submit(
        {
          clarityId,
          details: JSON.stringify(details),
        },
        { method: "post" },
      );
    }
  }, [clarityId, details, fetcher]);

  const handleEventChange = (event: keyof typeof selectedEvents) => {
    setSelectedEvents((prev) => {
      const newSelectedEvents = { ...prev, [event]: !prev[event] };
      setDetails((prevDetails: any) => ({
        ...prevDetails,
        selectedEvents: newSelectedEvents,
      }));
      return newSelectedEvents;
    });
  };

  const codeSnippet = `analytics.subscribe("checkout_completed", async (event) => {
  console.log("from Purchase");
  const clarityScript = document.createElement("script");
  clarityScript.async = true;
  clarityScript.type = "text/javascript";
  ${
    clarityId
      ? `clarityScript.innerHTML = \`
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${clarityId}");
  \`;`
      : "// ... more code will appear here after setting Clarity ID"
  }
  document.head.appendChild(clarityScript);
});`;

  const handleCopy = useCallback(() => {
    if (!clarityId) {
      setToastContent(
        "Clarity ID is not set. Please enter a valid Clarity ID before copying.",
      );
      setToastActive(true);
      return;
    }
    navigator.clipboard
      .writeText(codeSnippet)
      .then(() => {
        console.log("Code copied to clipboard");
        setToastContent("Code copied to clipboard successfully!");
        setToastActive(true);
      })
      .catch((err) => {
        console.error("Failed to copy code: ", err);
        setToastContent("Failed to copy code. Please try again.");
        setToastActive(true);
      });
  }, [codeSnippet, clarityId]);

  const handleCustomerEventsRedirect = () => {
    const shopId = details.shop.split(".")[0];

    const redirect = `https://${shopId}.myshopify.com/admin/settings/customer_events`;

    window.open(redirect, "_blank", "noopener,noreferrer");
  };

  return (
    <Frame>
      <Page>
        <Layout>
          <Layout.Section>
            {!doesAppEmbedExist && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    App Embed Status
                  </Text>
                  {details.appInstalled ? (
                    <Text as="p" variant="bodyMd">
                      App is successfully embedded in your theme.
                    </Text>
                  ) : (
                    <Banner
                      title="App not embedded"
                      action={{
                        content: "Go to Theme Settings",
                        onAction: () => {
                          const shopId = details.shop.split(".")[0];
                          window.open(
                            `https://${shopId}.myshopify.com/admin/themes/current/editor?context=apps`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        },
                      }}
                    >
                      <p>
                        The app is not embedded in your theme. Please go to your
                        theme settings to embed the app for proper
                        functionality.
                      </p>
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Basic Setup
                </Text>
                <Text as="p">
                  Submit your Microsoft Clarity ID and start tracking events.
                </Text>
                <Link url="#">Help Video</Link>
                <TextField
                  label="Microsoft Clarity ID"
                  value={clarityId || ""}
                  onChange={(value) => {
                    setClarityId(value || null);
                  }}
                  autoComplete="off"
                />
                <InlineStack gap="200">
                  <Button
                    onClick={() => {
                      window.open(
                        "https://clarity.microsoft.com/",
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                  >
                    Go To Microsoft Clarity
                  </Button>
                  <Button onClick={updateStore}>Change</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Create Custom Events
                </Text>
                <Text as="p">
                  Open Store Settings and navigate to Customer Events. Add a
                  custom pixel by copying the given code, paste it in the
                  specified section, and save your modifications. Confirm the
                  pixel is appropriately connected.
                </Text>
                <Card>
                  <BlockStack gap="400">
                    <div style={{ position: "relative" }}>
                      <pre
                        style={{
                          backgroundColor: "#f4f6f8",
                          padding: "1rem",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <code>{codeSnippet}</code>
                      </pre>
                      {!clarityId && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: "50%",
                            background: "linear-gradient(transparent, #f4f6f8)",
                            pointerEvents: "none",
                          }}
                        />
                      )}
                    </div>
                    <InlineStack gap="200">
                      <Button
                        onClick={handleCustomerEventsRedirect}
                        disabled={!clarityId}
                      >
                        Customer Events
                      </Button>
                      <Button
                        variant="plain"
                        onClick={handleCopy}
                        disabled={!clarityId}
                      >
                        Copy
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Event Options
                </Text>
                <Text as="p">
                  Select the option you want to track. This will allow you to
                  track the conversion.
                </Text>
                <InlineStack gap="500" wrap={false}>
                  <BlockStack gap="200">
                    <Checkbox
                      label="View Category"
                      checked={selectedEvents.viewCategory}
                      onChange={() => handleEventChange("viewCategory")}
                    />
                    <Checkbox
                      label="View Item"
                      checked={selectedEvents.viewItem}
                      onChange={() => handleEventChange("viewItem")}
                    />
                    <Checkbox
                      label="Search"
                      checked={selectedEvents.search}
                      onChange={() => handleEventChange("search")}
                    />
                  </BlockStack>
                  <BlockStack gap="200">
                    <Checkbox
                      label="Add to Cart"
                      checked={selectedEvents.addToCart}
                      onChange={() => handleEventChange("addToCart")}
                    />
                    <Checkbox
                      label="Begin Checkout"
                      checked={selectedEvents.beginCheckout}
                      onChange={() => handleEventChange("beginCheckout")}
                    />
                    <Checkbox
                      label="Purchase"
                      checked={selectedEvents.purchase}
                      onChange={() => handleEventChange("purchase")}
                    />
                  </BlockStack>
                </InlineStack>
                <Button onClick={updateStore}>Save</Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
        {toastActive && (
          <Toast
            content={toastContent}
            onDismiss={() => setToastActive(false)}
          />
        )}
      </Page>
    </Frame>
  );
}
