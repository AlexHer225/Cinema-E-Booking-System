import React, { useState } from "react";
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

  const [cardName, setCardName] = useState("John Doe");
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/28");
  const [cvv, setCvv] = useState("123");

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
    showtimeId,
    email,
    selectedSeats = [],
    adultQty = 0,
    childQty = 0,
    seniorQty = 0,
    totalPrice = 0,
    bookingId,
  } = state;

  const handlePayment = async () => {
    try {
      setLoading(true);
      setError("");

      if (!cardName.trim() || !cardNumber.trim() || !expiry.trim() || !cvv.trim()) {
        throw new Error("Please fill in all payment details");
      }

      const token = localStorage.getItem("access_token");

      if (!token) {
        throw new Error("You must be logged in to complete payment");
      }

      if (!bookingId) {
        throw new Error("Booking ID missing. Please go back and try again.");
      }

      if (!email?.trim()) {
        throw new Error("Email is required");
      }

      const emailRes = await fetch(`${API_BASE}/send-confirmation-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          email: email.trim(),
        }),
      });

      if (!emailRes.ok) {
        let message = "Email confirmation failed";

        try {
          const msg = await emailRes.json();
          message = msg.detail || msg.message || message;
        } catch {
          // ignore parse failure
        }

        throw new Error(message);
      }

      await emailRes.json();

      setPopup(true);

      setTimeout(() => {
        setPopup(false);
        localStorage.removeItem("booking_id");
        navigate("/");
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Payment Processing</h1>

        <div style={styles.card}>
          <p><b>Movie:</b> {movieTitle}</p>
          <p><b>Showtime:</b> {showtime}</p>
          <p><b>Email:</b> {email}</p>
          <p><b>Seats:</b> {selectedSeats.join(", ")}</p>
          <hr style={{ opacity: 0.2, margin: "10px 0" }} />
          <p><b>Total Amount:</b> ${Number(totalPrice).toFixed(2)}</p>
        </div>

        <div style={styles.card}>
          <h3>Payment Details</h3>

          <input
            style={styles.input}
            placeholder="Cardholder Name"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Card Number"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <input
              style={styles.input}
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="CVV"
              value={cvv}
              onChange={(e) => setCvv(e.target.value)}
            />
          </div>
        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button style={styles.btn} onClick={handlePayment} disabled={loading}>
          {loading ? "Processing..." : "Confirm & Pay"}
        </button>
      </div>

      {popup && (
        <div style={styles.overlay}>
          <div style={styles.popup}>
            <h2>Payment Successful 🎉</h2>
            <p>Your booking is confirmed. Email sent.</p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "fixed",
    inset: 0,
    paddingTop: 90,
    background:
      "radial-gradient(1200px 600px at 20% 10%, rgba(255,255,255,0.08), transparent 60%), rgba(10,10,12,1)",
    overflowY: "auto",
  },
  container: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "0 24px",
    color: "white",
  },
  title: {
    fontSize: 34,
    fontWeight: 800,
    marginBottom: 20,
  },
  card: {
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    outline: "none",
  },
  btn: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  popup: {
    background: "#111",
    padding: 30,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.2)",
    textAlign: "center" as const,
    color: "white",
  },
};