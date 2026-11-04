'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LoadingSpinner from '@/app/components/loading-spinner';
import { userService } from '@/app/services/user.service';
import { API_ENDPOINT, PRICING_URL } from '@/app/constants';
import { useAuth } from '@/app/hooks/useAuth';
import { PLAN_RANK, PURCHASABLE_PLANS, alreadyOn, checkoutPath } from '@/app/shared/utils';
import { Row, Section } from '@/app/components/rows';
import './billing.css';

// One plan as GET /payments/plans lists it: the price is Stripe's own, the
// allowances the ones the API meters, so nothing here is a copy to keep in
// step by hand.
interface PlanInfo {
  id: string;
  name: string;
  tier: string;
  price: { amount: number; currency: string; interval: string | null } | null;
  /** One pool a month, for cloud models and web searches alike. */
  credits: number;
  /** What a whole month's credits would buy in searches alone. */
  searches: number;
  available: boolean;
}

const PLAN_NAME: Record<string, string> = { free: 'Free', paid: 'Pro', plus: 'Plus', admin: 'Admin' };

const priceLabel = (price: PlanInfo['price']) =>
  price ? `${formatAmount(price.amount, price.currency)} / ${price.interval ?? 'month'}` : null;

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  pdf_url?: string;
  // Optional Stripe fields — rendered only when the API includes them.
  number?: string;
  hosted_invoice_url?: string;
  description?: string;
  period_start?: string;
  period_end?: string;
}

// One card shape for the whole page. Every panel below uses these values so
// radius, border and background never drift between sections.
const CARD_SX = {
  bgcolor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
} as const;

const CARD_PADDING = { xs: '20px', md: '28px' } as const;

const formatInvoiceDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// "Jul 1 – Jul 31, 2026" style billing period, when both bounds are present.
const formatBillingPeriod = (start?: string, end?: string) => {
  if (!start || !end) return null;
  const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
};

const formatAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

// Stripe invoice statuses -> badge colors.
const invoiceStatusColor = (status: string): { bg: string; color: string; border: string } => {
  switch (status) {
    case 'paid':
      return { bg: 'var(--ok-soft)', color: 'var(--ok-text)', border: 'var(--ok-border)' };
    case 'open':
      return { bg: 'var(--warn-soft)', color: 'var(--warn-text)', border: 'var(--warn-border)' };
    case 'void':
    case 'uncollectible':
      return { bg: 'var(--danger-soft)', color: 'var(--danger-text)', border: 'var(--danger-border)' };
    default:
      return { bg: 'var(--surface-2)', color: 'var(--muted)', border: 'var(--border)' };
  }
};

function Chip({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className="inline-block whitespace-nowrap"
      style={{
        padding: '3px 10px',
        fontSize: '11px',
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '0.02em',
        borderRadius: '6px',
        backgroundColor: accent ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: accent ? 'var(--accent-text)' : 'var(--muted)',
        border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
      }}
    >
      {label}
    </span>
  );
}

/**
 * The current plan's row: its name and chip, and what it allows a month.
 * `children` is the control on the right (the manage-subscription link for
 * a paying account). The plans above it are offered under the row, as
 * cards (see `PlanCards`), not crammed into the control column.
 */
function PlanRow({
  plan,
  plans,
  chip,
  description,
  children,
}: {
  plan: string;
  plans: PlanInfo[] | null;
  chip?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const current = plans?.find((p) => p.tier === plan) ?? null;

  return (
    <Row
      label={
        <Box className="flex items-center gap-2">
          <span>{PLAN_NAME[plan] ?? 'Free'} Plan</span>
          {chip ?? <Chip label="Current" />}
        </Box>
      }
      description={
        <>
          {description}
          {current && (
            <>
              {description ? <br /> : null}
              {plan === 'free'
                ? `${current.credits.toLocaleString()} credits a month, good for about ${current.searches.toLocaleString()} web searches; cloud models need a paid plan.`
                : `${current.credits.toLocaleString()} credits a month, shared by cloud models and web searches.`}
            </>
          )}
        </>
      }
    >
      {children}
    </Row>
  );
}

/** What a plan buys, as lines on its card: only what the API meters. One
 * pool pays for cloud models and web searches alike, so the searches line
 * says what the credits would stretch to, not a second allowance. */
const planPerks = (p: PlanInfo, below: PlanInfo | null): string[] => {
  const perks: string[] = [];
  if (below && below.id !== 'free') perks.push(`Everything in ${below.name}`);
  perks.push(`${p.credits.toLocaleString()} credits a month`);
  perks.push('Cloud models, charged by what each call reads and writes');
  perks.push(`Web searches from the same credits, up to ${p.searches.toLocaleString()} a month`);
  return perks;
};

/**
 * The plans above the current one that this deployment sells, as cards:
 * a free account sees Pro and Plus, a Pro account sees Plus. The top plan
 * carries the filled button and a "Best value" mark; the rest are
 * outlined, so the eye lands on one thing. Prices come from the API.
 */
function PlanCards({
  plan,
  plans,
  onUpgrade,
}: {
  plan: string;
  plans: PlanInfo[] | null;
  onUpgrade: (id: string) => void;
}) {
  const rank = PLAN_RANK[plan] ?? 0;
  const upgrades = (plans ?? []).filter(
    (p) => p.available && PURCHASABLE_PLANS[p.id] && (PLAN_RANK[p.tier] ?? 0) > rank
  );
  if (upgrades.length === 0) return null;
  const top = upgrades[upgrades.length - 1];

  return (
    <Row
      label="Upgrade"
      description="Pick a plan; you'll confirm on Stripe and can change or cancel it there at any time."
      stacked
    >
      <Box
        className="grid gap-4"
        sx={{ gridTemplateColumns: { xs: '1fr', sm: `repeat(${upgrades.length}, minmax(0, 1fr))` } }}
      >
        {upgrades.map((p) => {
          const featured = p.id === top.id;
          const below = plans?.find((b) => (PLAN_RANK[b.tier] ?? 0) === (PLAN_RANK[p.tier] ?? 0) - 1) ?? null;
          return (
            <Box
              key={p.id}
              className="plan-card"
              sx={{
                ...CARD_SX,
                borderColor: featured ? 'var(--accent-border)' : 'var(--border)',
                background: featured
                  ? 'linear-gradient(160deg, var(--accent-soft) 0%, var(--surface) 55%)'
                  : 'var(--surface)',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <Box className="flex items-start justify-between gap-3">
                <Box>
                  <div className="text-base font-semibold text-content tracking-tight">{p.name}</div>
                  <div className="text-xs text-faint mt-0.5">
                    {p.id === 'plus' ? 'For heavy cloud model use' : 'For everyday cloud model use'}
                  </div>
                </Box>
                {featured && <Chip label="Best value" accent />}
              </Box>

              <Box className="flex items-baseline gap-1">
                {p.price ? (
                  <>
                    <span className="text-3xl font-semibold text-content tracking-tight">
                      {formatAmount(p.price.amount, p.price.currency).replace(/\.00$/, '')}
                    </span>
                    <span className="text-sm text-muted">/ {p.price.interval ?? 'month'}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted">Price on Stripe</span>
                )}
              </Box>

              <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                {planPerks(p, below).map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-content">
                    <CheckRoundedIcon sx={{ fontSize: 16, color: 'var(--accent-text)', mt: '2px', flexShrink: 0 }} />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onUpgrade(p.id)}
                className={`plan-card-button mt-auto w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                  featured ? 'plan-card-button--filled' : 'plan-card-button--outlined'
                }`}
              >
                Upgrade to {p.name}
              </button>
            </Box>
          );
        })}
      </Box>
    </Row>
  );
}

export default function BillingSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user] = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [plans, setPlans] = useState<PlanInfo[] | null>(null);

  // The plans for sale, with Stripe's prices. 404 when payments are off:
  // then there is nothing to buy here, and the row shows the plan alone.
  const fetchPlans = async () => {
    try {
      const response = await fetch(`${API_ENDPOINT}/payments/plans`, {
        headers: { 'Authorization': `Bearer ${userService.token()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans ?? []);
      } else {
        setPlans([]);
      }
    } catch (err) {
      console.error('Plans fetch error:', err);
      setPlans([]);
    }
  };

  const INVOICE_PREVIEW_COUNT = 3;

  const fetchSubscription = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`${API_ENDPOINT}/payments/subscription`, {
        headers: { 'Authorization': `Bearer ${userService.token()}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
        return data;
      } else if (response.status === 404) {
        // No Stripe subscription on file (e.g. free account or premium granted
        // outside Stripe). Not an error — fall back to the user's account flags.
        setSubscription(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to load subscription details:', errorData.detail || 'Unknown error');
      }
    } catch (err) {
      console.error('Subscription fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    return null;
  };

  // Opens the Stripe customer portal. If the portal URL hasn't loaded yet
  // (or the first fetch 404'd), it re-fetches once before giving up.
  const handleManageBilling = async () => {
    setErrorMessage(null);
    let url: string | undefined = subscription?.portal_url;
    if (!url) {
      const data = await fetchSubscription();
      url = data?.portal_url;
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setErrorMessage('Billing management is not available for your account yet. Please contact support if you have an active subscription.');
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubscription();
      fetchPlans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // A user is Pro if the subscription endpoint reports premium/active OR the
  // account itself is flagged paid/premium (premium granted outside Stripe has
  // no subscription object, so /payments/subscription 404s).
  const hasActiveSubscription = subscription?.status === 'active' || subscription?.status === 'will_cancel';
  const isPro = hasActiveSubscription || !!subscription?.is_premium || !!(user?.is_paid || user?.is_premium);
  // Which plan, as the API names it: free, paid (Pro), plus or admin.
  const plan: string = subscription?.plan ?? user?.plan ?? (isPro ? 'paid' : 'free');
  const willCancel = subscription?.status === 'will_cancel';
  // current_period_end is an ISO date-time string from the API.
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  // What this user is actually billed, taken from their most recent invoice
  // rather than a hardcoded list price. Premium granted outside Stripe has no
  // invoices, so this is absent and we simply don't show a number.
  const latestInvoice = (subscription?.invoices as Invoice[] | undefined)?.[0];
  const billedAmount = latestInvoice
    ? `${formatAmount(latestInvoice.amount, latestInvoice.currency)} / month`
    : null;

  // Legacy links still arrive here with a plan pre-selected (e.g. the marketing
  // pricing page -> /plans?plan=pro or ?plan=plus, which now forwards to
  // /billing). Checkout lives on its own route, so hand off to it rather than
  // starting Stripe as a side effect of this page.
  const wantedPlan = searchParams.get('plan');
  const wantsCheckout = !!wantedPlan && !!PURCHASABLE_PLANS[wantedPlan];
  const hasWantedPlan = wantsCheckout && alreadyOn(plan, wantedPlan!);

  useEffect(() => {
    if (!wantsCheckout || loading || !user) return;

    if (hasWantedPlan) {
      // Already on it — drop the param and show the management view.
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    router.replace(checkoutPath(wantedPlan!));
  }, [wantsCheckout, hasWantedPlan, wantedPlan, loading, user, router]);

  // Show the branded loading screen from the start — including while the
  // subscription is still loading — so we never flash the billing page before
  // handing off. Once loaded, a user already on the plan falls through to the
  // billing view.
  if (wantsCheckout && !hasWantedPlan) {
    return <LoadingSpinner showLogo message="Redirecting to checkout..." size={48} />;
  }

  // The page frame renders immediately and the content area swaps a skeleton
  // for the real cards. Gating the whole tree on `user` used to blank the
  // screen, then flash the nav in — the jump was the jarring part.
  const isReady = !!user && !loading;

  return (
    <>
            {errorMessage && (
              <Box
                sx={{
                  ...CARD_SX,
                  bgcolor: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: CARD_PADDING,
                  mb: 3,
                }}
              >
                <p className="text-sm text-danger leading-relaxed">{errorMessage}</p>
              </Box>
            )}

            {!isReady ? (
              // Skeleton in the shape of what's coming, so nothing shifts.
              <Box sx={{ ...CARD_SX, padding: CARD_PADDING, height: 200 }} className="animate-pulse" />
            ) : !isPro ? (
              <>
                {/* The plans come from the API, prices and allowances alike.
                    Feature bullets still live on the marketing site
                    (PRICING_URL); only what can be bought here is listed. */}
                <Section title="Plan" description="Your current subscription.">
                  <PlanRow
                    plan={plan}
                    plans={plans}
                    description={
                      <>
                        Need more credits, more searches, or email support?{' '}
                        <a
                          href={PRICING_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline"
                          style={{ color: 'var(--accent-text)' }}
                        >
                          Compare plans
                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </a>
                      </>
                    }
                  />
                  <PlanCards plan={plan} plans={plans} onUpgrade={(id) => router.push(checkoutPath(id))} />
                  <Row stacked>
                    <p className="text-xs text-faint leading-relaxed">
                      Questions about the plans?{' '}
                      <a
                        href="mailto:support@smartloop.ai"
                        style={{ color: 'var(--accent-text)' }}
                        className="underline"
                      >
                        Talk to us
                      </a>
                      .
                    </p>
                  </Row>
                </Section>
              </>
            ) : (
              <>
                {/* Current plan, and the one above it when there is one. */}
                <Section title="Plan" description="Your current subscription.">
                  <PlanRow
                    plan={plan}
                    plans={plans}
                    chip={<Chip label={willCancel ? 'Cancels soon' : 'Active'} accent={!willCancel} />}
                    description={
                      <>
                        {/* What they pay, not what we advertise — see billedAmount. */}
                        {billedAmount}
                        {billedAmount && periodEnd ? ' · ' : ''}
                        {periodEnd
                          ? (willCancel ? `Access ends on ${periodEnd}` : `Renews on ${periodEnd}`)
                          : ''}
                      </>
                    }
                  >
                    <Box className="w-full sm:w-auto shrink-0">
                      {subscription?.portal_url ? (
                        <a
                          href={subscription.portal_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5 w-full md:w-auto whitespace-nowrap transition-colors"
                          style={{ border: '1px solid var(--accent)', color: 'var(--accent-text)' }}
                        >
                          Manage subscription
                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </a>
                      ) : (
                        <button
                          onClick={handleManageBilling}
                          disabled={refreshing}
                          className="px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5 w-full md:w-auto whitespace-nowrap transition-colors disabled:opacity-60"
                          style={{ border: '1px solid var(--accent)', color: 'var(--accent-text)' }}
                        >
                          Manage subscription
                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </button>
                      )}
                    </Box>
                  </PlanRow>
                  <PlanCards plan={plan} plans={plans} onUpgrade={(id) => router.push(checkoutPath(id))} />
                </Section>

                {/* Billing history. When the API returns an `invoices` array we
                     render it inline; otherwise we fall back to the Stripe portal. */}
                <Box className="mt-10">
                  <Box className="flex items-center justify-between gap-4 mb-4">
                    <h2 className="text-base md:text-lg font-semibold text-content tracking-tight">Billing history</h2>
                    {subscription?.portal_url ? (
                      <a
                        href={subscription.portal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        style={{ color: 'var(--accent-text)' }}
                      >
                        Billing portal
                        <OpenInNewIcon sx={{ fontSize: 15 }} />
                      </a>
                    ) : (
                      <button
                        onClick={handleManageBilling}
                        className="text-sm inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        style={{ color: 'var(--accent-text)' }}
                      >
                        Billing portal
                        <OpenInNewIcon sx={{ fontSize: 15 }} />
                      </button>
                    )}
                  </Box>

                  {(subscription?.invoices as Invoice[] | undefined)?.length ? (
                    (() => {
                      const allInvoices = subscription.invoices as Invoice[];
                      const query = invoiceSearch.trim().toLowerCase();
                      const filtered = query
                        ? allInvoices.filter((inv) =>
                          [
                            formatInvoiceDate(inv.date),
                            inv.status,
                            formatAmount(inv.amount, inv.currency),
                            inv.number,
                            inv.description,
                          ]
                            .filter(Boolean)
                            .join(' ')
                            .toLowerCase()
                            .includes(query)
                        )
                        : allInvoices;
                      const visible = showAllInvoices
                        ? filtered
                        : filtered.slice(0, INVOICE_PREVIEW_COUNT);
                      const remaining = filtered.length - visible.length;

                      return (
                        <>
                          {/* Search — only worth the row once there's enough
                              history to scan. */}
                          {allInvoices.length > INVOICE_PREVIEW_COUNT && (
                            <Box
                              className="flex items-center gap-2 mb-3 px-3.5 py-2"
                              sx={{ ...CARD_SX, borderRadius: '12px' }}
                            >
                              <SearchIcon sx={{ fontSize: 18, color: 'var(--muted)' }} />
                              <input
                                type="text"
                                value={invoiceSearch}
                                onChange={(e) => {
                                  setInvoiceSearch(e.target.value);
                                  setShowAllInvoices(true);
                                }}
                                placeholder="Search invoices by date, amount, or status"
                                className="flex-1 bg-transparent text-sm text-content placeholder:text-faint outline-none border-none"
                              />
                            </Box>
                          )}

                          <Box sx={{ ...CARD_SX, overflow: 'hidden' }}>
                            {visible.length === 0 ? (
                              <Box className="px-5 md:px-6 py-8 text-center">
                                <p className="text-sm text-muted">No invoices match “{invoiceSearch}”.</p>
                              </Box>
                            ) : (
                              visible.map((inv, idx) => {
                                const badge = invoiceStatusColor(inv.status);
                                return (
                                  <Box
                                    key={inv.id}
                                    className="flex items-center justify-between gap-4 px-5 md:px-6 py-4"
                                    sx={{
                                      borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                                      transition: 'background-color 0.15s ease',
                                      '&:hover': { bgcolor: 'var(--surface-2)' },
                                    }}
                                  >
                                    <Box className="flex items-center gap-3.5 min-w-0">
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          width: 40,
                                          height: 40,
                                          flexShrink: 0,
                                          borderRadius: '10px',
                                          border: '1px solid var(--border)',
                                          bgcolor: 'var(--surface-2)',
                                        }}
                                      >
                                        <ReceiptLongOutlinedIcon sx={{ fontSize: 20, color: 'var(--muted)' }} />
                                      </Box>
                                      <Box className="min-w-0">
                                        <Box className="flex items-center gap-2 flex-wrap">
                                          <p className="text-sm text-content font-medium">{formatInvoiceDate(inv.date)}</p>
                                          {inv.number && (
                                            <span className="text-xs text-faint font-mono">{inv.number}</span>
                                          )}
                                        </Box>
                                        {inv.description && (
                                          <p className="text-xs text-muted mt-0.5 truncate">{inv.description}</p>
                                        )}
                                        <Box className="flex items-center gap-2 flex-wrap mt-1.5">
                                          <span
                                            className="border-[0.5px] border-solid"
                                            style={{
                                              display: 'inline-block',
                                              padding: '2px 8px',
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              lineHeight: 1.4,
                                              borderRadius: '999px',
                                              textTransform: 'capitalize',
                                              backgroundColor: badge.bg,
                                              color: badge.color,
                                              borderColor: badge.border,
                                            }}
                                          >
                                            {inv.status}
                                          </span>
                                          {formatBillingPeriod(inv.period_start, inv.period_end) && (
                                            <span className="text-xs text-faint">
                                              {formatBillingPeriod(inv.period_start, inv.period_end)}
                                            </span>
                                          )}
                                        </Box>
                                      </Box>
                                    </Box>
                                    <Box className="flex items-center gap-3 shrink-0">
                                      <span className="text-sm text-content font-medium">
                                        {formatAmount(inv.amount, inv.currency)}
                                      </span>
                                      {inv.hosted_invoice_url && (
                                        <a
                                          href={inv.hosted_invoice_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="View invoice"
                                          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-content px-3 py-1.5 rounded-lg border border-border hover:border-muted transition-colors"
                                        >
                                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                                          <span className="hidden sm:inline">View</span>
                                        </a>
                                      )}
                                      {inv.pdf_url && (
                                        <a
                                          href={inv.pdf_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Download invoice (PDF)"
                                          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-content px-3 py-1.5 rounded-lg border border-border hover:border-muted transition-colors"
                                        >
                                          <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
                                          <span className="hidden sm:inline">PDF</span>
                                        </a>
                                      )}
                                    </Box>
                                  </Box>
                                );
                              })
                            )}
                          </Box>

                          {/* Expand / collapse */}
                          {filtered.length > INVOICE_PREVIEW_COUNT && (
                            <Box className="flex justify-center mt-3">
                              <button
                                onClick={() => setShowAllInvoices((v) => !v)}
                                className="inline-flex items-center gap-1 text-sm text-muted hover:text-content transition-colors"
                              >
                                {showAllInvoices ? 'Show less' : `Show ${remaining} more`}
                                <ExpandMoreIcon
                                  sx={{
                                    fontSize: 18,
                                    transition: 'transform 0.15s ease',
                                    transform: showAllInvoices ? 'rotate(180deg)' : 'none',
                                  }}
                                />
                              </button>
                            </Box>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <Box sx={{ ...CARD_SX, padding: CARD_PADDING }} className="flex items-start gap-3">
                      <ReceiptLongOutlinedIcon sx={{ fontSize: 24, color: 'var(--muted)', mt: 0.25 }} />
                      <Box>
                        <p className="text-sm text-content font-medium">No invoices yet</p>
                        <p className="text-xs text-faint mt-1 leading-relaxed">
                          Your invoices will appear here once your first payment is processed. Payment methods and full
                          history are always available in the Stripe billing portal.
                        </p>
                      </Box>
                    </Box>
                  )}
                </Box>
              </>
            )}
    </>
  );
}
