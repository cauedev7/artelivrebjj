'use client';

import { useState } from 'react';
import { contactHref, hasWhatsApp } from '@/data/schedule';

type Props = {
  message: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Abre o WhatsApp com a mensagem escrita. Sem número configurado, abre o Direct do Instagram
 * e copia a mensagem para a área de transferência (o Instagram não aceita texto pré-preenchido).
 */
export default function ContactButton({ message, children, className = 'btn btn--primary' }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    if (hasWhatsApp) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 6000);
    } catch {
      /* Sem permissão de área de transferência: o link abre o Direct mesmo assim. */
    }
  };

  return (
    <span className="contact-btn">
      <a className={className} href={contactHref(message)} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {children}
      </a>
      <span className="contact-btn__status" role="status" aria-live="polite">
        {copied ? 'Mensagem copiada. Cole no Direct do Instagram.' : ''}
      </span>
    </span>
  );
}
