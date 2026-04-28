import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.trim?.() ||
  "http://localhost:8000";

export default function PaymentPage() {
  const { state } = useLocation() as any;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState(false);
  const [error, setError] = useState("");

  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  useEffect(() => {
    const fetchSavedCards = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const res = await fetch(`${API_BASE}/me/cards`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const data = await res.json();
        setSavedCards(data.payment_cards || []);

        if ((data.payment_cards || []).length > 0) {
          setSelectedCardIndex(0);
        }
      } catch (err) {
        console.error("Failed to load cards", err);
      }
    };

    fetchSavedCards();
  }, []);

  if (!state) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p style={{ color: "white" }}>No payment data found.</p>
          <button style={styles.btn} onClick={() => navigate("/")}>
            Back Home
          </button>
        </div>
      </div>
    );
  }

  const {
    movieTitle,
    showtime,
    email,
    selectedSeats = [],
    totalPrice = 0,
    bookingId,
  } = state;

  const getCardLast4 = (card: any) => {
    if (card?.last4) return card.last4;

    if (card?.card_number && typeof card.card_number === "string") {
      return card.card_number.slice(-4);
    }

    return "Missing";
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      setError("");

      if (selectedCardIndex === null) {
        if (!cardName || !cardNumber || !expiry || !cvv) {
          throw new Error("Select a saved card or enter payment details.");
        }
      }

      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Must be logged in.");

      if (!bookingId) throw new Error("Missing booking ID.");

      const emailRes = await fetch(`${API_BASE}/send-confirmation-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          email,
        }),
      });

      if (!emailRes.ok) throw new Error("Email failed.");

      setPopup(true);

      setTimeout(() => {
        setPopup(false);
        localStorage.removeItem("booking_id");
        navigate("/");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Payment failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Payment</h1>

        <div style={styles.card}>
          <p>
            <b>Movie:</b> {movieTitle}
          </p>
          <p>
            <b>Showtime:</b> {showtime}
          </p>
          <p>
            <b>Email:</b> {email}
          </p>
          <p>
            <b>Seats:</b> {selectedSeats.join(", ")}
          </p>

          <hr style={styles.hr} />

          <p>
            <b>Total:</b> ${Number(totalPrice).toFixed(2)}
          </p>
        </div>

        {savedCards.length > 0 && (
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Saved Cards</h3>

            {savedCards.map((card, index) => (
              <label key={index} style={styles.cardOption}>
                <input
                  type="radio"
                  checked={selectedCardIndex === index}
                  onChange={() => setSelectedCardIndex(index)}
                />

                <div>
                  <div>
                    {card.cardholder_name || "Saved Card"} — ****{" "}
                    {getCardLast4(card)}
                  </div>
                  <div style={styles.muted}>
                    Exp {card.expiry_month}/{card.expiry_year}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Or Enter New Card</h3>

          <input
            style={styles.input}
            placeholder="Cardholder Name"
            value={cardName}
            onChange={(e) => {
              setCardName(e.target.value);
              setSelectedCardIndex(null);
            }}
          />

          <input
            style={styles.input}
            placeholder="Card Number"
            value={cardNumber}
            onChange={(e) => {
              setCardNumber(e.target.value);
              setSelectedCardIndex(null);
            }}
          />

          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => {
                setExpiry(e.target.value);
                setSelectedCardIndex(null);
              }}
            />

            <input
              style={styles.input}
              placeholder="CVV"
              value={cvv}
              onChange={(e) => {
                setCvv(e.target.value);
                setSelectedCardIndex(null);
              }}
            />
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.btn} onClick={handlePayment} disabled={loading}>
          {loading ? "Processing..." : "Confirm & Pay"}
        </button>
      </div>

      {popup && (
        <div style={styles.overlay}>
          <div style={styles.popup}>
            <h2>Payment Successful 🎉</h2>
            <p>Booking confirmed!</p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    paddingTop: 90,
    paddingBottom: 80,
    background: "#0a0a0c",
    overflowY: "auto",
  },
  container: {
    maxWidth: 800,
    margin: "0 auto",
    padding: 20,
    color: "white",
  },
  title: {
    fontSize: 30,
    marginBottom: 20,
  },
  card: {
    background: "#111",
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
  },
  sectionTitle: {
    marginTop: 0,
  },
  cardOption: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    border: "1px solid #333",
    borderRadius: 10,
    marginTop: 10,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    marginTop: 10,
    borderRadius: 8,
    border: "1px solid #333",
    background: "#222",
    color: "white",
  },
  row: {
    display: "flex",
    gap: 10,
  },
  btn: {
    padding: 14,
    width: "100%",
    borderRadius: 10,
    border: "none",
    background: "#444",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    marginTop: 5,
    marginBottom: 40,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  popup: {
    background: "#111",
    padding: 30,
    borderRadius: 12,
    color: "white",
  },
  muted: {
    opacity: 0.7,
    marginTop: 3,
  },
  error: {
    color: "#ff6b6b",
    marginBottom: 12,
  },
  hr: {
    opacity: 0.2,
    margin: "18px 0",
  },
};