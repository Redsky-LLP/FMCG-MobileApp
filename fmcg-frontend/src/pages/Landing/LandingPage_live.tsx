// PATH: src/pages/Landing/LandingPage.tsx
// UPDATED: Fetches real stats from GET /api/v1/analytics/public-stats
//          That endpoint is [AllowAnonymous] — no token needed.
//          Shows "—" gracefully while loading or if API is unreachable.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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
  const [stats,   setStats]   = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/analytics/public-stats")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeRoutes = stats ? String(stats.activeRoutes)  : "—";
  const todayOrders  = stats ? String(stats.todayOrders)   : "—";
  const collections  = stats ? fmtCr(stats.todayRevenue)   : "—";
  const customers    = stats ? String(stats.activeCustomers): "—";

  const maxRev = stats?.routes?.length ? Math.max(...stats.routes.map(r => r.revenue), 1) : 1;
  const routeBars = stats?.routes?.length
    ? stats.routes.map((r, i) => ({
        label: r.routeName,
        pct:   Math.round((r.revenue / maxRev) * 100),
        color: ["#2563EB","#16A34A","#D97706","#2563EB"][i % 4],
      }))
    : null;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif", background: "#fff", color: "#334155", overflowX: "hidden" }}>

      {/* Navbar */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 48px", height: 68, gap: 40 }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(37,99,235,0.25)" }}>
            <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#1E3A8A", letterSpacing: "-0.04em" }}>FMCG<span style={{ color: "#2563EB" }}>Dist</span></span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          {["#features","#how-it-works","#roles"].map((href, i) => (
            <a key={href} href={href} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#64748B", textDecoration: "none", transition: "all 0.14s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#2563EB"; (e.currentTarget as HTMLElement).style.background="#EFF6FF"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color="#64748B"; (e.currentTarget as HTMLElement).style.background="transparent"; }}
            >{["Features","How It Works","Roles"][i]}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <Link to="/login" style={{ padding: "8px 18px", borderRadius: 9, fontSize: 14, fontWeight: 700, color: "#1E3A8A", border: "1px solid #E2E8F0", background: "transparent", textDecoration: "none" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="#EFF6FF"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="transparent"; }}
          >Sign In</Link>
          <Link to="/register" style={{ padding: "8px 20px", borderRadius: 9, fontSize: 14, fontWeight: 700, color: "#fff", border: "none", textDecoration: "none", background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)", boxShadow: "0 3px 10px rgba(37,99,235,0.28)" }}>Get Started →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: 600, background: "linear-gradient(135deg,#F8FAFC 0%,#EFF6FF 60%,#E0F2FE 100%)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 48px 60px", gap: 64, flexWrap: "wrap" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(37,99,235,0.07) 0%,transparent 65%)", pointerEvents: "none" }} />

        <div style={{ flex: 1, maxWidth: 560, position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 20, background: "#DBEAFE", border: "1px solid rgba(37,99,235,0.20)", fontSize: 12, fontWeight: 700, color: "#2563EB", letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: 22 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
            FMCG Distribution Platform
          </div>
          <h1 style={{ fontSize: "clamp(34px,5vw,56px)", fontWeight: 900, color: "#1E3A8A", letterSpacing: "-0.04em", lineHeight: 1.06, marginBottom: 22 }}>
            Manage your <span style={{ color: "#2563EB" }}>entire</span> distribution network, in one place.
          </h1>
          <p style={{ fontSize: 17, color: "#64748B", lineHeight: 1.65, fontWeight: 500, maxWidth: 460, marginBottom: 36 }}>
            From routes and orders to collections and settlements — FMCGDist gives your team a single, powerful hub to run field operations with precision.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" as const }}>
            <Link to="/register" style={{ padding: "14px 30px", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "#fff", textDecoration: "none", background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)", boxShadow: "0 6px 22px rgba(37,99,235,0.32)" }}>Start Free Trial →</Link>
            <a href="#features" style={{ padding: "14px 28px", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "#1E3A8A", textDecoration: "none", border: "1.5px solid #E2E8F0", background: "transparent" }}>See Features</a>
          </div>
        </div>

        {/* Live stats card */}
        <div style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 24, padding: 24, boxShadow: "0 20px 60px rgba(15,23,42,0.10)", width: 340 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1E3A8A" }}>Today's Operations</div>
                <div style={{ fontSize: 11, color: "#64748B" }}>{loading ? "Fetching live data…" : "Live dashboard · Updated now"}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[
                { val: activeRoutes, lbl: "Active Routes" },
                { val: todayOrders,  lbl: "Orders Today" },
                { val: collections,  lbl: "Collections" },
                { val: customers,    lbl: "Active Customers" },
              ].map(s => (
                <div key={s.lbl} style={{ padding: "12px 14px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: loading ? "#CBD5E1" : "#1E3A8A", letterSpacing: "-0.03em" }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginTop: 2 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: stats ? "#F0FDF4" : "#F8FAFC", border: `1px solid ${stats ? "rgba(22,163,74,0.18)" : "#E2E8F0"}` }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? "#CBD5E1" : stats ? "#16A34A" : "#94A3B8" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: loading ? "#94A3B8" : stats ? "#15803D" : "#64748B" }}>
                {loading ? "Connecting to live data…" : stats ? "All systems operational · 0 route delays" : "Live data unavailable"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <div style={{ padding: "20px 48px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap" as const, background: "#fff" }}>
        {[
          { icon: <svg width="16" height="16" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>, label: "Real-time route tracking" },
          { icon: <svg width="16" height="16" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, label: "Role-based access control" },
          { icon: <svg width="16" height="16" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: "Daily settlement reports" },
          { icon: <svg width="16" height="16" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>, label: "Mobile-first design" },
          { icon: <svg width="16" height="16" fill="none" stroke="#2563EB" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>, label: "Live ₹ collections tracking" },
        ].map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {i > 0 && <div style={{ width: 1, height: 24, background: "#E2E8F0", marginRight: 30 }} />}
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#EFF6FF", border: "1px solid rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>{t.icon}</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1E3A8A" }}>{t.label}</span>
          </div>
        ))}
      </div>

      {/* Features */}
      <section id="features" style={{ padding: "80px 48px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EFF6FF", color: "#2563EB", padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: 16 }}>✦ Features</div>
            <h2 style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 900, color: "#1E3A8A", letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 14 }}>Everything your distribution team needs</h2>
            <p style={{ fontSize: 17, color: "#64748B", fontWeight: 500, lineHeight: 1.6, maxWidth: 540 }}>Purpose-built tools for every part of the FMCG supply chain — from warehouse to final-mile delivery.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {[
              { bg: "#EFF6FF", title: "Route Management",        icon: <svg width="24" height="24" fill="none" stroke="#2563EB" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>, desc: "Assign and track delivery routes in real time. View progress, stops completed, and ETA for each salesman." },
              { bg: "#F0FDF4", title: "Order Processing",         icon: <svg width="24" height="24" fill="none" stroke="#16A34A" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>, desc: "Create, edit, and track field orders from any device. Full order lifecycle with history and audit trail." },
              { bg: "#FFF7ED", title: "Collections & Settlement", icon: <svg width="24" height="24" fill="none" stroke="#C2410C" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>, desc: "Log cash, cheque, and UPI collections on the spot. Auto-reconcile daily settlements and flag outstanding dues." },
              { bg: "#FDF4FF", title: "Customer Catalog",         icon: <svg width="24" height="24" fill="none" stroke="#7E22CE" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, desc: "Maintain a live customer directory with credit limits, order history, and contact details by route." },
              { bg: "#EFF6FF", title: "Warehouse Dispatch",       icon: <svg width="24" height="24" fill="none" stroke="#2563EB" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>, desc: "Generate digital loading sheets, track packing status, and ensure accurate inventory dispatch daily." },
              { bg: "#F0FDF4", title: "Analytics & Reports",      icon: <svg width="24" height="24" fill="none" stroke="#15803D" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, desc: "Daily, weekly, and monthly performance reports. Track productivity, product-wise sales, and route efficiency." },
            ].map(f => (
              <div key={f.title} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 28, transition: "all 0.22s", cursor: "default" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform="translateY(-4px)"; (e.currentTarget as HTMLElement).style.boxShadow="0 12px 40px rgba(37,99,235,0.10)"; (e.currentTarget as HTMLElement).style.borderColor="rgba(37,99,235,0.25)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform="translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow="none"; (e.currentTarget as HTMLElement).style.borderColor="#E2E8F0"; }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E3A8A", marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - LIVE route bars */}
      <section id="how-it-works" style={{ padding: "80px 48px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 80, alignItems: "center", flexWrap: "wrap" as const }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EFF6FF", color: "#2563EB", padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 16 }}>📦 Operations Hub</div>
            <h2 style={{ fontSize: "clamp(22px,2.8vw,34px)", fontWeight: 900, color: "#1E3A8A", letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: 16 }}>Your entire field operation, <span style={{ color: "#2563EB" }}>visible in real time.</span></h2>
            <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, fontWeight: 500, maxWidth: 440, marginBottom: 24 }}>Admins get a live bird's-eye view of every route, every salesman, and every order — all from a single dashboard.</p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {["Live route progress with stop-by-stop visibility","Order status — pending, packed, dispatched, delivered","Daily collection targets vs. actual — at a glance","Incentive tracking tied to salesman performance"].map(pt => (
                <div key={pt} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, fontWeight: 600, color: "#334155" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: "#DBEAFE", border: "1px solid rgba(37,99,235,0.20)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <svg width="11" height="11" fill="none" stroke="#2563EB" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  {pt}
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 24, padding: 28, boxShadow: "0 8px 32px rgba(15,23,42,0.07)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1E3A8A" }}>Today's Route Performance</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{stats ? `${stats.activeRoutes} active routes · today` : "Live data · Updated now"}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", background: "#F0FDF4", padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(22,163,74,0.18)" }}>LIVE</span>
              </div>

              {loading ? (
                <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center" as const, padding: "20px 0" }}>Loading route data…</div>
              ) : routeBars && routeBars.length > 0 ? (
                routeBars.map((r, idx) => (
                  <div key={idx} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 200 }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: r.color, flexShrink: 0, marginLeft: 8 }}>{r.pct}%</span>
                    </div>
                    <div style={{ height: 8, background: "#E2E8F0", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${r.pct}%`, height: "100%", borderRadius: 4, background: r.color, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center" as const, padding: "20px 0", fontStyle: "italic" }}>No route activity yet today</div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 18, borderTop: "1px solid #E2E8F0", paddingTop: 18 }}>
                {[
                  { n: stats ? String(stats.todayOrders) : "—",       l: "Orders" },
                  { n: stats ? fmtCr(stats.todayRevenue) : "—",        l: "Collected" },
                  { n: stats ? String(stats.activeCustomers) : "—",    l: "Customers" },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: "center" as const }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1E3A8A", letterSpacing: "-0.03em" }}>{s.n}</div>
                    <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" style={{ padding: "80px 48px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 56 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EFF6FF", color: "#2563EB", padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const, marginBottom: 16 }}>👥 Roles</div>
            <h2 style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 900, color: "#1E3A8A", letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 14 }}>Built for every team member</h2>
            <p style={{ fontSize: 17, color: "#64748B", fontWeight: 500, lineHeight: 1.6, maxWidth: 540 }}>Four role-based access levels, each with the right tools and permissions for the job.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {[
              { badge: "Admin",     badgeBg: "#EFF6FF", badgeColor: "#1D4ED8", title: "Distribution Manager", desc: "Full platform access. Manage all users, routes, products, and business reports.",         perms: ["All routes & assignments","User management","Analytics & reports","Incentive configuration"] },
              { badge: "Salesman",  badgeBg: "#F0FDF4", badgeColor: "#15803D", title: "Field Sales Executive", desc: "Mobile-first access to assigned routes, order entry, and collection recording.",            perms: ["View assigned routes","Create & submit orders","Log collections","Track incentives"] },
              { badge: "Accounts",  badgeBg: "#FDF4FF", badgeColor: "#7E22CE", title: "Accounts Executive",   desc: "Focused view on daily settlements, outstanding dues, and financial reports.",              perms: ["Daily settlement","Collection review","Financial reports","Dues management"] },
              { badge: "Warehouse", badgeBg: "#FFF7ED", badgeColor: "#C2410C", title: "Warehouse Operator",   desc: "Manage loading sheets, packing status, and inventory dispatch for daily routes.",           perms: ["Loading sheet view","Pack & dispatch orders","Inventory tracking","Dispatch confirmation"] },
            ].map(r => (
              <div key={r.badge} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 18, padding: 24, transition: "all 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform="translateY(-3px)"; (e.currentTarget as HTMLElement).style.borderColor="rgba(37,99,235,0.25)"; (e.currentTarget as HTMLElement).style.boxShadow="0 8px 28px rgba(37,99,235,0.09)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform="translateY(0)"; (e.currentTarget as HTMLElement).style.borderColor="#E2E8F0"; (e.currentTarget as HTMLElement).style.boxShadow="none"; }}
              >
                <div style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: "uppercase" as const, marginBottom: 14, background: r.badgeBg, color: r.badgeColor }}>{r.badge}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1E3A8A", marginBottom: 8 }}>{r.title}</div>
                <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 16 }}>{r.desc}</div>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 7 }}>
                  {r.perms.map(p => (
                    <div key={p} style={{ fontSize: 12, color: "#334155", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ color: "#16A34A", fontWeight: 900, fontSize: 11 }}>✓</span>{p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "linear-gradient(135deg,#1E3A8A 0%,#2563EB 100%)", padding: "80px 48px", textAlign: "center" as const }}>
        <h2 style={{ fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", marginBottom: 16 }}>Ready to streamline your distribution?</h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.75)", fontWeight: 500, maxWidth: 500, margin: "0 auto 36px" }}>Join distribution teams already running their operations on FMCGDist.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
          <Link to="/register" style={{ padding: "14px 32px", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "#1E3A8A", textDecoration: "none", background: "#fff", boxShadow: "0 6px 22px rgba(0,0,0,0.15)" }}>Get Started Free →</Link>
          <Link to="/login"    style={{ padding: "14px 32px", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "#fff", textDecoration: "none", border: "2px solid rgba(255,255,255,0.35)", background: "transparent" }}>Sign In</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "#1E3A8A", color: "rgba(255,255,255,0.7)", padding: "48px 48px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, flexWrap: "wrap" as const, gap: 10 }}>
          <span style={{ fontWeight: 800, color: "#fff" }}>FMCG<span style={{ color: "#93C5FD" }}>Dist</span></span>
          <span>© {new Date().getFullYear()} FMCGDist · Built for India's FMCG distribution network</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link to="/login"    style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Sign In</Link>
            <Link to="/register" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Register</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}