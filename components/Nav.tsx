'use client';

import { useEffect, useRef, useState } from 'react';
import { CloseIcon, MenuIcon } from './icons';
import Logo from './Logo';

const LINKS = [
  { href: '#turmas', label: 'Turmas' },
  { href: '#horarios', label: 'Horários' },
  { href: '#planos', label: 'Planos' },
  { href: '#competicao', label: 'Equipe' },
  { href: '#contato', label: 'Contato' },
];

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Fica sólida depois do hero; marca o link da seção atual.
  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById('inicio');
      const limit = hero ? hero.offsetHeight - window.innerHeight * 0.9 : window.innerHeight;
      setSolid(window.scrollY > limit);
      let current = '';
      LINKS.forEach((l) => {
        const el = document.getElementById(l.href.slice(1));
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) current = l.href;
      });
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Menu mobile: Esc fecha, foco preso dentro do menu.
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current!;
    const focusables = () => Array.from(menu.querySelectorAll<HTMLElement>('a, button'));
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
      if (e.key === 'Tab') {
        const f = focusables();
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`nav ${solid ? 'nav--solid' : ''}`}>
      <div className="nav__inner">
        <a href="#inicio" className="nav__brand" data-flush="true" aria-label="Arte Livre BJJ, voltar ao início">
          <Logo size="sm" />
          <span className="nav__wordmark">
            Arte Livre <span>BJJ</span>
          </span>
        </a>
        <nav aria-label="Principal" className="nav__links">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} aria-current={active === l.href ? 'true' : undefined}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a href="#ache-sua-turma" className="btn btn--primary btn--small nav__cta">
          Ache sua turma
        </a>
        <button
          ref={toggleRef}
          type="button"
          className="icon-btn nav__toggle"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>
      <div
        id="menu-mobile"
        ref={menuRef}
        className={`nav__menu ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
      >
        <ul>
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a href="#ache-sua-turma" className="btn btn--primary btn--block" onClick={() => setOpen(false)}>
          Ache sua turma
        </a>
      </div>
    </header>
  );
}
