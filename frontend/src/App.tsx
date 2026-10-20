import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Fingerprint, Globe2, LayoutDashboard,
  Monitor, RefreshCw, Search, Shield, ShieldAlert, ShieldCheck, SlidersHorizontal,
  Smartphone, UserRound, Users, X,
} from 'lucide-react'

type Status = 'Open' | 'Investigating' | 'Resolved'
type EventItem = {
  id: number; account: string; event_type: string; timestamp: string; source: string;
  device: string; failed_attempts: number; new_device: boolean; unusual_hour: boolean;
  impossible_travel: boolean; privileged_account: boolean; status: Status; demo: boolean;
  risk_score: number; severity: string; evidence: string[]
}
type Summary = { accounts_monitored: number; events_analyzed: number; high_risk_accounts: number; open_alerts: number; resolved: number; average_risk: number }

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const demoEvents: EventItem[] = [
  { id: 1, account: 'a.chen@example.test', event_type: 'Login attempt', timestamp: '2026-10-20T08:42:00Z', source: '198.51.100.24', device: 'Chrome · Windows', failed_attempts: 12, new_device: true, unusual_hour: false, impossible_travel: false, privileged_account: true, status: 'Open', demo: true, risk_score: 63, severity: 'High', evidence: ['High volume of failed attempts (12)', 'Device has not been seen for this account', 'Account is marked as privileged'] },
  { id: 2, account: 'm.patel@example.test', event_type: 'Successful login', timestamp: '2026-10-20T08:15:00Z', source: '203.0.113.17', device: 'Safari · macOS', failed_attempts: 1, new_device: true, unusual_hour: true, impossible_travel: false, privileged_account: false, status: 'Investigating', demo: true, risk_score: 30, severity: 'Low', evidence: ['Device has not been seen for this account', 'Login occurred outside the account usual hours'] },
  { id: 3, account: 's.lee@example.test', event_type: 'Login attempt', timestamp: '2026-10-20T07:58:00Z', source: '192.0.2.43', device: 'Firefox · Linux', failed_attempts: 6, new_device: false, unusual_hour: false, impossible_travel: false, privileged_account: false, status: 'Open', demo: true, risk_score: 22, severity: 'Low', evidence: ['Repeated failed attempts (6)'] },
  { id: 4, account: 'j.morgan@example.test', event_type: 'Successful login', timestamp: '2026-10-20T07:20:00Z', source: '198.51.100.77', device: 'Edge · Windows', failed_attempts: 0, new_device: false, unusual_hour: false, impossible_travel: true, privileged_account: false, status: 'Open', demo: true, risk_score: 35, severity: 'Medium', evidence: ['Simulated impossible-travel signal detected'] },
  { id: 5, account: 'r.khan@example.test', event_type: 'Successful login', timestamp: '2026-10-20T06:51:00Z', source: '203.0.113.82', device: 'Chrome · Android', failed_attempts: 0, new_device: false, unusual_hour: false, impossible_travel: false, privileged_account: false, status: 'Resolved', demo: true, risk_score: 0, severity: 'Low', evidence: [] },
]
const fallbackSummary: Summary = { accounts_monitored: 5, events_analyzed: 5, high_risk_accounts: 1, open_alerts: 3, resolved: 1, average_risk: 30 }

function timeLabel(value: string) {
  return new Date(value).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function riskClass(score: number) { return score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low' }

export default function App() {
  const [events, setEvents] = useState<EventItem[]>(demoEvents)
  const [summary, setSummary] = useState<Summary>(fallbackSummary)
  const [connected, setConnected] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('Showing synthetic demo events. Connect the API to load persisted investigation data.')

  async function loadData() {
    setBusy(true)
    try {
      const [eventsRes, summaryRes] = await Promise.all([fetch(`${API}/api/events`), fetch(`${API}/api/summary`)])
      if (!eventsRes.ok || !summaryRes.ok) throw new Error('API unavailable')
      const eventsData = await eventsRes.json()
      setEvents(eventsData.items)
      setSummary(await summaryRes.json())
      setConnected(true)
      setNotice('Connected to AccountRisk API · synthetic demo data only.')
    } catch {
      setConnected(false)
      setEvents(demoEvents)
      setSummary(fallbackSummary)
      setNotice('API unavailable — showing synthetic demo data, not live identity-provider events.')
    } finally { setBusy(false) }
  }
  useEffect(() => { void loadData() }, [])

  const visible = useMemo(() => events.filter(e => {
    const matchesQuery = `${e.account} ${e.device} ${e.source} ${e.event_type}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (statusFilter === 'All' || e.status === statusFilter)
  }).sort((a, b) => b.risk_score - a.risk_score), [events, query, statusFilter])

  async function updateStatus(item: EventItem, status: Status) {
    if (connected) {
      try {
        const response = await fetch(`${API}/api/alerts/${item.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
        if (!response.ok) throw new Error('Could not update status')
      } catch {
        setNotice('Status update failed. Check that the backend is running.')
        return
      }
    }
    const updated = { ...item, status }
    setEvents(current => current.map(e => e.id === item.id ? updated : e))
    setSelected(updated)
    setSummary(current => ({ ...current, resolved: events.filter(e => e.status === 'Resolved').length + (status === 'Resolved' && item.status !== 'Resolved' ? 1 : status !== 'Resolved' && item.status === 'Resolved' ? -1 : 0) }))
    setNotice(connected ? 'Investigation status saved to the API.' : 'Demo status updated in this browser session only.')
  }

  const average = events.length ? Math.round(events.reduce((sum, item) => sum + item.risk_score, 0) / events.length) : 0

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Shield size={22}/></div><div><strong>ACCOUNT<span>RISK</span></strong><small>IDENTITY OPERATIONS</small></div></div>
      <div className="workspace-pill"><span className="live-dot"/> SECURITY WORKSPACE</div>
      <nav>
        <a className="nav-item active"><LayoutDashboard size={18}/> Overview</a>
        <a className="nav-item" onClick={() => document.getElementById('accounts')?.scrollIntoView({ behavior: 'smooth' })}><Users size={18}/> Accounts</a>
        <a className="nav-item" onClick={() => document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' })}><Activity size={18}/> Authentication events</a>
        <a className="nav-item" onClick={() => setStatusFilter('Open')}><Bell size={18}/> Open alerts <span className="nav-count">{events.filter(e => e.status === 'Open').length}</span></a>
      </nav>
      <div className="sidebar-bottom"><div className="avatar">AR</div><div><strong>Security Team</strong><small>Local workspace</small></div><CircleHelp size={16} className="help"/></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><div className="eyebrow">IDENTITY SECURITY / OVERVIEW</div><h1>Account risk command center</h1><p>Turn authentication signals into explainable security decisions.</p></div><div className="top-actions"><span className="demo-badge"><span className="live-dot"/> {connected ? 'API CONNECTED' : 'DEMO MODE'}</span><button className="refresh-btn" onClick={() => void loadData()} disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''}/> Refresh</button></div></header>
      <div className="notice"><ShieldAlert size={17}/><span>{notice}</span><span className="notice-demo">SYNTHETIC DATA</span></div>

      <section className="metrics">
        <Metric icon={<Users size={18}/>} label="Accounts monitored" value={summary.accounts_monitored} hint="Unique demo identities"/>
        <Metric icon={<Activity size={18}/>} label="Events analyzed" value={summary.events_analyzed} hint="Authentication signals"/>
        <Metric icon={<ShieldAlert size={18}/>} label="High-risk accounts" value={summary.high_risk_accounts} hint="Risk score ≥ 60"/>
        <Metric icon={<CheckCircle2 size={18}/>} label="Resolved alerts" value={summary.resolved} hint="Closed investigations"/>
      </section>

      <div className="content-grid">
        <section className="panel events-panel" id="events">
          <div className="panel-heading"><div><h2>Authentication risk queue</h2><p>Prioritized by explainable account risk score</p></div><span className="count-badge">{visible.length} EVENTS</span></div>
          <div className="filters"><label className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search account, device, source..."/></label><label className="select-wrap"><SlidersHorizontal size={14}/><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All</option><option>Open</option><option>Investigating</option><option>Resolved</option></select><ChevronDown size={14}/></label></div>
          <div className="table-scroll"><table><thead><tr><th>ACCOUNT / EVENT</th><th>DEVICE / SOURCE</th><th>RISK</th><th>STATUS</th><th></th></tr></thead><tbody>{visible.map(item => <tr key={item.id} onClick={() => setSelected(item)} className="clickable-row"><td><div className="account-cell"><span className="account-avatar"><UserRound size={16}/></span><div><strong>{item.account}</strong><small>{item.event_type} · {timeLabel(item.timestamp)}</small></div></div></td><td><div className="device-cell"><strong>{item.device}</strong><small>{item.source}</small></div></td><td><div className="risk-cell"><strong>{item.risk_score}</strong><div className="risk-track"><span className={riskClass(item.risk_score)} style={{ width: `${item.risk_score}%` }}/></div><small>{item.severity}</small></div></td><td><StatusPill status={item.status}/></td><td><button className="icon-button" aria-label="View event" onClick={e => { e.stopPropagation(); setSelected(item) }}>↗</button></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state">No events match these filters.</div>}</div>
          <div className="table-footer"><span>Showing {visible.length} of {events.length} synthetic events</span><span><span className="live-dot"/> Rule-based detection</span></div>
        </section>

        <div className="right-column">
          <section className="panel posture-panel">
            <div className="panel-heading"><div><h2>Account risk posture</h2><p>Average prioritized risk score</p></div><Activity size={20}/></div>
            <div className="posture-score">{average}<small>/100</small></div><div className="posture-track"><span style={{ width: `${average}%` }}/></div>
            <div className="legend"><span><i className="critical-dot"/> Critical ≥ 80</span><span><i className="high-dot"/> High ≥ 60</span><span><i className="medium-dot"/> Medium ≥ 35</span><span><i className="low-dot"/> Low &lt; 35</span></div>
            <div className="panel-footnote">Heuristic score · Not proof of compromise</div>
          </section>
          <section className="panel signal-panel">
            <div className="panel-heading"><div><h2>Detection signals</h2><p>What the rules look for</p></div><Fingerprint size={20}/></div>
            <Signal icon={<AlertTriangle size={17}/>} title="Repeated failures" detail="Burst of unsuccessful logins" count={events.filter(e => e.failed_attempts >= 5).length}/>
            <Signal icon={<Monitor size={17}/>} title="New device" detail="Previously unseen device" count={events.filter(e => e.new_device).length}/>
            <Signal icon={<Globe2 size={17}/>} title="Impossible travel" detail="Simulated location anomaly" count={events.filter(e => e.impossible_travel).length}/>
            <Signal icon={<Clock3 size={17}/>} title="Unusual login hour" detail="Outside usual activity window" count={events.filter(e => e.unusual_hour).length}/>
          </section>
          <section className="panel workflow-panel"><div className="panel-heading"><div><h2>Investigation workflow</h2><p>Move alerts through triage</p></div><CheckCircle2 size={19}/></div><div className="workflow"><span className="workflow-open">Open</span><span>→</span><span className="workflow-investigating">Investigating</span><span>→</span><span className="workflow-resolved">Resolved</span></div></section>
        </div>
      </div>

      <section className="account-strip" id="accounts"><div className="strip-heading"><div><h2>Account overview</h2><p>Highest event risk per synthetic account</p></div><span className="count-badge">{new Set(events.map(e => e.account)).size} ACCOUNTS</span></div><div className="account-cards">{[...new Set(events.map(e => e.account))].map(account => { const row = events.filter(e => e.account === account).sort((a,b) => b.risk_score-a.risk_score)[0]; return <button className="account-card" key={account} onClick={() => setSelected(row)}><div className="account-card-top"><span className="account-avatar"><UserRound size={17}/></span><span className={`severity-text ${riskClass(row.risk_score)}`}>{row.severity}</span></div><strong>{account}</strong><div className="account-card-bottom"><span>Risk score</span><b>{row.risk_score}/100</b></div><div className="risk-track"><span className={riskClass(row.risk_score)} style={{ width: `${row.risk_score}%` }}/></div></button> })}</div></section>

      <footer className="footer"><div className="footer-brand"><Shield size={18}/><strong>AccountRisk</strong><span>Identity & account risk engine</span></div><div className="footer-stack"><span>PYTHON</span><span>FASTAPI</span><span>REACT</span><span>TYPESCRIPT</span><span>SQLITE</span></div><span className="footer-motto">BUILD SECURE. REPEAT.</span></footer>
    </main>

    {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="detail-drawer" onClick={e => e.stopPropagation()}><div className="drawer-header"><div><div className="eyebrow">EVENT INVESTIGATION</div><h2>Account activity</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={18}/></button></div><div className="drawer-account"><div className="account-avatar large"><UserRound size={22}/></div><div><strong>{selected.account}</strong><small>{selected.event_type}</small></div></div><div className="drawer-risk"><div><span>Risk score</span><strong>{selected.risk_score}<small>/100</small></strong></div><StatusPill status={selected.status}/></div><div className="drawer-section"><h3>Event details</h3><Detail label="Timestamp" value={timeLabel(selected.timestamp)}/><Detail label="Source address" value={selected.source}/><Detail label="Device" value={selected.device}/><Detail label="Failed attempts" value={String(selected.failed_attempts)}/></div><div className="drawer-section"><h3>Detection evidence</h3>{selected.evidence.length ? selected.evidence.map((e, i) => <div className="evidence-row" key={i}><AlertTriangle size={15}/>{e}</div>) : <p className="muted">No risk signals matched this event.</p>}</div><div className="drawer-section"><h3>Investigation status</h3><div className="status-actions">{(['Open','Investigating','Resolved'] as Status[]).map(s => <button key={s} className={selected.status === s ? 'status-action selected' : 'status-action'} onClick={() => void updateStatus(selected, s)}>{s}</button>)}</div><p className="muted small-note">{connected ? 'Changes are saved to the local API database.' : 'Demo changes remain in this browser session only.'}</p></div><div className="drawer-warning"><ShieldCheck size={17}/><span>Risk scores are heuristic signals for investigation, not a verdict that an account is compromised.</span></div></aside></div>}
  </div>
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return <article className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-hint">{hint}</span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div></article>
}
function StatusPill({ status }: { status: Status }) { return <span className={`status-pill status-${status.toLowerCase()}`}>{status}</span> }
function Signal({ icon, title, detail, count }: { icon: React.ReactNode; title: string; detail: string; count: number }) { return <div className="signal-row"><span className="signal-icon">{icon}</span><div className="signal-copy"><strong>{title}</strong><small>{detail}</small></div><span className="signal-count">{count}</span></div> }
function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div> }
