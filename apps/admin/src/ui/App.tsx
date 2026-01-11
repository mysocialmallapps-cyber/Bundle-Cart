import { AppProvider, Frame, Page } from "@shopify/polaris";
import { Dashboard } from "./pages/Dashboard";

export function App() {
  return (
    <AppProvider i18n={{}}>
      <Frame>
        <Page title="BundleCart">
          <Dashboard />
        </Page>
      </Frame>
    </AppProvider>
  );
}

