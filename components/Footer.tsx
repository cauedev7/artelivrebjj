import { ADDRESS, INSTAGRAM_HANDLE, INSTAGRAM_URL, MOTTO, WHATSAPP_DISPLAY, WHATSAPP_URL } from '@/data/schedule';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="footer">
      <p className="footer__name" aria-label="Arte Livre BJJ">
        <span>Arte Livre</span> <span className="footer__bjj">BJJ</span>
      </p>
      <div className="container footer__grid">
        <Logo size="lg" alt="Emblema da Arte Livre BJJ Team, Brazilian Jiu-Jitsu, Neury Gomes" />
        <p className="footer__motto">{MOTTO.join(' • ')}</p>
        <p className="footer__links">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            WhatsApp {WHATSAPP_DISPLAY}
          </a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            Instagram @{INSTAGRAM_HANDLE}
          </a>
        </p>
        <address>
          {ADDRESS.street}, {ADDRESS.district}, {ADDRESS.city} - {ADDRESS.state}
        </address>
        <p className="footer__small">
          Fotos e vídeo: imagens ilustrativas. Resultados de competição citados a partir de
          fontes públicas de terceiros. © 2026 Arte Livre BJJ.
        </p>
      </div>
    </footer>
  );
}
