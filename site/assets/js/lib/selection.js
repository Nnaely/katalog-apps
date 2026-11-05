// Product -> plan -> duration selection. Price, status, summary, and draft all come from the same offer.
import { formatRupiah } from './format.js';
import { buildWhatsAppUrl, orderMessage, priceInquiryMessage, stockInquiryMessage } from './whatsapp.js';

export const AVAILABILITY_LABEL = {
  available: 'Dapat dipesan',
  sold_out: 'Stok habis',
  needs_confirmation: 'Perlu konfirmasi admin',
  inactive: 'Sedang tidak tersedia',
};

const findPlan = (product, planId) => product.plans.find(pl => pl.id === planId) ?? null;
const findOffer = (plan, offerId) => plan?.offers.find(o => o.id === offerId) ?? null;
const sameDuration = (a, b) => a.durationUnit === b.durationUnit && a.durationValue === b.durationValue;

/** Starts empty (FR04); restores a saved choice only if it still exists; auto-picks single options. */
export function initialSelection(product, saved = null) {
  let planId = null;
  let offerId = null;
  let discarded = false;
  if (saved && (saved.planId || saved.offerId)) {
    const savedPlan = findPlan(product, saved.planId);
    if (savedPlan) {
      planId = savedPlan.id;
      if (saved.offerId) {
        if (findOffer(savedPlan, saved.offerId)) offerId = saved.offerId;
        else discarded = true;
      }
    } else {
      discarded = true;
    }
  }
  let autoPlan = false;
  if (!planId && product.plans.length === 1) {
    planId = product.plans[0].id;
    autoPlan = true;
  }
  let autoOffer = false;
  const plan = findPlan(product, planId);
  if (plan && !offerId && plan.offers.length === 1) {
    offerId = plan.offers[0].id;
    autoOffer = true;
  }
  return { planId, offerId, autoPlan, autoOffer, discarded, durationCleared: false };
}

/** Changing plan keeps the same duration only if the new plan offers it (FR05, UAT02). */
export function choosePlan(product, state, planId) {
  const plan = findPlan(product, planId);
  if (!plan) return state;
  const previousOffer = findOffer(findPlan(product, state.planId), state.offerId);
  let offerId = null;
  let durationCleared = false;
  if (previousOffer) {
    const match = plan.offers.find(o => sameDuration(o, previousOffer));
    if (match) offerId = match.id;
    else durationCleared = true;
  }
  let autoOffer = false;
  if (!offerId && plan.offers.length === 1) {
    offerId = plan.offers[0].id;
    autoOffer = true;
  }
  return { ...state, planId: plan.id, offerId, autoOffer, durationCleared, discarded: false };
}

export function chooseOffer(product, state, offerId) {
  const offer = findOffer(findPlan(product, state.planId), offerId);
  if (!offer) return state;
  return { ...state, offerId: offer.id, autoOffer: false, durationCleared: false, discarded: false };
}

/** Everything the detail page shows for the current selection. */
export function describeSelection(product, state, { whatsappNumber }) {
  const plan = findPlan(product, state?.planId);
  const offer = findOffer(plan, state?.offerId);
  const link = message => buildWhatsAppUrl(whatsappNumber, message);
  const base = {
    product, plan, offer,
    singlePlan: product.plans.length === 1,
    singleOffer: !!plan && plan.offers.length === 1,
    notes: plan ? plan.notes : [],
    warrantyText: plan?.warrantyPeriod?.label ?? null,
    availability: null, statusLabel: null, priceText: null,
    canOrder: false, hint: null, draft: null,
  };

  if (product.plans.length === 0) {
    const message = priceInquiryMessage(product.name);
    return {
      ...base, step: 'none',
      hint: 'Rincian paket dan harga belum tersedia. Hubungi admin untuk informasi.',
      draft: { kind: 'price', message, href: link(message), actionLabel: 'Tanya harga ke admin' },
    };
  }
  if (!plan) return { ...base, step: 'plan', hint: 'Pilih paket terlebih dahulu.' };
  if (!offer) return { ...base, step: 'duration', hint: 'Pilih durasi terlebih dahulu.' };

  const availability = offer.effectiveAvailability;
  const complete = {
    ...base, step: 'complete', availability,
    statusLabel: AVAILABILITY_LABEL[availability] ?? AVAILABILITY_LABEL.inactive,
    priceText: formatRupiah(offer.priceIdr) ?? 'Hubungi admin',
  };
  const names = { productName: product.name, planName: plan.name, durationLabel: offer.durationLabel };

  if (offer.orderable) {
    const message = orderMessage({ ...names, priceIdr: offer.priceIdr });
    return { ...complete, canOrder: true, draft: { kind: 'order', message, href: link(message), actionLabel: 'Pesan lewat WhatsApp' } };
  }
  if (availability === 'needs_confirmation') {
    const message = priceInquiryMessage(product.name);
    return {
      ...complete,
      hint: 'Harga paket ini perlu dikonfirmasi admin. Tanyakan lewat WhatsApp.',
      draft: { kind: 'price', message, href: link(message), actionLabel: 'Tanya harga ke admin' },
    };
  }
  const message = stockInquiryMessage(names);
  return {
    ...complete,
    hint: availability === 'sold_out' ? 'Paket ini sedang habis.' : 'Paket ini sedang tidak tersedia.',
    draft: { kind: 'stock', message, href: link(message), actionLabel: 'Tanya ketersediaan' },
  };
}
