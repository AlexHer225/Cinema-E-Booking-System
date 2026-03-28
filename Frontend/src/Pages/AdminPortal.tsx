import React, { useMemo, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

type Movie = {
  id: string;
  title: string;
  rating: string;
};

type Promotion = {
  id: string;
  movieTitle: string;
  discount: string;
};

type Showtime = {
  id: string;
  movieTitle: string;
  date: string;
  time: string;
  auditorium: string;
};

const bgUrl = "/images/backgroundImage.jpg";

export default function AdminMoviesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);

  const [showUserModal, setShowUserModal] = useState(false);
  const [showMovieModal, setShowMovieModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showShowtimeModal, setShowShowtimeModal] = useState(false);

  const [newUser, setNewUser] = useState<User>({
    id: "",
    name: "",
    email: "",
    role: "",
    status: "",
  });

  const [newMovie, setNewMovie] = useState<Movie>({
    id: "",
    title: "",
    rating: "",
  });

  const [newPromo, setNewPromo] = useState<Promotion>({
    id: "",
    movieTitle: "",
    discount: "",
  });

  const [newShowtime, setNewShowtime] = useState<Showtime>({
    id: "",
    movieTitle: "",
    date: "",
    time: "",
    auditorium: "",
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const resetMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const userCountText = useMemo(() => {
    if (users.length === 1) return "1 user";
    return `${users.length} users`;
  }, [users]);

  const movieCountText = useMemo(() => {
    if (movies.length === 1) return "1 movie";
    return `${movies.length} movies`;
  }, [movies]);

  const promoCountText = useMemo(() => {
    if (promotions.length === 1) return "1 promotion";
    return `${promotions.length} promotions`;
  }, [promotions]);

  const showtimeCountText = useMemo(() => {
    if (showtimes.length === 1) return "1 showtime";
    return `${showtimes.length} showtimes`;
  }, [showtimes]);

  const closeUserModal = () => {
    setShowUserModal(false);
    setNewUser({
      id: "",
      name: "",
      email: "",
      role: "",
      status: "",
    });
  };

  const closeMovieModal = () => {
    setShowMovieModal(false);
    setNewMovie({
      id: "",
      title: "",
      rating: "",
    });
  };

  const closePromoModal = () => {
    setShowPromoModal(false);
    setNewPromo({
      id: "",
      movieTitle: "",
      discount: "",
    });
  };

  const closeShowtimeModal = () => {
    setShowShowtimeModal(false);
    setNewShowtime({
      id: "",
      movieTitle: "",
      date: "",
      time: "",
      auditorium: "",
    });
  };

  const handleAddUser = () => {
    resetMessages();

    if (
      !newUser.name.trim() ||
      !newUser.email.trim() ||
      !newUser.role.trim() ||
      !newUser.status.trim()
    ) {
      setErrorMessage("Please complete all user fields.");
      return;
    }

    const userToAdd: User = {
      ...newUser,
      id: Date.now().toString(),
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      role: newUser.role.trim(),
      status: newUser.status.trim(),
    };

    setUsers((prev) => [...prev, userToAdd]);
    setSuccessMessage("User added successfully.");
    closeUserModal();
  };

  const handleAddMovie = () => {
    resetMessages();

    if (!newMovie.title.trim() || !newMovie.rating.trim()) {
      setErrorMessage("Please complete all movie fields.");
      return;
    }

    const movieToAdd: Movie = {
      ...newMovie,
      id: Date.now().toString(),
      title: newMovie.title.trim(),
      rating: newMovie.rating.trim(),
    };

    setMovies((prev) => [...prev, movieToAdd]);
    setSuccessMessage("Movie added successfully.");
    closeMovieModal();
  };

  const handleAddPromotion = () => {
    resetMessages();

    if (!newPromo.movieTitle.trim() || !newPromo.discount.trim()) {
      setErrorMessage("Please complete all promotion fields.");
      return;
    }

    const promoToAdd: Promotion = {
      ...newPromo,
      id: Date.now().toString(),
      movieTitle: newPromo.movieTitle.trim(),
      discount: newPromo.discount.trim(),
    };

    setPromotions((prev) => [...prev, promoToAdd]);
    setSuccessMessage("Promotion added successfully.");
    closePromoModal();
  };

  const handleAddShowtime = () => {
    resetMessages();

    if (
      !newShowtime.movieTitle.trim() ||
      !newShowtime.date.trim() ||
      !newShowtime.time.trim() ||
      !newShowtime.auditorium.trim()
    ) {
      setErrorMessage("Please complete all showtime fields.");
      return;
    }

    const showtimeToAdd: Showtime = {
      ...newShowtime,
      id: Date.now().toString(),
      movieTitle: newShowtime.movieTitle.trim(),
      date: newShowtime.date.trim(),
      time: newShowtime.time.trim(),
      auditorium: newShowtime.auditorium.trim(),
    };

    setShowtimes((prev) => [...prev, showtimeToAdd]);
    setSuccessMessage("Showtime added successfully.");
    closeShowtimeModal();
  };

  const handleDeleteUser = (id: string) => {
    resetMessages();
    setUsers((prev) => prev.filter((user) => user.id !== id));
    setSuccessMessage("User removed.");
  };

  const handleDeleteMovie = (id: string) => {
    resetMessages();
    setMovies((prev) => prev.filter((movie) => movie.id !== id));
    setSuccessMessage("Movie removed.");
  };

  const handleDeletePromotion = (id: string) => {
    resetMessages();
    setPromotions((prev) => prev.filter((promo) => promo.id !== id));
    setSuccessMessage("Promotion removed.");
  };

  const handleDeleteShowtime = (id: string) => {
    resetMessages();
    setShowtimes((prev) => prev.filter((showtime) => showtime.id !== id));
    setSuccessMessage("Showtime removed.");
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.bg, backgroundImage: `url(${bgUrl})` }} />
      <div style={styles.overlay} />

      <div style={styles.wrapper}>
        <div style={styles.container}>
          <div style={styles.headerBlock}>
            <p style={styles.eyebrow}>ADMIN PORTAL</p>
            <h1 style={styles.title}>Admin Management</h1>
            <p style={styles.subtitle}>
              Manage users, movies, promotions, and showtimes from one clean dashboard.
            </p>
          </div>

          {(errorMessage || successMessage) && (
            <div style={styles.messageArea}>
              {errorMessage ? <div style={styles.errorBanner}>{errorMessage}</div> : null}
              {successMessage ? (
                <div style={styles.successBanner}>{successMessage}</div>
              ) : null}
            </div>
          )}

          <div style={styles.topButtonRow}>
            <button
              onClick={() => {
                resetMessages();
                setShowUserModal(true);
              }}
              style={styles.primaryBtn}
            >
              + Add User
            </button>

            <button
              onClick={() => {
                resetMessages();
                setShowMovieModal(true);
              }}
              style={styles.primaryBtn}
            >
              + Add Movie
            </button>

            <button
              onClick={() => {
                resetMessages();
                setShowPromoModal(true);
              }}
              style={styles.secondaryBtn}
            >
              + Add Promotion
            </button>

            <button
              onClick={() => {
                resetMessages();
                setShowShowtimeModal(true);
              }}
              style={styles.secondaryBtn}
            >
              + Add Showtime
            </button>
          </div>

          <div style={styles.grid}>
            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Users</h2>
                  <p style={styles.sectionMeta}>{userCountText}</p>
                </div>
                <button
                  onClick={() => {
                    resetMessages();
                    setShowUserModal(true);
                  }}
                  style={styles.smallActionBtn}
                >
                  Add
                </button>
              </div>

              {users.length === 0 ? (
                <div style={styles.emptyState}>
                  No users added yet. Click <strong>Add User</strong> to create one.
                </div>
              ) : (
                <div style={styles.itemsWrap}>
                  {users.map((user) => (
                    <div key={user.id} style={styles.itemCard}>
                      <div style={styles.itemTopRow}>
                        <div>
                          <h3 style={styles.itemTitle}>{user.name}</h3>
                          <p style={styles.itemSubtext}>{user.email}</p>
                          <p style={styles.itemSubtext}>
                            {user.role} • {user.status}
                          </p>
                        </div>
                      </div>

                      <div style={styles.itemActions}>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          style={styles.deleteBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Movies</h2>
                  <p style={styles.sectionMeta}>{movieCountText}</p>
                </div>
                <button
                  onClick={() => {
                    resetMessages();
                    setShowMovieModal(true);
                  }}
                  style={styles.smallActionBtn}
                >
                  Add
                </button>
              </div>

              {movies.length === 0 ? (
                <div style={styles.emptyState}>
                  No movies added yet. Click <strong>Add Movie</strong> to create one.
                </div>
              ) : (
                <div style={styles.itemsWrap}>
                  {movies.map((movie) => (
                    <div key={movie.id} style={styles.itemCard}>
                      <div style={styles.itemTopRow}>
                        <div>
                          <h3 style={styles.itemTitle}>{movie.title}</h3>
                          <p style={styles.itemSubtext}>Rating: {movie.rating}</p>
                        </div>
                        <span style={styles.badge}>{movie.rating}</span>
                      </div>

                      <div style={styles.itemActions}>
                        <button
                          onClick={() => handleDeleteMovie(movie.id)}
                          style={styles.deleteBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Promotions</h2>
                  <p style={styles.sectionMeta}>{promoCountText}</p>
                </div>
                <button
                  onClick={() => {
                    resetMessages();
                    setShowPromoModal(true);
                  }}
                  style={styles.smallActionBtn}
                >
                  Add
                </button>
              </div>

              {promotions.length === 0 ? (
                <div style={styles.emptyState}>
                  No promotions added yet. Click <strong>Add Promotion</strong> to create one.
                </div>
              ) : (
                <div style={styles.itemsWrap}>
                  {promotions.map((promo) => (
                    <div key={promo.id} style={styles.itemCard}>
                      <div style={styles.itemTopRow}>
                        <div>
                          <h3 style={styles.itemTitle}>{promo.movieTitle}</h3>
                          <p style={styles.itemSubtext}>Discount offer</p>
                        </div>
                        <span style={styles.discountBadge}>{promo.discount}% OFF</span>
                      </div>

                      <div style={styles.itemActions}>
                        <button
                          onClick={() => handleDeletePromotion(promo.id)}
                          style={styles.deleteBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Showtimes</h2>
                  <p style={styles.sectionMeta}>{showtimeCountText}</p>
                </div>
                <button
                  onClick={() => {
                    resetMessages();
                    setShowShowtimeModal(true);
                  }}
                  style={styles.smallActionBtn}
                >
                  Add
                </button>
              </div>

              {showtimes.length === 0 ? (
                <div style={styles.emptyState}>
                  No showtimes added yet. Click <strong>Add Showtime</strong> to create one.
                </div>
              ) : (
                <div style={styles.itemsWrap}>
                  {showtimes.map((showtime) => (
                    <div key={showtime.id} style={styles.itemCard}>
                      <div style={styles.itemTopRow}>
                        <div>
                          <h3 style={styles.itemTitle}>{showtime.movieTitle}</h3>
                          <p style={styles.itemSubtext}>
                            {showtime.date} at {showtime.time}
                          </p>
                          <p style={styles.itemSubtext}>
                            Auditorium: {showtime.auditorium}
                          </p>
                        </div>
                      </div>

                      <div style={styles.itemActions}>
                        <button
                          onClick={() => handleDeleteShowtime(showtime.id)}
                          style={styles.deleteBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {showUserModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add User</h3>
              <p style={styles.modalSubtitle}>Enter the user details below.</p>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                placeholder="Enter full name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                placeholder="Enter email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                style={styles.input}
              >
                <option value="">Select role</option>
                <option value="Admin">Admin</option>
                <option value="Customer">Customer</option>
                <option value="Manager">Manager</option>
              </select>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Status</label>
              <select
                value={newUser.status}
                onChange={(e) => setNewUser({ ...newUser, status: e.target.value })}
                style={styles.input}
              >
                <option value="">Select status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div style={styles.modalBtns}>
              <button onClick={closeUserModal} style={styles.modalSecondaryBtn}>
                Cancel
              </button>
              <button onClick={handleAddUser} style={styles.modalPrimaryBtn}>
                Save User
              </button>
            </div>
          </div>
        </div>
      )}

      {showMovieModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add Movie</h3>
              <p style={styles.modalSubtitle}>Enter the movie details below.</p>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Movie Title</label>
              <input
                type="text"
                placeholder="Enter movie title"
                value={newMovie.title}
                onChange={(e) => setNewMovie({ ...newMovie, title: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Age Rating</label>
              <select
                value={newMovie.rating}
                onChange={(e) => setNewMovie({ ...newMovie, rating: e.target.value })}
                style={styles.input}
              >
                <option value="">Select age rating</option>
                <option value="G">G</option>
                <option value="PG">PG</option>
                <option value="PG-13">PG-13</option>
                <option value="R">R</option>
                <option value="NC-17">NC-17</option>
              </select>
            </div>

            <div style={styles.modalBtns}>
              <button onClick={closeMovieModal} style={styles.modalSecondaryBtn}>
                Cancel
              </button>
              <button onClick={handleAddMovie} style={styles.modalPrimaryBtn}>
                Save Movie
              </button>
            </div>
          </div>
        </div>
      )}

      {showPromoModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add Promotion</h3>
              <p style={styles.modalSubtitle}>Create a discount for a movie.</p>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Movie Title</label>
              <input
                type="text"
                placeholder="Enter movie title"
                value={newPromo.movieTitle}
                onChange={(e) =>
                  setNewPromo({ ...newPromo, movieTitle: e.target.value })
                }
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Discount %</label>
              <input
                type="number"
                placeholder="e.g. 15"
                value={newPromo.discount}
                onChange={(e) => setNewPromo({ ...newPromo, discount: e.target.value })}
                style={styles.input}
              />
            </div>

            <div style={styles.modalBtns}>
              <button onClick={closePromoModal} style={styles.modalSecondaryBtn}>
                Cancel
              </button>
              <button onClick={handleAddPromotion} style={styles.modalPrimaryBtn}>
                Save Promotion
              </button>
            </div>
          </div>
        </div>
      )}

      {showShowtimeModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Add Showtime</h3>
              <p style={styles.modalSubtitle}>Enter the showtime details below.</p>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Movie Title</label>
              <input
                type="text"
                placeholder="Enter movie title"
                value={newShowtime.movieTitle}
                onChange={(e) =>
                  setNewShowtime({ ...newShowtime, movieTitle: e.target.value })
                }
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Date</label>
              <input
                type="date"
                value={newShowtime.date}
                onChange={(e) =>
                  setNewShowtime({ ...newShowtime, date: e.target.value })
                }
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Time</label>
              <input
                type="time"
                value={newShowtime.time}
                onChange={(e) =>
                  setNewShowtime({ ...newShowtime, time: e.target.value })
                }
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Auditorium</label>
              <input
                type="text"
                placeholder="Enter auditorium"
                value={newShowtime.auditorium}
                onChange={(e) =>
                  setNewShowtime({ ...newShowtime, auditorium: e.target.value })
                }
                style={styles.input}
              />
            </div>

            <div style={styles.modalBtns}>
              <button onClick={closeShowtimeModal} style={styles.modalSecondaryBtn}>
                Cancel
              </button>
              <button onClick={handleAddShowtime} style={styles.modalPrimaryBtn}>
                Save Showtime
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
    width: "100%",
  },

  bg: {
    position: "fixed",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    zIndex: -2,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.58)",
    zIndex: -1,
  },

  wrapper: {
    minHeight: "calc(100vh - 70px)",
    marginTop: 70,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "36px 24px",
    boxSizing: "border-box",
  },

  container: {
    width: "100%",
    maxWidth: "1200px",
    padding: "30px",
    borderRadius: "22px",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    background: "rgba(8, 8, 12, 0.78)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 20px 55px rgba(0,0,0,0.45)",
    color: "white",
  },

  headerBlock: {
    textAlign: "center",
    marginBottom: "24px",
  },

  eyebrow: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: 1.6,
    opacity: 0.72,
    fontWeight: 700,
  },

  title: {
    margin: "8px 0 10px 0",
    fontSize: "38px",
    fontWeight: 800,
  },

  subtitle: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.8)",
  },

  messageArea: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "18px",
  },

  errorBanner: {
    padding: "12px 14px",
    borderRadius: "12px",
    background: "rgba(255, 93, 93, 0.14)",
    border: "1px solid rgba(255, 93, 93, 0.35)",
    color: "#ff9d9d",
    fontSize: "14px",
    textAlign: "center",
  },

  successBanner: {
    padding: "12px 14px",
    borderRadius: "12px",
    background: "rgba(89, 214, 123, 0.14)",
    border: "1px solid rgba(89, 214, 123, 0.35)",
    color: "#9ef0b3",
    fontSize: "14px",
    textAlign: "center",
  },

  topButtonRow: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "26px",
  },

  primaryBtn: {
    padding: "13px 18px",
    borderRadius: "12px",
    border: "none",
    background: "white",
    color: "black",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "14px",
    minWidth: "150px",
  },

  secondaryBtn: {
    padding: "13px 18px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "14px",
    minWidth: "150px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },

  sectionCard: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    minHeight: "320px",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 800,
  },

  sectionMeta: {
    margin: "4px 0 0 0",
    fontSize: "12px",
    color: "rgba(255,255,255,0.68)",
  },

  smallActionBtn: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
  },

  emptyState: {
    borderRadius: "14px",
    padding: "18px",
    background: "rgba(255,255,255,0.04)",
    border: "1px dashed rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.74)",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  itemsWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  itemCard: {
    padding: "16px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  itemTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },

  itemTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 700,
    color: "white",
  },

  itemSubtext: {
    margin: "6px 0 0 0",
    fontSize: "13px",
    color: "rgba(255,255,255,0.72)",
  },

  badge: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.14)",
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  discountBadge: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(101, 214, 132, 0.16)",
    border: "1px solid rgba(101, 214, 132, 0.28)",
    color: "#b9f5c7",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  itemActions: {
    display: "flex",
    justifyContent: "flex-end",
  },

  deleteBtn: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    zIndex: 20,
  },

  modal: {
    width: "100%",
    maxWidth: "420px",
    background: "rgba(10,10,14,0.94)",
    padding: "24px",
    borderRadius: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 12px 34px rgba(0,0,0,0.45)",
    color: "white",
  },

  modalHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "4px",
  },

  modalTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 800,
  },

  modalSubtitle: {
    margin: 0,
    fontSize: "13px",
    color: "rgba(255,255,255,0.72)",
    lineHeight: 1.5,
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  label: {
    fontSize: "12px",
    fontWeight: 700,
    color: "white",
    letterSpacing: 0.4,
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

  modalBtns: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "6px",
  },

  modalPrimaryBtn: {
    padding: "12px 16px",
    background: "white",
    color: "black",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: "14px",
  },

  modalSecondaryBtn: {
    padding: "12px 16px",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "14px",
  },
};