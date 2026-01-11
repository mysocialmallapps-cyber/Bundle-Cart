import { useEffect, useMemo, useState } from "react";
import {
  BlockStack,
  Card,
  DataTable,
  InlineStack,
  Text
} from "@shopify/polaris";
import { useBackendClient } from "../api/backendClient";

export function Dashboard() {
  const api = useBackendClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<{
    shopDomain: string;
    totalDecisions: number;
    qualifiedDecisions: number;
    estimatedSavingsCents: number;
  } | null>(null);

  const [decisions, setDecisions] = useState<
    Array<{
      created_at: string;
      email: string | null;
      qualified: boolean;
      reason: string;
    }>
  >([]);

  const [groups, setGroups] = useState<
    Array<{
      email: string;
      linkGroupId: string;
      windowStart: string | null;
      windowEnd: string | null;
      ordersCount: number;
      lastOrderAt: string;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [s, d, g] = await Promise.all([
          api.getSummary(),
          api.getShippingDecisions(50),
          api.getLinkedOrders(50)
        ]);
        if (cancelled) return;

        setSummary(s);
        setDecisions(
          d.decisions.map((x) => ({
            created_at: x.created_at,
            email: x.email,
            qualified: x.qualified,
            reason: x.reason
          }))
        );
        setGroups(
          g.groups.map((x) => ({
            email: x.email,
            linkGroupId: x.linkGroupId,
            windowStart: x.windowStart,
            windowEnd: x.windowEnd,
            ordersCount: x.orders.length,
            lastOrderAt: x.orders[0]?.placedAt ?? ""
          }))
        );
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const summaryRows = useMemo(() => {
    if (!summary) return [];
    return [
      ["Shop", summary.shopDomain],
      ["Carrier decisions (total)", String(summary.totalDecisions)],
      ["Free shipping triggered (count)", String(summary.qualifiedDecisions)],
      ["Estimated savings", `$${(summary.estimatedSavingsCents / 100).toFixed(2)}`]
    ];
  }, [summary]);

  const decisionRows = useMemo(() => {
    return decisions.map((d) => [
      new Date(d.created_at).toLocaleString(),
      d.email ?? "(no email)",
      d.qualified ? "Yes" : "No",
      d.reason
    ]);
  }, [decisions]);

  const groupRows = useMemo(() => {
    return groups.map((g) => [
      g.email,
      g.ordersCount,
      g.windowStart ? new Date(g.windowStart).toLocaleString() : "",
      g.windowEnd ? new Date(g.windowEnd).toLocaleString() : "",
      g.lastOrderAt ? new Date(g.lastOrderAt).toLocaleString() : ""
    ]);
  }, [groups]);

  return (
    <BlockStack gap="400">
      {error ? (
        <Card>
          <Text as="p" tone="critical">
            {error}
          </Text>
        </Card>
      ) : null}

      <Card>
        <InlineStack align="space-between">
          <Text as="h2" variant="headingMd">
            Overview
          </Text>
          <Text as="p" tone="subdued">
            {loading ? "Loading…" : "Updated"}
          </Text>
        </InlineStack>
        <div style={{ marginTop: 12 }}>
          <DataTable
            columnContentTypes={["text", "text"]}
            headings={["Metric", "Value"]}
            rows={summaryRows}
          />
        </div>
        <Text as="p" tone="subdued">
          Estimated savings is shown as $0.00 until BundleCart has a baseline “would-have-paid”
          shipping amount to compare against.
        </Text>
      </Card>

      <Card>
        <Text as="h2" variant="headingMd">
          Recent shipping decisions
        </Text>
        <div style={{ marginTop: 12 }}>
          <DataTable
            columnContentTypes={["text", "text", "text", "text"]}
            headings={["Time", "Email", "Qualified", "Reason"]}
            rows={decisionRows}
          />
        </div>
      </Card>

      <Card>
        <Text as="h2" variant="headingMd">
          Linked orders (this shop only)
        </Text>
        <div style={{ marginTop: 12 }}>
          <DataTable
            columnContentTypes={["text", "numeric", "text", "text", "text"]}
            headings={["Customer email", "Orders", "Window start", "Window end", "Last order"]}
            rows={groupRows}
          />
        </div>
      </Card>
    </BlockStack>
  );
}

