/** Interaksi demo lokal: pencarian sederhana untuk latihan RPA. */
const input = document.getElementById('demo-search');
const button = document.getElementById('demo-search-btn');
const hits = Array.from(document.querySelectorAll('.demo-hit'));

function applyFilter() {
  const query = (input?.value || '').trim().toLowerCase();
  hits.forEach((hit) => {
    const text = (hit.textContent || '').toLowerCase();
    hit.hidden = Boolean(query) && !text.includes(query);
  });
}

button?.addEventListener('click', () => {
  applyFilter();
  button.textContent = 'Selesai';
  button.dataset.state = 'done';
});

input?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') applyFilter();
});
