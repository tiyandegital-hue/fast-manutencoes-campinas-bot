/* FAST MANUTENÇÕES — site logic
   Business name is ONE swappable constant: change BUSINESS.name and every
   [data-biz] element, the bot greeting and the WhatsApp compose text follow. */
'use strict';

const BUSINESS = {
  name: 'FAST MANUTENÇÕES',
  tagline: 'Desentupidora em Campinas e Região',
  whatsappDisplay: '(19) 99231-2502',
  whatsappNumber: '5519992312502'
};
const WA_BASE = 'https://wa.me/' + BUSINESS.whatsappNumber;
const GREETING = 'Olá! Sou o assistente da Fast Manutenções. O que entupiu aí?';

document.addEventListener('DOMContentLoaded', () => {
  /* Business name constant -> every [data-biz] slot */
  document.querySelectorAll('[data-biz]').forEach(el => { el.textContent = BUSINESS.name; });
  document.querySelectorAll('[data-biz-tagline]').forEach(el => { el.textContent = BUSINESS.tagline; });
  document.querySelectorAll('[data-wa-display]').forEach(el => { el.textContent = BUSINESS.whatsappDisplay; });
  document.querySelectorAll('a[data-wa-link]').forEach(a => { a.href = WA_BASE; });

  /* Mobile nav toggle */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  initHomeChat();
  initBotDemo();
  initTriageForm();
});

/* ---------- Home hero chat: STATIC mock — buttons highlight only, no state advance ---------- */
function initHomeChat() {
  const chat = document.getElementById('home-chat');
  if (!chat) return;
  chat.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chat.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('static-picked'));
      btn.classList.add('static-picked');
    });
  });
}

/* ---------- Bot Demo state machine ----------
   State 0 greeting -> service chips -> State 1 emergency/schedule
   -> State 2 bairro -> State 3 horário -> State 4 summary card + WhatsApp CTA
   RECOMEÇAR resets to State 0. Every path is clickable; no dead ends. ---------- */
const SERVICES = [
  { id: 'esgoto', label: 'Esgoto', short: 'Esgoto' },
  { id: 'vaso', label: 'Vaso Sanitário', short: 'Vaso sanitário' },
  { id: 'pia', label: 'Pia', short: 'Pia' },
  { id: 'ralo', label: 'Ralo', short: 'Ralo' },
  { id: 'caixa', label: 'Caixa de Gordura', short: 'Caixa de gordura' },
  { id: 'hidro', label: 'Hidrojateamento', short: 'Hidrojateamento' }
];
const BAIRROS = ['Cambuí, Campinas', 'Taquaral, Campinas', 'Barão Geraldo', 'Hortolândia', 'Outro bairro...'];
const HORARIOS = ['Imediato (Urgente)', 'Hoje à Tarde', 'Amanhã pela Manhã'];

function initBotDemo() {
  const chat = document.getElementById('bot-chat');
  if (!chat) return;
  const body = chat.querySelector('.chat-body');
  const state = { service: null, urgency: null, bairro: null, horario: null };
  let busy = false;

  const scrollDown = () => { body.scrollTop = body.scrollHeight; };
  const now = () => 'Agora';

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function botMsg(text) {
    const m = el(`<div class="msg msg-bot">${escapeHtml(text)}<span class="msg-time">${now()}</span></div>`);
    body.appendChild(m); scrollDown(); return m;
  }
  function userMsg(text) {
    const m = el(`<div class="msg msg-user">${escapeHtml(text)}<span class="msg-time">${now()} <span class="ticks">✓✓</span></span></div>`);
    body.appendChild(m); scrollDown(); return m;
  }
  function typing() {
    const t = el('<div class="typing" aria-label="Digitando..."><span></span><span></span><span></span></div>');
    body.appendChild(t); scrollDown(); return t;
  }
  function quickRow(buttons) {
    const row = el('<div class="quick-row"></div>');
    buttons.forEach(b => {
      const btn = el(`<button type="button" class="chip-btn">${b.label}</button>`);
      btn.addEventListener('click', () => {
        if (busy) return;
        row.querySelectorAll('.chip-btn').forEach(x => { x.disabled = true; });
        btn.classList.add('picked');
        b.onPick();
      });
      row.appendChild(btn);
    });
    body.appendChild(row); scrollDown(); return row;
  }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  async function botTurn(text, buttons) {
    busy = true;
    const t = typing();
    await wait(650);
    t.remove();
    botMsg(text);
    busy = false;
    if (buttons) quickRow(buttons);
  }
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderState0() {
    body.innerHTML = '';
    Object.assign(state, { service: null, urgency: null, bairro: null, horario: null });
    busy = false;
    const date = el('<div class="chat-date">Hoje • Triagem emergencial</div>');
    body.appendChild(date);
    botMsg(GREETING);
    quickRow(SERVICES.map(s => ({
      label: s.label,
      onPick: () => pickService(s)
    })));
  }

  async function pickService(s) {
    state.service = s;
    userMsg(s.short);
    await botTurn('É emergência — água voltando ou transbordando — ou pode agendar?', [
      { label: '🚨 Emergência (Transbordando)', onPick: () => pickUrgency('Emergência (Transbordando)') },
      { label: '📅 Posso agendar horário', onPick: () => pickUrgency('Agendamento') }
    ]);
  }

  async function pickUrgency(u) {
    state.urgency = u;
    userMsg(u);
    await botTurn('Perfeito. Em qual bairro e cidade você está? (Campinas e região)', BAIRROS.map(b => ({
      label: b.toUpperCase(),
      onPick: () => pickBairro(b)
    })));
  }

  async function pickBairro(b) {
    if (b === 'Outro bairro...') {
      userMsg('Outro bairro...');
      const row = el(`<div class="quick-row" style="width:100%">
        <input type="text" id="bairro-livre" placeholder="Digite seu bairro e cidade..." aria-label="Seu bairro e cidade" style="flex:1;min-width:0;background:var(--navy);border:1px solid var(--orange);color:var(--ink);font-family:var(--body);font-size:15px;padding:11px 12px;min-height:44px">
        <button type="button" class="chip-btn" id="bairro-enviar">Enviar</button>
      </div>`);
      body.appendChild(row); scrollDown();
      const input = row.querySelector('#bairro-livre');
      const send = row.querySelector('#bairro-enviar');
      input.focus();
      const submit = () => {
        const v = input.value.trim();
        if (!v) { input.focus(); return; }
        row.remove();
        pickBairroValue(v);
      };
      send.addEventListener('click', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      return;
    }
    pickBairroValue(b);
  }

  async function pickBairroValue(b) {
    state.bairro = b;
    userMsg(b);
    await botTurn('Qual o melhor período para a equipe ir até você?', HORARIOS.map(h => ({
      label: h.toUpperCase(),
      onPick: () => pickHorario(h)
    })));
  }

  async function pickHorario(h) {
    state.horario = h;
    userMsg(h);
    busy = true;
    const t = typing();
    await wait(650);
    t.remove();
    renderSummary();
    busy = false;
  }

  function renderSummary() {
    const statusTxt = state.urgency === 'Emergência (Transbordando)' ? '🚨 Emergência (Transbordando)' : '📅 Agendamento';
    const text = `Olá! Quero agendar um atendimento da ${BUSINESS.name}.\nServiço: ${state.service.label}\nStatus: ${state.urgency}\nBairro/Endereço: ${state.bairro}\nHorário: ${state.horario}`;
    const href = WA_BASE + '?text=' + encodeURIComponent(text);
    const card = el(`<div class="summary-card">
      <h4>Resumo do agendamento</h4>
      <div class="summary-row"><span class="k">Serviço</span><span class="v">${escapeHtml(state.service.label)}</span></div>
      <div class="summary-row"><span class="k">Status</span><span class="v" style="color:var(--orange)">${escapeHtml(statusTxt)}</span></div>
      <div class="summary-row"><span class="k">Bairro / Endereço</span><span class="v">${escapeHtml(state.bairro)}</span></div>
      <div class="summary-row"><span class="k">Horário</span><span class="v" style="color:var(--wa)">${escapeHtml(state.horario)}</span></div>
      <p class="summary-note">Orçamento gratuito na visita • Um técnico confirma em instantes.</p>
      <a class="btn btn-wa btn-block" href="${href}" target="_blank" rel="noopener">Falar no WhatsApp agora</a>
      <p class="summary-foot">Bot Fast • Concluído</p>
    </div>`);
    body.appendChild(card); scrollDown();
  }

  document.getElementById('bot-restart').addEventListener('click', renderState0);
  renderState0();
}

/* ---------- Triage form (precos.html): validate -> compose WhatsApp message ---------- */
function initTriageForm() {
  const form = document.getElementById('triage-form');
  if (!form) return;
  const name = form.querySelector('#f-nome');
  const problem = form.querySelector('#f-problema');
  const local = form.querySelector('#f-local');

  function setInvalid(input, bad) {
    input.closest('.field').classList.toggle('invalid', bad);
    return !bad;
  }
  [name, problem, local].forEach(input => {
    input.addEventListener('input', () => setInvalid(input, !input.value.trim()));
    input.addEventListener('change', () => setInvalid(input, !input.value.trim()));
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    ok = setInvalid(name, !name.value.trim()) && ok;
    ok = setInvalid(problem, !problem.value) && ok;
    ok = setInvalid(local, !local.value.trim()) && ok;
    if (!ok) {
      const firstBad = form.querySelector('.field.invalid input, .field.invalid select');
      if (firstBad) firstBad.focus();
      return;
    }
    const emerg = form.querySelector('input[name="emergencia"]:checked');
    const lines = [
      `Olá! Quero solicitar um orçamento da ${BUSINESS.name}.`,
      `Nome: ${name.value.trim()}`,
      `Problema: ${problem.value}`,
      `Cidade e bairro: ${local.value.trim()}`,
      `Emergência imediata: ${emerg ? emerg.value : 'Não informado'}`
    ];
    const url = WA_BASE + '?text=' + encodeURIComponent(lines.join('\n'));
    window.open(url, '_blank', 'noopener');
  });
}
