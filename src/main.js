import Fuse from 'fuse.js'
import './style.css'

// ── ROUTING: game-id is the URL path ──
function getOrCreateGameId() {
  const path = location.pathname.replace(/^\//, '').trim()
  if (path && path !== 'index.html') return path
  const id = Math.random().toString(36).slice(2, 8)
  history.replaceState({}, '', '/' + id)
  return id
}

const GAME_ID = getOrCreateGameId()
const STORAGE_KEY = 'co-plate-spotter-' + GAME_ID

// ── STATE ──
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { spotted: {} }
  } catch { return { spotted: {} } }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}
let state = loadState()

// ── LOAD PLATES ──
const platesRes = await fetch('/co/plates.json')
const PLATES_RAW = await platesRes.json()

// Filter out entries without images, remap image paths
const PLATES = PLATES_RAW
  .filter(p => p.image && p.id)
  .map(p => ({
    ...p,
    // plates.json has /plates/foo.jpg, actual path is /co/plates/foo.jpg
    image: p.image.replace(/^\/plates\//, '/co/plates/'),
  }))

// ── FUSE SEARCH ──
const fuse = new Fuse(PLATES, {
  keys: ['name', 'description'],
  threshold: 0.35,
  minMatchCharLength: 2,
})

// ── FILTER STATE ──
let activeView = 'all'
let activeCat = 'all'
let searchQuery = ''

// ── DOM REFS ──
const grid = document.getElementById('grid')
const emptyState = document.getElementById('emptyState')
const resultsInfo = document.getElementById('resultsInfo')
const statTotal = document.getElementById('statTotal')
const statSpotted = document.getElementById('statSpotted')
const statLeft = document.getElementById('statLeft')
const progressBar = document.getElementById('progressBar')
const gameIdEl = document.getElementById('gameId')
const copyLink = document.getElementById('copyLink')
const searchInput = document.getElementById('searchInput')
const searchClear = document.getElementById('searchClear')

// ── CATEGORY LABELS ──
const CAT_LABELS = {
  'regular': 'Standard',
  'group-special': 'Special Interest',
  'military': 'Military',
  'alumni': 'Alumni',
}

// ── RENDER ──
function filteredPlates() {
  let result = PLATES

  if (searchQuery.length >= 2) {
    result = fuse.search(searchQuery).map(r => r.item)
  }

  if (activeCat !== 'all') {
    result = result.filter(p => p.category === activeCat)
  }

  if (activeView === 'spotted') {
    result = result.filter(p => state.spotted[p.id])
  } else if (activeView === 'unspotted') {
    result = result.filter(p => !state.spotted[p.id])
  }

  return result
}

function renderGrid() {
  const plates = filteredPlates()
  const total = PLATES.length
  updateStats()
  gameIdEl.textContent = GAME_ID

  resultsInfo.textContent = plates.length === total
    ? `${total} plates`
    : `${plates.length} of ${total} plates`

  emptyState.classList.toggle('visible', plates.length === 0)

  // Diff render: reuse existing cards by id, remove stale, add new
  const existing = new Map()
  for (const card of grid.querySelectorAll('.plate-card')) {
    existing.set(card.dataset.id, card)
  }

  const wantedIds = new Set(plates.map(p => p.id))

  // Remove cards no longer visible
  for (const [id, card] of existing) {
    if (!wantedIds.has(id)) card.remove()
  }

  // Build ordered fragment
  const frag = document.createDocumentFragment()
  for (const plate of plates) {
    if (existing.has(plate.id)) {
      const card = existing.get(plate.id)
      updateCardState(card, plate)
      frag.appendChild(card)
    } else {
      frag.appendChild(createCard(plate))
    }
  }
  grid.appendChild(frag)
}

function updateCardState(card, plate) {
  const spotted = !!state.spotted[plate.id]
  card.classList.toggle('spotted', spotted)
  const name = card.querySelector('.plate-name')
  if (name) name.classList.toggle('spotted', spotted)
}

function createCard(plate) {
  const spotted = !!state.spotted[plate.id]
  const card = document.createElement('div')
  card.className = 'plate-card' + (spotted ? ' spotted' : '')
  card.dataset.id = plate.id

  const catLabel = CAT_LABELS[plate.category] || plate.category

  card.innerHTML = `
    <div class="plate-img-wrap">
      <img
        src="${plate.image}"
        alt="${plate.name}"
        loading="lazy"
        class="loading"
      >
      <div class="plate-placeholder">
        <div class="plate-mountains">&#9968;</div>
        <div class="plate-ph-name">${plate.name}</div>
        <div class="plate-ph-state">COLORADO</div>
      </div>
      <div class="spotted-badge">&#10003;</div>
    </div>
    <div class="plate-info">
      <div class="plate-name${spotted ? ' spotted' : ''}">${plate.name}</div>
      <div class="plate-category cat-${plate.category}">${catLabel}</div>
    </div>
  `

  const img = card.querySelector('img')
  img.addEventListener('load', () => {
    img.classList.remove('loading')
    img.classList.add('loaded')
  })
  img.addEventListener('error', () => {
    img.style.display = 'none'
  })

  card.addEventListener('click', () => toggleSpotted(plate.id))
  return card
}

function updateStats() {
  const spottedCount = Object.keys(state.spotted).length
  const total = PLATES.length
  statTotal.textContent = total
  statSpotted.textContent = spottedCount
  statLeft.textContent = total - spottedCount
  progressBar.style.width = (spottedCount / total * 100) + '%'
}

function toggleSpotted(id) {
  if (state.spotted[id]) {
    delete state.spotted[id]
  } else {
    state.spotted[id] = Date.now()
  }
  saveState()

  // Update only this card in place — no re-render, no flicker
  const card = grid.querySelector(`[data-id="${id}"]`)
  if (card) {
    const spotted = !!state.spotted[id]
    card.classList.toggle('spotted', spotted)
    const name = card.querySelector('.plate-name')
    if (name) name.classList.toggle('spotted', spotted)
  }

  // If filtering by spotted/unspotted, the card may need to disappear
  if (activeView !== 'all') renderGrid()
  else updateStats()
}

// ── CONTROLS ──
document.getElementById('viewFilters').addEventListener('click', e => {
  const btn = e.target.closest('[data-view]')
  if (!btn) return
  activeView = btn.dataset.view
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b === btn))
  renderGrid()
})

document.getElementById('catFilters').addEventListener('click', e => {
  const btn = e.target.closest('[data-cat]')
  if (!btn) return
  activeCat = btn.dataset.cat
  document.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('active', b === btn))
  renderGrid()
})

searchInput.addEventListener('input', e => {
  searchQuery = e.target.value.trim()
  searchClear.hidden = searchQuery === ''
  renderGrid()
})

searchClear.addEventListener('click', () => {
  searchInput.value = ''
  searchQuery = ''
  searchClear.hidden = true
  searchInput.focus()
  renderGrid()
})

copyLink.addEventListener('click', e => {
  e.preventDefault()
  navigator.clipboard.writeText(location.href).then(() => {
    copyLink.textContent = 'copied!'
    setTimeout(() => { copyLink.textContent = 'copy link' }, 1500)
  })
})

// ── INIT ──
renderGrid()
