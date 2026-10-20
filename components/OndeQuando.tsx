import { ADDRESS, OPENING_HOURS } from '@/data/schedule';

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS.mapsQuery)}`;
const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(ADDRESS.mapsQuery)}&z=16&output=embed`;

export default function OndeQuando() {
  return (
    <section id="onde" className="onde" aria-labelledby="onde-title">
      <div className="container">
        <h2 id="onde-title" className="display display--section" style={{ '--fit': 13 } as React.CSSProperties} data-reveal>
          <span className="line">Nilo Peçanha,</span>
          <span className="line line--red">85.</span>
        </h2>
      </div>
      <div className="container onde__grid">
        <div className="onde__text">
          <address className="onde__address" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
            {ADDRESS.street}, {ADDRESS.district}
            <br />
            {ADDRESS.city} - {ADDRESS.state}
          </address>
          <p data-reveal style={{ '--i': 2 } as React.CSSProperties}>
            <a className="btn btn--secondary" href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Abrir no Google Maps
            </a>
          </p>
          <table className="hours" data-reveal style={{ '--i': 3 } as React.CSSProperties}>
            <caption>Funcionamento</caption>
            <thead>
              <tr>
                <th scope="col">Dias</th>
                <th scope="col">Manhã</th>
                <th scope="col">Tarde e noite</th>
              </tr>
            </thead>
            <tbody>
              {OPENING_HOURS.map((o) => (
                <tr key={o.days}>
                  <th scope="row">{o.days}</th>
                  <td>{o.morning}</td>
                  <td>{o.evening === '—' ? <span aria-label="fechado">—</span> : o.evening}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="onde__map" data-reveal style={{ '--i': 2 } as React.CSSProperties}>
          <iframe
            title="Mapa: Arte Livre BJJ, Rua Nilo Peçanha, 85, Centro, Vassouras-RJ"
            src={embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
