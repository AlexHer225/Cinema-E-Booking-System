import React, { useState } from "react";

type Movie = {
  id: string;
  title: string;
  showtime: string;
  rating: string;
};

type Promotion = {
  id: string;
  movieTitle: string;
  discount: string;
};

const bgUrl = "/images/backgroundImage.jpg";

export default function AdminMoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [showMovieModal, setShowMovieModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);

  const [newMovie, setNewMovie] = useState<Movie>({
    id: "",
    title: "",
    showtime: "",
    rating: "",
  });

  const [newPromo, setNewPromo] = useState<Promotion>({
    id: "",
    movieTitle: "",
    discount: "",
  });


  const handleAddMovie = () => {
    if (!newMovie.title || !newMovie.showtime || !newMovie.rating) {
      alert("All movie fields are required");
      return;
    }

    const movieToAdd = {
      ...newMovie,
      id: Date.now().toString(),
    };

    setMovies([...movies, movieToAdd]);

    setNewMovie({ id: "", title: "", showtime: "", rating: "" });
    setShowMovieModal(false);
  };


  const handleAddPromotion = () => {
    if (!newPromo.movieTitle || !newPromo.discount) {
      alert("All promotion fields are required");
      return;
    }

    const promoToAdd = {
      ...newPromo,
      id: Date.now().toString(),
    };

    setPromotions([...promotions, promoToAdd]);

    setNewPromo({ id: "", movieTitle: "", discount: "" });
    setShowPromoModal(false);
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />

      <div style={styles.container}>
        <h2>Admin Management</h2>

      
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button onClick={() => setShowMovieModal(true)} style={styles.addBtn}>
            Add Movie
          </button>

          <button onClick={() => setShowPromoModal(true)} style={styles.addBtn}>
            Add Promotion
          </button>
        </div>

        <h3>Movies</h3>
        <ul style={styles.list}>
          {movies.map((m) => (
            <li key={m.id}>
              <strong>{m.title}</strong> — {m.showtime} — {m.rating}
            </li>
          ))}
        </ul>

     
        <h3>Promotions</h3>
        <ul style={styles.list}>
          {promotions.map((p) => (
            <li key={p.id}>
              {p.movieTitle} — {p.discount}% OFF
            </li>
          ))}
        </ul>
      </div>

    
      {showMovieModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Add Movie</h3>

            <input
              type="text"
              placeholder="Movie Title"
              value={newMovie.title}
              onChange={(e) =>
                setNewMovie({ ...newMovie, title: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Showtime (e.g. 7:00 PM)"
              value={newMovie.showtime}
              onChange={(e) =>
                setNewMovie({ ...newMovie, showtime: e.target.value })
              }
            />

            <select
              value={newMovie.rating}
              onChange={(e) =>
                setNewMovie({ ...newMovie, rating: e.target.value })
              }
            >
              <option value="">Select Age Rating</option>
              <option value="G">G</option>
              <option value="PG">PG</option>
              <option value="PG-13">PG-13</option>
              <option value="R">R</option>
            </select>

            <div style={styles.modalBtns}>
              <button onClick={handleAddMovie}>Add</button>
              <button onClick={() => setShowMovieModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      
      {showPromoModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Add Promotion</h3>

            <input
              type="text"
              placeholder="Movie Title"
              value={newPromo.movieTitle}
              onChange={(e) =>
                setNewPromo({ ...newPromo, movieTitle: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Discount %"
              value={newPromo.discount}
              onChange={(e) =>
                setNewPromo({ ...newPromo, discount: e.target.value })
              }
            />

            <div style={styles.modalBtns}>
              <button onClick={handleAddPromotion}>Add</button>
              <button onClick={() => setShowPromoModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
    maxWidth: "650px",
    padding: "28px",
    borderRadius: "16px",
    textAlign: "center",

   
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    background: "rgba(0, 0, 0, 0.75)",
    border: "1px solid rgba(255,255,255,0.15)",
    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",

    color: "white",
  },

  addBtn: {
    padding: "12px 16px",
    borderRadius: "10px",
    border: "none",
    background: "white",
    color: "black",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "14px",
  },

  list: {
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  modal: {
    background: "rgba(0,0,0,0.85)",
    padding: "20px",
    borderRadius: "16px",
    width: "320px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
    color: "white",
  },

  modalBtns: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
  },

  input: {
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    fontSize: "14px",
  },

  label: {
    fontSize: "12px",
    fontWeight: 700,
    color: "white",
    letterSpacing: 0.4,
  },

  saveBtn: {
    padding: "12px",
    background: "white",
    color: "black",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "14px",
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

