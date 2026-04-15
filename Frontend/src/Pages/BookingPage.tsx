import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

interface Seat {
  seat: string;
  status: "available" | "booked";
}

const API_BASE = "http://127.0.0.1:8000";

function BookingPage() {
  const navigate = useNavigate();
 
  const bgUrl = "/images/backgroundImage.jpg";
  const { title } = useParams();
  const [searchParams] = useSearchParams();

  const time = searchParams.get("time");
  const showtimeId = searchParams.get("showtime_id");

  const PRICES = {
    adult: 12.99,
    child: 7.99,
    senior: 7.99,
  };

  const [adultQty, setAdultQty] = useState(0);
  const [childQty, setChildQty] = useState(0);
  const [seniorQty, setSeniorQty] = useState(0);

  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [seatLayout, setSeatLayout] = useState<Seat[][]>([]);
  const [loadingSeats, setLoadingSeats] = useState(true);
  const [error, setError] = useState("");

  const totalTickets = adultQty + childQty + seniorQty;

  const totalPrice =
    adultQty * PRICES.adult +
    childQty * PRICES.child +
    seniorQty * PRICES.senior;

  // 🔁 Fetch seats
  const fetchSeats = async () => {
    
    if (!showtimeId) {
      setError("Missing showtime ID");
      
      setLoadingSeats(false);
      return;
    }

    try {
      setLoadingSeats(true);
      setError("");

      const res = await fetch(
        `${API_BASE}/showtimes/${showtimeId}/seats`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();

      console.log("Seat API response:", data); // 🔥 DEBUG

      const safeLayout: Seat[][] = Array.isArray(data.seat_layout)
        ? data.seat_layout.map((row: any[]) =>
            row.map((seatItem: any) => {
              // 🔥 handle BOTH formats
              if (typeof seatItem === "string") {
                return {
                  seat: seatItem,
                  status: "available", // default
                };
              }

              return {
                seat: seatItem?.seat ?? "",
                status: seatItem?.status ?? "available",
              };
            })
          )
        : [];

      setSeatLayout(safeLayout);
    } catch (err) {
      console.error("Seat fetch error:", err);
      setError("Failed to load seats.");
    } finally {
      setLoadingSeats(false);
    }
  };

  useEffect(() => {
    fetchSeats();
  }, [showtimeId]);

  // 🎟️ Toggle seat
  const toggleSeat = (seatId: string, isBooked: boolean) => {
    if (!seatId || isBooked) return;

    setSelectedSeats((prev) => {
      const updated = new Set(prev);

      if (updated.has(seatId)) {
        updated.delete(seatId);
      } else {
        if (totalTickets === 0) {
          alert("Select tickets first.");
          return prev;
        }

        if (updated.size >= totalTickets) {
          alert("Too many seats selected.");
          return prev;
        }

        updated.add(seatId);
      }

      return updated;
    });
  };

  // 🎯 Reserve seats

  const bookingState = {
  movieTitle: title || "Unknown Movie",
  showtimeId,
  showtime: time,
  selectedSeats: Array.from(selectedSeats),

  adultQty,
  childQty,
  seniorQty,

  pricePerTicket: {
    adult: PRICES.adult,
    child: PRICES.child,
    senior: PRICES.senior,
  },

  totalTickets,
  totalPrice,
};
  const handleReserve = async () => {
    if (!showtimeId || totalTickets === 0) return;

    if (selectedSeats.size !== totalTickets) {
      alert("Seats must match tickets.");
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
      tickets: Array.from(selectedSeats).map((seat, i) => ({
        seat,
        type: ticketTypes[i],
      })),
      session_token: sessionToken,
    };

    try {
      const res = await fetch(`${API_BASE}/bookings/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const err = await res.json();
        alert(err.detail);
        fetchSeats();
        return;
      }

      const data = await res.json();
      console.log("Booking:", data);

      localStorage.setItem("booking_id", data.id);

      alert("Seats reserved!");
      navigate("/");
      setSelectedSeats(new Set());
      fetchSeats();
    } catch (err) {
      console.error("Reserve error:", err);
    }
  };

  if (loadingSeats) return <div style={styles.center}>Loading seats...</div>;
  if (error) return <div style={styles.center}>{error}</div>;
  console.log("showtimeId:", showtimeId);
console.log("loadingSeats:", loadingSeats);
console.log("error:", error);
console.log("seatLayout:", seatLayout);

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1>Checkout</h1>

          <h2>{title}</h2>
          <p>{time}</p>

          {/* Tickets */}
          <div style={styles.ticketSection}>
            <TicketRow label="Adult" price={PRICES.adult} value={adultQty} onChange={setAdultQty} />
            <TicketRow label="Child" price={PRICES.child} value={childQty} onChange={setChildQty} />
            <TicketRow label="Senior" price={PRICES.senior} value={seniorQty} onChange={setSeniorQty} />
          </div>

          <h2>Total: ${totalPrice.toFixed(2)}</h2>

          {/* Seats */}
          <div style={styles.gridWrapper}>
            {seatLayout.map((row, i) => (
              <div key={i} style={styles.row}>
                {row.map((seatObj, j) => {
                  const isBooked = seatObj.status === "booked";
                  const isSelected = selectedSeats.has(seatObj.seat);

                  return (
                    <div
                      key={seatObj.seat}
                      onClick={() => toggleSeat(seatObj.seat, isBooked)}
                      style={{
                        ...styles.seat,
                        backgroundColor: isBooked
                          ? "#555"
                          : isSelected
                          ? "#2ecc71"
                          : "#e74c3c",
                        cursor: isBooked ? "not-allowed" : "pointer",
                      }}
                      title={seatObj.seat}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <button
  style={styles.confirmBtn}
  onClick={() => {
        navigate("/confirmation", {
          state: bookingState,
        });
  }}
  disabled={selectedSeats.size !== totalTickets}
>
  Confirm Booking
</button>
        </div>
      </div>
    </div>
  );
}

function TicketRow({ label, price, value, onChange }: any) {
  return (
    <div style={styles.rowTicket}>
      <span>{label} (${price})</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0a0c" },
  bg: {
  position: "fixed",
  inset: 0,
  backgroundSize: "cover",
  zIndex: 0, 
},

overlay: {
  position: "relative",
  zIndex: 1, 
  minHeight: "100vh",
  background: "rgba(0,0,0,0.8)",
  padding: 40,
},
  container: { maxWidth: 900, margin: "0 auto", color: "white" },
  ticketSection: { marginTop: 20 },
  rowTicket: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
  gridWrapper: { marginTop: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  row: { display: "flex", gap: 8 },
  seat: { width: 35, height: 35, borderRadius: 6 },
  confirmBtn: { marginTop: 20, width: "100%", padding: 12, background: "#e74c3c", color: "white", border: "none" },
  center: { height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", color: "white" },
};

export default BookingPage;