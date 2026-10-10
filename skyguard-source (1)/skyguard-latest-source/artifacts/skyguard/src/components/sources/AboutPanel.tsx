import { SiGmail } from 'react-icons/si';

const EMAILS = ['misoyete@gmail.com', 'calvincheng54@gmail.com', 'mialin10111688@gmail.com', 'ronit.aphale@gmail.com'];

export function AboutPanel() {
  return (
    <section className="panel about-panel" id="about-skyguard" data-testid="panel-about" aria-labelledby="about-title">
      <div className="panel-heading"><div><h2 id="about-title" className="panel-title">About SkyGuard</h2></div></div>
      <div className="about-body">
        <p>SkyGuard is a way for curious teens and adults to explore the air around them. It shows real public measurements from nearby ground stations, lets you sketch where a drone could look next, and lets you compare flight records you bring yourself.</p>
        <p>Measured public data, drone proposals and your own imports are kept apart on purpose. A proposal is not a measurement, an import is not independently verified, and a handful of stations is not a finished picture of the air.</p>
        <div className="contact-block">
          <h3>Contact</h3>
          <ul className="contact-list">
            {EMAILS.map(e => (
              <li key={e}><a href={`mailto:${e}`} aria-label={`Email ${e}`} data-testid={`contact-email-${e}`}><SiGmail size={20} aria-hidden="true" focusable="false" /><span>{e}</span></a></li>))}
          </ul>
          <p className="contact-note">Selecting an address opens your own email app. Nothing is sent from this site.</p>
        </div>
      </div>
    </section>
  );
}
