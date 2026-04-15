import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.trim?.() ||
  "http://localhost:8000";

export default function ConfirmationPage() {
  const navigate = useNavigate();
  const { state } = useLocation() as any;

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!state) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p style={{ color: "white" }}>No booking data found.</p>
          <button style={styles.btn} onClick={() => navigate("/")}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const {
    movieTitle,
    showtime,
    showtimeId,
    selectedSeats,
    adultQty,
    childQty,
    seniorQty,
    totalTickets,
    totalPrice,
  } = state;

  const handleConfirm = async () => {
    if (!showtimeId || totalTickets === 0) return;

    if (selectedSeats.length !== totalTickets) {
      setError("Seats must match tickets.");
      return;
    }

    let sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) {
      sessionToken = crypto.randomUUID();
      localStorage.setItem("session_token", sessionToken);
    }

    const ticketTypes = [
      ...Array(adultQty).fill("adult"),
      ...Array(childQty).fill("child"),
      ...Array(seniorQty).fill("senior"),
    ];

    const payload = {
      showtime_id: showtimeId,
      tickets: selectedSeats.map((seat: string, i: number) => ({
        seat,
        type: ticketTypes[i],
      })),
      session_token: sessionToken,
    };

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/bookings/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const err = await res.json();
        setError(err.detail || "Seats already booked.");
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Booking failed");
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not complete booking.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Order Summary</h1>

        <div style={styles.card}>
          <p><b>Movie:</b> {movieTitle}</p>
          <p><b>Showtime:</b> {showtime}</p>

          <p><b>Seats:</b> {selectedSeats.join(", ")}</p>

          <p>
            <b>Adult ($12.99):</b> {adultQty} &nbsp; | &nbsp;
            <b>Child ($7.99):</b> {childQty} &nbsp; | &nbsp;
            <b>Senior ($7.99):</b> {seniorQty}
          </p>

          <p><b>Total Tickets:</b> {totalTickets}</p>
          <p><b>Total Price:</b> ${totalPrice.toFixed(2)}</p>
        </div>

        {error && <p style={{ color: "salmon" }}>{error}</p>}

        <div style={styles.buttonRow}>
          <button style={styles.secondaryBtn} onClick={() => navigate(-1)}>
            Back
          </button>

          <button
            style={styles.btn}
            onClick={handleConfirm}
            disabled={loading || success}
          >
            {loading ? "Processing..." : "Confirm Order"}
          </button>
        </div>
      </div>

      {success && (
        <div style={styles.popupOverlay}>
          <div style={styles.popup}>
            <h2>Order Confirmed 🎉</h2>
            <p>Your seats have been reserved successfully.</p>

            <button style={styles.btn} onClick={() => navigate("/")}>
              Go to Home Now
            </button>
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
    overflowY: "auto",
    backgroundColor: "#0a0a0c",
    background:
      "radial-gradient(1200px 600px at 20% 10%, rgba(255,255,255,0.08), transparent 60%), rgba(10,10,12,1)",
  },

  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "0 24px 40px",
    color: "white",
  },

  title: {
    fontSize: 34,
    marginBottom: 18,
    fontWeight: 800,
  },

  card: {
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 20,
    lineHeight: 1.8,
  },

  buttonRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },

  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  },

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "transparent",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  },

  popupOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  popup: {
    background: "#111",
    padding: 30,
    borderRadius: 16,
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "white",
  },
};