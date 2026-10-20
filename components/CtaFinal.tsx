import QRCode from 'qrcode';
import { ADDRESS, INSTAGRAM_HANDLE, INSTAGRAM_URL, WHATSAPP_DISPLAY, WHATSAPP_URL } from '@/data/schedule';
import ContactButton from './ContactButton';
import { InstagramIcon, WhatsAppIcon } from './icons';
import Scene3D from './Scene3D';

export default async function CtaFinal({ fx3d = false }: { fx3d?: boolean }) {
  const qr = await QRCode.toString(INSTAGRAM_URL, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#171719', light: '#ffffff' },
  });

  return (
    <section id="contato" className="cta" aria-labelledby="cta-title">
      <div className="container cta__grid">
        <h2 id="cta-title" className="display display--cta" style={{ '--fit': 19 } as React.CSSProperties} data-reveal>
          <span className="line">Seu primeiro treino</span>
          <span className="line line--red">começa</span>
          <span className="line">aqui.</span>
        </h2>
        {fx3d && <Scene3D kind="finale" className="cta__scene" />}
        <div className="cta__side">
          <ul className="cta__contacts" data-reveal style={{ '--i': 1 } as React.CSSProperties}>
            <li>
              <span className="cta__label">WhatsApp</span>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> {WHATSAPP_DISPLAY}
              </a>
            </li>
            <li>
              <span className="cta__label">Instagram</span>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                <InstagramIcon /> @{INSTAGRAM_HANDLE}
              </a>
            </li>
            <li>
              <span className="cta__label">Endereço</span>
              <span>
                {ADDRESS.street}, {ADDRESS.district}, {ADDRESS.city} - {ADDRESS.state}
              </span>
            </li>
          </ul>
          <div className="cta__qr" data-reveal style={{ '--i': 2 } as React.CSSProperties}>
            <div className="qr" role="img" aria-label={`QR code que abre o Instagram @${INSTAGRAM_HANDLE}`}>
              <span className="qr__corner qr__corner--tl" aria-hidden="true" />
              <span className="qr__corner qr__corner--tr" aria-hidden="true" />
              <span className="qr__corner qr__corner--bl" aria-hidden="true" />
              <span className="qr__corner qr__corner--br" aria-hidden="true" />
              <div className="qr__code" dangerouslySetInnerHTML={{ __html: qr }} />
            </div>
            <p>Aponte a câmera e siga a equipe.</p>
          </div>
          <div className="cta__action" data-reveal style={{ '--i': 3 } as React.CSSProperties}>
            <p>Na aula experimental não precisa de kimono.</p>
            <ContactButton message="Olá! Vi o site e quero marcar uma aula experimental na Arte Livre BJJ. Como faço?" className="btn btn--primary btn--large">
              Marcar aula experimental
            </ContactButton>
          </div>
        </div>
      </div>
    </section>
  );
}
