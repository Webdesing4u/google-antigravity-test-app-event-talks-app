// ==========================================================================
// BigQuery Release Radar & X/Tweet Composer - Frontend JavaScript
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let allNotes = [];
  let activeCategory = 'ALL';
  let searchQuery = '';
  let selectedNoteIds = new Set();
  let currentModalNote = null;

  // DOM Elements
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshSpinner = document.getElementById('refreshSpinner');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const categoryFilters = document.getElementById('categoryFilters');
  const notesGrid = document.getElementById('notesGrid');
  const skeletonLoader = document.getElementById('skeletonLoader');
  const emptyState = document.getElementById('emptyState');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const lastUpdatedText = document.getElementById('lastUpdatedText');
  const feedStatusBadge = document.getElementById('feedStatusBadge');
  const feedStatusText = document.getElementById('feedStatusText');

  // Selection Bar Elements
  const selectionBar = document.getElementById('selectionBar');
  const selectedCountText = document.getElementById('selectedCountText');
  const tweetSelectedBtn = document.getElementById('tweetSelectedBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');

  // Modal Elements
  const tweetModal = document.getElementById('tweetModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const tweetTextArea = document.getElementById('tweetTextArea');
  const charCountText = document.getElementById('charCountText');
  const charProgress = document.getElementById('charProgress');
  const copyTweetBtn = document.getElementById('copyTweetBtn');
  const postToTwitterBtn = document.getElementById('postToTwitterBtn');

  // Toast Element
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  // Initial Fetch on Page Load
  fetchReleaseNotes();

  // Event Listeners
  refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
  
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    renderNotes();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderNotes();
  });

  categoryFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.getAttribute('data-category');
    renderNotes();
  });

  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    activeCategory = 'ALL';
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-category="ALL"]').classList.add('active');
    renderNotes();
  });

  // Modal Listeners
  closeModalBtn.addEventListener('click', closeTweetModal);
  tweetModal.addEventListener('click', (e) => {
    if (e.target === tweetModal) closeTweetModal();
  });

  tweetTextArea.addEventListener('input', updateCharCounter);

  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      if (!tweetTextArea.value.includes(tag)) {
        tweetTextArea.value = tweetTextArea.value.trim() + ' ' + tag;
        updateCharCounter();
      }
    });
  });

  copyTweetBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(tweetTextArea.value).then(() => {
      showToast('Tweet copied to clipboard!');
    });
  });

  postToTwitterBtn.addEventListener('click', () => {
    const text = encodeURIComponent(tweetTextArea.value);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(twitterUrl, '_blank');
  });

  // Selection Bar Actions
  clearSelectionBtn.addEventListener('click', () => {
    selectedNoteIds.clear();
    updateSelectionBar();
    renderNotes();
  });

  tweetSelectedBtn.addEventListener('click', () => {
    const selectedNotes = allNotes.filter(n => selectedNoteIds.has(n.id));
    if (selectedNotes.length === 0) return;

    let digestText = `🚀 BigQuery Updates Digest:\n\n`;
    selectedNotes.forEach((n, idx) => {
      digestText += `${idx + 1}. ${n.title}\n`;
    });
    digestText += `\n🔗 https://cloud.google.com/bigquery/docs/release-notes\n#BigQuery #GoogleCloud`;

    openTweetModal(digestText);
  });

  // Fetch Release Notes Function
  async function fetchReleaseNotes(isManualRefresh = false) {
    refreshSpinner.classList.add('spinning');
    refreshBtn.disabled = true;

    if (!allNotes.length || isManualRefresh) {
      skeletonLoader.style.display = 'grid';
      notesGrid.style.display = 'none';
      emptyState.style.display = 'none';
    }

    try {
      const response = await fetch('/api/notes');
      const data = await response.json();

      if (data.status === 'success') {
        allNotes = data.notes;
        
        // Update Feed Status Badge
        if (data.source === 'live') {
          feedStatusBadge.className = 'feed-status-badge';
          feedStatusText.textContent = 'Live Google Cloud Feed';
        } else {
          feedStatusBadge.className = 'feed-status-badge fallback';
          feedStatusText.textContent = 'Offline / Fallback Feed';
        }

        lastUpdatedText.textContent = `Last updated: ${data.last_fetched}`;
        updateCategoryCounts();
        renderNotes();
      } else {
        showToast('Failed to fetch release notes.');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      showToast('Error connecting to backend server.');
    } finally {
      refreshSpinner.classList.remove('spinning');
      refreshBtn.disabled = false;
      skeletonLoader.style.display = 'none';
    }
  }

  // Update Category Badge Counts
  function updateCategoryCounts() {
    const counts = { ALL: allNotes.length, FEATURE: 0, CHANGED: 0, DEPRECATED: 0, FIXED: 0 };
    allNotes.forEach(n => {
      if (counts[n.category] !== undefined) {
        counts[n.category]++;
      }
    });

    document.getElementById('countAll').textContent = counts.ALL;
    document.getElementById('countFeature').textContent = counts.FEATURE;
    document.getElementById('countChanged').textContent = counts.CHANGED;
    document.getElementById('countDeprecated').textContent = counts.DEPRECATED;
    document.getElementById('countFixed').textContent = counts.FIXED;
  }

  // Render Card Grid based on Filter & Search
  function renderNotes() {
    let filtered = allNotes.filter(n => {
      const matchCat = activeCategory === 'ALL' || n.category === activeCategory;
      const matchSearch = !searchQuery || 
        n.title.toLowerCase().includes(searchQuery) || 
        n.summary.toLowerCase().includes(searchQuery) ||
        n.content_html.toLowerCase().includes(searchQuery);
      return matchCat && matchSearch;
    });

    notesGrid.innerHTML = '';

    if (filtered.length === 0) {
      notesGrid.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    notesGrid.style.display = 'grid';

    filtered.forEach(note => {
      const isSelected = selectedNoteIds.has(note.id);
      const card = document.createElement('article');
      card.className = `note-card ${isSelected ? 'selected' : ''}`;
      card.setAttribute('data-id', note.id);

      card.innerHTML = `
        <div class="card-top-row">
          <span class="category-pill cat-${note.category}">${note.category}</span>
          <span class="card-date"><i class="far fa-calendar-alt"></i> ${note.formatted_date}</span>
        </div>

        <h3 class="card-title">
          <a href="${note.link}" target="_blank" title="Open Google Cloud documentation">
            ${escapeHtml(note.title)} <i class="fas fa-external-link-alt" style="font-size: 0.75rem; margin-left: 4px;"></i>
          </a>
        </h3>

        <div class="card-body">
          ${note.content_html}
        </div>

        <div class="card-actions-row">
          <button class="btn-card-select">
            <i class="${isSelected ? 'fas fa-check-square' : 'far fa-square'}"></i> Select Update
          </button>
          
          <div class="card-action-btns">
            <button class="btn-card-tweet" data-action="tweet">
              <i class="fa-brands fa-x-twitter"></i> Tweet Update
            </button>
          </div>
        </div>
      `;

      // Card Event Listeners
      const selectBtn = card.querySelector('.btn-card-select');
      selectBtn.addEventListener('click', () => {
        if (selectedNoteIds.has(note.id)) {
          selectedNoteIds.delete(note.id);
        } else {
          selectedNoteIds.add(note.id);
        }
        updateSelectionBar();
        renderNotes();
      });

      const tweetBtn = card.querySelector('.btn-card-tweet');
      tweetBtn.addEventListener('click', () => {
        const text = formatTweetForNote(note);
        openTweetModal(text, note);
      });

      notesGrid.appendChild(card);
    });
  }

  // Update Floating Selection Bar State
  function updateSelectionBar() {
    if (selectedNoteIds.size > 0) {
      selectionBar.style.display = 'flex';
      selectedCountText.textContent = `${selectedNoteIds.size} update${selectedNoteIds.size > 1 ? 's' : ''} selected`;
    } else {
      selectionBar.style.display = 'none';
    }
  }

  // Format Tweet string for a specific note
  function formatTweetForNote(note) {
    let cleanSummary = note.summary.replace(/<[^>]*>?/gm, '').trim();
    if (cleanSummary.length > 140) {
      cleanSummary = cleanSummary.substring(0, 137) + '...';
    }

    return `🚀 BigQuery Update: ${note.title}\n\n${cleanSummary}\n\n🔗 ${note.link}\n#BigQuery #GoogleCloud #DataEngineering`;
  }

  // Open Tweet Modal
  function openTweetModal(initialText, note = null) {
    currentModalNote = note;
    tweetTextArea.value = initialText;
    updateCharCounter();
    tweetModal.style.display = 'flex';
  }

  function closeTweetModal() {
    tweetModal.style.display = 'none';
    currentModalNote = null;
  }

  // Real-time Character Counter for Twitter (280 limit)
  function updateCharCounter() {
    const len = tweetTextArea.value.length;
    charCountText.textContent = `${len} / 280`;

    const percentage = Math.min((len / 280) * 100, 100);
    charProgress.style.width = `${percentage}%`;

    if (len > 280) {
      charProgress.className = 'progress-bar-fill danger';
      charCountText.style.color = '#ef4444';
      postToTwitterBtn.disabled = true;
      postToTwitterBtn.style.opacity = '0.5';
    } else if (len > 240) {
      charProgress.className = 'progress-bar-fill warn';
      charCountText.style.color = '#f59e0b';
      postToTwitterBtn.disabled = false;
      postToTwitterBtn.style.opacity = '1';
    } else {
      charProgress.className = 'progress-bar-fill';
      charCountText.style.color = 'var(--text-muted)';
      postToTwitterBtn.disabled = false;
      postToTwitterBtn.style.opacity = '1';
    }
  }

  // Toast Notification helper
  function showToast(message) {
    toastMsg.textContent = message;
    toast.style.display = 'flex';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
});
