// Detail produk: pilih paket -> durasi, ringkasan, draf WhatsApp, dan tombol pesan.
import { STORE } from './store.js';
import { formatRupiah } from './lib/format.js';
import { initialSelection, choosePlan, chooseOffer, describeSelection } from './lib/selection.js';
import { createSelectionStore } from './lib/storage.js';
import {
  bindStore, loadCatalog, el, icon, monogram, copyText, track, helpLink, catalogBackHref, safeSessionStorage, fillCatalogDate,
} from './ui.js';

const root = document.querySelector('[data-product-root]');
const live = document.querySelector('[data-live]');
const slug = new URLSearchParams(location.search).get('p');
const selections = createSelectionStore(safeSessionStorage());
const wideScreen = window.matchMedia('(min-width: 960px)');

let catalog = null;
let product = null;
let state = null;
let current = null;
const refs = { planInputs: new Map(), durationInputs: new Map(), renderedPlanId: undefined };

function say(message) {
  live.textContent = '';
  window.setTimeout(() => { live.textContent = message; }, 60);
}

const askPill = (text = 'Hubungi admin') => el('span', { class: 'pill-ask' }, icon('chat'), el('span', {}, text));
const STATUS_TONE = { available: 'ok', needs_confirmation: 'ask', sold_out: 'off', inactive: 'off' };

function offerStatusText(offer) {
  if (offer.orderable) return formatRupiah(offer.priceIdr);
  if (offer.effectiveAvailability === 'sold_out') return 'Stok habis';
  if (offer.effectiveAvailability === 'inactive') return 'Tidak tersedia';
  return 'Hubungi admin';
}

function planSubText(plan) {
  const orderable = plan.offers.filter(o => o.orderable);
  if (plan.offers.length === 1) {
    const only = plan.offers[0];
    return only.orderable ? `${formatRupiah(only.priceIdr)} untuk ${only.durationLabel}` : `${only.durationLabel}, ${offerStatusText(only).toLowerCase()}`;
  }
  if (orderable.length) return `${plan.offers.length} durasi, mulai ${formatRupiah(plan.startingPrice)}`;
  if (plan.offers.length && plan.offers.every(o => o.effectiveAvailability === 'sold_out')) return 'Stok habis';
  if (plan.offers.length && plan.offers.every(o => o.effectiveAvailability === 'inactive')) return 'Tidak tersedia';
  return 'Hubungi admin';
}

// ---------- page states ----------
function renderLoading() {
  root.setAttribute('aria-busy', 'true');
  root.replaceChildren(el('div', { class: 'product-skeleton', 'aria-hidden': 'true' },
    el('span', { class: 'mono mono--lg' }),
    el('span', { class: 'sk-line sk-line--title' }),
    el('span', { class: 'sk-line' }),
    el('span', { class: 'sk-block' })));
  live.textContent = 'Memuat produk…';
}

function renderMessage({ title, body, retry = false }) {
  root.removeAttribute('aria-busy');
  root.replaceChildren(el('div', { class: 'notice notice--page', dataset: { tone: retry ? 'error' : 'info' }, role: retry ? 'alert' : null },
    icon(retry ? 'alert' : 'info'),
    el('div', { class: 'notice-body' },
      el('h1', { class: 'notice-title', text: title }),
      el('p', { text: body }),
      el('div', { class: 'notice-actions' },
        retry ? el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: start }, icon('refresh'), el('span', {}, 'Muat ulang')) : null,
        el('a', { class: 'btn btn-secondary btn-sm', href: catalogBackHref() }, icon('back'), el('span', {}, 'Lihat semua produk')),
        helpLink('Tanya admin', 'btn btn-secondary btn-sm')))));
}

// ---------- product layout ----------
function pickerLegend(step, text) {
  return el('legend', { class: 'picker-legend' }, el('span', { class: 'step-badge', 'aria-hidden': 'true', text: String(step) }), text);
}

function buildPlanPicker() {
  const options = product.plans.map(plan => {
    const radio = el('input', { type: 'radio', name: 'paket', value: plan.id, class: 'option-input' });
    radio.addEventListener('change', () => onPlan(plan.id));
    refs.planInputs.set(plan.id, radio);
    return el('label', { class: 'option option--plan' }, radio,
      el('span', { class: 'option-body' },
        el('span', { class: 'option-title', text: plan.name }),
        el('span', { class: 'option-sub', text: planSubText(plan) })),
      icon('check', 'icon option-check'));
  });
  const note = product.plans.length === 1
    ? el('p', { class: 'picker-note', id: 'paket-note', text: 'Hanya ada satu paket, sudah dipilih otomatis.' })
    : el('p', { class: 'picker-note', id: 'paket-note', text: 'Harga dan durasi mengikuti paket yang dipilih.' });
  return el('fieldset', { class: 'picker', id: 'pilih-paket', 'aria-describedby': 'paket-note' },
    pickerLegend(1, 'Pilih paket'), note, el('div', { class: 'options options--plans' }, options));
}

function buildDurationPicker(step) {
  refs.durationNote = el('p', { class: 'picker-note', id: 'durasi-note' });
  refs.durationOptions = el('div', { class: 'options options--durations' });
  refs.durationPicker = el('fieldset', { class: 'picker', id: 'pilih-durasi', 'aria-describedby': 'durasi-note' },
    pickerLegend(step, 'Pilih durasi'), refs.durationNote, refs.durationOptions);
  return refs.durationPicker;
}

function renderDurations(plan) {
  refs.durationInputs.clear();
  if (!plan) {
    refs.durationOptions.replaceChildren();
    refs.durationNote.textContent = 'Pilih paket terlebih dahulu untuk melihat durasi yang tersedia.';
    return;
  }
  refs.durationOptions.replaceChildren(...plan.offers.map(offer => {
    const radio = el('input', { type: 'radio', name: 'durasi', value: offer.id, class: 'option-input' });
    radio.addEventListener('change', () => onOffer(offer.id));
    refs.durationInputs.set(offer.id, radio);
    return el('label', { class: 'option option--duration', dataset: { state: offer.orderable ? 'ok' : 'ask' } }, radio,
      el('span', { class: 'option-body' },
        el('span', { class: 'option-title', text: offer.durationLabel }),
        el('span', { class: 'option-sub', text: offerStatusText(offer) })),
      icon('check', 'icon option-check'));
  }));
  refs.durationNote.textContent = plan.offers.length === 1
    ? 'Hanya ada satu durasi untuk paket ini, sudah dipilih otomatis.'
    : 'Durasi layanan berbeda dengan masa garansi.';
}

function buildDetails() {
  refs.detailsIntro = el('p', { class: 'muted' });
  refs.detailsList = el('dl', { class: 'details-list' });
  refs.notes = el('ul', { class: 'notes' });
  return el('section', { class: 'details', 'aria-labelledby': 'rincian-title' },
    el('h2', { class: 'block-title', id: 'rincian-title', text: 'Rincian paket' }),
    refs.detailsIntro, refs.detailsList, refs.notes,
    el('p', { class: 'details-foot' }, 'Ketentuan umum juga berlaku. ', el('a', { href: './#ketentuan', text: 'Baca ketentuan layanan' }), '.'));
}

function buildSummary() {
  const row = (label, key) => {
    const dd = el('dd');
    refs[key] = dd;
    return [el('dt', { text: label }), dd];
  };
  refs.total = el('p', { class: 'total-value' });
  refs.draftLabel = el('p', { class: 'draft-label', id: 'draft-label' });
  refs.draftBubble = el('p', { class: 'bubble', id: 'draft-text', 'aria-labelledby': 'draft-label' });
  refs.hint = el('p', { class: 'order-hint', id: 'order-hint' });
  refs.order = el('a', { class: 'btn btn-primary btn-block btn-order', 'aria-describedby': 'order-hint' },
    icon('chat'), el('span', {}, 'Pesan lewat WhatsApp'));
  refs.inquiryLabel = el('span');
  refs.inquiry = el('a', { class: 'btn btn-secondary btn-block', target: '_blank', rel: 'noopener noreferrer', hidden: true },
    icon('chat'), refs.inquiryLabel);
  refs.copyMessage = el('button', { type: 'button', class: 'btn btn-ghost' }, icon('copy'), el('span', {}, 'Salin pesan'));
  refs.copyStatus = el('p', { class: 'copy-status', role: 'status' });
  refs.manual = el('textarea', { class: 'manual-copy', readonly: true, rows: '4', hidden: true, 'aria-label': 'Teks draf untuk disalin manual' });
  refs.actions = el('div', { class: 'order-actions' },
    refs.hint, refs.order, refs.inquiry,
    el('div', { class: 'copy-row' }, refs.copyMessage,
      el('button', { type: 'button', class: 'btn btn-ghost', 'data-copy': 'phone' }, icon('copy'), el('span', {}, 'Salin nomor'))),
    refs.copyStatus, refs.manual);

  refs.order.addEventListener('click', event => {
    if (refs.order.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      guideToMissingChoice();
      return;
    }
    track('whatsapp_click', { type: 'order', product: product.slug, plan: state.planId, offer: state.offerId });
  });
  refs.order.addEventListener('keydown', event => {
    if (event.key === 'Enter' && refs.order.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      guideToMissingChoice();
    }
  });
  refs.inquiry.addEventListener('click', () => track('whatsapp_click', { type: current?.draft?.kind === 'stock' ? 'stock_inquiry' : 'price_inquiry', product: product.slug }));
  refs.copyMessage.addEventListener('click', copyDraft);

  return el('aside', { class: 'summary', 'aria-labelledby': 'ringkasan-title' },
    el('h2', { class: 'summary-title', id: 'ringkasan-title', text: 'Ringkasan pesanan' }),
    el('dl', { class: 'summary-list' },
      el('dt', { text: 'Produk' }), el('dd', { text: product.name }),
      ...row('Paket', 'sumPlan'), ...row('Durasi', 'sumDuration'), ...row('Masa garansi', 'sumWarranty'), ...row('Status', 'sumStatus')),
    el('div', { class: 'summary-total' }, el('p', { class: 'total-label', text: 'Total' }), refs.total),
    el('div', { class: 'draft' }, refs.draftLabel, refs.draftBubble),
    refs.actions,
    el('p', { class: 'fine-print' }, 'Website hanya menyiapkan draf. Pesan terkirim setelah Anda menekan Kirim di WhatsApp ke ',
      el('span', { class: 'nowrap', 'data-store': 'phone', text: STORE.whatsappDisplay }), '.'));
}

function buildMobileBar() {
  refs.barLabel = el('span', { class: 'mobile-bar-label' });
  refs.barPrice = el('strong', { class: 'mobile-bar-price' });
  refs.barAction = el('a', { class: 'btn btn-primary btn-sm mobile-bar-action' });
  refs.bar = el('div', { class: 'mobile-bar', hidden: true },
    el('p', { class: 'mobile-bar-info' }, refs.barLabel, refs.barPrice), refs.barAction);
  refs.barAction.addEventListener('click', event => {
    const target = refs.barAction.dataset.focus;
    if (target) {
      event.preventDefault();
      focusPicker(target);
    } else if (refs.barAction.dataset.kind === 'order') {
      track('whatsapp_click', { type: 'order', product: product.slug, plan: state.planId, offer: state.offerId, from: 'mobile_bar' });
    }
  });
  document.body.append(refs.bar);
  document.documentElement.classList.add('has-mobile-bar');

  const observer = new IntersectionObserver(([entry]) => {
    refs.actionsVisible = entry.isIntersecting;
    renderMobileBar();
  });
  observer.observe(refs.actions);
  wideScreen.addEventListener('change', renderMobileBar);
}

function renderProduct() {
  root.removeAttribute('aria-busy');
  live.textContent = '';
  document.title = `${product.name}: paket dan harga | ${STORE.name}`;
  const categoryName = catalog.categories.find(c => c.id === product.category)?.name ?? 'Lainnya';
  const head = el('header', { class: 'product-head' },
    monogram(product, 'mono mono--lg'),
    el('div', { class: 'product-head-text' },
      el('h1', { class: 'product-title', id: 'product-title', text: product.name }),
      el('p', { class: 'product-desc', text: product.description || product.shortDescription || '' }),
      el('p', { class: 'card-meta' },
        el('span', { class: 'badge badge-cat', text: categoryName }),
        product.plans.length ? el('span', { class: 'plan-count', text: `${product.plans.length} paket` }) : null)));

  const main = el('div', { class: 'product-main' });
  refs.restoreNote = el('p', { class: 'notice notice--inline', dataset: { tone: 'info' }, hidden: true }, icon('info'),
    el('span', {}, 'Pilihan sebelumnya sudah tidak tersedia. Silakan pilih ulang.'));
  main.append(refs.restoreNote);

  if (!product.plans.length) {
    main.append(el('div', { class: 'notice', dataset: { tone: 'ask' } }, icon('info'),
      el('div', { class: 'notice-body' },
        el('p', { class: 'notice-title', text: 'Hubungi admin untuk informasi' }),
        el('p', { text: `Pricelist belum mencantumkan paket, durasi, atau harga untuk ${product.name}. Tanyakan ketersediaannya ke admin lewat WhatsApp.` }))));
  } else {
    const namelessSingle = product.plans.length === 1 && !product.plans[0].name;
    if (!namelessSingle) main.append(buildPlanPicker());
    main.append(buildDurationPicker(namelessSingle ? 1 : 2));
    main.append(buildDetails());
  }

  root.replaceChildren(el('article', { class: 'product', 'aria-labelledby': 'product-title' },
    head,
    el('div', { class: 'product-layout' }, main, buildSummary())));
  bindStore(root);
  if (product.plans.length) buildMobileBar();
}

// ---------- updates ----------
function renderSummary() {
  const { plan, offer } = current;
  const noPlans = !product.plans.length;
  const pending = text => el('span', { class: 'muted', text });
  refs.sumPlan.replaceChildren(noPlans ? pending('Belum tersedia') : plan ? (plan.name ?? 'Tanpa varian') : pending('Belum dipilih'));
  refs.sumDuration.replaceChildren(noPlans ? pending('Belum tersedia') : offer ? offer.durationLabel : pending('Belum dipilih'));
  refs.sumWarranty.replaceChildren(current.warrantyText ?? (plan || noPlans ? askPill() : pending('—')));
  refs.sumStatus.replaceChildren(current.statusLabel
    ? el('span', { class: 'badge badge-status', dataset: { tone: STATUS_TONE[current.availability] ?? 'off' }, text: current.statusLabel })
    : noPlans ? askPill('Hubungi admin untuk informasi') : pending('—'));

  if (noPlans || current.priceText === 'Hubungi admin') refs.total.replaceChildren(askPill());
  else refs.total.replaceChildren(current.priceText ?? '—');

  const draft = current.draft;
  refs.draftBubble.classList.toggle('bubble--empty', !draft);
  refs.draftBubble.dataset.kind = draft?.kind ?? 'none';
  if (draft) {
    refs.draftLabel.textContent = draft.kind === 'order' ? 'Draf pesan WhatsApp' : draft.kind === 'stock' ? 'Draf pertanyaan ketersediaan' : 'Draf pertanyaan harga';
    refs.draftBubble.textContent = draft.message;
  } else {
    refs.draftLabel.textContent = 'Draf pesan WhatsApp';
    refs.draftBubble.textContent = current.step === 'plan'
      ? 'Draf muncul setelah Anda memilih paket dan durasi.'
      : 'Draf muncul setelah Anda memilih durasi.';
  }
  refs.manual.hidden = true;
  refs.copyStatus.textContent = '';
}

function renderDetails() {
  if (!refs.detailsList) return;
  const { plan, offer } = current;
  if (!plan) {
    refs.detailsIntro.hidden = false;
    refs.detailsIntro.textContent = 'Pilih paket untuk melihat rinciannya.';
    refs.detailsList.replaceChildren();
    refs.notes.replaceChildren();
    return;
  }
  refs.detailsIntro.hidden = true;
  const value = v => (v ? el('span', { text: v }) : askPill());
  refs.detailsList.replaceChildren(
    el('dt', { text: 'Masa garansi' }), el('dd', {}, value(plan.warrantyPeriod?.label ?? null)),
    el('dt', { text: 'Jenis akses dan batas pengguna atau perangkat' }), el('dd', {}, value(plan.accessType)),
    el('dt', { text: 'Aturan pemakaian' }), el('dd', {}, value(plan.usageRules)),
    el('dt', { text: 'Cara aktivasi' }), el('dd', {}, value(plan.activationNotes)),
  );
  const notes = [...plan.notes, ...(offer?.note ? [offer.note] : [])];
  refs.notes.replaceChildren(...notes.map(n => el('li', {}, icon('info'), el('span', { text: n }))));
}

function setLink(link, href) {
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.removeAttribute('aria-disabled');
  link.removeAttribute('role');
  link.removeAttribute('tabindex');
}

function disableLink(link) {
  link.removeAttribute('href');
  link.removeAttribute('target');
  link.removeAttribute('rel');
  link.setAttribute('role', 'link');
  link.setAttribute('aria-disabled', 'true');
  link.tabIndex = 0;
}

function renderActions() {
  const draft = current.draft;
  const noPlans = !product.plans.length;
  refs.order.hidden = noPlans;
  if (current.canOrder) setLink(refs.order, draft.href);
  else disableLink(refs.order);

  const inquiry = draft && draft.kind !== 'order' ? draft : null;
  refs.inquiry.hidden = !inquiry;
  refs.inquiry.classList.toggle('btn-primary', noPlans);
  refs.inquiry.classList.toggle('btn-secondary', !noPlans);
  if (inquiry) {
    refs.inquiryLabel.textContent = inquiry.actionLabel;
    refs.inquiry.href = inquiry.href;
  }
  refs.hint.textContent = current.hint ?? '';
  refs.hint.hidden = !current.hint;
  refs.copyMessage.disabled = !draft;
}

function renderMobileBar() {
  if (!refs.bar) return;
  const show = !wideScreen.matches && !refs.actionsVisible;
  refs.bar.hidden = !show;
  if (!show) return;
  const { plan, offer, draft } = current;
  const planName = plan?.name ?? (plan ? '' : null);
  delete refs.barAction.dataset.focus;
  delete refs.barAction.dataset.kind;
  if (current.step === 'plan') {
    refs.barLabel.textContent = 'Belum memilih paket';
    refs.barPrice.textContent = '';
    refs.barAction.textContent = 'Pilih paket';
    refs.barAction.href = '#pilih-paket';
    refs.barAction.removeAttribute('target');
    refs.barAction.dataset.focus = 'paket';
    return;
  }
  if (current.step === 'duration') {
    refs.barLabel.textContent = planName ? `Paket ${planName}` : 'Durasi belum dipilih';
    refs.barPrice.textContent = '';
    refs.barAction.textContent = 'Pilih durasi';
    refs.barAction.href = '#pilih-durasi';
    refs.barAction.removeAttribute('target');
    refs.barAction.dataset.focus = 'durasi';
    return;
  }
  refs.barLabel.textContent = [planName, offer.durationLabel].filter(Boolean).join(', ');
  refs.barPrice.textContent = current.priceText;
  refs.barAction.dataset.kind = draft.kind;
  refs.barAction.textContent = current.canOrder ? 'Pesan lewat WhatsApp' : 'Tanya admin';
  refs.barAction.href = draft.href;
  refs.barAction.target = '_blank';
  refs.barAction.rel = 'noopener noreferrer';
}

function update() {
  current = describeSelection(product, state, { whatsappNumber: STORE.whatsappNumber });
  selections.save(product.slug, { planId: state.planId, offerId: state.offerId });
  for (const [id, radio] of refs.planInputs) radio.checked = id === state.planId;
  if (refs.durationOptions && refs.renderedPlanId !== state.planId) {
    renderDurations(current.plan);
    refs.renderedPlanId = state.planId;
  }
  for (const [id, radio] of refs.durationInputs) radio.checked = id === state.offerId;
  if (refs.durationNote && current.plan && state.durationCleared && refs.clearedLabel) {
    refs.durationNote.textContent = current.offer
      ? `Durasi ${refs.clearedLabel} tidak tersedia untuk paket ini, jadi ${current.offer.durationLabel} dipilih otomatis.`
      : `Durasi ${refs.clearedLabel} tidak tersedia untuk paket ini. Pilih durasi lagi.`;
  }
  renderSummary();
  renderDetails();
  renderActions();
  renderMobileBar();
}

function priceSentence() {
  return current.canOrder ? `Total ${current.priceText}.` : current.hint ?? '';
}

function onPlan(planId) {
  const previous = current?.offer ?? null;
  state = choosePlan(product, state, planId);
  refs.clearedLabel = state.durationCleared && previous ? previous.durationLabel : null;
  refs.restoreNote.hidden = true;
  update();
  const planText = current.plan.name ? `Paket ${current.plan.name} dipilih.` : 'Paket dipilih.';
  if (current.offer) {
    const auto = state.autoOffer ? ' Durasi dipilih otomatis karena hanya ada satu.' : '';
    const cleared = refs.clearedLabel ? ` Durasi ${refs.clearedLabel} tidak tersedia untuk paket ini.` : '';
    say(`${planText}${cleared} ${current.offer.durationLabel}.${auto} ${priceSentence()}`);
  } else if (refs.clearedLabel) {
    say(`${planText} Durasi ${refs.clearedLabel} tidak tersedia untuk paket ini. Pilih durasi lagi.`);
  } else {
    say(`${planText} Pilih durasi.`);
  }
}

function onOffer(offerId) {
  state = chooseOffer(product, state, offerId);
  refs.clearedLabel = null;
  update();
  say(`${current.offer.durationLabel} dipilih. ${priceSentence()} Draf pesan diperbarui.`);
}

function focusPicker(which) {
  const picker = document.getElementById(which === 'paket' ? 'pilih-paket' : 'pilih-durasi');
  if (!picker) return;
  const inputs = [...picker.querySelectorAll('input[type="radio"]')];
  const target = inputs.find(i => i.checked) ?? inputs[0];
  picker.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  target?.focus({ preventScroll: true });
  picker.classList.remove('is-attention');
  void picker.offsetWidth;
  picker.classList.add('is-attention');
}

function guideToMissingChoice() {
  if (current.step === 'plan') focusPicker(document.getElementById('pilih-paket') ? 'paket' : 'durasi');
  else if (current.step === 'duration') focusPicker('durasi');
  else if (!refs.inquiry.hidden) refs.inquiry.focus();
  if (current.hint) say(current.hint);
}

async function copyDraft() {
  const message = current?.draft?.message;
  if (!message) return;
  const ok = await copyText(message);
  if (ok) {
    refs.manual.hidden = true;
    refs.copyStatus.textContent = `Pesan disalin. Tempel di chat WhatsApp ke ${STORE.whatsappDisplay}.`;
  } else {
    refs.manual.value = message;
    refs.manual.hidden = false;
    refs.copyStatus.textContent = 'Tidak bisa menyalin otomatis. Teks draf sudah ditandai di bawah ini, salin secara manual.';
    refs.manual.focus();
    refs.manual.select();
  }
}

async function start() {
  renderLoading();
  try {
    catalog = await loadCatalog();
  } catch (error) {
    console.error('Katalog gagal dimuat:', error);
    renderMessage({
      title: 'Data produk tidak dapat dimuat.',
      body: 'Periksa koneksi internet, lalu muat ulang halaman ini. Anda juga bisa langsung bertanya ke admin lewat WhatsApp.',
      retry: true,
    });
    return;
  }
  fillCatalogDate(catalog);
  product = slug ? catalog.getProduct(slug) : null;
  if (!product) {
    renderMessage({
      title: 'Produk tidak ditemukan.',
      body: 'Tautan produk ini tidak cocok dengan katalog. Buka daftar produk untuk memilih aplikasi, atau tanyakan ke admin.',
    });
    document.title = `Produk tidak ditemukan | ${STORE.name}`;
    return;
  }
  state = initialSelection(product, selections.load(product.slug));
  renderProduct();
  update();
  if (state.discarded) {
    refs.restoreNote.hidden = false;
    say('Pilihan sebelumnya sudah tidak tersedia. Silakan pilih ulang.');
  }
}

document.querySelectorAll('[data-back-link]').forEach(link => { link.href = catalogBackHref(); });
bindStore(document);
start();
