import React, { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Address = {
  street: string;
  city: string;
  state: string;
  zip_code: string;
};

const EMPTY: Address = { street: "", city: "", state: "", zip_code: "" };

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC",
];

const AddressForm: React.FC = () => {
  const [address, setAddress] = useState<Address>(EMPTY);
  const [saved, setSaved] = useState<Address | null>(null); // what's currently in DB
  const [errors, setErrors] = useState<Partial<Address>>({});
  const [serverError, setServerError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const token = localStorage.getItem("access_token");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ── Load existing address on mount ──
  useEffect(() => {
    const fetchAddress = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/me/address`, {
          headers: authHeaders,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.address) {
            setAddress(data.address);
            setSaved(data.address);
          }
        }
      } catch {
        // silently ignore — form will just start empty
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddress();
  }, []);

  const validate = (): Partial<Address> => {
    const errs: Partial<Address> = {};
    if (!address.street.trim()) errs.street = "Street address is required.";
    if (!address.city.trim()) errs.city = "City is required.";
    if (!address.state.trim()) errs.state = "State is required.";
    if (!address.zip_code.trim()) {
      errs.zip_code = "ZIP code is required.";
    } else if (!/^\d{5}(-\d{4})?$/.test(address.zip_code.trim())) {
      errs.zip_code = "Enter a valid ZIP code (e.g. 12345 or 12345-6789).";
    }
    return errs;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setServerError("");
    setSuccessMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setSuccessMsg("");

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      // PUT replaces the whole address whether or not one exists yet
      const res = await fetch(`${API_BASE_URL}/me/address`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          street: address.street.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          zip_code: address.zip_code.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setServerError(
          typeof data?.detail === "string" ? data.detail : "Failed to save address."
        );
        return;
      }

      setSaved(data.address);
      setSuccessMsg("Address saved successfully.");
    } catch {
      setServerError("Could not connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!saved) return;
    if (!window.confirm("Remove your saved address?")) return;

    setIsDeleting(true);
    setServerError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${API_BASE_URL}/me/address`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (res.ok || res.status === 204) {
        setAddress(EMPTY);
        setSaved(null);
        setSuccessMsg("Address removed.");
      } else {
        setServerError("Failed to remove address.");
      }
    } catch {
      setServerError("Could not connect to the server.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <p style={styles.loading}>Loading address...</p>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          {saved ? "Edit Address" : "Add Address"}
        </h2>
        {saved && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={styles.deleteBtn}
          >
            {isDeleting ? "Removing..." : "Remove"}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Street */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Street Address</label>
          <input
            type="text"
            name="street"
            placeholder="123 Main St"
            value={address.street}
            onChange={handleChange}
            style={styles.input}
          />
          {errors.street && <span style={styles.error}>{errors.street}</span>}
        </div>

        {/* City + State row */}
        <div style={styles.row}>
          <div style={{ ...styles.fieldGroup, flex: 1 }}>
            <label style={styles.label}>City</label>
            <input
              type="text"
              name="city"
              placeholder="Atlanta"
              value={address.city}
              onChange={handleChange}
              style={styles.input}
            />
            {errors.city && <span style={styles.error}>{errors.city}</span>}
          </div>

          <div style={{ ...styles.fieldGroup, width: 140 }}>
            <label style={styles.label}>State</label>
            <select
              name="state"
              value={address.state}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="">— Select —</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errors.state && <span style={styles.error}>{errors.state}</span>}
          </div>
        </div>

        {/* ZIP */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>ZIP Code</label>
          <input
            type="text"
            name="zip_code"
            placeholder="30301"
            value={address.zip_code}
            onChange={handleChange}
            style={{ ...styles.input, maxWidth: 160 }}
            maxLength={10}
          />
          {errors.zip_code && (
            <span style={styles.error}>{errors.zip_code}</span>
          )}
        </div>

        {serverError && <p style={styles.serverError}>{serverError}</p>}
        {successMsg && <p style={styles.success}>{successMsg}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          style={styles.submitBtn}
        >
          {isSubmitting ? "Saving..." : saved ? "Update Address" : "Save Address"}
        </button>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    color: "white",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
  },

  deleteBtn: {
    background: "transparent",
    border: "1px solid rgba(255,100,100,0.5)",
    color: "#ff8080",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  row: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  label: {
    fontWeight: 600,
    fontSize: 13,
  },

  input: {
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  },

  select: {
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(30,30,35,0.95)",
    color: "white",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    cursor: "pointer",
  },

  error: {
    color: "#ffb3b3",
    fontSize: 12,
  },

  serverError: {
    color: "#ff8080",
    fontSize: 13,
    margin: 0,
  },

  success: {
    color: "#6ee7b7",
    fontSize: 13,
    margin: 0,
  },

  submitBtn: {
    marginTop: 4,
    padding: "12px",
    borderRadius: 10,
    border: "none",
    background: "white",
    color: "black",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
  },

  loading: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
};

export default AddressForm;