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
    selectedSeats,
    adultQty,
    childQty,
    seniorQty,
    totalPrice,
  } = state;

const handlePayment = async () => {
  try {
    setLoading(true);
    setError("");

    if (!cardName || !cardNumber || !expiry || !cvv) {
      throw new Error("Please fill in all payment details");
    }

    const token = localStorage.getItem("access_token");

    const ticketTypes = [
      ...Array(adultQty).fill("adult"),
      ...Array(childQty).fill("child"),
      ...Array(seniorQty).fill("senior"),
    ];

    const sessionToken =
      localStorage.getItem("session_token") || crypto.randomUUID();

    localStorage.setItem("session_token", sessionToken);

    
    const reserveRes = await fetch(`${API_BASE}/bookings/reserve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
      body: JSON.stringify({
        showtime_id: showtimeId,
        tickets: selectedSeats.map((seat: string, i: number) => ({
          seat,
          type: ticketTypes[i],
        })),
        session_token: sessionToken,
      }),
    });

    if (!reserveRes.ok) {
      const msg = await reserveRes.json();
      throw new Error(msg.detail || "Booking failed");
    }

    await reserveRes.json();

    
    const emailRes = await fetch(`${API_BASE}/send-confirmation-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        movieTitle,
        showtime,
        seats: selectedSeats.join(", "),
        totalPrice,
      }),
    });

    if (!emailRes.ok) {
      const msg = await emailRes.json();
      throw new Error(msg.detail || "Email failed");
    }

   
    setPopup(true);

    setTimeout(() => {
      setPopup(false);
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
          <p><b>Total Amount:</b> ${totalPrice.toFixed(2)}</p>
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
    textAlign: "center",
    color: "white",
  },
};