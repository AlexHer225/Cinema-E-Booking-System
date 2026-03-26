import React, { useEffect, useState } from "react";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.trim?.() || "http://127.0.0.1:8000";


const bgUrl = "/images/backgroundImage.jpg";



type Address = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

type Card = {
  cardNumber: string;
  expiry: string;
};

type Movie = {
  id: string;
  title: string;
};

type User = {
  name: string;
  username: string;
  email: string;
  address?: Address;
  cards: Card[];
  favorites: Movie[];
};



const defaultUser: User = {
  name: "John Doe",
  username: "johndoe",
  email: "johndoe@example.com",
  address: {
    street: "123 Main St",
    city: "Manhattan",
    state: "NYC",
    zip: "10001",
  },
  cards: [{ cardNumber: "1111 2222 3333 4444", expiry: "12/26" }],
  favorites: [
    { id: "1", title: "Inception" },
    { id: "2", title: "Interstellar" },
  ],
};

export default function EditProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [newFav, setNewFav] = useState("");

  
  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch(`${API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("No profile found");
        return res.json();
      })
      .then((data) =>
        setUser({
          ...defaultUser,
          ...data,
          cards: data.cards || [],
          favorites: data.favorites || [],
        })
      )
      .catch(() => {
        console.warn("Using default profile");
        setUser(defaultUser);
      });
  }, []);


  const handleSave = async () => {
    const token = localStorage.getItem("token");

    await fetch(`${API_BASE}/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(user),
    });

    alert("Profile updated!");
  };

  if (!user) {
    return (
      <div style={{ color: "white", textAlign: "center", marginTop: "100px" }}>
        Loading...
      </div>
    );
  }

 
  const addAddress = () => {
    if (user.address) {
      alert("Only one address allowed");
      return;
    }
    setUser({
      ...user,
      address: { street: "", city: "", state: "", zip: "" },
    });
  };

 
  const addCard = () => {
    if (user.cards.length >= 3) {
      alert("Maximum 3 cards allowed");
      return;
    }
    setUser({
      ...user,
      cards: [...user.cards, { cardNumber: "", expiry: "" }],
    });
  };


  const addFavorite = async () => {
    if (!newFav.trim()) return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_BASE}/favorites`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ movieTitle: newFav }),
      });

      const movie = await res.json();

      setUser({
        ...user,
        favorites: [...user.favorites, movie],
      });
    } catch {
      
      setUser({
        ...user,
        favorites: [
          ...user.favorites,
          { id: Date.now().toString(), title: newFav },
        ],
      });
    }

    setNewFav("");
  };

  return (
    <div style={styles.page}>
      
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />

     
      <div style={styles.container}>
        <h2>Edit Profile</h2>

        
        {user.username === "johndoe" && (
          <p style={{ color: "orange" }}>
            ⚠ Using demo profile (not saved)
          </p>
        )}

        
        <div style={styles.section}>
          <input
            value={user.name}
            onChange={(e) =>
              setUser({ ...user, name: e.target.value })
            }
            placeholder="Name"
          />

          <input
            value={user.username}
            onChange={(e) =>
              setUser({ ...user, username: e.target.value })
            }
            placeholder="Username"
          />

          <input value={user.email} disabled />
        </div>

       
        <div style={styles.section}>
          <h3>Address</h3>

          {user.address ? (
            <>
              <input
                value={user.address.street}
                onChange={(e) =>
                  setUser({
                    ...user,
                    address: { ...user.address!, street: e.target.value },
                  })
                }
                placeholder="Street"
              />
              <input
                value={user.address.city}
                onChange={(e) =>
                  setUser({
                    ...user,
                    address: { ...user.address!, city: e.target.value },
                  })
                }
                placeholder="City"
              />
              <input
                value={user.address.state}
                onChange={(e) =>
                  setUser({
                    ...user,
                    address: { ...user.address!, state: e.target.value },
                  })
                }
                placeholder="State"
              />
              <input
                value={user.address.zip}
                onChange={(e) =>
                  setUser({
                    ...user,
                    address: { ...user.address!, zip: e.target.value },
                  })
                }
                placeholder="ZIP"
              />
            </>
          ) : (
            <button onClick={addAddress}>Add Address</button>
          )}
        </div>

      
        <div style={styles.section}>
          <h3>Payment Cards</h3>

          {user.cards?.map((c, i) => (
            <div key={i}>
              <input
                value={c.cardNumber}
                onChange={(e) => {
                  const updated = [...user.cards];
                  updated[i].cardNumber = e.target.value;
                  setUser({ ...user, cards: updated });
                }}
                placeholder="Card Number"
              />
              <input
                value={c.expiry}
                onChange={(e) => {
                  const updated = [...user.cards];
                  updated[i].expiry = e.target.value;
                  setUser({ ...user, cards: updated });
                }}
                placeholder="MM/YY"
              />
            </div>
          ))}

          <button onClick={addCard}>Add Card</button>
        </div>

        
        <div style={styles.section}>
          <h3>Favorite Movies</h3>

          <ul>
            {user.favorites?.map((m) => (
              <li key={m.id}>{m.title}</li>
            ))}
          </ul>

          <input
            value={newFav}
            onChange={(e) => setNewFav(e.target.value)}
            placeholder="Add movie title"
          />
          <button onClick={addFavorite}>Add Favorite</button>
        </div>

        
        <button onClick={handleSave} style={styles.saveBtn}>
          Save Changes
        </button>
      </div>
    </div>
  );
}


const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    
  },


  bg: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    zIndex: -1,
  },

  container: {
    width: "100%",
    maxWidth: 500,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    gap: 20,
    borderRadius: 16,

    
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    background: "rgba(0, 0, 0, 0.75)",
    border: "1px solid rgba(255,255,255,0.15)",
    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",

    color: "white",
  },

  section: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
  },

  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "white",
    letterSpacing: 0.4,
    
  },

  input: {
    padding: "12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    fontSize: "14px",
  },

  saveBtn: {
    padding: "12px",
    background: "white",
    color: "black",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "14px",
    marginTop: 10,
  },

  error: {
    color: "#ff6b6b",
    fontSize: "0.8rem",
    textAlign: "left",
  },

  success: {
    color: "#4cd964",
    fontSize: "0.9rem",
    textAlign: "left",
  },
};

