import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const services = [
  { name: 'BunkerWeb', role: 'Edge protection', state: 'Running', detail: 'HTTP :80', color: 'teal' },
  { name: 'CrowdSec', role: 'Threat intelligence', state: 'Watching', detail: 'Local API :8080', color: 'coral' },
  { name: 'Assembly UI', role: 'Application surface', state: 'Running', detail: 'React / Vite', color: 'ink' },
];

function App() {
  const [active, setActive] = useState('Overview');
  const [armed, setArmed] = useState(true);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="mark"><span>AS</span><b>assembly</b></div>
        <p className="eyebrow">Local command center</p>
        <nav aria-label="Main navigation">
          {['Overview', 'Services', 'Traffic', 'Settings'].map((item) => (
            <button className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)} key={item}>
              <span className="nav-dot" />{item}
            </button>
          ))}
        </nav>
        <div className="side-note">
          <span className="pulse" />
          <div><strong>Local environment</strong><small>Docker network healthy</small></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar"><div><span className="breadcrumb">WORKSPACE / {active.toUpperCase()}</span><h1>{active === 'Overview' ? 'Everything in place.' : active}</h1></div><button className="avatar">BS</button></header>
        <div className="hero-row">
          <div><p className="kicker">ASSEMBLY STATUS <span className="live">LIVE</span></p><p className="hero-copy">One clear view of your app, its perimeter, and the signals keeping it steady.</p></div>
          <div className="uptime"><span>UPTIME</span><strong>99.98%</strong><small>last 30 days</small></div>
        </div>

        <section className="stats" aria-label="System statistics">
          <article><span>REQUESTS TODAY</span><strong>12,480</strong><small className="positive">+18.4%</small></article>
          <article><span>THREATS BLOCKED</span><strong>37</strong><small className="negative">+6 since 09:00</small></article>
          <article><span>RESPONSE TIME</span><strong>84ms</strong><small className="positive">-12ms vs yesterday</small></article>
        </section>

        <div className="section-head"><div><p className="kicker">THE STACK</p><h2>Protection layers</h2></div><button className={armed ? 'arm-button armed' : 'arm-button'} onClick={() => setArmed(!armed)}><span className="toggle" />{armed ? 'Protection armed' : 'Protection paused'}</button></div>
        <section className="services">{services.map((service, index) => <article className="service" key={service.name}><div className={`service-icon ${service.color}`}>{String(index + 1).padStart(2, '0')}</div><div className="service-info"><h3>{service.name}</h3><p>{service.role}</p></div><div className="service-state"><span className={`state-dot ${service.color}`} />{service.state}<small>{service.detail}</small></div><span className="arrow">↗</span></article>)}</section>

        <section className="bottom-grid"><article className="activity"><div className="section-head compact"><div><p className="kicker">RECENT SIGNALS</p><h2>Quietly doing its job</h2></div><button className="text-button">View log ↗</button></div><div className="signal"><span className="signal-mark coral">!</span><div><strong>Suspicious request blocked</strong><small>SQLi pattern · 2 minutes ago</small></div><b>403</b></div><div className="signal"><span className="signal-mark teal">✓</span><div><strong>Application health check</strong><small>Assembly UI · 8 minutes ago</small></div><b className="ok">200</b></div></article><article className="brief"><p className="kicker">TODAY'S BRIEF</p><div className="brief-number">04</div><p>security events reviewed</p><div className="bar"><i /></div><small>All systems are operating within their normal range.</small></article></section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
