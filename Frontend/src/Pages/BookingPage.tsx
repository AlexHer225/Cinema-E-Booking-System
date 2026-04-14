import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

interface Seat {
  seat: string;
  status: "available" | "booked";
}

const API_BASE = "http://127.0.0.1:8000";

function BookingPage() {
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

  // 🔁 Fetch seats (SAFE)
  const fetchSeats = async () => {
    if (!showtimeId) {
      setError("Missing showtime ID");
      setLoadingSeats(false);
      return;
    }

    try {
      setLoadingSeats(true);
      setError("");

      const res = await fetch(`${API_BASE}/showtimes/${showtimeId}/seats`) ;
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data = await res.json();

      // ✅ SAFE parsing (prevents crash)
      const safeLayout: Seat[][] = Array.isArray(data.seat_layout)
        ? data.seat_layout.map((row: any[]) =>
            Array.isArray(row)
              ? row.map((seatObj: any) => ({
                  seat: seatObj?.seat ?? "",
                  status: seatObj?.status ?? "available",
                }))
              : []
          )
        : [];

      setSeatLayout(safeLayout);
    } catch (err) {
      console.error(err);
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

  // 🎯 Reserve
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

    const tickets = [
      ...Array(adultQty).fill("adult"),
      ...Array(childQty).fill("child"),
      ...Array(seniorQty).fill("senior"),
    ];

    const payload = {
      showtime_id: showtimeId,
      tickets: Array.from(selectedSeats).map((seat, i) => ({
        seat,
        type: tickets[i],
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
      localStorage.setItem("booking_id", data.id);

      alert("Reserved!");
      fetchSeats();
      setSelectedSeats(new Set());
    } catch (err) {
      console.error(err);
    }
  };

  // ⏳ States
  if (loadingSeats) return <div style={styles.center}>Loading...</div>;
  if (error) return <div style={styles.center}>{error}</div>;

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
      <div style={styles.overlay}>
        <div style={styles.container}>
          <h1 style={styles.header}>Checkout</h1>

          <h2>{title}</h2>
          <p>{time}</p>

          {/* Tickets */}
          <div style={styles.ticketSection}>
            <TicketRow label="Adult" price={PRICES.adult} value={adultQty} onChange={setAdultQty} />
            <TicketRow label="Child" price={PRICES.child} value={childQty} onChange={setChildQty} />
            <TicketRow label="Senior" price={PRICES.senior} value={seniorQty} onChange={setSeniorQty} />
          </div>

          <h2 style={styles.total}>Total: ${totalPrice.toFixed(2)}</h2>

          {/* Seats */}
          <div style={styles.gridWrapper}>
            {seatLayout.map((row, i) => (
              <div key={i} style={styles.row}>
                {row.map((seatObj, j) => {
                  if (!seatObj?.seat) return null;

                  const isBooked = seatObj.status === "booked";
                  const isSelected = selectedSeats.has(seatObj.seat);

                  return (
                    <div
                      key={seatObj.seat || j}
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
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <button
            style={styles.confirmBtn}
            onClick={handleReserve}
            disabled={selectedSeats.size !== totalTickets}
          >
            Confirm
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
  bg: { position: "fixed", inset: 0, backgroundSize: "cover" },
  overlay: { minHeight: "100vh", background: "rgba(0,0,0,0.8)", padding: 40 },
  container: { maxWidth: 900, margin: "0 auto", color: "white" },
  header: { textAlign: "center" },
  ticketSection: { marginTop: 20 },
  rowTicket: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
  total: { marginTop: 20 },
  gridWrapper: {
    marginTop: 30,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  row: { display: "flex", gap: 8 },
  seat: {
    width: 35,
    height: 35,
    borderRadius: 6,
  },
  confirmBtn: {
    marginTop: 20,
    width: "100%",
    padding: 12,
    background: "#e74c3c",
    color: "white",
    border: "none",
  },
  center: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
  },
};

export default BookingPage;