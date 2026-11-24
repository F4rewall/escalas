import 'dotenv/config';
import fs from 'node:fs';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { initializeApp } from 'firebase/app';
import { ensureFirestoreBase } from './initDb.js';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  runTransaction
} from 'firebase/firestore';

// 1. Firebase setup (same project as src/firebase.js, overridable via .env)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyA6DkKR0vYYxWWNX6Td6K1O53GRM7-5Z_M',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'psaescalas.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'psaescalas',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'psaescalas.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '66155357211',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:66155357211:web:1998658ad9c1e6c0e444be'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SECTOR_META = {
  coroinhas: { name: 'Coroinhas', mainRoleTitle: 'Cerimoniário Principal', auxLabel: 'Cerimoniários', memberLabel: 'Coroinhas' },
  musica: { name: 'Música', mainRoleTitle: 'Responsável Musical', auxLabel: 'Cantores / Vocais', memberLabel: 'Instrumentistas' },
  liturgia: { name: 'Liturgia', mainRoleTitle: 'Coordenador / Comentarista', auxLabel: 'Salmista / Comentaristas', memberLabel: 'Leitores' },
  mece: { name: 'MECE', mainRoleTitle: 'Ministro Coordenador', auxLabel: 'Ministros Auxiliares', memberLabel: 'Ministros (MECE)' }
};

// In-memory state synced with Firestore
let chapelsMap = new Map();
let serversMap = new Map();
let schedulesList = [];
let botConfigsMap = new Map();
let swapRequestsList = [];

let sock = null;
let isWaConnected = false;
let waPhone = '';

const processingOutboxIds = new Set();
const processingScheduleJobs = new Set();
const activeSwapLocks = new Set();

// Per-WhatsApp-JID conversation state & phone overrides
// sessions.get(jid) = { step, data, identifiedPhone, history }
const sessions = new Map();

function getSession(jid) {
  if (!sessions.has(jid)) {
    sessions.set(jid, { step: 'idle', data: {}, identifiedPhone: '', history: [] });
  }
  return sessions.get(jid);
}

// --- Helper functions ---
function normalizeDigits(phone = '') {
  return String(phone).replace(/\D/g, '');
}

function stripMarkdown(text = '') {
  return String(text).replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '').trim();
}

function matchServersByPhone(rawPhone = '') {
  const inputDigits = normalizeDigits(rawPhone);
  if (!inputDigits) return [];

  const matches = [];
  for (const sv of serversMap.values()) {
    const svDigits = normalizeDigits(sv.phone);
    if (!svDigits) continue;
    if (inputDigits.length >= 8 && svDigits.length >= 8) {
      if (svDigits.slice(-8) === inputDigits.slice(-8)) {
        matches.push(sv);
      }
    } else if (svDigits === inputDigits || (inputDigits.length >= 3 && svDigits.endsWith(inputDigits))) {
      matches.push(sv);
    }
  }
  return matches;
}

function getPhoneCandidates(phone = '') {
  const digits = normalizeDigits(phone);
  if (!digits) return [];

  let local = digits;
  if (!local.startsWith('55') && (local.length === 10 || local.length === 11)) {
    local = `55${local}`;
  }

  const candidates = new Set([local]);
  if (local.startsWith('55') && local.length === 13 && local[4] === '9') {
    candidates.add(local.slice(0, 4) + local.slice(5));
  } else if (local.startsWith('55') && local.length === 12) {
    candidates.add(local.slice(0, 4) + '9' + local.slice(4));
  }
  return Array.from(candidates);
}

async function resolveWhatsAppJid(phone) {
  if (!sock || !isWaConnected) return null;
  const candidates = getPhoneCandidates(phone);
  for (const num of candidates) {
    try {
      const [result] = await sock.onWhatsApp(num);
      if (result?.exists && result?.jid) {
        return result.jid;
      }
    } catch {
      // try next candidate
    }
  }
  return candidates[0] ? `${candidates[0]}@s.whatsapp.net` : null;
}

async function sendWhatsAppMessage(phone, text) {
  if (!sock || !isWaConnected) {
    throw new Error('WhatsApp não está conectado no momento.');
  }
  const jid = await resolveWhatsAppJid(phone);
  if (!jid) {
    throw new Error(`Número inválido para WhatsApp: ${phone}`);
  }
  await sock.sendMessage(jid, { text: stripMarkdown(text) });
  return jid;
}

async function replyDirect(remoteJid, text) {
  await sock.sendMessage(remoteJid, { text: stripMarkdown(text) });
}

function formatBrDate(dateStr = '') {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function parseScheduleDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const dateParts = dateStr.split('-').map(Number);
  if (dateParts.length < 3 || dateParts.some(Number.isNaN)) return null;
  const [year, month, day] = dateParts;

  let hour = 19;
  let minute = 0;
  if (timeStr) {
    const match = String(timeStr).match(/(\d{1,2})\s*[:hH]\s*(\d{0,2})/);
    if (match) {
      hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
      minute = match[2] ? Math.min(59, Math.max(0, parseInt(match[2], 10))) : 0;
    }
  }
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatTeamText(sc, sectorId) {
  const meta = SECTOR_META[sectorId] || SECTOR_META.coroinhas;
  const findName = (id) => serversMap.get(id)?.name || 'Desconhecido';
  const lines = [];
  if (sc.mainCeremonialistId) {
    lines.push(`• ${meta.mainRoleTitle}: ${findName(sc.mainCeremonialistId)}`);
  }
  if (Array.isArray(sc.ceremonialistIds) && sc.ceremonialistIds.length > 0) {
    lines.push(`• ${meta.auxLabel}: ${sc.ceremonialistIds.map(findName).join(', ')}`);
  }
  if (Array.isArray(sc.serverIds) && sc.serverIds.length > 0) {
    lines.push(`• ${meta.memberLabel}: ${sc.serverIds.map(findName).join(', ')}`);
  }
  return lines.length > 0 ? lines.join('\n') : 'Equipe em definição';
}

function interpolateTemplate(template, vars) {
  let out = template || '';
  for (const [key, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), val ?? '');
  }
  return stripMarkdown(out);
}

function getSectorConfig(sectorId = 'global') {
  const meta = SECTOR_META[sectorId] || SECTOR_META.coroinhas;
  const globalSaved = botConfigsMap.get('global') || {};
  const sectorSaved = sectorId === 'global' ? {} : (botConfigsMap.get(sectorId) || {});
  return {
    enabled: false,
    proactiveRemindersEnabled: true,
    notifyAllMembers: false,
    hoursBeforeSwapCheck: 12,
    reportCodeMode: 'at_time',
    reportCodeOffsetMinutes: 0,
    notifyAdminPhone: '',
    siteUrl: process.env.SITE_URL || '',
    geminiApiKey: '',
    confessionScheduleInfo: 'Atendimento de confissões mediante agendamento com a secretaria paroquial ou antes das celebrações.',
    dizimoInfo: 'Para se tornar dizimista, atualizar seu cadastro ou solicitar a chave PIX do Dízimo, informe seus dados que a equipe entrará em contato.',
    doacoesInfo: 'Recebemos doações de alimentos não perecíveis e ofertas pela secretaria paroquial.',
    memberReminderTemplate:
      `Paz de Cristo, {membro}! 🙏\n\nPassando para lembrar da sua escala no setor de {setor}:\n\n📍 Local: {capela}\n📅 Data: {data}\n⏰ Horário: {horario}\n👤 Responsável: {comandante}\n\nCaso precise trocar com alguém, avise o responsável com antecedência. Deus abençoe!`,
    swapMessageTemplate:
      `Paz de Cristo, {comandante}! 🙏\n\nVocê está escalado(a) como {cargoPrincipal} no setor de {setor}:\n\n📍 Local: {capela}\n📅 Data: {data}\n⏰ Horário: {horario}\n\n👥 Equipe escalada:\n{equipe}\n\nVocê trocou com alguém ou houve alguma substituição na equipe?\n• Se estiver tudo certo, responda: NÃO\n• Se houve troca, responda: SIM e diga quem trocou com quem.`,
    codeMessageTemplate:
      `Paz de Cristo, {comandante}! ⛪\n\nChegou o momento da celebração em {capela} ({data} às {horario}) pelo setor de {setor}.\n\n🔑 Código para o relatório: {codigo}\n\nPara fazer a chamada e enviar o relatório:\n1. Acesse o site: {siteUrl}\n2. Clique em "Enviar Relatório (Código)"\n3. Informe o código {codigo}\n\nDeus abençoe o seu serviço! ✨`,
    ...sectorSaved,
    ...globalSaved,
    sector: sectorId,
    meta
  };
}

async function writeBotLog({ sector, scheduleId = '', type, direction, targetPhone, targetName, message, scheduleSummary = '', status }) {
  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(doc(db, 'bot_logs', id), {
    id,
    sector: sector || 'coroinhas',
    scheduleId,
    type,
    direction,
    targetPhone: targetPhone || '',
    targetName: targetName || '',
    message: stripMarkdown(message || ''),
    scheduleSummary,
    status: status || 'sent',
    createdAt: new Date().toISOString()
  });
}

async function saveParishRequest({ type, requesterName, requesterPhone, preferredDate = '', details = '' }) {
  const id = `par_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await setDoc(doc(db, 'parish_requests', id), {
    id,
    type,
    requesterName: (requesterName || '').trim(),
    requesterPhone: (requesterPhone || '').trim(),
    preferredDate: (preferredDate || '').trim(),
    details: (details || '').trim(),
    source: 'whatsapp',
    status: 'pending',
    createdAt: new Date().toISOString()
  });
}

async function updateBotHeartbeat(connected, qrDataUrl = '') {
  try {
    await setDoc(doc(db, 'bot_status', 'main'), {
      connected,
      phone: waPhone || '',
      qrDataUrl: connected ? '' : qrDataUrl,
      lastHeartbeat: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erro ao atualizar bot_status:', err.message);
  }
}

// --- Gemini AI Helper (Assistente Virtual da Paróquia Santo Antônio) ---
async function callGeminiAssistant(session, userText) {
  const cfg = getSectorConfig('global');
  const apiKey = (cfg.geminiApiKey || '').trim();
  if (!apiKey || apiKey.length < 20) return null;

  const chapelsSummary = Array.from(chapelsMap.values())
    .map((c) => `${c.name}: ${(c.massTimes || []).join(', ')}`)
    .join(' | ');

  const systemPrompt =
    `Você é o Assistente Virtual da Paróquia Santo Antônio de Lisboa (Palmas - TO). ` +
    `Responda sempre com acolhimento cristão começando com "Paz de Cristo" em saudações, de forma direta, objetiva, caridosa e clara. ` +
    `REGRAS IMPORTANTES: NUNCA use asteriscos (* ou **) nem sublinhados (_) na resposta; escreva texto limpo sem markdown. ` +
    `Você auxilia os fiéis e servidores tanto sobre fé católica, sacramentos, orações, liturgia e serviços da Paróquia Santo Antônio (Confissões, Direção Espiritual, Batismos, Reuniões, Dízimos, Doações, Escalas), quanto em quaisquer outras dúvidas gerais úteis que trouxerem, sempre dentro dos valores cristãos. ` +
    `Horários das comunidades da paróquia: ${chapelsSummary || 'Paróquia Santo Antônio'}. ` +
    `Confissões: ${cfg.confessionScheduleInfo}. Dízimo: ${cfg.dizimoInfo}. Doações: ${cfg.doacoesInfo}.`;

  const models = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-3-flash-preview'];
  for (const model of models) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [...session.history.slice(-8), { role: 'user', parts: [{ text: userText }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
          }),
          signal: AbortSignal.timeout(15000)
        }
      );
      if (!resp.ok) continue;
      const json = await resp.json();
      const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return stripMarkdown(reply);
    } catch {
      // try next model
    }
  }
  return null;
}

// --- Schedule Helpers for Users ---
function getPersonUpcomingSchedules(personList) {
  const ids = new Set(personList.map((s) => s.id));
  return schedulesList
    .filter(
      (sc) =>
        sc.status === 'scheduled' &&
        (ids.has(sc.mainCeremonialistId) ||
          (sc.ceremonialistIds || []).some((id) => ids.has(id)) ||
          (sc.serverIds || []).some((id) => ids.has(id)))
    )
    .sort((a, b) => new Date(a.date || '') - new Date(b.date || ''));
}

function getRoleInSchedule(sc, personList) {
  const ids = new Set(personList.map((s) => s.id));
  const meta = SECTOR_META[sc.sector || 'coroinhas'] || SECTOR_META.coroinhas;
  if (ids.has(sc.mainCeremonialistId)) return `${meta.mainRoleTitle} (Principal)`;
  if ((sc.ceremonialistIds || []).some((id) => ids.has(id))) return meta.auxLabel;
  return meta.memberLabel;
}

// --- Swap Workflow (Anti-spam & Concurrent-safe Transaction) ---
async function initiateSwapRequest(sc, requester, reason, requesterPhone) {
  const scSector = sc.sector || 'coroinhas';
  const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';

  // Ensure only ONE open swap request per (schedule, requester)
  const existingOpen = swapRequestsList.find(
    (r) => r.scheduleId === sc.id && r.requesterId === requester.id && r.status === 'open'
  );
  if (existingOpen) {
    return { ok: false, alreadyExists: true, swapRequest: existingOpen };
  }

  let roleType = 'coroinha';
  if (sc.mainCeremonialistId === requester.id) roleType = 'main_ceremonialist';
  else if ((sc.ceremonialistIds || []).includes(requester.id)) roleType = 'cerimonialist';

  const alreadyInSchedule = new Set(
    [sc.mainCeremonialistId, ...(sc.ceremonialistIds || []), ...(sc.serverIds || [])].filter(Boolean)
  );

  // Target eligible candidates (e.g. cerimoniarios for cerimoniario swaps, or matching category in sector)
  const candidates = Array.from(serversMap.values()).filter((sv) => {
    if (!sv.active || sv.id === requester.id) return false;
    if ((sv.sector || 'coroinhas') !== scSector) return false;
    if (alreadyInSchedule.has(sv.id)) return false;
    if (normalizeDigits(sv.phone).length < 10) return false;
    return sv.category === requester.category;
  });

  const swapId = `sw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const swapCode = String(Math.floor(1000 + Math.random() * 9000));

  const newSwap = {
    id: swapId,
    code: swapCode,
    scheduleId: sc.id,
    sector: scSector,
    chapelName,
    scheduleDate: sc.date || '',
    scheduleTime: sc.time || '',
    requesterId: requester.id,
    requesterName: requester.name,
    requesterPhone: requester.phone || requesterPhone || '',
    requesterCategory: requester.category || '',
    roleType,
    reason: reason.trim(),
    status: 'open',
    notifiedCandidateIds: candidates.map((c) => c.id),
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'swap_requests', swapId), newSwap);

  // Notify each candidate ONCE (no repeated spam)
  let notifiedCount = 0;
  for (const cand of candidates) {
    const offerMsg =
      `Paz de Cristo, ${cand.name}! 🙏\n\n` +
      `${requester.name} solicitou uma troca na escala de ${chapelName}:\n\n` +
      `📅 Data: ${formatBrDate(sc.date)}\n` +
      `⏰ Horário: ${sc.time || ''}\n` +
      `💬 Motivo: ${newSwap.reason}\n\n` +
      `Você teria disponibilidade para servir nesse lugar?\n` +
      `Para aceitar, responda: ACEITAR ${swapCode}`;

    try {
      await sendWhatsAppMessage(cand.phone, offerMsg);
      notifiedCount++;
      await writeBotLog({
        sector: scSector,
        scheduleId: sc.id,
        type: 'swap_offer',
        direction: 'outbound',
        targetPhone: cand.phone,
        targetName: cand.name,
        message: offerMsg,
        scheduleSummary: `Troca ${swapCode} • ${chapelName}`,
        status: 'sent'
      });
    } catch (err) {
      console.warn(`Falha ao enviar oferta de troca para ${cand.name}:`, err.message);
    }
  }

  return { ok: true, swapRequest: newSwap, notifiedCount };
}

async function handleAcceptSwapAttempt(remoteJid, senderMatches, targetSwap) {
  if (!targetSwap) return false;

  const lockKey = targetSwap.id;
  while (activeSwapLocks.has(lockKey)) {
    await new Promise((r) => setTimeout(r, 80));
  }
  activeSwapLocks.add(lockKey);

  try {
    // Pick matching server in that sector (or first matching)
    const acceptor =
      senderMatches.find((s) => (s.sector || 'coroinhas') === targetSwap.sector) ||
      senderMatches[0];

    if (!acceptor) {
      await replyDirect(
        remoteJid,
        `Paz de Cristo! Não consegui localizar seu cadastro completo para confirmar essa troca.`
      );
      return true;
    }

    const txResult = await runTransaction(db, async (tx) => {
      const swapRef = doc(db, 'swap_requests', targetSwap.id);
      const swapSnap = await tx.get(swapRef);
      if (!swapSnap.exists()) return { outcome: 'missing' };

      const swapData = swapSnap.data();
      if (swapData.status !== 'open') {
        return { outcome: 'already_taken', swapData };
      }

      const schedRef = doc(db, 'schedules', swapData.scheduleId);
      const schedSnap = await tx.get(schedRef);
      if (!schedSnap.exists()) return { outcome: 'schedule_missing' };

      const scData = schedSnap.data();
      const scPatch = {};
      if (scData.mainCeremonialistId === swapData.requesterId) {
        scPatch.mainCeremonialistId = acceptor.id;
      } else if ((scData.ceremonialistIds || []).includes(swapData.requesterId)) {
        scPatch.ceremonialistIds = scData.ceremonialistIds.map((id) =>
          id === swapData.requesterId ? acceptor.id : id
        );
      } else if ((scData.serverIds || []).includes(swapData.requesterId)) {
        scPatch.serverIds = scData.serverIds.map((id) =>
          id === swapData.requesterId ? acceptor.id : id
        );
      }
      scPatch.botSwapStatus = 'resolved';
      scPatch.botSwapReply = `Troca aceita pelo WhatsApp: ${swapData.requesterName} -> ${acceptor.name} (Motivo: ${swapData.reason})`;

      tx.update(schedRef, scPatch);
      tx.update(swapRef, {
        status: 'accepted',
        acceptedById: acceptor.id,
        acceptedByName: acceptor.name,
        acceptedByPhone: acceptor.phone || '',
        acceptedAt: new Date().toISOString()
      });

      return { outcome: 'accepted', swapData };
    });

    if (txResult.outcome === 'already_taken') {
      await replyDirect(
        remoteJid,
        `Paz de Cristo, ${acceptor.name}! 🙏\n\nMuito obrigado de coração pela sua disponibilidade em ajudar, mas outro servidor já aceitou e foi encontrado para servir nesse lugar!\n\nQue Deus abençoe muito a sua generosidade.`
      );
      return true;
    }

    if (txResult.outcome === 'accepted') {
      const sw = txResult.swapData;
      const meta = SECTOR_META[sw.sector] || SECTOR_META.coroinhas;
      const dateBr = formatBrDate(sw.scheduleDate);

      // 1. Reply to Acceptor
      await replyDirect(
        remoteJid,
        `Paz de Cristo, ${acceptor.name}! Troca aceita com sucesso! ✅\n\nVocê assumiu a escala em ${sw.chapelName} (${dateBr} às ${sw.scheduleTime}) no lugar de ${sw.requesterName}.\nA escala já foi atualizada automaticamente no sistema. Deus abençoe o seu serviço!`
      );

      // 2. Notify Requester's WhatsApp
      if (sw.requesterPhone && normalizeDigits(sw.requesterPhone).length >= 10) {
        try {
          const reqMsg =
            `Paz de Cristo, ${sw.requesterName}! Boas notícias! ✅\n\n` +
            `${acceptor.name} aceitou a sua solicitação de troca para a escala em ${sw.chapelName} (${dateBr} às ${sw.scheduleTime}).\n\n` +
            `A substituição já foi feita automaticamente no sistema e os coordenadores foram avisados!`;
          await sendWhatsAppMessage(sw.requesterPhone, reqMsg);
        } catch (err) {
          console.error('Erro ao notificar solicitante da troca:', err.message);
        }
      }

      // 3. Notify Sector / Global Coordinators & System Notification Bell
      const sectorCfg = getSectorConfig(sw.sector);
      const globalCfg = getSectorConfig('global');
      const coordinatorPhones = Array.from(
        new Set([sectorCfg.notifyAdminPhone, globalCfg.notifyAdminPhone].filter((p) => p && normalizeDigits(p).length >= 10))
      );

      const coordMsg =
        `Aviso de Troca Realizada (${meta.name}) ✅\n\n` +
        `📍 Escala: ${sw.chapelName} (${dateBr} às ${sw.scheduleTime})\n` +
        `🔄 Saiu: ${sw.requesterName}\n` +
        `👤 Entrou: ${acceptor.name}\n` +
        `💬 Motivo: ${sw.reason}\n\n` +
        `A mudança já foi realizada automaticamente no site.`;

      for (const coordPhone of coordinatorPhones) {
        try {
          await sendWhatsAppMessage(coordPhone, coordMsg);
        } catch (err) {
          console.error('Erro ao notificar coordenador:', err.message);
        }
      }

      await writeBotLog({
        sector: sw.sector,
        scheduleId: sw.scheduleId,
        type: 'swap_accepted',
        direction: 'outbound',
        targetPhone: acceptor.phone || '',
        targetName: `${sw.requesterName} -> ${acceptor.name}`,
        message: coordMsg,
        scheduleSummary: `${sw.chapelName} • ${dateBr}`,
        status: 'completed'
      });

      const reqId = `req_sw_${sw.id}`;
      await setDoc(doc(db, 'system_requests', reqId), {
        id: reqId,
        sector: sw.sector,
        title: `Troca concluída: ${sw.requesterName} -> ${acceptor.name}`,
        description: `${sw.chapelName} (${dateBr} às ${sw.scheduleTime}). Motivo: ${sw.reason}. Sistema atualizado automaticamente.`,
        status: 'open',
        createdAt: new Date().toISOString()
      });

      return true;
    }
  } finally {
    activeSwapLocks.delete(lockKey);
  }
  return false;
}

// --- Automatic 2-Moment Scheduler (runs ONLY once per schedule if proactiveRemindersEnabled) ---
async function checkScheduledNotifications() {
  if (!isWaConnected) return;
  const nowMs = Date.now();

  for (const sc of schedulesList) {
    if (sc.status !== 'scheduled') continue;
    const sectorId = sc.sector || 'coroinhas';
    const cfg = getSectorConfig(sectorId);
    if (!cfg.enabled || !cfg.proactiveRemindersEnabled) continue;

    if (!sc.mainCeremonialistId) continue;
    const principal = serversMap.get(sc.mainCeremonialistId);
    if (!principal || normalizeDigits(principal.phone).length < 10) continue;

    const celebrationDate = parseScheduleDateTime(sc.date, sc.time);
    if (!celebrationDate) continue;
    const celebrationMs = celebrationDate.getTime();

    const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
    const summary = `${chapelName} • ${formatBrDate(sc.date)} ${sc.time || ''}`;
    const vars = {
      comandante: principal.name,
      cargoPrincipal: cfg.meta.mainRoleTitle,
      setor: cfg.meta.name,
      capela: chapelName,
      data: formatBrDate(sc.date),
      horario: sc.time || '',
      codigo: sc.code || '',
      siteUrl: cfg.siteUrl || process.env.SITE_URL || '',
      equipe: formatTeamText(sc, sectorId)
    };

    // MOMENT 1: Ask about swaps once
    const swapSendAtMs = celebrationMs - (Number(cfg.hoursBeforeSwapCheck) || 12) * 3600 * 1000;
    const swapJobKey = `${sc.id}_swap`;
    if (
      !sc.botSwapCheckSentAt &&
      !processingScheduleJobs.has(swapJobKey) &&
      nowMs >= swapSendAtMs &&
      nowMs <= celebrationMs + 2 * 3600 * 1000
    ) {
      processingScheduleJobs.add(swapJobKey);
      try {
        const sentAt = new Date().toISOString();
        // Mark BEFORE sending to guarantee zero duplicate spam
        await updateDoc(doc(db, 'schedules', sc.id), {
          botSwapCheckSentAt: sentAt,
          botSwapStatus: 'waiting_reply'
        });
        const text = interpolateTemplate(cfg.swapMessageTemplate, vars);
        await sendWhatsAppMessage(principal.phone, text);
        await writeBotLog({
          sector: sectorId,
          scheduleId: sc.id,
          type: 'swap_check',
          direction: 'outbound',
          targetPhone: principal.phone,
          targetName: principal.name,
          message: text,
          scheduleSummary: summary,
          status: 'sent_auto'
        });
        console.log(`[1º Momento - Troca] Enviado para ${principal.name} (${summary})`);
      } catch (err) {
        console.error(`Falha no 1º momento (${summary}):`, err.message);
      } finally {
        processingScheduleJobs.delete(swapJobKey);
      }
    }

    // Optional individual reminders once
    const membersJobKey = `${sc.id}_members`;
    if (
      cfg.notifyAllMembers &&
      !sc.botMembersNotifiedAt &&
      !processingScheduleJobs.has(membersJobKey) &&
      nowMs >= swapSendAtMs &&
      nowMs <= celebrationMs + 2 * 3600 * 1000
    ) {
      processingScheduleJobs.add(membersJobKey);
      try {
        await updateDoc(doc(db, 'schedules', sc.id), {
          botMembersNotifiedAt: new Date().toISOString()
        });
        const otherIds = Array.from(
          new Set([...(sc.ceremonialistIds || []), ...(sc.serverIds || [])])
        ).filter((id) => id && id !== sc.mainCeremonialistId);

        let sentCount = 0;
        for (const memberId of otherIds) {
          const member = serversMap.get(memberId);
          if (!member || normalizeDigits(member.phone).length < 10) continue;
          const memberMsg = interpolateTemplate(cfg.memberReminderTemplate, {
            ...vars,
            membro: member.name
          });
          try {
            await sendWhatsAppMessage(member.phone, memberMsg);
            sentCount++;
          } catch (mErr) {
            console.warn(`Falha ao lembrar membro ${member.name}:`, mErr.message);
          }
        }
        if (sentCount > 0) {
          await writeBotLog({
            sector: sectorId,
            scheduleId: sc.id,
            type: 'member_reminder',
            direction: 'outbound',
            targetPhone: `${sentCount} membro(s)`,
            targetName: `Equipe (${sentCount})`,
            message: `Lembrete individual enviado para ${sentCount} membro(s) da escala.`,
            scheduleSummary: summary,
            status: 'sent_auto'
          });
        }
      } catch (err) {
        console.error(`Falha ao notificar equipe (${summary}):`, err.message);
      } finally {
        processingScheduleJobs.delete(membersJobKey);
      }
    }

    // MOMENT 2: Send 4-digit report code once on celebration day/time
    let codeSendAtMs = celebrationMs;
    if (cfg.reportCodeMode === 'morning_of_day') {
      const morning = new Date(celebrationDate);
      morning.setHours(7, 0, 0, 0);
      codeSendAtMs = morning.getTime();
    } else if (cfg.reportCodeMode === '30_before') {
      codeSendAtMs = celebrationMs - 30 * 60 * 1000;
    } else if (cfg.reportCodeMode === '60_after') {
      codeSendAtMs = celebrationMs + 60 * 60 * 1000;
    }

    const codeJobKey = `${sc.id}_code`;
    if (
      !sc.botCodeSentAt &&
      !processingScheduleJobs.has(codeJobKey) &&
      nowMs >= codeSendAtMs &&
      nowMs <= celebrationMs + 24 * 3600 * 1000
    ) {
      processingScheduleJobs.add(codeJobKey);
      try {
        const sentAt = new Date().toISOString();
        await updateDoc(doc(db, 'schedules', sc.id), {
          botCodeSentAt: sentAt
        });
        const text = interpolateTemplate(cfg.codeMessageTemplate, vars);
        await sendWhatsAppMessage(principal.phone, text);
        await writeBotLog({
          sector: sectorId,
          scheduleId: sc.id,
          type: 'report_code',
          direction: 'outbound',
          targetPhone: principal.phone,
          targetName: principal.name,
          message: text,
          scheduleSummary: summary,
          status: 'sent_auto'
        });
        console.log(`[2º Momento - Código] Enviado (${sc.code}) para ${principal.name} (${summary})`);
      } catch (err) {
        console.error(`Falha no 2º momento (${summary}):`, err.message);
      } finally {
        processingScheduleJobs.delete(codeJobKey);
      }
    }
  }
}

// --- Conversational Menu Builders ---
function buildMainMenuText(name = '') {
  return (
    `Paz de Cristo${name ? `, ${name}` : ''}! 🙏\n\n` +
    `Eu sou o Assistente Virtual da Paróquia Santo Antônio.\n` +
    `Como posso ajudar você hoje?\n\n` +
    `1 - ⛪🙏 Marcar Confissão\n\n` +
    `2 - 🧭✨ Direção Espiritual\n\n` +
    `3 - 💧🕊️ Batismos\n\n` +
    `4 - 🤝📅 Reuniões\n\n` +
    `5 - 🌾❤️ Dízimos\n\n` +
    `6 - 🎁🤲 Doações\n\n` +
    `7 - 📋⛪ Escalas\n\n` +
    `8 - 💬❓ Outros\n\n` +
    `Responda com o número ou digite sua pergunta!`
  );
}

function buildEscalasMenuText(name = '') {
  return (
    `Certo, ${name || 'irmão(ã)'}! 📋 Sobre as suas escalas, escolha o que deseja:\n\n` +
    `1. Troca\n` +
    `2. Código do Relatório\n` +
    `3. Ver minhas escalas`
  );
}

// --- Incoming WhatsApp Handler (Menu ONLY on contact + full Assistant + Swaps) ---
async function handleIncomingMessage(msg) {
  try {
    if (!msg.message || msg.key.fromMe) return;
    const remoteJid = msg.key.remoteJid || '';
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') return;

    const text = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''
    ).trim();
    if (!text) return;

    const norm = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const senderDigits = normalizeDigits(remoteJid.split('@')[0]);
    const session = getSession(remoteJid);
    session.history.push({ role: 'user', parts: [{ text }] });

    // Check identity: first explicit phone override in session, otherwise sender WhatsApp number
    const lookupPhone = session.identifiedPhone || senderDigits;
    let personMatches = matchServersByPhone(lookupPhone);
    let personName = personMatches[0]?.name || '';

    // Log inbound message
    await writeBotLog({
      sector: personMatches[0]?.sector || 'coroinhas',
      type: 'chat_inbound',
      direction: 'inbound',
      targetPhone: senderDigits,
      targetName: personName || senderDigits,
      message: text,
      status: 'received'
    });

    // 1. Detect explicit phone identification statement (e.g. "meu numero de telefone e 000")
    const phonePhraseMatch = norm.match(/(?:meu\s*(?:numero\s*(?:de\s*)?(?:telefone|whatsapp|zap|celular)?|telefone|whatsapp|zap|celular))\s*(?:e|:)?\s*([\d\s().-]{3,20})/i);
    if (phonePhraseMatch && session.step === 'idle') {
      const candidatePhone = normalizeDigits(phonePhraseMatch[1]);
      const matched = matchServersByPhone(candidatePhone);
      if (matched.length > 0) {
        session.identifiedPhone = candidatePhone;
        personMatches = matched;
        personName = matched[0].name;
        const sectorsLabel = matched.map((m) => (SECTOR_META[m.sector || 'coroinhas'] || SECTOR_META.coroinhas).name).join(', ');
        session.step = 'escalas_menu';
        await replyDirect(
          remoteJid,
          `Paz de Cristo, ${personName}! 🙏 Identifiquei você pelo número (${sectorsLabel}).\n\n` +
            buildEscalasMenuText(personName)
        );
        return;
      }
      await replyDirect(
        remoteJid,
        `Paz de Cristo! Procurei o número informado no sistema, mas ainda não encontrei um cadastro com ele. Peça ao coordenador do seu setor para conferir o número em Perfis.`
      );
      return;
    }

    // 2. Check if this is an ACEITAR swap response (e.g. "ACEITAR 4829" or "ACEITAR")
    const acceptMatch = norm.match(/^aceitar(?:\s+(\d{4}))?$/i);
    if (acceptMatch) {
      const codeParam = acceptMatch[1];
      let targetSwap = null;
      if (codeParam) {
        targetSwap = swapRequestsList.find((r) => r.code === codeParam);
      } else {
        // Find swap requests where this person was notified (even if recently accepted by someone else)
        const myIds = new Set(personMatches.map((m) => m.id));
        targetSwap = swapRequestsList.find((r) =>
          (r.notifiedCandidateIds || []).some((id) => myIds.has(id))
        );
      }
      if (targetSwap) {
        await handleAcceptSwapAttempt(remoteJid, personMatches, targetSwap);
        return;
      }
    }

    // 3. Universal Menu/Back shortcut
    if (norm === 'menu' || norm === 'voltar' || norm === 'inicio' || norm === 'cancelar') {
      session.step = 'idle';
      session.data = {};
      await replyDirect(remoteJid, buildMainMenuText(personName));
      return;
    }

    // 4. Check if they are replying directly to a proactive Principal swap_check (only when idle & explicitly saying NAO / SIM / troquei)
    if (session.step === 'idle' && personMatches.length > 0) {
      const myIds = new Set(personMatches.map((m) => m.id));
      const waitingSchedule = schedulesList
        .filter(
          (sc) =>
            sc.status === 'scheduled' &&
            myIds.has(sc.mainCeremonialistId) &&
            sc.botSwapCheckSentAt &&
            sc.botSwapStatus === 'waiting_reply'
        )
        .sort((a, b) => (b.botSwapCheckSentAt || '').localeCompare(a.botSwapCheckSentAt || ''))[0];

      if (waitingSchedule) {
        const isNoSwap = /^(nao|não|n|tudo certo|sem troca|sem trocas|confirmado)\b/i.test(norm);
        const isSwapReply = /^(sim|s|troquei|trocou)\b/i.test(norm) || norm.includes('trocou com') || norm.includes('troquei com');

        if (isNoSwap) {
          const chapelName = chapelsMap.get(waitingSchedule.chapelId)?.name || 'Capela';
          await updateDoc(doc(db, 'schedules', waitingSchedule.id), {
            botSwapStatus: 'confirmed',
            botSwapReply: text
          });
          await replyDirect(
            remoteJid,
            `Perfeito, ${personName}! 🙏\n\nEscala de ${chapelName} (${formatBrDate(waitingSchedule.date)}) confirmada sem trocas.\n\nNo dia e horário da celebração enviarei o código do relatório por aqui. Deus abençoe!`
          );
          return;
        }
        if (isSwapReply) {
          const chapelName = chapelsMap.get(waitingSchedule.chapelId)?.name || 'Capela';
          const scSector = waitingSchedule.sector || 'coroinhas';
          const cfg = getSectorConfig(scSector);
          await updateDoc(doc(db, 'schedules', waitingSchedule.id), {
            botSwapStatus: 'swap_reported',
            botSwapReply: text
          });
          await replyDirect(
            remoteJid,
            `Anotado, ${personName}! ✅\n\nRegistrei seu aviso sobre ${chapelName} (${formatBrDate(waitingSchedule.date)}) e avisei a coordenação.`
          );
          if (cfg.notifyAdminPhone && normalizeDigits(cfg.notifyAdminPhone).length >= 10) {
            try {
              await sendWhatsAppMessage(
                cfg.notifyAdminPhone,
                `Aviso de Troca (${(SECTOR_META[scSector] || SECTOR_META.coroinhas).name})\n\n📍 ${chapelName} (${formatBrDate(waitingSchedule.date)} às ${waitingSchedule.time || ''})\n👤 ${personName}: "${text}"`
              );
            } catch {
              // ignore
            }
          }
          return;
        }
      }
    }

    // 5. Handle active conversation steps
    if (session.step === 'parish_name') {
      session.data.requesterName = text;
      session.step = 'parish_details';
      const type = session.data.type;
      const hint =
        type === 'batismo'
          ? 'Informe o nome da criança, nome dos pais e a data pretendida:'
          : type === 'confissao'
          ? `${getSectorConfig('global').confessionScheduleInfo}\n\nQual dia e horário de sua preferência?`
          : type === 'outros'
          ? 'Digite aqui sua dúvida, recado ou solicitação para a equipe da Paróquia:'
          : 'Qual dia/horário preferido ou observação para esse atendimento?';
      await replyDirect(remoteJid, `Obrigado, ${text}! Agora ${hint.charAt(0).toLowerCase() + hint.slice(1)}`);
      return;
    }

    if (session.step === 'parish_details') {
      const { type, label, requesterName } = session.data;
      await saveParishRequest({
        type,
        requesterName: requesterName || personName || senderDigits,
        requesterPhone: senderDigits,
        preferredDate: text,
        details: text
      });
      session.step = 'idle';
      session.data = {};
      await replyDirect(
        remoteJid,
        `Perfeito, ${requesterName || personName || 'irmão(ã)'}! 🙏\n\nSua solicitação de ${label} foi registrada com sucesso na Paróquia Santo Antônio.\nEntraremos em contato neste mesmo WhatsApp para confirmar.\n\nDigite "menu" sempre que precisar. Deus abençoe!`
      );
      return;
    }

    if (session.step === 'escalas_identify_phone') {
      const candidatePhone = normalizeDigits(text);
      const matched = matchServersByPhone(candidatePhone);
      if (matched.length === 0) {
        await replyDirect(
          remoteJid,
          `Não encontrei nenhum cadastro com "${text}". Confira os dígitos (ou peça ao coordenador para verificar seu celular) ou digite "menu" para voltar.`
        );
        return;
      }
      session.identifiedPhone = candidatePhone;
      personMatches = matched;
      personName = matched[0].name;
      session.step = 'escalas_menu';
      await replyDirect(
        remoteJid,
        `Paz de Cristo, ${personName}! Cadastro identificado.\n\n` + buildEscalasMenuText(personName)
      );
      return;
    }

    if (session.step === 'escalas_menu') {
      if (norm === '1' || norm.includes('troca')) {
        const mySc = getPersonUpcomingSchedules(personMatches);
        if (mySc.length === 0) {
          session.step = 'idle';
          await replyDirect(remoteJid, `Você não possui escalas futuras agendadas no momento para solicitar troca.`);
          return;
        }
        if (mySc.length === 1) {
          const sc = mySc[0];
          const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
          session.step = 'swap_reason';
          session.data = { schedule: sc };
          await replyDirect(
            remoteJid,
            `Escala selecionada: ${chapelName} (${formatBrDate(sc.date)} às ${sc.time || ''}).\n\nQual é o motivo da troca?`
          );
          return;
        }
        const listText = mySc
          .map((sc, idx) => {
            const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
            const secName = (SECTOR_META[sc.sector || 'coroinhas'] || SECTOR_META.coroinhas).name;
            return `${idx + 1}. [${secName}] ${chapelName} • ${formatBrDate(sc.date)} às ${sc.time || ''}`;
          })
          .join('\n');
        session.step = 'swap_pick_schedule';
        session.data = { choices: mySc };
        await replyDirect(remoteJid, `Em qual dessas escalas você deseja pedir troca? Responda com o número:\n\n${listText}`);
        return;
      }

      if (norm === '2' || norm.includes('codigo') || norm.includes('relatorio')) {
        session.step = 'idle';
        const mySc = getPersonUpcomingSchedules(personMatches);
        const myIds = new Set(personMatches.map((s) => s.id));
        const principalSc = mySc.filter((sc) => myIds.has(sc.mainCeremonialistId));

        if (principalSc.length === 0) {
          const extra =
            mySc.length > 0
              ? `\n\nNa sua próxima escala (${chapelsMap.get(mySc[0].chapelId)?.name || 'Capela'}, ${formatBrDate(mySc[0].date)}), você está como ${getRoleInSchedule(mySc[0], personMatches)}.`
              : '';
          await replyDirect(
            remoteJid,
            `${personName}, verifiquei no sistema e você não foi escalado como Principal em nenhuma escala ativa no momento.${extra}`
          );
          return;
        }

        const lines = principalSc.map((sc) => {
          const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
          const secName = (SECTOR_META[sc.sector || 'coroinhas'] || SECTOR_META.coroinhas).name;
          return `• [${secName}] ${chapelName} (${formatBrDate(sc.date)} às ${sc.time || ''})\n  Código do Relatório: ${sc.code}`;
        });
        await replyDirect(
          remoteJid,
          `Paz de Cristo, ${personName}! 🔑\n\nVocê está como Principal nas seguintes escalas:\n\n${lines.join('\n\n')}\n\nPara enviar o relatório no site, clique em "Enviar Relatório (Código)" na aba do seu setor.`
        );
        return;
      }

      if (norm === '3' || norm.includes('minhas') || norm.includes('ver')) {
        session.step = 'idle';
        const mySc = getPersonUpcomingSchedules(personMatches);
        if (mySc.length === 0) {
          await replyDirect(remoteJid, `Paz de Cristo, ${personName}! Você não possui escalas futuras agendadas no momento.`);
          return;
        }
        const lines = mySc.map((sc, i) => {
          const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
          const secName = (SECTOR_META[sc.sector || 'coroinhas'] || SECTOR_META.coroinhas).name;
          return `${i + 1}. [${secName}] ${chapelName} • ${formatBrDate(sc.date)} às ${sc.time || ''} — ${getRoleInSchedule(sc, personMatches)}`;
        });
        await replyDirect(remoteJid, `Paz de Cristo, ${personName}! Suas próximas escalas:\n\n${lines.join('\n')}`);
        return;
      }

      await replyDirect(remoteJid, `Escolha 1 (Troca), 2 (Código do Relatório) ou 3 (Ver minhas escalas), ou digite "menu" para voltar.`);
      return;
    }

    if (session.step === 'swap_pick_schedule') {
      const idx = parseInt(norm, 10) - 1;
      const choices = session.data.choices || [];
      if (Number.isNaN(idx) || idx < 0 || idx >= choices.length) {
        await replyDirect(remoteJid, `Número inválido. Escolha de 1 a ${choices.length} ou digite "menu".`);
        return;
      }
      const sc = choices[idx];
      const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
      session.step = 'swap_reason';
      session.data = { schedule: sc };
      await replyDirect(remoteJid, `Certo! Qual é o motivo da troca para ${chapelName} (${formatBrDate(sc.date)})?`);
      return;
    }

    if (session.step === 'swap_reason') {
      const sc = session.data.schedule;
      const requester =
        personMatches.find(
          (sv) =>
            sv.id === sc.mainCeremonialistId ||
            (sc.ceremonialistIds || []).includes(sv.id) ||
            (sc.serverIds || []).includes(sv.id)
        ) || personMatches[0];

      const res = await initiateSwapRequest(sc, requester, text, senderDigits);
      session.step = 'idle';
      session.data = {};

      if (res.alreadyExists) {
        await replyDirect(
          remoteJid,
          `Já existe uma solicitação de troca aberta para esta escala (código ${res.swapRequest.code}). Para evitar mensagens repetidas, estamos aguardando um colega aceitar!`
        );
        return;
      }

      if (res.ok) {
        await replyDirect(
          remoteJid,
          `Solicitação de troca registrada, ${requester.name}! ✅\n\nMotivo: "${text}"\nEnviei uma única solicitação via WhatsApp para ${res.notifiedCount} colega(s) disponível(is).\n\nAssim que alguém aceitar, a escala será atualizada no sistema e avisaremos você e os coordenadores!`
        );
      } else {
        await replyDirect(remoteJid, `Não foi possível registrar a troca agora. Tente novamente mais tarde.`);
      }
      return;
    }

    // 6. Idle Main Menu Selection (ONLY when user contacts us)
    const startBooking = async (type, label) => {
      const cfg = getSectorConfig('global');
      if (personName) {
        session.step = 'parish_details';
        session.data = { type, label, requesterName: personName };
        const extra =
          type === 'batismo'
            ? 'Informe o nome da criança, nome dos pais e a data pretendida:'
            : type === 'confissao'
            ? `${cfg.confessionScheduleInfo}\n\nQual dia e horário de sua preferência?`
            : type === 'dizimo'
            ? `${cfg.dizimoInfo}\n\nDeseja fazer cadastro, solicitar chave PIX ou deixar alguma observação?`
            : type === 'doacao'
            ? `${cfg.doacoesInfo}\n\nQual doação você gostaria de fazer ou combinar?`
            : type === 'outros'
            ? 'Pode digitar aqui sua dúvida, recado ou solicitação que vamos responder e encaminhar para a equipe da Paróquia!'
            : 'Qual dia/horário preferido e observação?';
        await replyDirect(remoteJid, `Paz de Cristo, ${personName}! Vamos registrar sua solicitação de ${label}.\n\n${extra}`);
      } else {
        session.step = 'parish_name';
        session.data = { type, label };
        await replyDirect(remoteJid, `Paz de Cristo! Com alegria vamos atender seu pedido de ${label}.\n\nQual é o seu nome completo?`);
      }
    };

    if (norm === '1' || norm.includes('confiss')) return await startBooking('confissao', 'Confissão');
    if (norm === '2' || norm.includes('direcao') || norm.includes('espiritual')) return await startBooking('direcao_espiritual', 'Direção Espiritual');
    if (norm === '3' || norm.includes('batism')) return await startBooking('batismo', 'Batismo');
    if (norm === '4' || norm.includes('reunia')) return await startBooking('reuniao', 'Reunião');
    if (norm === '5' || norm.includes('dizim')) return await startBooking('dizimo', 'Dízimo');
    if (norm === '6' || norm.includes('doac') || norm.includes('doar')) return await startBooking('doacao', 'Doação');
    if (norm === '8' || norm === 'outro' || norm === 'outros') return await startBooking('outros', 'Outros Assuntos');

    if (norm === '7' || norm.includes('escala') || norm.includes('minhas escalas')) {
      if (personMatches.length === 0) {
        session.step = 'escalas_identify_phone';
        session.data = {};
        await replyDirect(
          remoteJid,
          `Paz de Cristo! Para acessar suas escalas, informar troca ou pegar seu código de relatório, me diga o seu número de telefone cadastrado (com DDD ou seu número de cadastro):`
        );
        return;
      }
      session.step = 'escalas_menu';
      session.data = {};
      await replyDirect(remoteJid, buildEscalasMenuText(personName));
      return;
    }

    // 7. Greeting -> Menu
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|paz|paz de cristo|salve maria|ajuda|start)$/i.test(norm)) {
      await replyDirect(remoteJid, buildMainMenuText(personName));
      return;
    }

    // 8. Conversational Gemini AI for Catholic faith & parish questions (when Gemini API Key is set)
    const aiReply = await callGeminiAssistant(session, text);
    if (aiReply) {
      session.history.push({ role: 'model', parts: [{ text: aiReply }] });
      await replyDirect(remoteJid, aiReply);
      return;
    }

    // Default clean menu response
    await replyDirect(remoteJid, buildMainMenuText(personName));
  } catch (err) {
    console.error('Erro ao processar mensagem recebida:', err);
  }
}

// --- Firestore Listeners ---
function startFirestoreListeners() {
  onSnapshot(collection(db, 'chapels'), (snap) => {
    const next = new Map();
    snap.docs.forEach((d) => next.set(d.id, { id: d.id, ...d.data() }));
    chapelsMap = next;
  });

  onSnapshot(collection(db, 'servers'), (snap) => {
    const next = new Map();
    snap.docs.forEach((d) => next.set(d.id, { id: d.id, ...d.data() }));
    serversMap = next;
  });

  onSnapshot(collection(db, 'schedules'), (snap) => {
    schedulesList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });

  onSnapshot(collection(db, 'bot_configs'), (snap) => {
    const next = new Map();
    snap.docs.forEach((d) => next.set(d.id, { id: d.id, ...d.data() }));
    botConfigsMap = next;
  });

  onSnapshot(collection(db, 'swap_requests'), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    swapRequestsList = list;
  });

  // Real-time manual/web dispatch queue
  onSnapshot(collection(db, 'bot_outbox'), async (snap) => {
    if (!isWaConnected) return;
    for (const d of snap.docs) {
      const item = { id: d.id, ...d.data() };
      if (item.status !== 'pending' || processingOutboxIds.has(item.id)) continue;

      processingOutboxIds.add(item.id);
      try {
        await sendWhatsAppMessage(item.targetPhone, item.message);
        await updateDoc(doc(db, 'bot_outbox', item.id), {
          status: 'sent',
          sentAt: new Date().toISOString()
        });
        console.log(`[Fila] Mensagem enviada para ${item.targetName || item.targetPhone}`);
      } catch (err) {
        console.error(`[Fila] Erro para ${item.targetPhone}:`, err.message);
        await updateDoc(doc(db, 'bot_outbox', item.id), {
          status: 'error',
          error: err.message
        });
      } finally {
        processingOutboxIds.delete(item.id);
      }
    }
  });
}

// --- Baileys WhatsApp Connection ---
async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 ESCANEIE O QR CODE ABAIXO COM O WHATSAPP DA PARÓQUIA:\n');
      qrcode.generate(qr, { small: true });
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 260, margin: 2 });
        await updateBotHeartbeat(false, qrDataUrl);
      } catch (err) {
        console.error('Erro ao gerar QR Code para o painel web:', err.message);
      }
    }

    if (connection === 'open') {
      isWaConnected = true;
      waPhone = (sock.user?.id || '').split(':')[0];
      console.log(`\n✅ Assistente Virtual da Paróquia Santo Antônio conectado (${waPhone})!\n`);
      await updateBotHeartbeat(true, '');
      await checkScheduledNotifications();
    }

    if (connection === 'close') {
      isWaConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      if (isLoggedOut) {
        console.log('🔄 Sessão desconectada (401). Limpando credenciais para gerar novo QR Code...');
        try {
          fs.rmSync('./auth_info', { recursive: true, force: true });
        } catch {
          // ignore
        }
        await updateBotHeartbeat(false, '');
        setTimeout(startWhatsAppBot, 2000);
      } else {
        console.log(`⚠️ Conexão fechada (código ${statusCode}). Reconectando...`);
        await updateBotHeartbeat(false, '');
        setTimeout(startWhatsAppBot, 4000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      await handleIncomingMessage(msg);
    }
  });
}

console.log('⛪ Iniciando Assistente Virtual da Paróquia Santo Antônio...');
await ensureFirestoreBase(db, process.env.SITE_URL || 'http://localhost:5173');
startFirestoreListeners();
await startWhatsAppBot();

setInterval(async () => {
  if (isWaConnected) {
    await updateBotHeartbeat(true, '');
    await checkScheduledNotifications();
  }
}, 60 * 1000);
