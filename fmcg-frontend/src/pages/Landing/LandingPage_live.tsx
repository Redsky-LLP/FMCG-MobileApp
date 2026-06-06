// PATH: src/pages/Landing/LandingPage_live.tsx
// UPDATED: Mobile-responsive layout + PWA install prompt

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PWAInstallPrompt from '../../components/PWAInstallPrompt';

function fmtCr(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(0)}K`;
  if (n === 0)         return "₹0";
  return `₹${n.toFixed(0)}`;
}

interface PublicStats {
  activeRoutes:    number;
  todayOrders:     number;
  todayRevenue:    number;
  activeCustomers: number;
  routes: { routeName: string; revenue: number; orderCount: number }[];
}

export function LandingPage() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/v1/analytics/public-stats")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeRoutes = stats ? String(stats.activeRoutes) : "—";
  const todayOrders = stats ? String(stats.todayOrders) : "—";
  const collections = stats ? fmtCr(stats.todayRevenue) : "—";
  const customers = stats ? String(stats.activeCustomers) : "—";

  const maxRev = stats?.routes?.length ? Math.max(...stats.routes.map(r => r.revenue), 1) : 1;
  const routeBars = stats?.routes?.length
    ? stats.routes.map((r, i) => ({
        label: r.routeName,
        pct: Math.round((r.revenue / maxRev) * 100),
        color: ["#2563EB", "#16A34A", "#D97706", "#2563EB"][i % 4],
      }))
    : null;

  const navLinks = ["Features", "How It Works", "Roles"];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif", background: "#fff", color: "#334155", overflowX: "hidden" }}>

      {/* ── Mobile-responsive Navbar ────────────────────────────────────────── */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(255,255,255,0.98)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E2E8F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        height: 64,
        gap: 16,
      }}>
        {/* Logo */}
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
          }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#1E3A8A", letterSpacing: "-0.04em" }}>
            FMCG<span style={{ color: "#2563EB" }}>Dist</span>
          </span>
        </a>

        {/* Desktop Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, justifyContent: "center" }} className="hide-mobile">
          {navLinks.map((link, i) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/ /g, '-')}`}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "#64748B",
                textDecoration: "none",
                transition: "all 0.14s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#2563EB"; (e.currentTarget as HTMLElement).style.background = "#EFF6FF"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748B"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {link}
            </a>
          ))}
        </div>

        {/* Desktop Auth Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="hide-mobile">
          <Link to="/login" style={{
            padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            color: "#1E3A8A", border: "1px solid #E2E8F0", background: "transparent",
            textDecoration: "none",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#EFF6FF"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >Sign In</Link>
          <Link to="/register" style={{
            padding: "7px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            color: "#fff", border: "none", textDecoration: "none",
            background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
            boxShadow: "0 2px 8px rgba(37,99,235,0.28)",
          }}>Get Started →</Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'none',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 8, borderRadius: 8, color: '#64748B',
          }}
          className="show-mobile"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {mobileMenuOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
          </svg>
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed', top: 64, left: 0, right: 0,
          background: '#fff', borderBottom: '1px solid #E2E8F0',
          padding: '16px', zIndex: 99, boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
        }}>
          {navLinks.map((link, i) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/ /g, '-')}`}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'block', padding: '12px 16px', borderRadius: 8,
                fontSize: 15, fontWeight: 600, color: '#334155',
                textDecoration: 'none', borderBottom: i < navLinks.length - 1 ? '1px solid #F1F5F9' : 'none',
              }}
            >
              {link}
            </a>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{
              flex: 1, textAlign: 'center', padding: '10px', borderRadius: 8,
              fontSize: 14, fontWeight: 700, color: '#1E3A8A', border: '1px solid #E2E8F0',
              background: 'transparent', textDecoration: 'none',
            }}>Sign In</Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)} style={{
              flex: 1, textAlign: 'center', padding: '10px', borderRadius: 8,
              fontSize: 14, fontWeight: 700, color: '#fff', border: 'none',
              background: 'linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)',
              textDecoration: 'none',
            }}>Get Started</Link>
          </div>
        </div>
      )}

      {/* ── Hero Section - Mobile Responsive ────────────────────────────────── */}
      <section style={{
        minHeight: 'auto',
        background: "linear-gradient(135deg,#F8FAFC 0%,#EFF6FF 60%,#E0F2FE 100%)",
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "48px 20px 60px",
        gap: 40,
      }}>
        <div style={{
          position: "absolute", top: "-10%", right: "-5%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(37,99,235,0.07) 0%,transparent 65%)",
          pointerEvents: "none",
        }} />

        {/* Hero Text */}
        <div style={{ flex: 1, maxWidth: 560, position: "relative", zIndex: 1, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 12px", borderRadius: 20, background: "#DBEAFE",
            border: "1px solid rgba(37,99,235,0.20)",
            fontSize: 11, fontWeight: 700, color: "#2563EB",
            letterSpacing: "0.04em", textTransform: "uppercase" as const,
            marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
            FMCG Distribution Platform
          </div>
          <h1 style={{
            fontSize: "clamp(32px, 8vw, 56px)",
            fontWeight: 900, color: "#1E3A8A", letterSpacing: "-0.04em",
            lineHeight: 1.15, marginBottom: 18,
          }}>
            Manage your <span style={{ color: "#2563EB" }}>entire</span> distribution network, in one place.
          </h1>
          <p style={{
            fontSize: "clamp(15px, 4vw, 17px)",
            color: "#64748B", lineHeight: 1.6, fontWeight: 500,
            maxWidth: 460, margin: "0 auto 28px",
          }}>
            From routes and orders to collections and settlements — FMCGDist gives your team a single, powerful hub to run field operations with precision.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" as const }}>
            <Link to="/register" style={{
              padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 800,
              color: "#fff", textDecoration: "none",
              background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
              boxShadow: "0 4px 14px rgba(37,99,235,0.32)",
            }}>Start Free Trial →</Link>
            <a href="#features" style={{
              padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 800,
              color: "#1E3A8A", textDecoration: "none",
              border: "1.5px solid #E2E8F0", background: "transparent",
            }}>See Features</a>
          </div>
        </div>

        {/* Stats Card - Full width on mobile */}
        <div style={{ position: "relative", zIndex: 1, width: '100%', maxWidth: 380 }}>
          <div style={{
            background: "#fff", border: "1px solid #E2E8F0", borderRadius: 24,
            padding: 20, boxShadow: "0 20px 40px rgba(15,23,42,0.10)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #E2E8F0" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="16" height="16" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1E3A8A" }}>Today's Operations</div>
                <div style={{ fontSize: 10, color: "#64748B" }}>{loading ? "Fetching live data…" : "Live dashboard · Updated now"}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[
                { val: activeRoutes, lbl: "Active Routes" },
                { val: todayOrders, lbl: "Orders Today" },
                { val: collections, lbl: "Collections" },
                { val: customers, lbl: "Active Customers" },
              ].map(s => (
                <div key={s.lbl} style={{ padding: "10px 12px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: loading ? "#CBD5E1" : "#1E3A8A", letterSpacing: "-0.03em" }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, marginTop: 2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderRadius: 10,
              background: stats ? "#F0FDF4" : "#F8FAFC",
              border: `1px solid ${stats ? "rgba(22,163,74,0.18)" : "#E2E8F0"}`,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: loading ? "#CBD5E1" : stats ? "#16A34A" : "#94A3B8",
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: loading ? "#94A3B8" : stats ? "#15803D" : "#64748B" }}>
                {loading ? "Connecting to live data…" : stats ? "All systems operational · 0 route delays" : "Live data unavailable"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Bar - Scrollable on mobile ──────────────────────────────────── */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid #E2E8F0",
        background: "#fff", overflowX: "auto", WebkitOverflowScrolling: "touch",
        whiteSpace: "nowrap",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 24 }}>
          {[
            { icon: <TrustIcon1 />, label: "Real-time route tracking" },
            { icon: <TrustIcon2 />, label: "Role-based access control" },
            { icon: <TrustIcon3 />, label: "Daily settlement reports" },
            { icon: <TrustIcon4 />, label: "Mobile-first design" },
            { icon: <TrustIcon5 />, label: "Live ₹ collections tracking" },
          ].map((t, i) => (
            <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {i > 0 && <div style={{ width: 1, height: 24, background: "#E2E8F0", marginRight: 8 }} />}
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: "#EFF6FF", border: "1px solid rgba(37,99,235,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{t.icon}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1E3A8A" }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features - Responsive Grid ───────────────────────────────────────── */}
      <section id="features" style={{ padding: "60px 20px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 40, textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#EFF6FF", color: "#2563EB", padding: "4px 12px",
              borderRadius: 20, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.04em", textTransform: "uppercase" as const,
              marginBottom: 14,
            }}>✦ Features</div>
            <h2 style={{
              fontSize: "clamp(24px, 6vw, 42px)", fontWeight: 900,
              color: "#1E3A8A", letterSpacing: "-0.04em", lineHeight: 1.15,
              marginBottom: 12,
            }}>Everything your distribution team needs</h2>
            <p style={{ fontSize: "clamp(14px, 4vw, 17px)", color: "#64748B", fontWeight: 500, maxWidth: 540, margin: "0 auto" }}>
              Purpose-built tools for every part of the FMCG supply chain — from warehouse to final-mile delivery.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {[
              { bg: "#EFF6FF", title: "Route Management", icon: <FeatureIcon1 />, desc: "Assign and track delivery routes in real time. View progress, stops completed, and ETA for each salesman." },
              { bg: "#F0FDF4", title: "Order Processing", icon: <FeatureIcon2 />, desc: "Create, edit, and track field orders from any device. Full order lifecycle with history and audit trail." },
              { bg: "#FFF7ED", title: "Collections & Settlement", icon: <FeatureIcon3 />, desc: "Log cash, cheque, and UPI collections on the spot. Auto-reconcile daily settlements and flag outstanding dues." },
              { bg: "#FDF4FF", title: "Customer Catalog", icon: <FeatureIcon4 />, desc: "Maintain a live customer directory with credit limits, order history, and contact details by route." },
              { bg: "#EFF6FF", title: "Warehouse Dispatch", icon: <FeatureIcon5 />, desc: "Generate digital loading sheets, track packing status, and ensure accurate inventory dispatch daily." },
              { bg: "#F0FDF4", title: "Analytics & Reports", icon: <FeatureIcon6 />, desc: "Daily, weekly, and monthly performance reports. Track productivity, product-wise sales, and route efficiency." },
            ].map(f => (
              <div key={f.title} style={{
                background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16,
                padding: 20, transition: "all 0.22s", cursor: "default",
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px rgba(37,99,235,0.10)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.25)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0";
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: f.bg,
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
                }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1E3A8A", marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works - Stack on mobile ────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "60px 20px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 48, alignItems: "center", flexWrap: "wrap" as const }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#EFF6FF", color: "#2563EB", padding: "4px 12px",
              borderRadius: 20, fontSize: 11, fontWeight: 700,
              textTransform: "uppercase" as const, marginBottom: 16,
            }}>📦 Operations Hub</div>
            <h2 style={{
              fontSize: "clamp(22px, 5vw, 34px)", fontWeight: 900,
              color: "#1E3A8A", letterSpacing: "-0.04em", lineHeight: 1.2,
              marginBottom: 16,
            }}>Your entire field operation, <span style={{ color: "#2563EB" }}>visible in real time.</span></h2>
            <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, fontWeight: 500, marginBottom: 20 }}>
              Admins get a live bird's-eye view of every route, every salesman, and every order — all from a single dashboard.
            </p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {["Live route progress with stop-by-stop visibility", "Order status — pending, packed, dispatched, delivered", "Daily collection targets vs. actual — at a glance", "Incentive tracking tied to salesman performance"].map(pt => (
                <div key={pt} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 6,
                    background: "#DBEAFE", border: "1px solid rgba(37,99,235,0.20)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
                  }}>
                    <svg width="10" height="10" fill="none" stroke="#2563EB" strokeWidth="2.5" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  {pt}
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{
              background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 20,
              padding: 20, boxShadow: "0 8px 24px rgba(15,23,42,0.07)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1E3A8A" }}>Today's Route Performance</div>
                  <div style={{ fontSize: 10, color: "#64748B" }}>{stats ? `${stats.activeRoutes} active routes · today` : "Live data · Updated now"}</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#16A34A",
                  background: "#F0FDF4", padding: "3px 8px", borderRadius: 20,
                  border: "1px solid rgba(22,163,74,0.18)",
                }}>LIVE</span>
              </div>

              {loading ? (
                <div style={{ color: "#94A3B8", fontSize: 12, textAlign: "center" as const, padding: "20px 0" }}>Loading route data…</div>
              ) : routeBars && routeBars.length > 0 ? (
                routeBars.map((r, idx) => (
                  <div key={idx} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 180 }}>{r.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: r.color, flexShrink: 0, marginLeft: 8 }}>{r.pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${r.pct}%`, height: "100%", borderRadius: 3, background: r.color, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: "#94A3B8", fontSize: 12, textAlign: "center" as const, padding: "20px 0", fontStyle: "italic" }}>No route activity yet today</div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 16, borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
                {[
                  { n: stats ? String(stats.todayOrders) : "—", l: "Orders" },
                  { n: stats ? fmtCr(stats.todayRevenue) : "—", l: "Collected" },
                  { n: stats ? String(stats.activeCustomers) : "—", l: "Customers" },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: "center" as const }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#1E3A8A", letterSpacing: "-0.03em" }}>{s.n}</div>
                    <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Roles - Responsive Grid ──────────────────────────────────────────── */}
      <section id="roles" style={{ padding: "60px 20px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 40, textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#EFF6FF", color: "#2563EB", padding: "4px 12px",
              borderRadius: 20, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.04em", textTransform: "uppercase" as const,
              marginBottom: 14,
            }}>👥 Roles</div>
            <h2 style={{
              fontSize: "clamp(24px, 6vw, 42px)", fontWeight: 900,
              color: "#1E3A8A", letterSpacing: "-0.04em", lineHeight: 1.15,
              marginBottom: 12,
            }}>Built for every team member</h2>
            <p style={{ fontSize: "clamp(14px, 4vw, 17px)", color: "#64748B", fontWeight: 500, maxWidth: 540, margin: "0 auto" }}>
              Four role-based access levels, each with the right tools and permissions for the job.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}>
            {[
              { badge: "Admin", badgeBg: "#EFF6FF", badgeColor: "#1D4ED8", title: "Distribution Manager", desc: "Full platform access. Manage all users, routes, products, and business reports.", perms: ["All routes & assignments", "User management", "Analytics & reports", "Incentive configuration"] },
              { badge: "Salesman", badgeBg: "#F0FDF4", badgeColor: "#15803D", title: "Field Sales Executive", desc: "Mobile-first access to assigned routes, order entry, and collection recording.", perms: ["View assigned routes", "Create & submit orders", "Log collections", "Track incentives"] },
              { badge: "Accounts", badgeBg: "#FDF4FF", badgeColor: "#7E22CE", title: "Accounts Executive", desc: "Focused view on daily settlements, outstanding dues, and financial reports.", perms: ["Daily settlement", "Collection review", "Financial reports", "Dues management"] },
              { badge: "Warehouse", badgeBg: "#FFF7ED", badgeColor: "#C2410C", title: "Warehouse Operator", desc: "Manage loading sheets, packing status, and inventory dispatch for daily routes.", perms: ["Loading sheet view", "Pack & dispatch orders", "Inventory tracking", "Dispatch confirmation"] },
            ].map(r => (
              <div key={r.badge} style={{
                background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16,
                padding: 20, transition: "all 0.2s",
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.25)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(37,99,235,0.08)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#E2E8F0";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div style={{
                  display: "inline-flex", padding: "3px 8px", borderRadius: 20,
                  fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const,
                  marginBottom: 12, background: r.badgeBg, color: r.badgeColor,
                }}>{r.badge}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1E3A8A", marginBottom: 6 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6, marginBottom: 14 }}>{r.desc}</div>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                  {r.perms.map(p => (
                    <div key={p} style={{ fontSize: 11, color: "#334155", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "#16A34A", fontWeight: 900, fontSize: 10 }}>✓</span>{p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)",
        padding: "60px 20px", textAlign: "center" as const,
      }}>
        <h2 style={{
          fontSize: "clamp(24px, 6vw, 42px)", fontWeight: 900,
          color: "#fff", letterSpacing: "-0.04em", marginBottom: 14,
        }}>Ready to streamline your distribution?</h2>
        <p style={{ fontSize: "clamp(14px, 4vw, 17px)", color: "rgba(255,255,255,0.8)", fontWeight: 500, maxWidth: 500, margin: "0 auto 28px" }}>
          Join distribution teams already running their operations on FMCGDist.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" as const }}>
          <Link to="/register" style={{
            padding: "12px 28px", borderRadius: 12, fontSize: 14, fontWeight: 800,
            color: "#1E3A8A", textDecoration: "none", background: "#fff",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          }}>Get Started Free →</Link>
          <Link to="/login" style={{
            padding: "12px 28px", borderRadius: 12, fontSize: 14, fontWeight: 800,
            color: "#fff", textDecoration: "none",
            border: "2px solid rgba(255,255,255,0.35)", background: "transparent",
          }}>Sign In</Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#1E3A8A", color: "rgba(255,255,255,0.7)", padding: "40px 20px 28px" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 20,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap" as const, gap: 12, fontSize: 12,
        }}>
          <span style={{ fontWeight: 800, color: "#fff" }}>FMCG<span style={{ color: "#93C5FD" }}>Dist</span></span>
          <span>© {new Date().getFullYear()} FMCGDist · Built for India's FMCG distribution network</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/login" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Sign In</Link>
            <Link to="/register" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Register</Link>
          </div>
        </div>
      </footer>

      {/* ── PWA Install Prompt ───────────────────────────────────────────────── */}
      <PWAInstallPrompt variant="landing" autoShowDelay={4000} />

      {/* ── Mobile CSS overrides ─────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .hide-mobile {
            display: none !important;
          }
          .show-mobile {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .show-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Trust Bar Icons ──────────────────────────────────────────────────────────
const TrustIcon1 = () => <svg width="14" height="14" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
const TrustIcon2 = () => <svg width="14" height="14" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const TrustIcon3 = () => <svg width="14" height="14" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const TrustIcon4 = () => <svg width="14" height="14" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const TrustIcon5 = () => <svg width="14" height="14" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;

// ── Feature Icons ────────────────────────────────────────────────────────────
const FeatureIcon1 = () => <svg width="20" height="20" fill="none" stroke="#2563EB" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
const FeatureIcon2 = () => <svg width="20" height="20" fill="none" stroke="#16A34A" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>;
const FeatureIcon3 = () => <svg width="20" height="20" fill="none" stroke="#C2410C" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
const FeatureIcon4 = () => <svg width="20" height="20" fill="none" stroke="#7E22CE" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const FeatureIcon5 = () => <svg width="20" height="20" fill="none" stroke="#2563EB" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const FeatureIcon6 = () => <svg width="20" height="20" fill="none" stroke="#15803D" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;