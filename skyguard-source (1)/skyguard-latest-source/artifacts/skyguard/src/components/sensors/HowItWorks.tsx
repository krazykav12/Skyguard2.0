import { Wind, Cpu, Radio, MonitorSmartphone, Wrench, X } from 'lucide-react';

const STEPS = [
  { icon: Wrench, title: 'Mount to the frame', text: 'The sensing attachment is designed to mount to the drone frame or an existing payload rail through a lightweight bracket—not to the ESC. The exact mount depends on the aircraft.' },
  { icon: Wind, title: 'Air flows in', text: 'Air enters through an inlet placed away from rotor wash, heat and vibration, and reaches the sensor module inside the pod.' },
  { icon: Cpu, title: 'Sensors measure', text: 'Installed, calibrated modules (PM2.5, CO2 or a target gas) take the readings. A small controller stamps each one with a time, plus a position if your setup logs it.' },
  { icon: MonitorSmartphone, title: 'You view it here', text: 'Export the readings as CSV or JSON, import them on the Sensors tab, and explore or compare them in SkyGuard.' },
];

export function HowItWorks({ onClose, onGoSensors }: { onClose: () => void; onGoSensors: () => void }) {
  return (
    <section className="panel how-panel" id="how-aerotrace" data-testid="panel-how-aerotrace" aria-labelledby="how-title">
      <div className="how-head">
        <div><div className="eyebrow">How it works</div><h2 id="how-title" className="how-title">How AeroTrace connects to the drone</h2>
          <p>AeroTrace is the drone-mounted sensing attachment—the PCV attachment that collects air measurements. The hardware senses the air; SkyGuard helps you view and understand the readings.</p></div>
        <button className="btn-soft" onClick={onClose} data-testid="button-close-how" aria-label="Close explanation"><X size={14} />Close</button>
      </div>
      <ol className="how-steps">{STEPS.map((s, i) => <li key={s.title}><span className="how-icon"><s.icon size={18} /></span><b>{i + 1}. {s.title}</b><p>{s.text}</p></li>)}</ol>
      <div className="how-split">
        <div className="how-card concept"><Radio size={15} /><div><strong>Hardware concept</strong><p>Fasteners, connector, voltage and communication method are not specified. They depend on your drone and sensor package. A sensor only produces values once it is installed and calibrated. This overview is not CAD or an assembly guide.</p></div></div>
        <div className="how-card now"><MonitorSmartphone size={15} /><div><strong>What SkyGuard does today</strong><p>Shows real public ground-station data and lets you import your own flight records. No aircraft is connected live and nothing is dispatched. Imported records stay unverified.</p></div></div>
      </div>
      <div className="mission-controls"><button className="btn-primary" onClick={onGoSensors} data-testid="button-how-to-sensors">See the pod sketch and import records</button></div>
    </section>
  );
}
