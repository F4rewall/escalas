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
  mece: { name: 'MESCE', mainRoleTitle: 'Ministro Coordenador', auxLabel: 'Ministros Auxiliares', memberLabel: 'Ministros (MESCE)' }
};

// In-memory state synced with Firestore
let chapelsMap = new Map();
let serversMap = new Map();
let schedulesList = [];
let botConfigsMap = new Map();
let swapRequestsList = [];
let whatsappContactsMap = new Map();
let parishRequestsList = [];

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
    sessions.set(jid, { step: 'idle', data: {}, identifiedPhone: '', history: [], welcomed: false });
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
  const cleanText = stripMarkdown(text);
  await sock.sendMessage(jid, { text: cleanText });
  const digits = normalizeDigits(phone);
  if (digits) {
    appendContactHistory(digits, [{ role: 'model', text: cleanText }]).catch(() => {});
  }
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

// --- Persistent Contact Memory & Conversation History (remembers names, info & past chats across restarts) ---
const MAX_PERSISTED_HISTORY = 24;

function findContactMemory(senderDigits) {
  if (!senderDigits) return null;
  if (whatsappContactsMap.has(senderDigits)) {
    return whatsappContactsMap.get(senderDigits);
  }
  const last8 = senderDigits.length >= 8 ? senderDigits.slice(-8) : senderDigits;
  for (const contact of whatsappContactsMap.values()) {
    const cDigits = normalizeDigits(contact.phone);
    if (cDigits && ((senderDigits.length >= 8 && cDigits.slice(-8) === last8) || cDigits === senderDigits)) {
      return contact;
    }
  }
  // Fallback: check parish_requests for historical name
  const prevReq = parishRequestsList.find((r) => {
    const rDigits = normalizeDigits(r.requesterPhone);
    return rDigits && ((senderDigits.length >= 8 && rDigits.slice(-8) === last8) || rDigits === senderDigits);
  });
  if (prevReq) {
    return {
      phone: senderDigits,
      name: prevReq.requesterName || '',
      recentRequests: [`${prevReq.type}: ${prevReq.details || prevReq.preferredDate || ''}`.slice(0, 100)],
      conversationHistory: []
    };
  }
  return null;
}

async function upsertContactMemory(senderDigits, patch = {}) {
  if (!senderDigits) return;
  const existing = findContactMemory(senderDigits) || {};
  const docId = existing.id || existing.phone || senderDigits;
  const merged = {
    ...existing,
    ...patch,
    id: docId,
    phone: existing.phone || senderDigits,
    updatedAt: new Date().toISOString()
  };
  whatsappContactsMap.set(docId, merged);
  try {
    await setDoc(doc(db, 'whatsapp_contacts', docId), merged, { merge: true });
  } catch (err) {
    console.warn('Erro ao salvar memoria do contato:', err.message);
  }
}

async function appendContactHistory(senderDigits, newTurns = [], extraPatch = {}) {
  if (!senderDigits || !Array.isArray(newTurns) || newTurns.length === 0) return;
  const existing = findContactMemory(senderDigits) || {};
  const prevList = Array.isArray(existing.conversationHistory) ? existing.conversationHistory : [];
  const normalizedNew = newTurns
    .filter((t) => t && t.text && String(t.text).trim())
    .map((t) => ({
      role: t.role === 'model' ? 'model' : 'user',
      text: stripMarkdown(String(t.text)).slice(0, 500),
      at: t.at || new Date().toISOString(),
      ...(t.topic ? { topic: String(t.topic).slice(0, 80) } : {})
    }));
  if (normalizedNew.length === 0) return;

  const updatedHistory = [...prevList, ...normalizedNew].slice(-MAX_PERSISTED_HISTORY);
  await upsertContactMemory(senderDigits, {
    ...extraPatch,
    conversationHistory: updatedHistory,
    lastInteractionAt: normalizedNew[normalizedNew.length - 1].at
  });
}

function hydrateSessionFromMemory(session, contactMemory) {
  if (!session || session._hydratedFromDb) return;
  session._hydratedFromDb = true;
  const saved = Array.isArray(contactMemory?.conversationHistory) ? contactMemory.conversationHistory : [];
  if (session.history.length === 0 && saved.length > 0) {
    session.history = saved.slice(-MAX_PERSISTED_HISTORY).map((item) => ({
      role: item.role === 'model' ? 'model' : 'user',
      parts: [{ text: item.text }],
      at: item.at || ''
    }));
  }
}

async function replyAndTrack(remoteJid, senderDigits, text, { recordText = null, topic = '' } = {}) {
  const cleanText = stripMarkdown(text);
  await replyDirect(remoteJid, cleanText);
  const session = getSession(remoteJid);
  const savedBotText = stripMarkdown(recordText || cleanText).slice(0, 500);
  if (savedBotText) {
    session.history.push({ role: 'model', parts: [{ text: savedBotText }], at: new Date().toISOString() });
    if (session.history.length > MAX_PERSISTED_HISTORY * 2) {
      session.history = session.history.slice(-MAX_PERSISTED_HISTORY);
    }
    if (senderDigits) {
      await appendContactHistory(senderDigits, [{ role: 'model', text: savedBotText, topic }]);
    }
  }
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

// --- Response Validation & Guidance Filter ---
const NON_NAME_WORDS = new Set([
  // Animais
  'cachorro', 'cachorra', 'cao', 'cadela', 'gato', 'gata', 'gatinho', 'gatinha', 'papagaio', 'passaro', 'passarinho',
  'cavalo', 'egua', 'burro', 'jumento', 'mula', 'vaca', 'boi', 'touro', 'bezerro', 'porco', 'porca', 'leitao',
  'galinha', 'galo', 'pinto', 'pato', 'ganso', 'peru', 'macaco', 'leao', 'tigre', 'onca', 'elefante', 'girafa',
  'hipopotamo', 'zebra', 'urso', 'lobo', 'raposa', 'coelho', 'coelha', 'rato', 'ratazana', 'hamster', 'cobra',
  'serpente', 'jacare', 'crocodilo', 'tartaruga', 'sapo', 'ra', 'peixe', 'tubarao', 'baleia', 'golfinho', 'pombo',
  'pomba', 'coruja', 'aguia', 'falcao', 'formiga', 'abelha', 'barata', 'mosca', 'mosquito', 'aranha', 'dinossauro',
  'bicho', 'animal', 'pet', 'dog', 'cat',
  // Objetos, comida e aleatoriedades comuns em testes
  'mesa', 'cadeira', 'sofa', 'cama', 'porta', 'janela', 'parede', 'teto', 'chao', 'casa', 'predio', 'apartamento',
  'carro', 'moto', 'onibus', 'caminhao', 'bicicleta', 'aviao', 'barco', 'celular', 'telefone', 'computador', 'notebook',
  'teclado', 'mouse', 'monitor', 'televisao', 'tv', 'geladeira', 'fogao', 'microondas', 'ventilador', 'ar', 'sapato',
  'tenis', 'chinelo', 'sandalia', 'roupa', 'camisa', 'camiseta', 'calca', 'short', 'vestido', 'blusa', 'boné', 'bone',
  'bola', 'livro', 'caderno', 'caneta', 'lapis', 'borracha', 'papel', 'pedra', 'madeira', 'ferro', 'agua', 'fogo',
  'terra', 'arroz', 'feijao', 'carne', 'frango', 'pao', 'bolo', 'bolacha', 'biscoito', 'banana', 'maca', 'laranja',
  'uva', 'melancia', 'abacaxi', 'morango', 'manga', 'limao', 'batata', 'tomate', 'cebola', 'alho', 'sal', 'acucar',
  'cafe', 'leite', 'suco', 'refrigerante', 'cerveja', 'vinho', 'pizza', 'hamburguer', 'lanche', 'pastel', 'coxinha',
  'sorvete', 'chocolate', 'doce', 'bala', 'chiclete', 'pipoca', 'queijo', 'ovo', 'macarrao',
  // Termos de teste, saudações, negações, opções e palavras ofensivas
  'teste', 'testando', 'test', 'exemplo', 'fulano', 'beltrano', 'ciclano', 'anonimo', 'usuario', 'ninguem', 'nada',
  'tudo', 'coisa', 'negocio', 'trem', 'nao', 'sim', 'talvez', 'ok', 'blz', 'beleza', 'certo', 'sei', 'naosei',
  'desconhecido', 'qualquer', 'tanto', 'faz', 'menu', 'voltar', 'cancelar', 'sair', 'inicio', 'ajuda', 'start',
  'oi', 'ola', 'eai', 'fala', 'bom', 'boa', 'dia', 'tarde', 'noite', 'obrigado', 'obrigada', 'valeu', 'pfv',
  'dizimo', 'dizimos', 'confissao', 'batismo', 'batismos', 'reuniao', 'reunioes', 'doacao', 'doacoes', 'escala',
  'escalas', 'outros', 'outro', 'igreja', 'paroquia', 'capela', 'padre', 'pix', 'cadastro', 'dinheiro', 'valor',
  'bosta', 'merda', 'porra', 'caralho', 'idiota', 'otario', 'palhaco', 'lixo', 'besta', 'feio', 'chato', 'troll',
  'batman', 'superman', 'homem', 'aranha', 'goku', 'naruto', 'pikachu', 'shrek', 'mickey', 'donald', 'bob', 'esponja',
  'asdf', 'qwer', 'zxcv', 'aaaa', 'bbbb', 'kkkk', 'haha', 'hehe', 'rsrs', 'xxx', 'zzz'
]);

const GIBBERISH_VOWEL_EXEMPT = new Set(['pix', 'sms', 'cep', 'cpf', 'rg', 'rj', 'sp', 'to', 'mg', 'ba', 'pr', 'rs', 'go', 'df', 'ok']);

function normalizeForFilter(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isKeyboardSmashOrGibberish(normText = '') {
  if (!normText || normText.length < 2) return true;
  if (/^(.)\1{2,}$/.test(normText.replace(/\s/g, ''))) return true;
  if (/(.)\1{3,}/.test(normText)) return true;
  const words = normText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const lettersOnly = normText.replace(/[^a-z]/g, '');
  if (lettersOnly.length === 0) return true;

  // Check if all alphabetic tokens lack vowels (e.g., "sdfgh", "xzcv")
  const alphaWords = words.map((w) => w.replace(/[^a-z]/g, '')).filter(Boolean);
  if (alphaWords.length > 0 && alphaWords.every((w) => w.length >= 3 && !/[aeiou]/.test(w) && !GIBBERISH_VOWEL_EXEMPT.has(w))) {
    return true;
  }
  if (/^(asdf|qwer|zxcv|hjkl|yuio|abcd|1234|kkkk|haha|hehe|rsrs)+$/.test(lettersOnly)) {
    return true;
  }
  if (/(asdf|qwer|zxcv|sdfg|dfgh|fghj|ghjk|hjkl|wert|erty|rtyu|tyui|uiop)/i.test(lettersOnly)) {
    return true;
  }
  if (alphaWords.some((w) => /[bcdfghjklmnpqrstvwxyz]{5,}/.test(w))) {
    return true;
  }
  return false;
}

function toTitleCasePtBr(name = '') {
  const preps = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && preps.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function stripNamePrefixes(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/^(?:ola|oi|bom dia|boa tarde|boa noite|paz de cristo)[,!.\s]*/i, '')
    .replace(/^(?:o\s+)?(?:meu\s+nome\s+(?:completo\s+)?[eé]|eu\s+me\s+chamo|me\s+chamo|pode\s+me\s+chamar\s+de|eu\s+sou\s+(?:o|a)?|sou\s+(?:o|a)?|aqui\s+[eé]\s+(?:o|a)?)\s+/i, '')
    .replace(/[.!?,;:"'()]+$/g, '')
    .trim();
}

function runDeterministicFilter(expectedType, rawText, context = {}) {
  const trimmed = String(rawText || '').trim();
  const norm = normalizeForFilter(trimmed);
  const label = context.label || 'atendimento';

  if (expectedType === 'person_name') {
    const cleanedRaw = stripNamePrefixes(trimmed);
    const cleanedNorm = normalizeForFilter(cleanedRaw);

    if (!cleanedNorm || cleanedNorm.length < 2) {
      return {
        valid: false,
        needsAiCheck: false,
        helpMessage:
          `Paz de Cristo! 🙏 Esse texto está muito curto para ser um nome.\n\n` +
          `Para continuarmos com o atendimento de ${label}, informe o seu nome completo.\n` +
          `Exemplo: Maria Aparecida da Silva\n\n` +
          `(Se quiser voltar às opções, digite "menu".)`
      };
    }

    if (/\d/.test(cleanedRaw) || /https?:\/\/|@/.test(cleanedRaw)) {
      return {
        valid: false,
        needsAiCheck: false,
        helpMessage:
          `Paz de Cristo! 🙏 Números ou símbolos não fazem parte do nome.\n\n` +
          `Por favor, escreva apenas o seu nome completo com letras.\n` +
          `Exemplo: João Pedro Oliveira\n\n` +
          `(Ou digite "menu" para voltar.)`
      };
    }

    if (isKeyboardSmashOrGibberish(cleanedNorm)) {
      return {
        valid: false,
        needsAiCheck: false,
        helpMessage:
          `Paz de Cristo! 🙏 Não consegui identificar um nome válido em "${trimmed}".\n\n` +
          `Escreva o seu nome e sobrenome normalmente para que a equipe identifique você.\n` +
          `Exemplo: Ana Paula Ferreira`
      };
    }

    const tokens = cleanedNorm.split(/\s+/).filter(Boolean);
    const nonNameHit = tokens.find((t) => NON_NAME_WORDS.has(t));
    if (nonNameHit || /^(nao sei|sei la|nao tenho|tanto faz|qualquer um|sem nome)$/i.test(cleanedNorm)) {
      return {
        valid: false,
        needsAiCheck: false,
        helpMessage:
          `Paz de Cristo! 🙏 Notei que "${trimmed}" não parece ser o seu nome de pessoa.\n\n` +
          `Para registrarmos seu atendimento de ${label} corretamente, digite apenas o seu nome completo.\n` +
          `Exemplo: Maria Aparecida da Silva\n\n` +
          `(Se preferir cancelar e voltar ao início, digite "menu".)`
      };
    }

    if (tokens.some((t) => t.length === 1 && t !== 'e') && tokens.length === 1) {
      return {
        valid: false,
        needsAiCheck: false,
        helpMessage:
          `Paz de Cristo! 🙏 Precisamos do seu nome completo (e não apenas uma letra).\n\n` +
          `Exemplo: José Carlos Santos`
      };
    }

    if (tokens.length > 6 || cleanedRaw.includes('?')) {
      return {
        valid: false,
        needsAiCheck: false,
        helpMessage:
          `Paz de Cristo! 🙏 Agora estou aguardando apenas o seu nome completo antes de continuarmos.\n\n` +
          `Digite só o seu nome e sobrenome, como no exemplo:\n` +
          `Exemplo: Fernanda Costa Lima\n\n` +
          `(Se quiser perguntar outra coisa antes, digite "menu".)`
      };
    }

    return {
      valid: true,
      needsAiCheck: true,
      normalizedValue: toTitleCasePtBr(cleanedRaw)
    };
  }

  if (expectedType === 'phone') {
    const digits = normalizeDigits(trimmed);
    if (digits.length < 8) {
      return {
        valid: false,
        needsAiCheck: false,
        helpMessage:
          `Paz de Cristo! 🙏 "${trimmed}" não possui dígitos suficientes de um telefone.\n\n` +
          `Digite apenas o seu número de WhatsApp/celular com DDD (8 a 11 números).\n` +
          `Exemplo: 63999998888\n\n` +
          `(Ou digite "menu" para voltar.)`
      };
    }
    return { valid: true, needsAiCheck: false, normalizedValue: digits };
  }

  if (expectedType === 'swap_reason') {
    const tokens = norm.split(/\s+/).filter(Boolean);
    const trivialAnswers = new Set(['sim', 'nao', 'ok', 'blz', 'beleza', 'tudo bem', 'nada', 'sei la', 'nao sei', 'teste']);
    if (
      trimmed.length < 4 ||
      isKeyboardSmashOrGibberish(norm) ||
      trivialAnswers.has(norm) ||
      (tokens.length === 1 && NON_NAME_WORDS.has(tokens[0]))
    ) {
      return {
        valid: false,
        needsAiCheck: false,
        helpMessage:
          `Paz de Cristo! 🙏 Esse motivo ("${trimmed}") ficou muito vago ou inválido para enviar aos colegas da escala.\n\n` +
          `Escreva rapidamente o motivo real da troca para que todos entendam.\n` +
          `Exemplos:\n` +
          `- Preciso viajar com minha família neste dia\n` +
          `- Estarei no trabalho neste horário\n` +
          `- Tive um imprevisto de saúde\n\n` +
          `(Ou digite "menu" para cancelar.)`
      };
    }
    return { valid: true, needsAiCheck: true, normalizedValue: trimmed };
  }

  if (expectedType === 'parish_details') {
    const type = context.type || 'outros';
    const tokens = norm.split(/\s+/).filter(Boolean);

    // Allow concise valid intents on dizimo/doacao
    const shortAllowed = type === 'dizimo' && /^(pix|chave pix|cadastro|quero cadastro|atualizar|boleto)$/i.test(norm);
    if (!shortAllowed) {
      const trivial = new Set(['sim', 'nao', 'ok', 'blz', 'beleza', 'oi', 'ola', 'nada', 'nao sei', 'sei la', 'tanto faz', 'teste']);
      if (
        trimmed.length < 3 ||
        isKeyboardSmashOrGibberish(norm) ||
        trivial.has(norm) ||
        (tokens.length === 1 && NON_NAME_WORDS.has(tokens[0]))
      ) {
        const examplesByType = {
          batismo: `Exemplo: Criança: Lucas Gabriel • Pais: Maria e José • Data pretendida: 15/12`,
          confissao: `Exemplo: Gostaria de confessar na sexta-feira às 16h (ou sábado pela manhã)`,
          direcao_espiritual: `Exemplo: Gostaria de conversar com o padre na quinta-feira à tarde`,
          reuniao: `Exemplo: Reunião sobre a pastoral na terça-feira às 19h30`,
          dizimo: `Exemplos:\n- Quero fazer meu cadastro de dizimista\n- Gostaria da chave PIX do Dízimo`,
          doacao: `Exemplo: Quero doar alimentos não perecíveis (ou fazer oferta em dinheiro)`,
          outros: `Exemplo: Gostaria de saber os horários da secretaria ou tirar uma dúvida sobre a missa`
        };
        return {
          valid: false,
          needsAiCheck: false,
          helpMessage:
            `Paz de Cristo! 🙏 Não consegui aproveitar a resposta "${trimmed}" para o seu pedido de ${label}.\n\n` +
            `Por favor, escreva com mais clareza o que você precisa para que a equipe paroquial possa atender você:\n` +
            `${examplesByType[type] || examplesByType.outros}\n\n` +
            `(Ou digite "menu" para voltar.)`
        };
      }
    }
    return { valid: true, needsAiCheck: true, normalizedValue: trimmed };
  }

  return { valid: true, needsAiCheck: false, normalizedValue: trimmed };
}

async function evaluateUserResponse(expectedType, rawText, context = {}) {
  const det = runDeterministicFilter(expectedType, rawText, context);
  if (!det.valid) {
    return det;
  }
  if (!det.needsAiCheck) {
    return det;
  }

  const cfg = getSectorConfig('global');
  const apiKey = (cfg.geminiApiKey || '').trim();
  if (!apiKey || apiKey.length < 20) {
    return det;
  }

  const fieldDescriptions = {
    person_name: `Nome de uma pessoa física para cadastro/atendimento paroquial de "${context.label || 'Paróquia'}". Aceite nomes reais brasileiros ou estrangeiros (mesmo que seja só o primeiro nome ou nome composto). REJEITE animais (cachorro, gato, etc.), objetos, comidas, personagens fictícios (homem aranha, goku), palavras de teste, xingamentos, frases sem sentido ou perguntas no lugar do nome.`,
    swap_reason: `Motivo real de um servidor da igreja para pedir substituição/troca de escala (ex: viagem, trabalho, doença, prova, compromisso familiar). REJEITE piadas, palavras aleatórias, animais, comidas ou respostas sem sentido.`,
    parish_details: `Informação/solicitação do usuário para o serviço paroquial "${context.label || context.type}". REJEITE piadas, animais aleatórios ("cachorro"), comidas sem contexto, frases desconexas ou respostas que não ajudam a equipe paroquial a entender o pedido. (Para Dízimo, pedidos curtos como "quero o pix" ou "cadastro" SÃO VÁLIDOS.)`
  };

  const evaluatorPrompt =
    `Você é um filtro validador gentil do Assistente Virtual da Paróquia Santo Antônio (WhatsApp).\n` +
    `Avalie se a resposta do usuário faz sentido para o campo pedido.\n\n` +
    `CAMPO ESPERADO: ${fieldDescriptions[expectedType] || expectedType}\n` +
    `RESPOSTA DO USUÁRIO: "${String(rawText || '').trim()}"\n\n` +
    `Responda EXCLUSIVAMENTE em JSON válido neste formato:\n` +
    `{\n` +
    `  "valid": true ou false,\n` +
    `  "normalizedValue": "valor limpo se válido (para nome, mantenha capitalização correta sem prefixos como 'meu nome é')",\n` +
    `  "helpMessage": "se valid=false, escreva uma mensagem acolhedora começando com Paz de Cristo! explicando por que não parece válido e dando 1 ou 2 exemplos claros de como escrever corretamente. NUNCA use asteriscos (*) nem sublinhados (_)."\n` +
    `}`;

  const models = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
  for (const model of models) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: evaluatorPrompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(8000)
        }
      );
      if (!resp.ok) continue;
      const json = await resp.json();
      const rawJson = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) continue;
      const parsed = JSON.parse(rawJson);
      if (typeof parsed.valid === 'boolean') {
        if (!parsed.valid) {
          return {
            valid: false,
            helpMessage: stripMarkdown(
              parsed.helpMessage ||
                `Paz de Cristo! 🙏 Não consegui validar essa resposta. Por favor, tente escrever novamente de forma clara ou digite "menu" para voltar.`
            )
          };
        }
        return {
          valid: true,
          normalizedValue: (parsed.normalizedValue || det.normalizedValue || rawText).trim()
        };
      }
    } catch {
      // fallback safely to deterministic result
    }
  }
  return det;
}

// --- Gemini AI Helper (Assistente Virtual da Paróquia Santo Antônio) ---
function buildGeminiContents(history = [], currentUserText = '') {
  const recent = (Array.isArray(history) ? history : []).slice(-16);
  const turns = [];

  for (const item of recent) {
    const role = item?.role === 'model' ? 'model' : 'user';
    const txt = String(item?.parts?.[0]?.text || item?.text || '').trim();
    if (!txt) continue;
    if (turns.length > 0 && turns[turns.length - 1].role === role) {
      turns[turns.length - 1].parts[0].text += `\n${txt}`;
    } else {
      turns.push({ role, parts: [{ text: txt }] });
    }
  }

  // Gemini expects the conversation sequence to start with 'user'
  while (turns.length > 0 && turns[0].role === 'model') {
    turns.shift();
  }

  const cleanCurrent = String(currentUserText || '').trim();
  if (cleanCurrent) {
    const last = turns[turns.length - 1];
    if (!last || last.role !== 'user') {
      turns.push({ role: 'user', parts: [{ text: cleanCurrent }] });
    } else if (last.parts[0].text !== cleanCurrent && !last.parts[0].text.endsWith(cleanCurrent)) {
      last.parts[0].text += `\n${cleanCurrent}`;
    }
  }

  return turns;
}

async function callGeminiAssistant(session, userText, personContext = '') {
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
    `Confissões: ${cfg.confessionScheduleInfo}. Dízimo: ${cfg.dizimoInfo}. Doações: ${cfg.doacoesInfo}.` +
    (personContext ? `\n\nDADOS E CONVERSAS ANTERIORES JÁ LEMBRADAS DESTE CONTATO (use com naturalidade, demonstre continuidade e nunca peça de novo o que já sabe):\n${personContext}` : '');

  const contents = buildGeminiContents(session?.history || [], userText);
  const models = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-3-flash-preview'];
  for (const model of models) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
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
function formatShortTimePt(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

function buildPersonContextSummary(personMatches = [], contactMemory = null) {
  const name = personMatches[0]?.name || contactMemory?.name || '';
  const parts = [];
  if (name) parts.push(`Nome: ${name}`);

  if (personMatches.length > 0) {
    const roles = personMatches.map((m) => {
      const secName = (SECTOR_META[m.sector || 'coroinhas'] || SECTOR_META.coroinhas).name;
      return `${secName} (${m.category || 'servidor'})`;
    });
    parts.push(`Setor/Função: ${roles.join(', ')}`);
    const prefId = personMatches.find((m) => m.preferredChapelId)?.preferredChapelId;
    if (prefId && chapelsMap.has(prefId)) {
      parts.push(`Capela preferencial: ${chapelsMap.get(prefId).name}`);
    }
    const upcoming = getPersonUpcomingSchedules(personMatches);
    if (upcoming.length > 0) {
      const next = upcoming[0];
      const nextChapel = chapelsMap.get(next.chapelId)?.name || 'Capela';
      parts.push(`Próxima escala: ${nextChapel} em ${formatBrDate(next.date)} às ${next.time || ''} (${getRoleInSchedule(next, personMatches)})`);
    }
  } else if (contactMemory?.sector) {
    parts.push(`Setor: ${contactMemory.sector}`);
  }

  if (Array.isArray(contactMemory?.recentRequests) && contactMemory.recentRequests.length > 0) {
    parts.push(`Últimos atendimentos salvos: ${contactMemory.recentRequests.slice(0, 3).join(' | ')}`);
  }

  if (Array.isArray(contactMemory?.conversationHistory) && contactMemory.conversationHistory.length > 0) {
    const recentChat = contactMemory.conversationHistory
      .slice(-10)
      .map((entry) => {
        const who = entry.role === 'model' ? 'Assistente' : (name || 'Contato');
        const when = entry.at ? `[${formatShortTimePt(entry.at)}] ` : '';
        return `${when}${who}: ${entry.text}`;
      })
      .join('\n');
    parts.push(`Histórico recente de conversas anteriores:\n${recentChat}`);
  }

  return parts.join('\n');
}

function getLastMeaningfulUserTopic(contactMemory = null, currentText = '') {
  const history = Array.isArray(contactMemory?.conversationHistory) ? contactMemory.conversationHistory : [];
  const normCurrent = normalizeForFilter(currentText);
  const twoMinutesAgoMs = Date.now() - 2 * 60 * 1000;

  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item?.role !== 'user' || !item?.text) continue;
    const clean = item.text.trim();
    const norm = normalizeForFilter(clean);
    if (!clean || clean.length <= 2) continue;
    if (normCurrent && norm === normCurrent) continue;
    if (item.at) {
      const itemMs = new Date(item.at).getTime();
      // Prefer topics from prior conversations (older than 2 minutes) or earlier turns before current message
      if (!Number.isNaN(itemMs) && itemMs >= twoMinutesAgoMs && i === history.length - 1) continue;
    }
    if (/^(oi|ola|bom dia|boa tarde|boa noite|menu|voltar|inicio|cancelar|sair|desistir|parar|sim|nao|ok|\d+)$/.test(norm)) continue;
    return clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
  }
  return '';
}

function buildWelcomeText(name = '', personMatches = [], contactMemory = null, currentText = '') {
  const resolvedName = name || contactMemory?.name || '';
  const hasSavedHistory = Array.isArray(contactMemory?.conversationHistory) && contactMemory.conversationHistory.length > 1;
  const isReturning = Boolean(resolvedName || personMatches.length > 0 || contactMemory?.recentRequests?.length || hasSavedHistory);

  if (!isReturning) {
    return (
      `Paz de Cristo! 🙏\n\n` +
      `Seja muito bem-vindo(a) ao canal de atendimento do Assistente Virtual da Paróquia Santo Antônio!\n` +
      `Aqui você pode marcar atendimentos da paróquia, tirar dúvidas sobre a nossa fé ou consultar suas escalas.`
    );
  }

  const infoLines = [];
  if (personMatches.length > 0) {
    const roles = personMatches.map((m) => {
      const secName = (SECTOR_META[m.sector || 'coroinhas'] || SECTOR_META.coroinhas).name;
      return `${secName} (${m.category || 'servidor'})`;
    });
    infoLines.push(`📌 Cadastro: ${roles.join(' | ')}`);
    const upcoming = getPersonUpcomingSchedules(personMatches);
    if (upcoming.length > 0) {
      const next = upcoming[0];
      infoLines.push(`📅 Próxima escala: ${chapelsMap.get(next.chapelId)?.name || 'Capela'} (${formatBrDate(next.date)} às ${next.time || ''})`);
    }
  }
  if (Array.isArray(contactMemory?.recentRequests) && contactMemory.recentRequests.length > 0) {
    infoLines.push(`📝 Último registro: ${contactMemory.recentRequests[0]}`);
  }
  const lastTopic = getLastMeaningfulUserTopic(contactMemory, currentText);
  if (lastTopic) {
    infoLines.push(`💬 Última conversa lembrada: "${lastTopic}"`);
  }

  const greetingLine = resolvedName ? `Paz de Cristo, ${resolvedName}! 🙏` : `Paz de Cristo! 🙏`;
  const infoBlock = infoLines.length > 0 ? `\n\n${infoLines.join('\n')}` : '';
  return (
    `${greetingLine}\n\n` +
    `Que alegria falar com você novamente no canal do Assistente Virtual da Paróquia Santo Antônio!${infoBlock}`
  );
}

function buildMainMenuText() {
  return (
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

async function sendWelcomeThenMenu(remoteJid, name = '', session = null, personMatches = [], contactMemory = null, senderDigits = '') {
  await replyDirect(remoteJid, buildWelcomeText(name, personMatches, contactMemory));
  await new Promise((resolve) => setTimeout(resolve, 600));
  await replyAndTrack(remoteJid, senderDigits || normalizeDigits(remoteJid.split('@')[0]), buildMainMenuText(), {
    recordText: '[Enviou boas-vindas e o menu principal com opções 1 a 8]'
  });
  if (session) {
    session.welcomed = true;
  }
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

    const norm = normalizeForFilter(text);
    const senderDigits = normalizeDigits(remoteJid.split('@')[0]);
    const session = getSession(remoteJid);

    // Load persistent contact memory (including prior conversation history) + match servers
    let contactMemory = findContactMemory(senderDigits);
    hydrateSessionFromMemory(session, contactMemory);

    // Record current incoming user message in RAM session + Firestore history
    session.history.push({ role: 'user', parts: [{ text }], at: new Date().toISOString() });
    if (session.history.length > MAX_PERSISTED_HISTORY * 2) {
      session.history = session.history.slice(-MAX_PERSISTED_HISTORY);
    }
    await appendContactHistory(senderDigits, [{ role: 'user', text }]);
    contactMemory = findContactMemory(senderDigits);

    const lookupPhone = session.identifiedPhone || contactMemory?.linkedPhone || senderDigits;
    let personMatches = matchServersByPhone(lookupPhone);
    let personName = personMatches[0]?.name || contactMemory?.name || '';

    // Persist basic server info into contact memory if matched and not yet saved
    if (personMatches.length > 0) {
      const primary = personMatches[0];
      const secName = (SECTOR_META[primary.sector || 'coroinhas'] || SECTOR_META.coroinhas).name;
      const prefChapelName = primary.preferredChapelId ? (chapelsMap.get(primary.preferredChapelId)?.name || '') : '';
      if (!contactMemory || contactMemory.name !== primary.name || contactMemory.sector !== secName) {
        await upsertContactMemory(senderDigits, {
          remoteJid,
          name: primary.name,
          sector: secName,
          category: primary.category || '',
          preferredChapel: prefChapelName,
          linkedPhone: lookupPhone
        });
        contactMemory = findContactMemory(senderDigits);
      }
    } else if (msg.pushName && !contactMemory?.whatsappPushName) {
      await upsertContactMemory(senderDigits, {
        remoteJid,
        whatsappPushName: msg.pushName
      });
    }

    // Log inbound message
    await writeBotLog({
      sector: personMatches[0]?.sector || 'coroinhas',
      type: 'chat_inbound',
      direction: 'inbound',
      targetPhone: senderDigits,
      targetName: personName || msg.pushName || senderDigits,
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
        await upsertContactMemory(senderDigits, {
          remoteJid,
          name: personName,
          linkedPhone: candidatePhone,
          sector: sectorsLabel,
          category: matched[0].category || ''
        });
        session.step = 'escalas_menu';
        await replyAndTrack(
          remoteJid,
          senderDigits,
          `Paz de Cristo, ${personName}! 🙏 Identifiquei você pelo número (${sectorsLabel}) e já deixei salvo aqui.\n\n` +
            buildEscalasMenuText(personName),
          { topic: 'escalas' }
        );
        return;
      }
      await replyAndTrack(
        remoteJid,
        senderDigits,
        `Paz de Cristo! Procurei o número informado no sistema, mas ainda não encontrei um cadastro com ele. Confira os dígitos com DDD (ex: 63999998888) ou peça ao coordenador do seu setor para conferir o número em Perfis.`,
        { topic: 'escalas' }
      );
      return;
    }

    // 1b. Detect explicit name introduction (e.g. "meu nome é Maria", "me chamo João") with validation filter
    const nameIntroMatch = text.match(/(?:meu nome [eé]|me chamo)\s+([^\n!?]{2,60})/i);
    if (nameIntroMatch && session.step === 'idle') {
      const nameCheck = await evaluateUserResponse('person_name', nameIntroMatch[1].trim(), { label: 'cadastro' });
      if (!nameCheck.valid) {
        await replyAndTrack(remoteJid, senderDigits, nameCheck.helpMessage, { topic: 'validacao_nome' });
        return;
      }
      const introducedName = nameCheck.normalizedValue || nameIntroMatch[1].trim();
      personName = introducedName;
      await upsertContactMemory(senderDigits, {
        remoteJid,
        name: introducedName
      });
      contactMemory = findContactMemory(senderDigits);
      await replyAndTrack(
        remoteJid,
        senderDigits,
        `Paz de Cristo, ${introducedName}! 🙏 Que alegria te conhecer! Já deixei seu nome guardado aqui para nossos próximos atendimentos.\n\n` +
          buildMainMenuText(),
        { recordText: `Apresentou-se como ${introducedName} e recebeu o menu principal.`, topic: 'cadastro_nome' }
      );
      session.welcomed = true;
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
    if (/^(menu|voltar|inicio|cancelar|sair|desistir|parar)$/.test(norm)) {
      session.step = 'idle';
      session.data = {};
      if (!session.welcomed) {
        await sendWelcomeThenMenu(remoteJid, personName, session, personMatches, contactMemory, senderDigits);
      } else {
        await replyAndTrack(remoteJid, senderDigits, buildMainMenuText(), {
          recordText: '[Voltou para o menu principal]'
        });
      }
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
          await replyAndTrack(
            remoteJid,
            senderDigits,
            `Perfeito, ${personName}! 🙏\n\nEscala de ${chapelName} (${formatBrDate(waitingSchedule.date)}) confirmada sem trocas.\n\nNo dia e horário da celebração enviarei o código do relatório por aqui. Deus abençoe!`,
            { topic: 'escalas' }
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
          await replyAndTrack(
            remoteJid,
            senderDigits,
            `Anotado, ${personName}! ✅\n\nRegistrei seu aviso sobre ${chapelName} (${formatBrDate(waitingSchedule.date)}) e avisei a coordenação.`,
            { topic: 'escalas' }
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

    // 5. Handle active conversation steps (with response validation filter & guidance)
    if (session.step === 'parish_name') {
      const nameCheck = await evaluateUserResponse('person_name', text, { label: session.data.label });
      if (!nameCheck.valid) {
        await replyAndTrack(remoteJid, senderDigits, nameCheck.helpMessage, { topic: 'validacao_nome' });
        return;
      }

      const cleanName = nameCheck.normalizedValue || text.trim();
      session.data.requesterName = cleanName;
      await upsertContactMemory(senderDigits, {
        remoteJid,
        name: cleanName
      });
      session.step = 'parish_details';
      const type = session.data.type;
      const cfg = getSectorConfig('global');
      const hint =
        type === 'batismo'
          ? 'Informe o nome da criança, nome dos pais e a data pretendida:'
          : type === 'confissao'
          ? `${cfg.confessionScheduleInfo}\n\nQual dia e horário de sua preferência?`
          : type === 'dizimo'
          ? `${cfg.dizimoInfo}\n\nDeseja fazer cadastro, solicitar chave PIX ou deixar alguma observação?`
          : type === 'doacao'
          ? `${cfg.doacoesInfo}\n\nQual doação você gostaria de fazer ou combinar?`
          : type === 'outros'
          ? 'Digite aqui sua dúvida, recado ou solicitação para a equipe da Paróquia:'
          : 'Qual dia/horário preferido ou observação para esse atendimento?';
      await replyAndTrack(
        remoteJid,
        senderDigits,
        `Obrigado, ${cleanName}! 🙏 Agora ${hint.charAt(0).toLowerCase() + hint.slice(1)}`,
        { topic: session.data.type }
      );
      return;
    }

    if (session.step === 'parish_details') {
      const { type, label, requesterName } = session.data;
      const detailsCheck = await evaluateUserResponse('parish_details', text, { type, label });
      if (!detailsCheck.valid) {
        await replyAndTrack(remoteJid, senderDigits, detailsCheck.helpMessage, { topic: `validacao_${type}` });
        return;
      }

      const cleanDetails = detailsCheck.normalizedValue || text.trim();
      const finalName = requesterName || personName || senderDigits;
      await saveParishRequest({
        type,
        requesterName: finalName,
        requesterPhone: senderDigits,
        preferredDate: cleanDetails,
        details: cleanDetails
      });
      const existingRecent = Array.isArray(contactMemory?.recentRequests) ? contactMemory.recentRequests : [];
      const newSummary = `${label}: ${cleanDetails}`.slice(0, 120);
      await upsertContactMemory(senderDigits, {
        remoteJid,
        name: finalName !== senderDigits ? finalName : (contactMemory?.name || ''),
        recentRequests: [newSummary, ...existingRecent.filter((r) => r !== newSummary)].slice(0, 5)
      });
      session.step = 'idle';
      session.data = {};
      await replyAndTrack(
        remoteJid,
        senderDigits,
        `Perfeito, ${requesterName || personName || 'irmão(ã)'}! 🙏\n\nSua solicitação de ${label} foi registrada com sucesso na Paróquia Santo Antônio.\nEntraremos em contato neste mesmo WhatsApp para confirmar.\n\nDigite "menu" sempre que precisar. Deus abençoe!`,
        { topic: type }
      );
      return;
    }

    if (session.step === 'escalas_identify_phone') {
      const phoneCheck = await evaluateUserResponse('phone', text);
      if (!phoneCheck.valid) {
        await replyAndTrack(remoteJid, senderDigits, phoneCheck.helpMessage, { topic: 'validacao_telefone' });
        return;
      }
      const candidatePhone = phoneCheck.normalizedValue || normalizeDigits(text);
      const matched = matchServersByPhone(candidatePhone);
      if (matched.length === 0) {
        await replyAndTrack(
          remoteJid,
          senderDigits,
          `Não encontrei nenhum cadastro com "${text}". Confira os dígitos com DDD (exemplo: 63999998888), peça ao coordenador para verificar seu celular em Perfis ou digite "menu" para voltar.`,
          { topic: 'escalas' }
        );
        return;
      }
      session.identifiedPhone = candidatePhone;
      personMatches = matched;
      personName = matched[0].name;
      await upsertContactMemory(senderDigits, {
        remoteJid,
        name: personName,
        linkedPhone: candidatePhone,
        sector: (SECTOR_META[matched[0].sector || 'coroinhas'] || SECTOR_META.coroinhas).name,
        category: matched[0].category || ''
      });
      session.step = 'escalas_menu';
      await replyAndTrack(
        remoteJid,
        senderDigits,
        `Paz de Cristo, ${personName}! Cadastro identificado e salvo.\n\n` + buildEscalasMenuText(personName),
        { topic: 'escalas' }
      );
      return;
    }

    if (session.step === 'escalas_menu') {
      if (norm === '1' || norm.includes('troca')) {
        const mySc = getPersonUpcomingSchedules(personMatches);
        if (mySc.length === 0) {
          session.step = 'idle';
          await replyAndTrack(remoteJid, senderDigits, `Você não possui escalas futuras agendadas no momento para solicitar troca.`, { topic: 'escalas' });
          return;
        }
        if (mySc.length === 1) {
          const sc = mySc[0];
          const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
          session.step = 'swap_reason';
          session.data = { schedule: sc };
          await replyAndTrack(
            remoteJid,
            senderDigits,
            `Escala selecionada: ${chapelName} (${formatBrDate(sc.date)} às ${sc.time || ''}).\n\nQual é o motivo da troca? (Exemplo: Preciso viajar ou estarei trabalhando neste horário)`,
            { topic: 'escalas' }
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
        await replyAndTrack(remoteJid, senderDigits, `Em qual dessas escalas você deseja pedir troca? Responda apenas com o número (ex: 1):\n\n${listText}`, { topic: 'escalas' });
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
          await replyAndTrack(
            remoteJid,
            senderDigits,
            `${personName}, verifiquei no sistema e você não foi escalado como Principal em nenhuma escala ativa no momento.${extra}`,
            { topic: 'escalas' }
          );
          return;
        }

        const lines = principalSc.map((sc) => {
          const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
          const secName = (SECTOR_META[sc.sector || 'coroinhas'] || SECTOR_META.coroinhas).name;
          return `• [${secName}] ${chapelName} (${formatBrDate(sc.date)} às ${sc.time || ''})\n  Código do Relatório: ${sc.code}`;
        });
        await replyAndTrack(
          remoteJid,
          senderDigits,
          `Paz de Cristo, ${personName}! 🔑\n\nVocê está como Principal nas seguintes escalas:\n\n${lines.join('\n\n')}\n\nPara enviar o relatório no site, clique em "Enviar Relatório (Código)" na aba do seu setor.`,
          { topic: 'escalas' }
        );
        return;
      }

      if (norm === '3' || norm.includes('minhas') || norm.includes('ver')) {
        session.step = 'idle';
        const mySc = getPersonUpcomingSchedules(personMatches);
        if (mySc.length === 0) {
          await replyAndTrack(remoteJid, senderDigits, `Paz de Cristo, ${personName}! Você não possui escalas futuras agendadas no momento.`, { topic: 'escalas' });
          return;
        }
        const lines = mySc.map((sc, i) => {
          const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
          const secName = (SECTOR_META[sc.sector || 'coroinhas'] || SECTOR_META.coroinhas).name;
          return `${i + 1}. [${secName}] ${chapelName} • ${formatBrDate(sc.date)} às ${sc.time || ''} — ${getRoleInSchedule(sc, personMatches)}`;
        });
        await replyAndTrack(remoteJid, senderDigits, `Paz de Cristo, ${personName}! Suas próximas escalas:\n\n${lines.join('\n')}`, { topic: 'escalas' });
        return;
      }

      await replyAndTrack(
        remoteJid,
        senderDigits,
        `Paz de Cristo! 🙏 Não identifiquei a opção "${text}" no menu de Escalas.\n\nResponda apenas com:\n1 para pedir Troca\n2 para pegar o Código do Relatório\n3 para Ver minhas escalas\n\n(Ou digite "menu" para voltar ao início.)`,
        { topic: 'escalas' }
      );
      return;
    }

    if (session.step === 'swap_pick_schedule') {
      const choices = session.data.choices || [];
      const idx = /^\d+$/.test(norm) ? parseInt(norm, 10) - 1 : -1;
      if (idx < 0 || idx >= choices.length) {
        await replyAndTrack(
          remoteJid,
          senderDigits,
          `Paz de Cristo! 🙏 "${text}" não é uma opção válida.\n\nDigite apenas um número de 1 a ${choices.length} (exemplo: 1) ou digite "menu" para cancelar.`,
          { topic: 'escalas' }
        );
        return;
      }
      const sc = choices[idx];
      const chapelName = chapelsMap.get(sc.chapelId)?.name || 'Capela';
      session.step = 'swap_reason';
      session.data = { schedule: sc };
      await replyAndTrack(
        remoteJid,
        senderDigits,
        `Certo! Qual é o motivo da troca para ${chapelName} (${formatBrDate(sc.date)})? (Exemplo: Compromisso familiar ou trabalho)`,
        { topic: 'escalas' }
      );
      return;
    }

    if (session.step === 'swap_reason') {
      const reasonCheck = await evaluateUserResponse('swap_reason', text);
      if (!reasonCheck.valid) {
        await replyAndTrack(remoteJid, senderDigits, reasonCheck.helpMessage, { topic: 'validacao_troca' });
        return;
      }

      const cleanReason = reasonCheck.normalizedValue || text.trim();
      const sc = session.data.schedule;
      const requester =
        personMatches.find(
          (sv) =>
            sv.id === sc.mainCeremonialistId ||
            (sc.ceremonialistIds || []).includes(sv.id) ||
            (sc.serverIds || []).includes(sv.id)
        ) || personMatches[0];

      const res = await initiateSwapRequest(sc, requester, cleanReason, senderDigits);
      session.step = 'idle';
      session.data = {};

      if (res.alreadyExists) {
        await replyAndTrack(
          remoteJid,
          senderDigits,
          `Já existe uma solicitação de troca aberta para esta escala (código ${res.swapRequest.code}). Para evitar mensagens repetidas, estamos aguardando um colega aceitar!`,
          { topic: 'escalas' }
        );
        return;
      }

      if (res.ok) {
        await replyAndTrack(
          remoteJid,
          senderDigits,
          `Solicitação de troca registrada, ${requester.name}! ✅\n\nMotivo: "${cleanReason}"\nEnviei uma única solicitação via WhatsApp para ${res.notifiedCount} colega(s) disponível(is).\n\nAssim que alguém aceitar, a escala será atualizada no sistema e avisaremos você e os coordenadores!`,
          { topic: 'escalas' }
        );
      } else {
        await replyAndTrack(remoteJid, senderDigits, `Não foi possível registrar a troca agora. Tente novamente mais tarde.`, { topic: 'escalas' });
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
        await replyAndTrack(
          remoteJid,
          senderDigits,
          `Paz de Cristo, ${personName}! Vamos registrar sua solicitação de ${label}.\n\n${extra}`,
          { topic: type }
        );
      } else {
        session.step = 'parish_name';
        session.data = { type, label };
        await replyAndTrack(
          remoteJid,
          senderDigits,
          `Paz de Cristo! Com alegria vamos atender seu pedido de ${label}.\n\nQual é o seu nome completo? (Exemplo: Maria Aparecida da Silva)`,
          { topic: type }
        );
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
        await replyAndTrack(
          remoteJid,
          senderDigits,
          `Paz de Cristo! Para acessar suas escalas, informar troca ou pegar seu código de relatório, me diga o seu número de telefone cadastrado com DDD (exemplo: 63999998888):`,
          { topic: 'escalas' }
        );
        return;
      }
      session.step = 'escalas_menu';
      session.data = {};
      await replyAndTrack(remoteJid, senderDigits, buildEscalasMenuText(personName), { topic: 'escalas' });
      return;
    }

    // 7. Greeting -> Welcome message + Options menu
    if (/^(oi|ola|bom dia|boa tarde|boa noite|paz|paz de cristo|salve maria|ajuda|start)$/i.test(norm)) {
      await sendWelcomeThenMenu(remoteJid, personName, session, personMatches, contactMemory, senderDigits);
      return;
    }

    // 7b. Help users who send keyboard-smash / unreadable gibberish while idle
    if (isKeyboardSmashOrGibberish(norm) && text.length < 24) {
      await replyAndTrack(
        remoteJid,
        senderDigits,
        `Paz de Cristo! 🙏 Não consegui entender a mensagem "${text}".\n\nEscreva sua pergunta com palavras claras ou escolha um dos números abaixo:\n\n` +
          buildMainMenuText(),
        { recordText: `[Orientou usuário após mensagem incompreensível: ${text}]` }
      );
      session.welcomed = true;
      return;
    }

    // 8. Conversational Gemini AI for Catholic faith, general doubts & remembered past conversations
    const personContext = buildPersonContextSummary(personMatches, contactMemory);
    const aiReply = await callGeminiAssistant(session, text, personContext);
    if (aiReply) {
      if (!session.welcomed) {
        await replyDirect(remoteJid, buildWelcomeText(personName, personMatches, contactMemory, text));
        await new Promise((resolve) => setTimeout(resolve, 600));
        session.welcomed = true;
      }
      await replyAndTrack(remoteJid, senderDigits, aiReply, { topic: 'ia_livre' });
      return;
    }

    // Default: Welcome message + Options menu
    await sendWelcomeThenMenu(remoteJid, personName, session, personMatches, contactMemory, senderDigits);
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

  onSnapshot(collection(db, 'whatsapp_contacts'), (snap) => {
    const next = new Map();
    snap.docs.forEach((d) => next.set(d.id, { id: d.id, ...d.data() }));
    whatsappContactsMap = next;
  });

  onSnapshot(collection(db, 'parish_requests'), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    parishRequestsList = list;
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
