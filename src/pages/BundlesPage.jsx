import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const DEFAULT_FORM = {
  title: "",
  productHandles: "",
  discountPercent: "10",
  secondOrderFreeShipping: true,
  isActive: true
};

function toArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
}

function normalizeBundleInput(form) {
  return {
    title: form.title.trim(),
    productHandles: form.productHandles
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    discountPercent: Number(form.discountPercent),
    secondOrderFreeShipping: Boolean(form.secondOrderFreeShipping),
    isActive: Boolean(form.isActive)
  };
}

export default function BundlesPage({ notify }) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState("");

  async function loadBundles() {
    try {
      setError("");
      const payload = await api.getBundles();
      setBundles(toArray(payload));
    } catch (requestError) {
      setError(requestError.message);
      notify.error("Failed to load bundles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBundles();
  }, []);

  const submitLabel = useMemo(
    () => (saving ? "Saving..." : editingId ? "Update Bundle" : "Create Bundle"),
    [editingId, saving]
  );

  function updateForm(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      notify.error("Bundle title is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = normalizeBundleInput(form);
      if (editingId) {
        await api.updateBundle(editingId, payload);
        notify.success("Bundle updated.");
      } else {
        await api.createBundle(payload);
        notify.success("Bundle created.");
      }
      setForm(DEFAULT_FORM);
      setEditingId(null);
      await loadBundles();
    } catch (requestError) {
      notify.error(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(bundle) {
    setEditingId(bundle.id);
    setForm({
      title: bundle.title || bundle.name || "",
      productHandles: Array.isArray(bundle.productHandles)
        ? bundle.productHandles.join(", ")
        : Array.isArray(bundle.products)
          ? bundle.products.map((item) => item.handle || item.title).filter(Boolean).join(", ")
          : "",
      discountPercent: String(bundle.discountPercent ?? bundle.discountValue ?? 10),
      secondOrderFreeShipping: Boolean(
        bundle.secondOrderFreeShipping ?? bundle.freeShippingOnSecondOrder ?? true
      ),
      isActive: Boolean(bundle.isActive ?? bundle.status === "active" ?? true)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(bundleId) {
    const confirmed = window.confirm("Delete this bundle?");
    if (!confirmed) {
      return;
    }

    try {
      await api.deleteBundle(bundleId);
      notify.success("Bundle deleted.");
      await loadBundles();
    } catch (requestError) {
      notify.error(requestError.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h3>Bundle Management</h3>
      </div>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h4>{editingId ? "Edit Bundle" : "Create Bundle"}</h4>
        <label>
          Bundle Title
          <input
            name="title"
            value={form.title}
            onChange={updateForm}
            placeholder="Weekend Family Bundle"
            required
          />
        </label>
        <label>
          Product Handles (comma separated)
          <input
            name="productHandles"
            value={form.productHandles}
            onChange={updateForm}
            placeholder="coffee-beans, ceramic-mug"
          />
        </label>
        <label>
          Discount Percent
          <input
            type="number"
            min="0"
            max="100"
            name="discountPercent"
            value={form.discountPercent}
            onChange={updateForm}
          />
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            name="secondOrderFreeShipping"
            checked={form.secondOrderFreeShipping}
            onChange={updateForm}
          />
          Enable second-order free shipping
        </label>
        <label className="checkbox-label">
          <input type="checkbox" name="isActive" checked={form.isActive} onChange={updateForm} />
          Bundle active
        </label>
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={saving}>
            {submitLabel}
          </button>
          {editingId ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setEditingId(null);
                setForm(DEFAULT_FORM);
              }}
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
      </form>

      <div className="card">
        <div className="card-header-inline">
          <h4>Active Bundles</h4>
          <button type="button" className="button button-secondary" onClick={loadBundles}>
            Refresh
          </button>
        </div>
        {error ? <p className="inline-error">{error}</p> : null}
        {loading ? <p>Loading bundles...</p> : null}
        {!loading && bundles.length === 0 ? (
          <p className="empty-state">No bundles yet. Create your first bundle above.</p>
        ) : null}
        {!loading && bundles.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Products</th>
                  <th>Discount</th>
                  <th>Second-order Free Shipping</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bundles.map((bundle) => {
                  const productCount = Array.isArray(bundle.productHandles)
                    ? bundle.productHandles.length
                    : Array.isArray(bundle.products)
                      ? bundle.products.length
                      : 0;
                  const active = Boolean(bundle.isActive ?? bundle.status === "active");
                  return (
                    <tr key={bundle.id}>
                      <td>{bundle.title || bundle.name || `Bundle #${bundle.id}`}</td>
                      <td>{productCount}</td>
                      <td>{bundle.discountPercent ?? bundle.discountValue ?? 0}%</td>
                      <td>
                        {Boolean(bundle.secondOrderFreeShipping ?? bundle.freeShippingOnSecondOrder)
                          ? "Enabled"
                          : "Disabled"}
                      </td>
                      <td>
                        <span className={`status-pill ${active ? "status-ok" : "status-neutral"}`}>
                          {active ? "Live" : "Paused"}
                        </span>
                      </td>
                      <td className="table-actions">
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => handleEdit(bundle)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button button-danger"
                          onClick={() => handleDelete(bundle.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
