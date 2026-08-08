import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const WARNING_MS = 15 * 60 * 1000;
const DEFAULT_V = '12.00';

const RECOMENDACION = {
  Excelente: 'Tu batería está en excelente estado, sin nada que observar.',
  Buena: 'Tu batería está en buen estado.',
  Regular: 'Tu batería ya muestra desgaste. Te recomendamos que la vayamos monitoreando y empieces a evaluar el cambio en los próximos meses.',
  Reemplazar: 'Tu batería está muy debilitada y ya no garantiza un arranque confiable. Te recomendamos reemplazarla a la brevedad.',
};

function formatTiempo(ms) {
  if (ms <= 0) return '¡DESCONECTAR!';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`;
}

function formatDuracion(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function fmtRead(r) {
  return r ? `${r.v ?? '—'}V / ${r.cca ?? '—'} CCA` : null;
}

function calcEstado(ficha, ciclo) {
  const nominal = parseFloat(ficha?.ccaNominal);
  if (!nominal || nominal <= 0) return null;
  const ref = ciclo?.reposo?.cca ? ciclo.reposo : ciclo?.cargaFin?.cca ? ciclo.cargaFin : null;
  if (!ref) return null;
  const cca = parseFloat(ref.cca);
  if (!cca || cca <= 0) return null;

  const pct = (cca / nominal) * 100;
  let nivel = pct >= 90 ? 3 : pct >= 75 ? 2 : pct >= 50 ? 1 : 0;

  let caida = null;
  if (ciclo?.cargaFin && ciclo?.reposo) {
    const vFin = parseFloat(ciclo.cargaFin.v);
    const vRep = parseFloat(ciclo.reposo.v);
    if (!isNaN(vFin) && !isNaN(vRep)) {
      caida = +(vFin - vRep).toFixed(2);
      if (caida > 0.5 && nivel > 0) nivel -= 1;
    }
  }

  const NIVELES = [
    { label: 'Reemplazar', cls: 'estado-alarm' },
    { label: 'Regular', cls: 'estado-warning' },
    { label: 'Buena', cls: 'estado-ok' },
    { label: 'Excelente', cls: 'estado-ok' },
  ];
  return { pct: Math.round(pct), caida, usedReposo: !!ciclo?.reposo?.cca, ...NIVELES[nivel] };
}

function buildMessage(type, ficha, ciclo) {
  if (type === 'diagnostico') {
    const estado = calcEstado(ficha, ciclo);
    const partes = [];
    if (ciclo?.ingreso) partes.push(`Ingreso: ${fmtRead(ciclo.ingreso)}`);
    if (ciclo?.cargaFin) partes.push(`Fin de carga: ${fmtRead(ciclo.cargaFin)}`);
    if (ciclo?.reposo) partes.push(`Reposo: ${fmtRead(ciclo.reposo)}`);
    const lecturasTxt = partes.length ? '\n' + partes.join('\n') : '';
    let estadoTxt = '\n\nNo pudimos calcular el estado de salud (falta el CCA nominal de la batería).';
    if (estado) {
      estadoTxt = `\n\nEstado de la batería: *${estado.label}* (${estado.pct}% de su capacidad de arranque nominal).\n${RECOMENDACION[estado.label] || ''}`;
    }
    return `Hola ${ficha.cliente}, tu batería (${ficha.marca}) ya está lista en Lubri. Estas fueron las lecturas tomadas:${lecturasTxt}${estadoTxt}`;
  }
  if (type === 'lecturas') {
    const partes = [];
    if (ciclo?.ingreso) partes.push(`Ingreso: ${fmtRead(ciclo.ingreso)}`);
    if (ciclo?.cargaFin) partes.push(`Fin de carga: ${fmtRead(ciclo.cargaFin)}`);
    if (ciclo?.reposo) partes.push(`Reposo: ${fmtRead(ciclo.reposo)}`);
    const lecturasTxt = partes.length ? '\n' + partes.join('\n') : '';
    return `Hola ${ficha.cliente}, tu batería (${ficha.marca}) ya está lista en Lubri. Estas fueron las lecturas tomadas:${lecturasTxt}`;
  }
  return `Hola ${ficha.cliente}, tu batería (${ficha.marca}) ya está lista para retirar en Lubri. ¡Te esperamos!`;
}

export default function TableroCargaBaterias() {
  const [fichas, setFichas] = useState([]);
  const [charges, setCharges] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Audio Context for beep
  const audioCtxRef = useRef(null);
  const alarmIntervalRef = useRef(null);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [clienteInput, setClienteInput] = useState('');
  const [marcaInput, setMarcaInput] = useState('');
  const [telefonoInput, setTelefonoInput] = useState('');
  const [ccaNominalInput, setCcaNominalInput] = useState('');
  const [vIngresoInput, setVIngresoInput] = useState('');
  const [ccaIngresoInput, setCcaIngresoInput] = useState('');
  const [minutosInput, setMinutosInput] = useState('');
  const [precioServicioInput, setPrecioServicioInput] = useState('2500');
  const [enviarCajaCheck, setEnviarCajaCheck] = useState(true);
  const [modalErr, setModalErr] = useState(false);
  const [selectedQt, setSelectedQt] = useState(null);

  // Client Autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Notify Modal state
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState(null);
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifyPreset, setNotifyPreset] = useState('diagnostico');
  const [notifyText, setNotifyText] = useState('');
  const [notifyErr, setNotifyErr] = useState(false);

  // Recharge Modal state
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeTarget, setRechargeTarget] = useState(null);
  const [rechargeUseReading, setRechargeUseReading] = useState(true);
  const [rechargeMinutos, setRechargeMinutos] = useState('');
  const [rechargeErr, setRechargeErr] = useState(false);
  const [rechargeSelectedQt, setRechargeSelectedQt] = useState(null);

  // Draft inputs for testing & reposo inside active cards
  const [cardDrafts, setCardDrafts] = useState({});

  // Cargar datos del backend
  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/baterias/carga');
      if (res.ok) {
        const data = await res.json();
        setFichas(data.fichas || []);
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tick interval for 1s clock updates
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Alarm Sound logic
  const beep = useCallback(() => {
    if (muted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {
      // ignore audio errors
    }
  }, [muted]);

  const computeStatus = useCallback((charge) => {
    if (charge.manualStatus) return charge.manualStatus;
    if (charge.paused) return 'paused';
    const remaining = charge.endTime - now;
    if (remaining <= 0) return 'alarm';
    if (remaining <= WARNING_MS) return 'warning';
    return 'active';
  }, [now]);

  useEffect(() => {
    const anyAlarm = charges.some((c) => computeStatus(c) === 'alarm');
    if (anyAlarm && !alarmIntervalRef.current) {
      alarmIntervalRef.current = setInterval(beep, 700);
    } else if (!anyAlarm && alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  }, [charges, computeStatus, beep]);

  // Autocomplete fetch
  useEffect(() => {
    if (clienteInput.trim().length >= 2) {
      fetch(`/api/baterias/clientes?query=${encodeURIComponent(clienteInput.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          setSuggestions(Array.isArray(data) ? data : []);
          setShowSuggestions(true);
        })
        .catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [clienteInput]);

  // Launch or queue local charge object
  const startOrQueue = (payload) => {
    const isBusy = charges.some((c) => {
      const s = computeStatus(c);
      return s === 'active' || s === 'warning' || s === 'paused';
    });

    const totalMs = payload.minutos * 60 * 1000;
    const newCharge = {
      id: Date.now() + Math.random(),
      dbCicloId: payload.cicloId,
      dbFichaId: payload.fichaId,
      cliente: payload.cliente,
      marca: payload.marca,
      endTime: Date.now() + totalMs,
      totalMs,
      manualStatus: null,
      showReposoForm: false,
      paused: false,
      pausedRemainingMs: null,
      ficha: payload.ficha,
      ciclo: payload.ciclo,
      precio: payload.precio,
      ventaId: payload.ventaId,
    };

    if (isBusy) {
      setQueue((prev) => [...prev, newCharge]);
    } else {
      setCharges((prev) => [newCharge, ...prev]);
    }
  };

  // Open / Close Modal Nueva Carga
  const handleOpenModal = (prefill) => {
    setClienteInput(prefill?.cliente || '');
    setMarcaInput(prefill?.marca || '');
    setTelefonoInput(prefill?.telefono || '');
    setCcaNominalInput(prefill?.ccaNominal || '');
    setVIngresoInput('');
    setCcaIngresoInput('');
    setMinutosInput('');
    setSelectedQt(null);
    setModalErr(false);
    setModalOpen(true);
  };

  const handleStartCharge = async () => {
    const cliente = clienteInput.trim();
    const marca = marcaInput.trim();
    const minutos = parseInt(minutosInput, 10);
    const precio = Number(precioServicioInput) || 0;

    if (!cliente || !marca || !minutos || minutos <= 0) {
      setModalErr(true);
      return;
    }
    setModalErr(false);

    try {
      const res = await fetch('/api/baterias/carga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nombre: cliente,
          cliente_telefono: telefonoInput.trim(),
          marca,
          cca_nominal: ccaNominalInput,
          minutos,
          v_ingreso: vIngresoInput,
          cca_ingreso: ccaIngresoInput,
          precio_servicio: precio,
          enviar_caja: enviarCajaCheck,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const ingresoObj = (vIngresoInput || ccaIngresoInput) ? { v: vIngresoInput || DEFAULT_V, cca: ccaIngresoInput || null } : null;

        let fichaObj = fichas.find((f) => f.id === data.fichaId);
        const newCiclo = {
          id: data.cicloId,
          ficha_id: data.fichaId,
          fecha: new Date().toISOString(),
          minutos,
          estado_ciclo: 'activo',
          ingreso: ingresoObj,
          cargaFin: null,
          reposo: null,
          salud: null,
          venta: data.ventaId ? { id: data.ventaId, estado: 'pendiente', total: precio } : null,
        };

        if (fichaObj) {
          fichaObj.ciclos.unshift(newCiclo);
          if (telefonoInput) fichaObj.telefono = telefonoInput.trim();
          if (ccaNominalInput) fichaObj.ccaNominal = ccaNominalInput;
        } else {
          fichaObj = {
            id: data.fichaId,
            cliente,
            telefono: telefonoInput.trim(),
            marca,
            ccaNominal: ccaNominalInput || null,
            key: `${cliente}|${marca}`.toLowerCase(),
            ciclos: [newCiclo],
          };
          setFichas((prev) => [fichaObj, ...prev]);
        }

        startOrQueue({
          cicloId: data.cicloId,
          fichaId: data.fichaId,
          ficha: fichaObj,
          ciclo: newCiclo,
          cliente,
          marca,
          minutos,
          precio,
          ventaId: data.ventaId,
        });

        setModalOpen(false);
      }
    } catch (err) {
      console.error('Error al iniciar carga:', err);
    }
  };

  // Card Action Handlers
  const handleCardAction = async (c, action) => {
    if (action === 'pause') {
      setCharges((prev) =>
        prev.map((item) =>
          item.id === c.id
            ? { ...item, paused: true, pausedRemainingMs: item.endTime - now }
            : item
        )
      );
      fetch('/api/baterias/carga/ciclo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo_id: c.dbCicloId, action: 'update_status', estado_ciclo: 'pausado' }),
      });
    } else if (action === 'resume') {
      setCharges((prev) =>
        prev.map((item) =>
          item.id === c.id
            ? { ...item, paused: false, endTime: now + item.pausedRemainingMs, pausedRemainingMs: null }
            : item
        )
      );
      fetch('/api/baterias/carga/ciclo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo_id: c.dbCicloId, action: 'update_status', estado_ciclo: 'activo' }),
      });
    } else if (action === 'cancel') {
      setCharges((prev) => prev.filter((item) => item.id !== c.id));
      fetch('/api/baterias/carga/ciclo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo_id: c.dbCicloId, action: 'update_status', estado_ciclo: 'cancelado' }),
      });
      // Dequeue if queue exists
      if (queue.length > 0) {
        const nextQ = queue[0];
        setQueue((prev) => prev.slice(1));
        setCharges((prev) => [nextQ, ...prev]);
      }
    } else if (action === 'toTesting') {
      setCharges((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, manualStatus: 'testing' } : item))
      );
    } else if (action === 'saveTesting') {
      const draft = cardDrafts[c.id] || {};
      const finV = draft.finV || DEFAULT_V;
      const finCCA = draft.finCCA || null;

      c.ciclo.cargaFin = { v: finV, cca: finCCA };
      setCharges((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, manualStatus: 'reposo' } : item))
      );

      fetch('/api/baterias/carga/ciclo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo_id: c.dbCicloId, action: 'save_testing', fin_v: finV, fin_cca: finCCA }),
      });
    } else if (action === 'skipTesting') {
      setCharges((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, manualStatus: 'reposo' } : item))
      );
    } else if (action === 'openReposo') {
      setCharges((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, showReposoForm: true } : item))
      );
    } else if (action === 'saveReposo') {
      const draft = cardDrafts[c.id] || {};
      const repV = draft.repV || DEFAULT_V;
      const repCCA = draft.repCCA || null;

      c.ciclo.reposo = { v: repV, cca: repCCA };
      const estadoSalud = calcEstado(c.ficha, c.ciclo);

      setCharges((prev) => prev.filter((item) => item.id !== c.id));

      fetch('/api/baterias/carga/ciclo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciclo_id: c.dbCicloId,
          action: 'save_reposo',
          reposo_v: repV,
          reposo_cca: repCCA,
          salud_pct: estadoSalud?.pct,
          salud_nivel: estadoSalud?.label,
          salud_caida_v: estadoSalud?.caida,
        }),
      });

      if (queue.length > 0) {
        const nextQ = queue[0];
        setQueue((prev) => prev.slice(1));
        setCharges((prev) => [nextQ, ...prev]);
      }
    } else if (action === 'finishNoReposo') {
      setCharges((prev) => prev.filter((item) => item.id !== c.id));
      fetch('/api/baterias/carga/ciclo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo_id: c.dbCicloId, action: 'update_status', estado_ciclo: 'cerrado' }),
      });
      if (queue.length > 0) {
        const nextQ = queue[0];
        setQueue((prev) => prev.slice(1));
        setCharges((prev) => [nextQ, ...prev]);
      }
    } else if (action === 'enviarCaja') {
      const res = await fetch('/api/baterias/carga/ciclo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo_id: c.dbCicloId, action: 'enviar_caja', precio_servicio: c.precio || 2500 }),
      });
      if (res.ok) {
        loadData();
      }
    }
  };

  // WhatsApp Notify Action
  const handleOpenNotify = (ficha, ciclo) => {
    setNotifyTarget({ ficha, ciclo });
    setNotifyPhone(ficha.telefono || '');
    const defaultPreset = ficha.ccaNominal ? 'diagnostico' : 'lecturas';
    setNotifyPreset(defaultPreset);
    setNotifyText(buildMessage(defaultPreset, ficha, ciclo));
    setNotifyErr(false);
    setNotifyOpen(true);
  };

  const handleSendNotify = () => {
    if (!notifyPhone.trim()) {
      setNotifyErr(true);
      return;
    }
    setNotifyErr(false);
    const cleanPhone = notifyPhone.trim().replace(/[^\d]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(notifyText)}`;
    window.open(url, '_blank', 'noopener');
    setNotifyOpen(false);
  };

  return (
    <>
      <Head>
        <title>Módulo Carga de Baterías — Lubri</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <style jsx global>{`
        :root {
          --ink: #121314;
          --panel: #1d2023;
          --panel-2: #25292c;
          --steel: #5a6167;
          --amber: #f5b400;
          --alarm: #ef3f4d;
          --ok: #59c27a;
          --paper: #efe9dd;
          --paper-dim: #a6a196;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0; padding: 0;
          background: radial-gradient(circle at 15% -10%, #23262a 0%, var(--ink) 45%);
          color: var(--paper);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          padding-bottom: 60px;
        }

        header {
          position: relative;
          padding: 24px 28px 20px;
          border-bottom: 3px solid var(--amber);
          background: repeating-linear-gradient(135deg, #1a1b1d 0 14px, #1c1d1f 14px 28px);
        }
        .header-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
        .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .18em; color: var(--amber); text-transform: uppercase; margin: 0 0 6px; }
        h1 { font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; font-size: clamp(24px, 4vw, 36px); margin: 0 0 4px; }
        p.sub { margin: 0; color: var(--paper-dim); font-size: 14px; max-width: 600px; }
        .header-actions { display: flex; gap: 10px; align-items: center; }

        .nav-back { color: var(--paper-dim); text-decoration: none; font-size: 13px; margin-right: 12px; }
        .nav-back:hover { color: var(--amber); }

        button { font-family: inherit; cursor: pointer; }
        .btn-primary {
          background: var(--amber); color: #1a1200; border: none;
          font-family: 'Oswald', sans-serif; font-weight: 600; text-transform: uppercase;
          letter-spacing: .03em; font-size: 14px; padding: 12px 20px; border-radius: 3px;
          transition: transform .12s ease;
        }
        .btn-primary:hover { transform: translateY(-1px); }

        .btn-mute {
          background: transparent; border: 1px solid var(--steel); color: var(--paper-dim);
          width: 40px; height: 40px; border-radius: 3px; font-size: 16px;
          display: flex; align-items: center; justify-content: center;
        }
        .btn-mute.active { border-color: var(--alarm); color: var(--alarm); }

        main { padding: 30px 28px; }
        .section-title {
          font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: .12em;
          color: var(--paper-dim); text-transform: uppercase; margin: 0 0 16px;
          display: flex; gap: 10px; align-items: center;
        }
        .section-title span.count { color: var(--amber); }
        .section-title::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, var(--steel), transparent); }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; margin-bottom: 44px; }
        .empty-state { border: 1px dashed var(--steel); border-radius: 6px; padding: 44px 20px; text-align: center; color: var(--paper-dim); grid-column: 1 / -1; }
        .empty-state .big { font-family: 'Oswald', sans-serif; font-size: 19px; color: var(--paper); text-transform: uppercase; margin-bottom: 6px; }

        .card {
          position: relative; background: var(--panel); border: 1px solid #34383c; border-radius: 6px;
          padding: 18px 18px 16px; overflow: hidden; transition: border-color .3s ease;
        }
        .card.warning { border-color: var(--amber); }
        .card.alarm {
          border-color: var(--alarm);
          background: repeating-linear-gradient(135deg, var(--alarm) 0 16px, #b91f2c 16px 32px);
          animation: pulseCard 1s infinite;
        }
        .card.reposo { border-color: var(--ok); }
        .card.paused { border-color: var(--steel); border-style: dashed; }
        @keyframes pulseCard { 0%,100% { box-shadow: 0 0 0 rgba(239,63,77,0); } 50% { box-shadow: 0 0 26px rgba(239,63,77,.55); } }

        .cliente { font-family: 'Oswald', sans-serif; font-size: 19px; font-weight: 600; margin: 0 0 2px; }
        .marca { font-size: 12.5px; color: var(--paper-dim); margin: 0 0 12px; }

        .clock { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 30px; margin-bottom: 12px; }
        .card.alarm .clock { font-size: 22px; text-transform: uppercase; }

        .bar-track { height: 6px; border-radius: 3px; background: #0e0f10; overflow: hidden; margin-bottom: 14px; }
        .bar-fill { height: 100%; background: linear-gradient(90deg, var(--amber), #ffd35c); }

        .card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn-ghost {
          flex: 1; background: transparent; border: 1px solid var(--steel); color: var(--paper-dim);
          font-size: 12px; padding: 9px 8px; border-radius: 3px; text-transform: uppercase;
          font-family: 'Inter', sans-serif; font-weight: 600;
        }
        .btn-ghost:hover { border-color: var(--paper-dim); color: var(--paper); }

        .btn-solid {
          width: 100%; background: #fff; border: none; font-family: 'Oswald', sans-serif; font-weight: 700;
          text-transform: uppercase; font-size: 14px; padding: 12px; border-radius: 4px;
        }
        .btn-solid.alarm-c { color: var(--alarm); }
        .btn-solid.ok-c { color: #0e3a1f; }

        .readings { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .read-chip {
          background: #141517; border: 1px solid #34383c; border-radius: 4px;
          padding: 6px 9px; font-size: 11px;
        }
        .read-chip .lbl { display: block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; opacity: .7; text-transform: uppercase; }
        .read-chip .val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 13px; }

        .mini-form { margin-bottom: 10px; }
        .mini-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .mini-field { flex: 1; }
        .mini-field label { display: block; font-size: 10px; text-transform: uppercase; color: var(--paper-dim); margin-bottom: 4px; font-family: 'JetBrains Mono', monospace; }
        .mini-field input { width: 100%; background: #141517; border: 1px solid #3a3f43; color: var(--paper); padding: 8px 9px; border-radius: 4px; font-size: 13px; font-family: 'JetBrains Mono', monospace; }

        /* Fichas e Historial */
        .ficha { background: var(--panel-2); border: 1px solid #34383c; border-radius: 6px; padding: 16px 18px; margin-bottom: 12px; }
        .ficha-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
        .ficha-title { font-family: 'Oswald', sans-serif; font-size: 16px; text-transform: uppercase; }
        .ficha-title .n { color: var(--paper-dim); font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-left: 8px; text-transform: none; }
        .btn-recharge { background: transparent; border: 1px solid var(--amber); color: var(--amber); font-size: 11px; font-weight: 600; padding: 7px 12px; border-radius: 4px; text-transform: uppercase; }
        .btn-recharge:hover { background: rgba(245,180,0,.12); }

        .ciclo-row { display: grid; grid-template-columns: 140px 1fr 1fr 1fr auto auto; gap: 10px; padding: 9px 0; border-top: 1px solid #303437; font-size: 12.5px; align-items: center; }
        .ciclo-fecha { color: var(--paper-dim); font-family: 'JetBrains Mono', monospace; font-size: 11px; }
        .ciclo-col .lbl { display: block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; text-transform: uppercase; color: var(--paper-dim); }
        .ciclo-col .val { font-family: 'JetBrains Mono', monospace; font-weight: 600; }

        .estado-badge { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 5px 9px; border-radius: 4px; }
        .estado-badge.estado-ok { background: rgba(89,194,122,.15); color: var(--ok); border: 1px solid rgba(89,194,122,.4); }
        .estado-badge.estado-warning { background: rgba(245,180,0,.15); color: var(--amber); border: 1px solid rgba(245,180,0,.4); }
        .estado-badge.estado-alarm { background: rgba(239,63,77,.15); color: var(--alarm); border: 1px solid rgba(239,63,77,.4); }
        .estado-badge.estado-none { background: transparent; color: var(--paper-dim); border: 1px dashed var(--steel); }

        /* Overlay & Modals */
        .overlay { position: fixed; inset: 0; background: rgba(6,7,8,.72); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
        .modal { background: var(--panel-2); border: 1px solid #3a3f43; border-top: 3px solid var(--amber); border-radius: 6px; width: 100%; max-width: 440px; padding: 24px; max-height: 90vh; overflow-y: auto; }
        .modal h2 { font-family: 'Oswald', sans-serif; text-transform: uppercase; font-size: 20px; margin: 0 0 4px; }
        .modal .modal-sub { font-size: 12px; color: var(--paper-dim); margin: 0 0 18px; }

        .field { margin-bottom: 14px; position: relative; }
        .field label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--paper-dim); margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; }
        .field input, .field textarea { width: 100%; background: #141517; border: 1px solid #3a3f43; color: var(--paper); padding: 10px 12px; border-radius: 4px; font-size: 14px; }
        .field-row { display: flex; gap: 10px; }
        .field-row .field { flex: 1; }
        .fieldset-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; color: var(--paper-dim); margin: 18px 0 8px; display: block; }

        .quick-times { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
        .qt { background: #141517; border: 1px solid #3a3f43; color: var(--paper); padding: 8px 12px; border-radius: 4px; font-size: 13px; font-family: 'JetBrains Mono', monospace; }
        .qt.selected { background: var(--amber); color: #1a1200; border-color: var(--amber); font-weight: 700; }

        .autocomplete-box { position: absolute; top: 100%; left: 0; right: 0; background: #1c1e21; border: 1px solid var(--amber); border-radius: 4px; z-index: 10; max-height: 150px; overflow-y: auto; }
        .autocomplete-item { padding: 8px 12px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #2d3135; }
        .autocomplete-item:hover { background: var(--amber); color: #1a1200; }

        .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
        .btn-cancel { flex: 1; background: transparent; border: 1px solid var(--steel); color: var(--paper-dim); padding: 12px; border-radius: 4px; font-weight: 600; text-transform: uppercase; font-size: 13px; }

        .err { color: var(--alarm); font-size: 12px; margin: -6px 0 12px; }
      `}</style>

      <header>
        <div className="header-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link href="/" className="nav-back">← Volver al inicio</Link>
              <p className="eyebrow">Módulo · Carga de Baterías</p>
            </div>
            <h1>Tablero de Carga — FB Lubricentro</h1>
            <p className="sub">
              Un solo cargador: cuando termina el tiempo de la batería activa, arranca sola la próxima en cola. Diagnóstico de salud y registro de servicio enviado a Caja.
            </p>
          </div>
          <div className="header-actions">
            <button className={`btn-mute ${muted ? 'active' : ''}`} onClick={() => setMuted(!muted)} title="Silenciar alarma sonora">
              {muted ? '🔇' : '🔊'}
            </button>
            <button className="btn-primary" onClick={() => handleOpenModal()}>
              + Nueva Carga
            </button>
          </div>
        </div>
      </header>

      <main>
        <p className="section-title">
          Baterías en el taller <span className="count">{charges.length}</span>
        </p>

        <div className="grid">
          {charges.length === 0 ? (
            <div className="empty-state">
              <div className="big">No hay baterías cargando en este momento</div>
              <p>Presioná «+ Nueva Carga» para iniciar un temporizador o registrar un servicio.</p>
            </div>
          ) : (
            charges.map((c) => {
              const remaining = c.endTime - now;
              const status = computeStatus(c);
              const pct = Math.min(100, Math.max(0, ((c.totalMs - remaining) / c.totalMs) * 100));
              const cardClass = status === 'alarm' ? 'alarm' : status === 'warning' ? 'warning' : status === 'reposo' ? 'reposo' : status === 'paused' ? 'paused' : '';

              const draft = cardDrafts[c.id] || {};

              return (
                <div key={c.id} className={`card ${cardClass}`}>
                  <h3 className="cliente">{c.cliente}</h3>
                  <p className="marca">Batería: {c.marca}</p>

                  {(status === 'active' || status === 'warning') && (
                    <>
                      <div className="clock">{formatTiempo(remaining)}</div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="card-actions">
                        <button className="btn-ghost" onClick={() => handleCardAction(c, 'pause')}>⏸ Pausar</button>
                        <button className="btn-ghost" onClick={() => handleCardAction(c, 'cancel')}>Cancelar</button>
                      </div>
                    </>
                  )}

                  {status === 'paused' && (
                    <>
                      <div className="clock">{formatTiempo(c.pausedRemainingMs)}</div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: '100%', background: 'var(--steel)' }} />
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--paper-dim)' }}>⏸ En pausa — cargador detenido.</p>
                      <div className="card-actions">
                        <button className="btn-ghost" onClick={() => handleCardAction(c, 'resume')}>▶ Reanudar</button>
                        <button className="btn-ghost" onClick={() => handleCardAction(c, 'cancel')}>Cancelar</button>
                      </div>
                    </>
                  )}

                  {status === 'alarm' && (
                    <>
                      <div className="clock">¡DESCONECTAR!</div>
                      <button className="btn-solid alarm-c" onClick={() => handleCardAction(c, 'toTesting')}>
                        Desconectar y registrar lectura
                      </button>
                    </>
                  )}

                  {status === 'testing' && (
                    <>
                      <div className="mini-form">
                        <div className="mini-row">
                          <div className="mini-field">
                            <label>Voltaje fin (V)</label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="12.00"
                              value={draft.finV || ''}
                              onChange={(e) => setCardDrafts({ ...cardDrafts, [c.id]: { ...draft, finV: e.target.value } })}
                            />
                          </div>
                          <div className="mini-field">
                            <label>CCA fin</label>
                            <input
                              type="number"
                              step="1"
                              placeholder="200"
                              value={draft.finCCA || ''}
                              onChange={(e) => setCardDrafts({ ...cardDrafts, [c.id]: { ...draft, finCCA: e.target.value } })}
                            />
                          </div>
                        </div>
                      </div>
                      <button className="btn-solid alarm-c" onClick={() => handleCardAction(c, 'saveTesting')}>
                        Guardar y pasar a reposo
                      </button>
                      <div className="card-actions" style={{ marginTop: '8px' }}>
                        <button className="btn-ghost" onClick={() => handleCardAction(c, 'skipTesting')}>Omitir lectura</button>
                      </div>
                    </>
                  )}

                  {status === 'reposo' && (
                    <>
                      <div className="readings">
                        {c.ciclo.ingreso && (
                          <div className="read-chip">
                            <span className="lbl">Ingreso</span>
                            <span className="val">{fmtRead(c.ciclo.ingreso)}</span>
                          </div>
                        )}
                        {c.ciclo.cargaFin && (
                          <div className="read-chip">
                            <span className="lbl">Fin de carga</span>
                            <span className="val">{fmtRead(c.ciclo.cargaFin)}</span>
                          </div>
                        )}
                      </div>

                      {!c.showReposoForm ? (
                        <>
                          <button className="btn-solid ok-c" onClick={() => handleCardAction(c, 'openReposo')}>
                            Registrar lectura de reposo
                          </button>
                          <div className="card-actions" style={{ marginTop: '8px' }}>
                            <button className="btn-ghost" onClick={() => handleCardAction(c, 'finishNoReposo')}>Finalizar sin reposo</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mini-form">
                            <div className="mini-row">
                              <div className="mini-field">
                                <label>Voltaje reposo (V)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="12.00"
                                  value={draft.repV || ''}
                                  onChange={(e) => setCardDrafts({ ...cardDrafts, [c.id]: { ...draft, repV: e.target.value } })}
                                />
                              </div>
                              <div className="mini-field">
                                <label>CCA reposo</label>
                                <input
                                  type="number"
                                  step="1"
                                  placeholder="210"
                                  value={draft.repCCA || ''}
                                  onChange={(e) => setCardDrafts({ ...cardDrafts, [c.id]: { ...draft, repCCA: e.target.value } })}
                                />
                              </div>
                            </div>
                          </div>
                          <button className="btn-solid ok-c" onClick={() => handleCardAction(c, 'saveReposo')}>
                            Guardar y finalizar
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Historial de Fichas */}
        <p className="section-title">
          Historial de baterías <span className="count">{fichas.length}</span>
        </p>

        <div>
          {loading ? (
            <p style={{ color: 'var(--paper-dim)' }}>Cargando fichas de carga desde Google Sheets...</p>
          ) : fichas.length === 0 ? (
            <div className="empty-state">
              <div className="big">Todavía no hay historial registrado</div>
              <p>Cada carga guardada aparecerá agrupada por cliente y marca de batería.</p>
            </div>
          ) : (
            fichas.map((f) => (
              <div key={f.id} className="ficha">
                <div className="ficha-head">
                  <div className="ficha-title">
                    {f.cliente} — {f.marca}
                    <span className="n">
                      {f.ciclos.length} ciclo(s) · {f.ccaNominal ? `${f.ccaNominal}A CCA nominal` : 'sin CCA nominal'}
                    </span>
                  </div>
                  <button className="btn-recharge" onClick={() => handleOpenModal({ cliente: f.cliente, marca: f.marca, telefono: f.telefono })}>
                    + Nueva carga para esta batería
                  </button>
                </div>

                {f.ciclos.map((c) => {
                  const estado = calcEstado(f, c);
                  const fechaStr = new Date(c.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

                  return (
                    <div key={c.id} className="ciclo-row">
                      <div className="ciclo-fecha">{fechaStr}</div>
                      <div className="ciclo-col">
                        <span className="lbl">Ingreso</span>
                        <span className={`val ${c.ingreso ? '' : 'empty'}`}>{c.ingreso ? fmtRead(c.ingreso) : 'sin dato'}</span>
                      </div>
                      <div className="ciclo-col">
                        <span className="lbl">Fin Carga</span>
                        <span className={`val ${c.cargaFin ? '' : 'empty'}`}>{c.cargaFin ? fmtRead(c.cargaFin) : 'sin dato'}</span>
                      </div>
                      <div className="ciclo-col">
                        <span className="lbl">Reposo</span>
                        <span className={`val ${c.reposo ? '' : 'empty'}`}>{c.reposo ? fmtRead(c.reposo) : 'sin dato'}</span>
                      </div>
                      <div className="ciclo-col">
                        <span className="lbl">Estado / Salud</span>
                        {estado ? (
                          <span className={`estado-badge ${estado.cls}`}>
                            {estado.label} · {estado.pct}%
                          </span>
                        ) : (
                          <span className="estado-badge estado-none">Sin dato</span>
                        )}
                      </div>
                      <button className="btn-recharge" style={{ fontSize: '11px', padding: '5px 9px' }} onClick={() => handleOpenNotify(f, c)}>
                        💬 Notificar WhatsApp
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal Nueva Carga */}
      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target.className === 'overlay' && setModalOpen(false)}>
          <div className="modal">
            <h2>Nueva Carga de Batería</h2>
            <p className="modal-sub">Completa los datos del cliente y de la batería para iniciar el temporizador.</p>

            <div className="field-row">
              <div className="field">
                <label>Cliente</label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={clienteInput}
                  onChange={(e) => setClienteInput(e.target.value)}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="autocomplete-box">
                    {suggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="autocomplete-item"
                        onClick={() => {
                          setClienteInput(item.nombre);
                          if (item.telefono) setTelefonoInput(item.telefono);
                          setShowSuggestions(false);
                        }}
                      >
                        {item.nombre} {item.telefono ? `(${item.telefono})` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="field">
                <label>Batería / Marca</label>
                <input
                  type="text"
                  placeholder="Ej: 65Ah — Willard"
                  value={marcaInput}
                  onChange={(e) => setMarcaInput(e.target.value)}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>WhatsApp Cliente</label>
                <input
                  type="text"
                  placeholder="Ej: 5493541234567"
                  value={telefonoInput}
                  onChange={(e) => setTelefonoInput(e.target.value)}
                />
              </div>
              <div className="field">
                <label>CCA Nominal (etiqueta)</label>
                <input
                  type="number"
                  placeholder="Ej: 340"
                  value={ccaNominalInput}
                  onChange={(e) => setCcaNominalInput(e.target.value)}
                />
              </div>
            </div>

            <span className="fieldset-label">Lectura de ingreso (opcional)</span>
            <div className="field-row">
              <div className="field">
                <label>Voltaje (V)</label>
                <input type="number" step="0.01" placeholder="12.00" value={vIngresoInput} onChange={(e) => setVIngresoInput(e.target.value)} />
              </div>
              <div className="field">
                <label>CCA</label>
                <input type="number" step="1" placeholder="20" value={ccaIngresoInput} onChange={(e) => setCcaIngresoInput(e.target.value)} />
              </div>
            </div>

            <span className="fieldset-label">Servicio comercial & Cobro en Caja</span>
            <div className="field-row">
              <div className="field">
                <label>Precio Servicio ($)</label>
                <input type="number" placeholder="2500" value={precioServicioInput} onChange={(e) => setPrecioServicioInput(e.target.value)} />
              </div>
              <div className="field" style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'none', color: 'var(--paper)' }}>
                  <input
                    type="checkbox"
                    checked={enviarCajaCheck}
                    onChange={(e) => setEnviarCajaCheck(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--amber)' }}
                  />
                  Enviar orden a Caja
                </label>
              </div>
            </div>

            <span className="fieldset-label">Duración de la carga</span>
            <div className="quick-times">
              {[30, 60, 90, 120, 180, 240].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`qt ${selectedQt === m ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedQt(m);
                    setMinutosInput(String(m));
                  }}
                >
                  {formatDuracion(m)}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              placeholder="Minutos personalizados"
              value={minutosInput}
              onChange={(e) => {
                setSelectedQt(null);
                setMinutosInput(e.target.value);
              }}
            />

            {modalErr && <p className="err">Completá cliente, batería y minutos antes de iniciar.</p>}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleStartCharge}>Iniciar Carga</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Notificar WhatsApp */}
      {notifyOpen && notifyTarget && (
        <div className="overlay" onClick={(e) => e.target.className === 'overlay' && setNotifyOpen(false)}>
          <div className="modal">
            <h2>Notificar Cliente por WhatsApp</h2>
            <p className="modal-sub">
              {notifyTarget.ficha.cliente} — {notifyTarget.ficha.marca}
            </p>

            <div className="field">
              <label>Teléfono WhatsApp</label>
              <input type="text" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} placeholder="Ej: 5493541234567" />
            </div>

            <span className="fieldset-label">Formato del Mensaje</span>
            <div className="quick-times">
              {['diagnostico', 'lecturas', 'aviso'].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`qt ${notifyPreset === p ? 'selected' : ''}`}
                  onClick={() => {
                    setNotifyPreset(p);
                    setNotifyText(buildMessage(p, notifyTarget.ficha, notifyTarget.ciclo));
                  }}
                >
                  {p === 'diagnostico' ? 'Con diagnóstico' : p === 'lecturas' ? 'Con lecturas' : 'Solo aviso'}
                </button>
              ))}
            </div>

            <div className="field">
              <textarea rows="5" value={notifyText} onChange={(e) => setNotifyText(e.target.value)} />
            </div>

            {notifyErr && <p className="err">Ingresá el teléfono del cliente.</p>}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setNotifyOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSendNotify}>Abrir en WhatsApp</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
