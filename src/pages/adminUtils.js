export function parseMaybeJson(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  if (typeof value !== "string") {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export function formatDateTime(value) {
  if (!value) {
    return "N/A";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }
  return parsed.toLocaleString();
}

export function getCustomerName(address) {
  if (!address || typeof address !== "object") {
    return "Unknown";
  }
  const combined = [address.first_name, address.last_name].filter(Boolean).join(" ").trim();
  return address.name || combined || "Unknown";
}

export function formatAddress(address) {
  if (!address || typeof address !== "object") {
    return "N/A";
  }
  const parts = [
    address.address1,
    address.address2,
    address.city,
    address.province || address.province_code,
    address.zip || address.postal_code,
    address.country || address.country_code
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "N/A";
}
