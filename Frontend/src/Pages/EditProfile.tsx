import React, { useEffect, useState } from "react";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.trim?.() || "http://127.0.0.1:8000";

const bgUrl = "/images/backgroundImage.jpg";

type Address = {
  street: string;
  city: string;
  state: string;
  zip_code: string;
};

type PaymentCard = {
  cardholder_name: string;
  card_number?: string;
  last4?: string;
  expiry_month: number;
  expiry_year: number;
  cvv?: string;
  isNew?: boolean;
};

type Movie = {
  id: string;
  title: string;
};

type UserProfile = {
  id?: string;
  name: string;
  username: string;
  email: string;
  status?: string;
  address?: Address | null;
};

export default function EditProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setServerError("You must be logged in to edit your profile.");
      setLoading(false);
      return;
    }

    const loadPage = async () => {
      try {
        setLoading(true);
        setServerError("");
        setSuccessMessage("");

        const [profileRes, cardsRes, favoritesRes] = await Promise.all([
          fetch(`${API_BASE}/me/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/me/cards`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/me/favorites`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!profileRes.ok) throw new Error("Could not load profile.");
        if (!cardsRes.ok) throw new Error("Could not load payment cards.");
        if (!favoritesRes.ok) throw new Error("Could not load favorites.");

        const profileData = await profileRes.json();
        const cardsData = await cardsRes.json();
        const favoritesData = await favoritesRes.json();

        setUser({
          id: profileData.id,
          name: profileData.name || "",
          username: profileData.username || "",
          email: profileData.email || "",
          status: profileData.status || "",
          address: profileData.address || null,
        });

        setCards(
          (cardsData.payment_cards || []).map((card: any) => ({
            cardholder_name: card.cardholder_name || "",
            last4: card.last4 || "",
            expiry_month:
              Number(card.expiry_month) || new Date().getMonth() + 1,
            expiry_year:
              Number(card.expiry_year) || new Date().getFullYear(),
            isNew: false,
          }))
        );

        setFavorites(
          (favoritesData || []).map((m: any) => ({
            id: m.id,
            title: m.title,
          }))
        );
      } catch (err: any) {
        console.error(err);
        setServerError(err?.message || "Failed to load edit profile page.");
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, []);

  const saveProfile = async () => {
    if (!user) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      setServerError("You must be logged in to save changes.");
      return;
    }

    try {
      setIsSavingProfile(true);
      setServerError("");
      setSuccessMessage("");

      const response = await fetch(`${API_BASE}/me/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: user.name,
          username: user.username,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Failed to update profile.");
      }

      setUser({
        id: data.id,
        name: data.name || "",
        username: data.username || "",
        email: data.email || "",
        status: data.status || "",
        address: data.address || null,
      });

      localStorage.setItem(
        "user",
        JSON.stringify({
          id: data.id,
          name: data.name || "",
          username: data.username || "",
          email: data.email || "",
          status: data.status || "",
        })
      );

      setSuccessMessage("Profile updated successfully.");
    } catch (err: any) {
      console.error(err);
      setServerError(err?.message || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const saveAddress = async () => {
    if (!user || !user.address) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      setServerError("You must be logged in to save address.");
      return;
    }

    const payload = {
      street: user.address.street.trim(),
      city: user.address.city.trim(),
      state: user.address.state.trim(),
      zip_code: user.address.zip_code.trim(),
    };

    if (
      !payload.street ||
      !payload.city ||
      !payload.state ||
      !payload.zip_code
    ) {
      setServerError("Please complete all address fields before saving.");
      setSuccessMessage("");
      return;
    }

    try {
      setIsSavingAddress(true);
      setServerError("");
      setSuccessMessage("");

      const response = await fetch(`${API_BASE}/me/address`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Failed to save address.");
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              address: data.address || payload,
            }
          : prev
      );

      setSuccessMessage("Address saved successfully.");
    } catch (err: any) {
      console.error(err);
      setServerError(err?.message || "Failed to save address.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const deleteAddress = async () => {
    if (!user?.address) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      setServerError("You must be logged in to delete address.");
      return;
    }

    try {
      setIsSavingAddress(true);
      setServerError("");
      setSuccessMessage("");

      const response = await fetch(`${API_BASE}/me/address`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete address.");
      }

      setUser((prev) => (prev ? { ...prev, address: null } : prev));
      setSuccessMessage("Address removed.");
    } catch (err: any) {
      console.error(err);
      setServerError(err?.message || "Failed to delete address.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const changePassword = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setServerError("You must be logged in to change your password.");
      return;
    }

    if (
      !currentPassword.trim() ||
      !newPassword.trim() ||
      !confirmNewPassword.trim()
    ) {
      setServerError("Please complete all password fields.");
      setSuccessMessage("");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setServerError("New password and confirm password must match.");
      setSuccessMessage("");
      return;
    }

    if (newPassword.length < 8) {
      setServerError("New password must be at least 8 characters.");
      setSuccessMessage("");
      return;
    }

    if (currentPassword === newPassword) {
      setServerError("New password must be different from your current password.");
      setSuccessMessage("");
      return;
    }

    try {
      setIsChangingPassword(true);
      setServerError("");
      setSuccessMessage("");

      const response = await fetch(`${API_BASE}/me/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Failed to update password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setSuccessMessage(data?.message || "Password updated successfully.");
    } catch (err: any) {
      console.error(err);
      setServerError(err?.message || "Failed to update password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const saveCard = async (card: PaymentCard, index: number) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setServerError("You must be logged in to save cards.");
      return;
    }

    const payload = {
      cardholder_name: card.cardholder_name.trim(),
      card_number: (card.card_number || "").replace(/\s+/g, ""),
      expiry_month: Number(card.expiry_month),
      expiry_year: Number(card.expiry_year),
      cvv: (card.cvv || "").trim(),
    };

    const isIncomplete =
      !payload.cardholder_name ||
      !payload.card_number ||
      !payload.expiry_month ||
      !payload.expiry_year ||
      !payload.cvv;

    if (isIncomplete) {
      setServerError("Please complete all payment card fields before saving.");
      return;
    }

    if (payload.expiry_month < 1 || payload.expiry_month > 12) {
      setServerError("Expiry month must be between 1 and 12.");
      return;
    }

    try {
      setServerError("");
      setSuccessMessage("");

      const response = await fetch(`${API_BASE}/me/cards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Failed to save card.");
      }

      setCards(
        (data.payment_cards || []).map((savedCard: any) => ({
          cardholder_name: savedCard.cardholder_name || "",
          last4: savedCard.last4 || "",
          expiry_month:
            Number(savedCard.expiry_month) || new Date().getMonth() + 1,
          expiry_year:
            Number(savedCard.expiry_year) || new Date().getFullYear(),
          isNew: false,
        }))
      );

      setSuccessMessage("Payment card saved successfully.");
    } catch (err: any) {
      console.error(err);
      setServerError(err?.message || "Failed to save card.");
    }
  };

  const deleteCard = async (index: number) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setServerError("You must be logged in to delete cards.");
      return;
    }

    try {
      setServerError("");
      setSuccessMessage("");

      const card = cards[index];

      if (card?.isNew) {
        setCards((prev) => prev.filter((_, i) => i !== index));
        setSuccessMessage("Unsaved card removed.");
        return;
      }

      const response = await fetch(`${API_BASE}/me/cards/${index}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete card.");
      }

      setCards((prev) => prev.filter((_, i) => i !== index));
      setSuccessMessage("Payment card removed.");
    } catch (err: any) {
      console.error(err);
      setServerError(err?.message || "Failed to delete card.");
    }
  };

  const addAddress = () => {
    if (!user) return;

    if (user.address) {
      setServerError("Only one address can be stored.");
      return;
    }

    setServerError("");
    setSuccessMessage("");
    setUser({
      ...user,
      address: {
        street: "",
        city: "",
        state: "",
        zip_code: "",
      },
    });
  };

  const addBlankCard = () => {
    if (cards.length >= 3) {
      setServerError("Users can store a maximum of 3 payment cards.");
      return;
    }

    setServerError("");
    setSuccessMessage("");
    setCards((prev) => [
      ...prev,
      {
        cardholder_name: "",
        card_number: "",
        expiry_month: new Date().getMonth() + 1,
        expiry_year: new Date().getFullYear(),
        cvv: "",
        isNew: true,
      },
    ]);
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
        <div style={styles.overlay} />
        <div style={styles.wrapper}>
          <div style={styles.card}>
            <p style={styles.loadingText}>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
        <div style={styles.overlay} />
        <div style={styles.wrapper}>
          <div style={styles.card}>
            <p style={styles.serverError}>{serverError || "No profile found."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
      <div style={styles.overlay} />

      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.headerBlock}>
            <p style={styles.eyebrow}>Account Settings</p>
            <h1 style={styles.title}>Edit Profile</h1>
            <p style={styles.subtitle}>
              Update your information, manage your saved cards, change your
              password, and review your favorite movies.
            </p>
          </div>

          {serverError && <div style={styles.serverError}>{serverError}</div>}
          {successMessage && (
            <div style={styles.successMessage}>{successMessage}</div>
          )}

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Profile Information</h2>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                value={user.name}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
                placeholder="Enter your full name"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Username</label>
              <input
                value={user.username}
                onChange={(e) => setUser({ ...user, username: e.target.value })}
                placeholder="Enter your username"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email</label>
              <input value={user.email} disabled style={styles.disabledInput} />
              <span style={styles.helperText}>Email cannot be changed.</span>
            </div>

            <button
              onClick={saveProfile}
              disabled={isSavingProfile}
              style={styles.submitBtn}
            >
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </button>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Update Password</h2>
            <p style={styles.helperText}>
              Enter your current password to set a new one.
            </p>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Confirm New Password</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                style={styles.input}
              />
            </div>

            <button
              onClick={changePassword}
              disabled={isChangingPassword}
              style={styles.submitBtn}
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </button>
          </section>

          <section style={styles.section}>
            <div style={styles.sectionHeaderRow}>
              <h2 style={styles.sectionTitle}>Address</h2>
              {!user.address && (
                <button onClick={addAddress} style={styles.secondaryBtn}>
                  Add Address
                </button>
              )}
            </div>

            {user.address ? (
              <>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Street</label>
                  <input
                    value={user.address.street}
                    onChange={(e) =>
                      setUser({
                        ...user,
                        address: { ...user.address!, street: e.target.value },
                      })
                    }
                    style={styles.input}
                  />
                </div>

                <div style={styles.twoCol}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>City</label>
                    <input
                      value={user.address.city}
                      onChange={(e) =>
                        setUser({
                          ...user,
                          address: { ...user.address!, city: e.target.value },
                        })
                      }
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>State</label>
                    <input
                      value={user.address.state}
                      onChange={(e) =>
                        setUser({
                          ...user,
                          address: { ...user.address!, state: e.target.value },
                        })
                      }
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>ZIP Code</label>
                  <input
                    value={user.address.zip_code}
                    onChange={(e) =>
                      setUser({
                        ...user,
                        address: {
                          ...user.address!,
                          zip_code: e.target.value,
                        },
                      })
                    }
                    style={styles.input}
                  />
                </div>

                <div style={styles.buttonRow}>
                  <button
                    onClick={saveAddress}
                    disabled={isSavingAddress}
                    style={styles.submitBtn}
                  >
                    {isSavingAddress ? "Saving..." : "Save Address"}
                  </button>

                  <button
                    onClick={deleteAddress}
                    disabled={isSavingAddress}
                    style={styles.secondaryBtn}
                  >
                    Remove Address
                  </button>
                </div>
              </>
            ) : (
              <p style={styles.helperText}>No address stored.</p>
            )}
          </section>

          <section style={styles.section}>
            <div style={styles.sectionHeaderRow}>
              <h2 style={styles.sectionTitle}>Payment Cards</h2>
              <button onClick={addBlankCard} style={styles.secondaryBtn}>
                Add Card
              </button>
            </div>

            <p style={styles.helperText}>Maximum 3 payment cards allowed.</p>

            {cards.length === 0 && (
              <p style={styles.helperText}>No saved cards.</p>
            )}

            {cards.map((card, index) => {
              const isSavedCard = !!card.last4 && !card.isNew;

              return (
                <div key={index} style={styles.cardBox}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Cardholder Name</label>
                    <input
                      value={card.cardholder_name || ""}
                      onChange={(e) => {
                        const updated = [...cards];
                        updated[index] = {
                          ...updated[index],
                          cardholder_name: e.target.value,
                        };
                        setCards(updated);
                      }}
                      style={styles.input}
                      disabled={isSavedCard}
                    />
                  </div>

                  {isSavedCard ? (
                    <>
                      <div style={styles.maskedCardText}>
                        Saved card ending in {card.last4}
                      </div>

                      <div style={styles.twoCol}>
                        <div style={styles.fieldGroup}>
                          <label style={styles.label}>Exp. Month</label>
                          <input
                            type="number"
                            value={card.expiry_month}
                            disabled
                            style={styles.disabledInput}
                          />
                        </div>

                        <div style={styles.fieldGroup}>
                          <label style={styles.label}>Exp. Year</label>
                          <input
                            type="number"
                            value={card.expiry_year}
                            disabled
                            style={styles.disabledInput}
                          />
                        </div>
                      </div>

                      <p style={styles.helperText}>
                        Saved cards cannot be edited here because the backend
                        only returns masked card details. Remove the card and add
                        a new one if you want to replace it.
                      </p>

                      <div style={styles.buttonRow}>
                        <button
                          onClick={() => deleteCard(index)}
                          style={styles.secondaryBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={styles.fieldGroup}>
                        <label style={styles.label}>Card Number</label>
                        <input
                          value={card.card_number || ""}
                          onChange={(e) => {
                            const updated = [...cards];
                            updated[index] = {
                              ...updated[index],
                              card_number: e.target.value,
                            };
                            setCards(updated);
                          }}
                          style={styles.input}
                          placeholder="Enter card number"
                        />
                      </div>

                      <div style={styles.threeCol}>
                        <div style={styles.fieldGroup}>
                          <label style={styles.label}>Exp. Month</label>
                          <input
                            type="number"
                            value={card.expiry_month}
                            onChange={(e) => {
                              const updated = [...cards];
                              updated[index] = {
                                ...updated[index],
                                expiry_month: Number(e.target.value),
                              };
                              setCards(updated);
                            }}
                            style={styles.input}
                          />
                        </div>

                        <div style={styles.fieldGroup}>
                          <label style={styles.label}>Exp. Year</label>
                          <input
                            type="number"
                            value={card.expiry_year}
                            onChange={(e) => {
                              const updated = [...cards];
                              updated[index] = {
                                ...updated[index],
                                expiry_year: Number(e.target.value),
                              };
                              setCards(updated);
                            }}
                            style={styles.input}
                          />
                        </div>

                        <div style={styles.fieldGroup}>
                          <label style={styles.label}>CVV</label>
                          <input
                            value={card.cvv || ""}
                            onChange={(e) => {
                              const updated = [...cards];
                              updated[index] = {
                                ...updated[index],
                                cvv: e.target.value,
                              };
                              setCards(updated);
                            }}
                            style={styles.input}
                            placeholder="CVV"
                          />
                        </div>
                      </div>

                      <div style={styles.buttonRow}>
                        <button
                          onClick={() => saveCard(card, index)}
                          style={styles.submitBtn}
                        >
                          Save Card
                        </button>
                        <button
                          onClick={() => deleteCard(index)}
                          style={styles.secondaryBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Favorite Movies</h2>
            <p style={styles.helperText}>
              Favorite movies are added while browsing from the movie detail
              page.
            </p>

            {favorites.length === 0 ? (
              <p style={styles.helperText}>No favorite movies yet.</p>
            ) : (
              <ul style={styles.favoriteList}>
                {favorites.map((movie) => (
                  <li key={movie.id} style={styles.favoriteItem}>
                    {movie.title}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    width: "100%",
  },
  bg: {
    position: "fixed",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    zIndex: -2,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: -1,
  },
  wrapper: {
    minHeight: "calc(100vh - 70px)",
    marginTop: 70,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 760,
    background: "rgba(10,10,12,0.78)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    backdropFilter: "blur(14px)",
    padding: "32px",
    color: "white",
    boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  headerBlock: {
    textAlign: "center",
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    opacity: 0.72,
    margin: 0,
  },
  title: {
    fontSize: 36,
    fontWeight: 800,
    margin: "8px 0",
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.82,
    margin: 0,
    lineHeight: 1.5,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 18,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
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
    padding: "12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    fontSize: 14,
  },
  disabledInput: {
    padding: "12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.7)",
    outline: "none",
    fontSize: 14,
    cursor: "not-allowed",
  },
  helperText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    margin: 0,
  },
  serverError: {
    color: "#ff8080",
    fontSize: 13,
    textAlign: "center",
  },
  successMessage: {
    color: "#8dffb1",
    fontSize: 13,
    textAlign: "center",
  },
  submitBtn: {
    padding: "12px",
    borderRadius: 10,
    border: "none",
    background: "white",
    color: "black",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  loadingText: {
    color: "white",
    textAlign: "center",
    margin: 0,
    fontSize: 16,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  threeCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
  },
  cardBox: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  maskedCardText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.82)",
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  favoriteList: {
    margin: 0,
    paddingLeft: 20,
  },
  favoriteItem: {
    marginBottom: 8,
    color: "rgba(255,255,255,0.9)",
  },
};