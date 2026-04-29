import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.trim?.() ||
  "http://localhost:8000";

export default function ConfirmationPage() {
  const navigate = useNavigate();
  const { state } = useLocation() as any;

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const loadEmail = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const res = await fetch(`${API_BASE}/me/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const data = await res.json();
        setEmail(data.email || data.email_address || "");
      } catch (err) {
        console.error("Email fetch failed", err);
      }
    };

    loadEmail();
  }, []);

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
    selectedSeats = [],
    adultQty = 0,
    childQty = 0,
    seniorQty = 0,
    totalTickets = 0,
    totalPrice = 0,
  } = state;

  const handleConfirm = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem("access_token");
      const bookingId = state?.bookingId;

      if (!token) {
        alert("You must be logged in to continue.");
        navigate("/login");
        return;
      }

      if (!bookingId) {
        alert("Booking ID not found. Please go back and reserve seats again.");
        return;
      }

      if (!email.trim()) {
        alert("Please enter an email address.");
        return;
      }

      const checkoutRes = await fetch(
        `${API_BASE}/bookings/${bookingId}/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      if (!checkoutRes.ok) {
        let message = "Could not proceed to payment.";

        try {
          const errData = await checkoutRes.json();
          message = errData.detail || errData.message || message;
        } catch {
          // ignore JSON parse failure
        }

        throw new Error(message);
      }

      const checkoutData = await checkoutRes.json();

      navigate("/payment", {
        state: {
          movieTitle,
          showtime,
          showtimeId,
          email: email.trim(),
          selectedSeats,
          adultQty,
          childQty,
          seniorQty,
          totalTickets,
          totalPrice,
          bookingId,
          checkoutData,
        },
      });
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Could not proceed to payment.");
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

          <p><b>Email:</b> {email || "Loading..."}</p>

          <p><b>Seats:</b> {selectedSeats.join(", ")}</p>

          <hr style={{ margin: "10px 0", opacity: 0.2 }} />

          <p>
            <b>Adult ($12.99):</b> {adultQty} &nbsp; | &nbsp;
            <b>Child ($7.99):</b> {childQty} &nbsp; | &nbsp;
            <b>Senior ($7.99):</b> {seniorQty}
          </p>

          <p><b>Total Tickets:</b> {totalTickets}</p>
          <p><b>Total Price:</b> ${Number(totalPrice).toFixed(2)}</p>
        </div>

        <div style={{ marginTop: 12 }}>
          <h4 style={{ color: "white" }}>Change Email</h4>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
            }}
          />
        </div>

        <div style={styles.buttonRow}>
          <button style={styles.secondaryBtn} onClick={() => navigate(-1)}>
            Back
          </button>

          <button
            style={styles.btn}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : "Proceed to Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "fixed",
    inset: 0,
    paddingTop: 90,
    overflowY: "auto",
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
  },
};