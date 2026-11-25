// Variable State
let animeDataList = [];
let currentSearchKeyword = '';
let currentAuraFilter = 'all';
let availableGenres = [];

// DOM Element Selectors
const animeGrid = document.getElementById('anime-grid');
const searchInput = document.getElementById('search-input');
const auraButtons = document.getElementById('aura-buttons');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const retryButton = document.getElementById('retry-button');

// Mobile Navigation Toggle
const hamburgerBtn = document.getElementById('hamburger-btn');
const closeBtn = document.getElementById('close-btn');
const mobileSidebar = document.getElementById('mobile-sidebar');
const mobileOverlay = document.getElementById('mobile-overlay');
const mobileLinks = document.querySelectorAll('.mobile-link');

function openSidebar() {
  if (mobileSidebar && mobileOverlay) {
    mobileSidebar.classList.remove('translate-x-full');
    mobileOverlay.classList.remove('hidden');
  }
}

function closeSidebar() {
  if (mobileSidebar && mobileOverlay) {
    mobileSidebar.classList.add('translate-x-full');
    mobileOverlay.classList.add('hidden');
  }
}

if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);
if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
if (mobileOverlay) mobileOverlay.addEventListener('click', closeSidebar);
mobileLinks.forEach((link) => link.addEventListener('click', closeSidebar));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function getSafeHttpsUrl(value, fallback) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : fallback;
  } catch {
    return fallback;
  }
}


async function fetchAnimeData() {
  if (!animeGrid) return;

  try {
    if (loadingState) loadingState.classList.remove('hidden');
    if (errorState) errorState.classList.add('hidden');
    animeGrid.innerHTML = '';

    const response = await fetch(
      'https://kitsu.io/api/edge/anime?page%5Blimit%5D=20&page%5Boffset%5D=0&include=genres'
    );

    if (!response.ok) {
      throw new Error(`Gagal memuat data Kitsu. Status HTTP: ${response.status}`);
    }

    const result = await response.json();

    if (!Array.isArray(result.data)) {
      throw new Error('Format respon API tidak valid.');
    }

    const genresById = new Map(
      (Array.isArray(result.included) ? result.included : [])
        .filter((item) => item.type === 'genres')
        .map((genre) => [genre.id, genre.attributes?.name])
    );

    animeDataList = result.data
      .filter((anime) => anime && anime.attributes)
      .map((anime) => {
        const attributes = anime.attributes;
        const rating = attributes.averageRating === null || attributes.averageRating === undefined
          ? null
          : Number(attributes.averageRating);

        return {
          id: anime.id,
          title: attributes.canonicalTitle || attributes.titles?.en || attributes.titles?.en_jp,
          score: rating !== null && Number.isFinite(rating) ? rating / 10 : null,
          type: attributes.subtype,
          episodes: attributes.episodeCount,
          year: attributes.startDate ? Number(attributes.startDate.slice(0, 4)) : null,
          genres: (anime.relationships?.genres?.data || [])
            .map((genre) => genresById.get(genre.id))
            .filter(Boolean)
            .map((name) => ({ name })),
          imageUrl: attributes.posterImage?.large || attributes.posterImage?.medium,
        };
      });
    availableGenres = [...new Set(
      animeDataList.flatMap((anime) => anime.genres.map((genre) => genre.name))
    )].sort((first, second) => first.localeCompare(second));
    renderAuraButtons();
    renderAnimeCards(animeDataList);
  } catch (error) {
    if (errorState) errorState.classList.remove('hidden');
    if (errorMessage) {
      errorMessage.textContent = error instanceof TypeError
        ? 'Tidak dapat terhubung ke Kitsu API. Periksa koneksi internet, lalu coba lagi.'
        : error.message || 'Terjadi kesalahan saat mengambil data.';
    }
  } finally {
    if (loadingState) loadingState.classList.add('hidden');
  }
}


function matchesAuraFilter(anime, aura) {
  if (aura === 'all') return true;

  return anime.genres.some((genre) => genre.name === aura);
}

function renderAuraButtons() {
  if (!auraButtons) return;

  const genres = ['all', ...availableGenres];
  auraButtons.innerHTML = genres
    .map((genre) => {
      const isSelected = genre === currentAuraFilter;
      const label = genre === 'all' ? 'Semua' : genre;

      return `
        <button
          type="button"
          data-aura="${escapeHtml(genre)}"
          class="aura-btn px-4 py-2 text-xs font-semibold rounded-xl transition ${
            isSelected
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'bg-slate-100 text-slate-600 hover:bg-teal-100 hover:text-teal-700'
          }"
        >${escapeHtml(label)}</button>
      `;
    })
    .join('');
}


function renderAnimeCards(data) {
  const filteredAnime = data.filter((anime) => {
    const title = (anime.title || '').toLowerCase();
    const matchesSearch = title.includes(currentSearchKeyword.toLowerCase());
    const matchesAura = matchesAuraFilter(anime, currentAuraFilter);

    return matchesSearch && matchesAura;
  });

  if (filteredAnime.length === 0) {
    animeGrid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500 font-medium bg-white rounded-2xl border border-slate-200">
        Tidak ada anime yang sesuai dengan pencarian "${escapeHtml(currentSearchKeyword)}" atau filter aura yang dipilih.
      </div>
    `;
    return;
  }

  animeGrid.innerHTML = filteredAnime
    .map((anime) => {
      const title = anime.title || 'Judul tidak tersedia';
      const score = anime.score !== null && anime.score !== undefined
        ? `⭐ ${anime.score.toFixed(1)}`
        : '⭐ N/A';
      const type = anime.type || 'Anime';
      const episodes = anime.episodes ? `${anime.episodes} Eps` : 'Ongoing';
      const year = anime.year || 'TBA';
      
      const imageUrl = getSafeHttpsUrl(
        anime.imageUrl ||
        'https://placehold.co/600x900/0f172a/ffffff?text=No+Image',
        'https://placehold.co/600x900/0f172a/ffffff?text=No+Image'
      );
      const detailUrl = escapeHtml(getSafeHttpsUrl(
        `https://kitsu.io/anime/${encodeURIComponent(anime.id)}`,
        '#'
      ));

      return `
        <article class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between">
          <div>
            <div class="overflow-hidden relative">
              <img 
                src="${imageUrl}" 
                alt="${escapeHtml(title)}" 
                class="h-72 w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <span class="absolute top-3 right-3 bg-slate-900/80 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                ${escapeHtml(episodes)}
              </span>
            </div>
            <div class="p-4">
              <div class="mb-3 flex items-center justify-between gap-2">
                <span class="rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                ${escapeHtml(type)}
                </span>
                <span class="text-xs font-bold text-amber-500">${escapeHtml(score)}</span>
              </div>
              <h2 class="line-clamp-2 text-base font-bold text-slate-900 leading-snug" title="${escapeHtml(title)}">
                ${escapeHtml(title)}
              </h2>
            </div>
          </div>
          <div class="px-4 pb-4 pt-0 border-t border-slate-100 mt-2 flex justify-between items-center text-xs text-slate-500">
            <span>${escapeHtml(year)}</span>
            <a href="${detailUrl}" target="_blank" rel="noopener noreferrer" class="text-teal-600 hover:underline font-medium">Lihat Detail</a>
          </div>
        </article>
      `;
    })
    .join('');
}


if (searchInput) {
  searchInput.addEventListener('input', (event) => {
    currentSearchKeyword = event.target.value.trim();
    renderAnimeCards(animeDataList);
  });
}


if (auraButtons) {
  auraButtons.addEventListener('click', (event) => {
    const button = event.target.closest('.aura-btn');
    if (!button) return;

    currentAuraFilter = button.getAttribute('data-aura') || 'all';
    renderAuraButtons();
    renderAnimeCards(animeDataList);
  });
}


if (retryButton) {
  retryButton.addEventListener('click', fetchAnimeData);
}

document.addEventListener('DOMContentLoaded', fetchAnimeData);