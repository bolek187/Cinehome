const state = {
  movies: [],
  favorites: [],
  wishlist: [],
  ratings: {},
  activeTab: 'movies',
  search: '',
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  selectedMovie: null,
  hls: null
};

const els = {
  moviesGrid: document.getElementById('moviesGrid'),
  rankingGrid: document.getElementById('rankingGrid'),
  favoritesGrid: document.getElementById('favoritesGrid'),
  wishlistList: document.getElementById('wishlistList'),
  moviesEmpty: document.getElementById('moviesEmpty'),
  rankingEmpty: document.getElementById('rankingEmpty'),
  favoritesEmpty: document.getElementById('favoritesEmpty'),
  wishlistEmpty: document.getElementById('wishlistEmpty'),
  searchInput: document.getElementById('searchInput'),
  tabButtons: [...document.querySelectorAll('.tab-button')],
  tabPanels: [...document.querySelectorAll('.tab-panel')],
  player: document.getElementById('player'),
  openWishlistForm: document.getElementById('openWishlistForm'),
  wishlistForm: document.getElementById('wishlistForm'),
  cancelWishlistForm: document.getElementById('cancelWishlistForm'),
  wishlistTitle: document.getElementById('wishlistTitle'),
  wishlistYear: document.getElementById('wishlistYear'),
  wishlistNote: document.getElementById('wishlistNote'),
  themeToggle: document.querySelector('[data-theme-toggle]'),
  statAll: document.getElementById('statAll'),
  statFavorites: document.getElementById('statFavorites'),
  statWishlist: document.getElementById('statWishlist'),
  heroCover: document.getElementById('heroCover'),
  heroMovieTitle: document.getElementById('heroMovieTitle'),
  heroRatingStars: document.getElementById('heroRatingStars'),
  heroRatingValue: document.getElementById('heroRatingValue'),
  heroPlayButton: document.getElementById('heroPlayButton')
};

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  els.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function starIcon() {
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.6 2.85 5.78 6.38.93-4.61 4.5 1.08 6.35L12 17.16 6.3 20.16l1.09-6.35-4.62-4.5 6.38-.93L12 2.6Z"></path></svg>';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fallbackCover(title) {
  const safe = escapeHtml(String(title || 'Film').slice(0, 28));
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 720">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#171717"/>
        <stop offset="100%" stop-color="#3a2f0b"/>
      </linearGradient>
    </defs>
    <rect width="480" height="720" fill="url(#g)"/>
    <rect x="28" y="28" width="424" height="664" rx="28" fill="none" stroke="#ffd54a" stroke-opacity=".35"/>
    <text x="50%" y="50%" fill="#fff2bf" font-family="Inter, Arial, sans-serif" font-size="34" text-anchor="middle">${safe}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeMovie(movie) {
  const id = movie.id || movie.slug || movie.title;
  return {
    id,
    title: movie.title || 'Ohne Titel',
    video: movie.video || '',
    cover: movie.cover || fallbackCover(movie.title),
    rating: Number(movie.rating || 0)
  };
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${text || response.statusText}`);
  }
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : null;
}

async function safeApi(url, fallback) {
  try {
    const data = await api(url);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

function favoriteIds() {
  return new Set(state.favorites.map(item => item.id || item.title));
}

function filteredMovies(source = state.movies) {
  const term = state.search.trim().toLowerCase();
  if (!term) return source;
  return source.filter(movie => String(movie.title).toLowerCase().includes(term));
}

function getMovieById(id) {
  return state.movies.find(movie => movie.id === id || movie.title === id) || null;
}

function movieRatingOutOfFive(movie) {
  return Number((Number(state.ratings[movie.id] ?? movie.rating ?? 0) / 2).toFixed(1));
}

function ratingLabel(movie) {
  const value = movieRatingOutOfFive(movie);
  return value > 0 ? `${value.toFixed(1)} / 5 Sterne` : 'Noch nicht bewertet';
}

function createImage(movie) {
  const img = document.createElement('img');
  img.className = 'movie-cover';
  img.alt = `Cover von ${movie.title}`;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = movie.cover || fallbackCover(movie.title);
  img.addEventListener('error', () => {
    img.src = fallbackCover(movie.title);
  }, { once: true });
  return img;
}

function createStarsDisplay(value) {
  const wrap = document.createElement('div');
  wrap.className = 'stars-display';
  for (let i = 1; i <= 5; i += 1) {
    const fill = Math.max(0, Math.min(1, value - (i - 1)));
    const star = document.createElement('div');
    star.className = 'rating-star';
    star.setAttribute('aria-hidden', 'true');
    star.innerHTML = `<span class="star-base">★</span><span class="star-fill" style="--fill:${fill * 100}%">★</span>`;
    wrap.appendChild(star);
  }
  return wrap;
}

function renderStats() {
  els.statAll.textContent = state.movies.length;
  els.statFavorites.textContent = state.favorites.length;
  els.statWishlist.textContent = state.wishlist.length;
}

function renderTabs() {
  els.tabButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.tabTarget === state.activeTab);
  });
  els.tabPanels.forEach(panel => {
    panel.classList.toggle('is-active', panel.id === `tab-${state.activeTab}`);
  });
}

function destroyPlayer() {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
  els.player.pause();
  els.player.removeAttribute('src');
  els.player.load();
}

function loadPlayer(movie, autoplay = false) {
  if (!movie?.video) {
    destroyPlayer();
    return;
  }
  if (state.selectedMovie?.id !== movie.id) {
    state.selectedMovie = movie;
  }
  const src = movie.video;
  destroyPlayer();
  if (src.endsWith('.m3u8') && window.Hls?.isSupported()) {
    state.hls = new Hls();
    state.hls.loadSource(src);
    state.hls.attachMedia(els.player);
    state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (autoplay) els.player.play().catch(() => {});
    });
  } else {
    els.player.src = src;
    if (autoplay) els.player.play().catch(() => {});
  }
}

function renderRatingInput(movie) {
  els.heroRatingStars.replaceChildren();
  const current = movieRatingOutOfFive(movie);
  for (let i = 1; i <= 5; i += 1) {
    const button = document.createElement('button');
    button.className = 'rating-star';
    button.type = 'button';
    button.dataset.value = String(i);
    button.setAttribute('aria-label', `${i} Sterne setzen`);
    const fill = Math.max(0, Math.min(1, current - (i - 1)));
    button.innerHTML = `<span class="star-base">★</span><span class="star-fill" style="--fill:${fill * 100}%">★</span>`;

    const preview = value => {
      [...els.heroRatingStars.children].forEach((child, idx) => {
        const starFill = Math.max(0, Math.min(1, value - idx));
        child.querySelector('.star-fill').style.setProperty('--fill', `${starFill * 100}%`);
      });
    };

    button.addEventListener('mousemove', event => {
      const rect = button.getBoundingClientRect();
      const half = event.clientX - rect.left < rect.width / 2 ? 0.5 : 1;
      preview((i - 1) + half);
    });
    button.addEventListener('mouseleave', () => preview(movieRatingOutOfFive(movie)));
    button.addEventListener('click', async event => {
      const rect = button.getBoundingClientRect();
      const half = event.clientX - rect.left < rect.width / 2 ? 0.5 : 1;
      const starsValue = (i - 1) + half;
      const apiValue = Math.round(starsValue * 2);
      await api(`/api/ratings/${encodeURIComponent(movie.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ rating: apiValue })
      });
      state.ratings[movie.id] = apiValue;
      renderHero();
      renderCollections();
      renderRanking();
    });
    els.heroRatingStars.appendChild(button);
  }
}

function renderHero() {
  const movie = state.selectedMovie || state.movies[0] || null;
  state.selectedMovie = movie;
  if (!movie) {
    els.heroCover.src = fallbackCover('CineHome');
    els.heroMovieTitle.textContent = 'Noch kein Film geladen';
    els.heroRatingStars.replaceChildren();
    els.heroRatingValue.textContent = 'Nicht bewertet';
    els.heroPlayButton.disabled = true;
    destroyPlayer();
    return;
  }
  els.heroCover.src = movie.cover || fallbackCover(movie.title);
  els.heroMovieTitle.textContent = movie.title;
  els.heroPlayButton.disabled = false;
  els.heroRatingValue.textContent = ratingLabel(movie);
  renderRatingInput(movie);
  loadPlayer(movie, false);
}

function movieCard(movie, isFavorite, mode = 'default') {
  const article = document.createElement('article');
  article.className = `movie-card ${state.selectedMovie?.id === movie.id ? 'is-selected' : ''}`;

  const playButton = document.createElement('button');
  playButton.className = 'movie-surface';
  playButton.type = 'button';
  playButton.setAttribute('aria-label', `${movie.title} auswählen`);

  const wrap = document.createElement('div');
  wrap.className = 'movie-cover-wrap';
  wrap.appendChild(createImage(movie));
  const overlay = document.createElement('div');
  overlay.className = 'movie-overlay';
  overlay.textContent = '▶ Im oberen Player öffnen';
  wrap.appendChild(overlay);

  const meta = document.createElement('div');
  meta.className = 'movie-meta';
  const textWrap = document.createElement('div');
  const subtitle = mode === 'ranking' ? 'Bewertet und sortiert' : 'Zum Abspielen auswählen';
  textWrap.innerHTML = `<h4 class="movie-title"></h4><p class="movie-subtitle"></p>`;
  textWrap.querySelector('.movie-title').textContent = movie.title;
  textWrap.querySelector('.movie-subtitle').textContent = subtitle;

  const rightWrap = document.createElement('div');
  rightWrap.style.display = 'grid';
  rightWrap.style.gap = '.45rem';
  rightWrap.style.justifyItems = 'end';

  const ratingChip = document.createElement('div');
  ratingChip.className = 'rating-chip';
  ratingChip.textContent = ratingLabel(movie);
  rightWrap.appendChild(ratingChip);

  if (mode !== 'ranking') {
    const favoriteButton = document.createElement('button');
    favoriteButton.className = `favorite-toggle ${isFavorite ? 'is-active' : ''}`;
    favoriteButton.type = 'button';
    favoriteButton.setAttribute('aria-label', isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren');
    favoriteButton.innerHTML = starIcon();
    favoriteButton.addEventListener('click', async event => {
      event.stopPropagation();
      await toggleFavorite(movie);
    });
    rightWrap.appendChild(favoriteButton);
  }

  playButton.append(wrap, meta);
  meta.append(textWrap, rightWrap);
  playButton.addEventListener('click', () => {
    state.selectedMovie = movie;
    renderHero();
    renderCollections();
    if (state.activeTab === 'ranking') renderRanking();
    els.player.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  article.appendChild(playButton);
  return article;
}

function renderCollection(target, items, emptyElement) {
  target.replaceChildren(...items);
  emptyElement.classList.toggle('hidden', items.length > 0);
}

function renderCollections() {
  const favoritesSet = favoriteIds();
  const movies = filteredMovies(state.movies).map(movie => movieCard(movie, favoritesSet.has(movie.id)));
  const favoritesSource = state.favorites
    .map(item => getMovieById(item.id || item.title) || normalizeMovie(item))
    .filter(Boolean);
  const favorites = filteredMovies(favoritesSource).map(movie => movieCard(movie, true));
  renderCollection(els.moviesGrid, movies, els.moviesEmpty);
  renderCollection(els.favoritesGrid, favorites, els.favoritesEmpty);
}

function renderRanking() {
  const rated = filteredMovies(state.movies)
    .map(movie => ({ ...movie, _stars: movieRatingOutOfFive(movie) }))
    .filter(movie => movie._stars > 0)
    .sort((a, b) => b._stars - a._stars || a.title.localeCompare(b.title, 'de'))
    .map(movie => movieCard(movie, favoriteIds().has(movie.id), 'ranking'));
  renderCollection(els.rankingGrid, rated, els.rankingEmpty);
}

function renderWishlist() {
  const term = state.search.trim().toLowerCase();
  const items = [...state.wishlist]
    .filter(item => !term || String(item.title).toLowerCase().includes(term))
    .sort((a, b) => String(a.title).localeCompare(String(b.title), 'de'));

  const cards = items.map(item => {
    const article = document.createElement('article');
    article.className = 'wishlist-item';
    article.innerHTML = `
      <div class="wishlist-top">
        <div><h4 class="movie-title"></h4></div>
        <span class="wishlist-year"></span>
      </div>
      <p class="wishlist-note"></p>
      <div class="wishlist-actions"><button class="wishlist-delete" type="button">Entfernen</button></div>
    `;
    article.querySelector('.movie-title').textContent = item.title;
    article.querySelector('.wishlist-year').textContent = item.year || '—';
    article.querySelector('.wishlist-note').textContent = item.note || 'Keine Notiz hinterlegt.';
    article.querySelector('.wishlist-delete').addEventListener('click', async () => {
      await api('/api/wishlist', { method: 'DELETE', body: JSON.stringify({ id: item.id }) });
      state.wishlist = state.wishlist.filter(entry => entry.id !== item.id);
      renderStats();
      renderWishlist();
    });
    return article;
  });

  els.wishlistList.replaceChildren(...cards);
  els.wishlistEmpty.classList.toggle('hidden', cards.length > 0 || !els.wishlistForm.classList.contains('hidden'));
}

async function toggleFavorite(movie) {
  const exists = favoriteIds().has(movie.id);
  if (exists) {
    await api('/api/favorites', { method: 'DELETE', body: JSON.stringify({ id: movie.id, title: movie.title }) });
    state.favorites = state.favorites.filter(item => (item.id || item.title) !== movie.id && item.title !== movie.title);
  } else {
    await api('/api/favorites', { method: 'POST', body: JSON.stringify(movie) });
    state.favorites = [...state.favorites.filter(item => (item.id || item.title) !== movie.id), movie];
  }
  renderStats();
  renderCollections();
  renderRanking();
}

async function loadData() {
  const [movies, favorites, wishlist, ratings] = await Promise.all([
    safeApi('/api/movies', []),
    safeApi('/api/favorites', []),
    safeApi('/api/wishlist', []),
    safeApi('/api/ratings', {})
  ]);

  state.movies = movies.map(normalizeMovie);
  state.favorites = Array.isArray(favorites) ? favorites : [];
  state.wishlist = Array.isArray(wishlist) ? wishlist : [];
  state.ratings = Object.fromEntries(
    Object.entries(ratings || {}).map(([key, value]) => {
      const movie = getMovieById(key) || state.movies.find(entry => entry.title === key);
      return [movie?.id || key, Number(value || 0)];
    })
  );

  state.selectedMovie = state.movies[0] || null;
  renderStats();
  renderTabs();
  renderHero();
  renderCollections();
  renderRanking();
  renderWishlist();
}

function bindEvents() {
  els.themeToggle.addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
  els.searchInput.addEventListener('input', event => {
    state.search = event.target.value;
    renderCollections();
    renderRanking();
    renderWishlist();
  });
  els.tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.tabTarget;
      renderTabs();
      if (state.activeTab === 'ranking') renderRanking();
    });
  });
  els.heroPlayButton.addEventListener('click', () => {
    if (!state.selectedMovie) return;
    loadPlayer(state.selectedMovie, true);
  });
  els.openWishlistForm.addEventListener('click', () => {
    els.wishlistForm.classList.remove('hidden');
    els.wishlistEmpty.classList.add('hidden');
    els.wishlistTitle.focus();
  });
  els.cancelWishlistForm.addEventListener('click', () => {
    els.wishlistForm.classList.add('hidden');
    els.wishlistForm.reset();
    renderWishlist();
  });
  els.wishlistForm.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = {
      title: els.wishlistTitle.value.trim(),
      year: els.wishlistYear.value.trim(),
      note: els.wishlistNote.value.trim()
    };
    if (!payload.title) return;
    const created = await api('/api/wishlist', { method: 'POST', body: JSON.stringify(payload) });
    state.wishlist = [...state.wishlist, created];
    els.wishlistForm.reset();
    els.wishlistForm.classList.add('hidden');
    renderStats();
    renderWishlist();
  });
}

setTheme(state.theme);
bindEvents();
loadData().catch(error => {
  console.error('CineHome konnte nicht geladen werden:', error);
  renderStats();
  renderTabs();
  renderHero();
  renderCollections();
  renderRanking();
  renderWishlist();
});
