import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

export const DEFAULT_CLEAN_TEMPLATES = {
  memberReminderTemplate:
    `Paz de Cristo, {membro}! 🙏\n\nPassando para lembrar da sua escala no setor de {setor}:\n\n📍 Local: {capela}\n📅 Data: {data}\n⏰ Horário: {horario}\n👤 Responsável: {comandante}\n\nCaso precise trocar com alguém, avise o responsável com antecedência. Deus abençoe!`,
  swapMessageTemplate:
    `Paz de Cristo, {comandante}! 🙏\n\nVocê está escalado(a) como {cargoPrincipal} no setor de {setor}:\n\n📍 Local: {capela}\n📅 Data: {data}\n⏰ Horário: {horario}\n\n👥 Equipe escalada:\n{equipe}\n\nVocê trocou com alguém ou houve alguma substituição na equipe?\n• Se estiver tudo certo, responda: NÃO\n• Se houve troca, responda: SIM e diga quem trocou com quem.`,
  codeMessageTemplate:
    `Paz de Cristo, {comandante}! ⛪\n\nChegou o momento da celebração em {capela} ({data} às {horario}) pelo setor de {setor}.\n\n🔑 Código para o relatório: {codigo}\n\nPara fazer a chamada e enviar o relatório:\n1. Acesse o site: {siteUrl}\n2. Clique em "Enviar Relatório (Código)"\n3. Informe o código {codigo}\n\nDeus abençoe o seu serviço! ✨`
};

const SECTOR_BASES = [
  { id: 'coroinhas', name: 'Coroinhas', mainRoleTitle: 'Cerimoniário Principal' },
  { id: 'musica', name: 'Música', mainRoleTitle: 'Responsável Musical' },
  { id: 'liturgia', name: 'Liturgia', mainRoleTitle: 'Coordenador / Comentarista' },
  { id: 'mece', name: 'MESCE', mainRoleTitle: 'Ministro Coordenador' }
];

/**
 * Ensures every new configuration & feature collection has its base documents initialized in Firestore.
 * Uses non-destructive merges so existing custom user configurations are preserved.
 */
export async function ensureFirestoreBase(db, siteUrlFallback = 'http://localhost:5173') {
  const nowIso = new Date().toISOString();

  // 1. Base global chatbot config (bot_configs/global)
  const globalRef = doc(db, 'bot_configs', 'global');
  const globalSnap = await getDoc(globalRef);
  const existingGlobal = globalSnap.exists() ? globalSnap.data() : {};

  await setDoc(
    globalRef,
    {
      sector: 'global',
      enabled: existingGlobal.enabled ?? true,
      proactiveRemindersEnabled: true,
      notifyAllMembers: existingGlobal.notifyAllMembers ?? false,
      hoursBeforeSwapCheck: existingGlobal.hoursBeforeSwapCheck ?? 12,
      reportCodeMode: existingGlobal.reportCodeMode ?? 'at_time',
      reportCodeOffsetMinutes: existingGlobal.reportCodeOffsetMinutes ?? 0,
      notifyAdminPhone: existingGlobal.notifyAdminPhone ?? '',
      siteUrl: existingGlobal.siteUrl || siteUrlFallback,
      geminiApiKey: existingGlobal.geminiApiKey ?? '',
      confessionScheduleInfo:
        existingGlobal.confessionScheduleInfo ||
        'Atendimento de confissões mediante agendamento com a secretaria paroquial ou antes das celebrações.',
      dizimoInfo:
        existingGlobal.dizimoInfo ||
        'Para se tornar dizimista, atualizar seu cadastro ou solicitar a chave PIX do Dízimo, informe seus dados que a equipe entrará em contato.',
      doacoesInfo:
        existingGlobal.doacoesInfo ||
        'Recebemos doações de alimentos não perecíveis e ofertas pela secretaria paroquial.',
      webhookUrl: existingGlobal.webhookUrl ?? '',
      webhookToken: existingGlobal.webhookToken ?? '',
      ...DEFAULT_CLEAN_TEMPLATES,
      initializedAt: existingGlobal.initializedAt || nowIso,
      updatedAt: nowIso
    },
    { merge: true }
  );

  // 2. Base registry documents for the 4 sectors in bot_configs (metadata only, never overrides global)
  for (const sec of SECTOR_BASES) {
    const secRef = doc(db, 'bot_configs', sec.id);
    const secSnap = await getDoc(secRef);
    if (!secSnap.exists()) {
      await setDoc(secRef, {
        sector: sec.id,
        sectorName: sec.name,
        mainRoleTitle: sec.mainRoleTitle,
        inheritsGlobalConfig: true,
        initializedAt: nowIso
      });
    }
  }

  // 3. Base parish assistant menu & services configuration (parish_settings/whatsapp_menu)
  const parishSettingsRef = doc(db, 'parish_settings', 'whatsapp_menu');
  const parishSnap = await getDoc(parishSettingsRef);
  const existingParish = parishSnap.exists() ? parishSnap.data() : {};
  await setDoc(
    parishSettingsRef,
    {
      id: 'whatsapp_menu',
      assistantName: 'Assistente Virtual da Paróquia Santo Antônio',
      greeting: 'Paz de Cristo!',
      menuOnlyOnUserContact: true,
      options: [
        { number: 1, key: 'confissao', label: 'Marcar Confissão', enabled: true },
        { number: 2, key: 'direcao_espiritual', label: 'Direção Espiritual', enabled: true },
        { number: 3, key: 'batismo', label: 'Batismos', enabled: true },
        { number: 4, key: 'reuniao', label: 'Reuniões', enabled: true },
        { number: 5, key: 'dizimo', label: 'Dízimos', enabled: true },
        { number: 6, key: 'doacao', label: 'Doações', enabled: true },
        { number: 7, key: 'escalas', label: 'Escalas (Troca, Código, Ver minhas escalas)', enabled: true },
        { number: 8, key: 'outros', label: 'Outros', enabled: true }
      ],
      initializedAt: existingParish.initializedAt || nowIso,
      updatedAt: nowIso
    },
    { merge: true }
  );

  // 4. Base bot_status/main if missing
  const statusRef = doc(db, 'bot_status', 'main');
  const statusSnap = await getDoc(statusRef);
  if (!statusSnap.exists()) {
    await setDoc(statusRef, {
      connected: false,
      phone: '',
      qrDataUrl: '',
      lastHeartbeat: nowIso
    });
  }

  // 4b. Pre-seed whatsapp_contacts for any existing parish_requests so names are remembered immediately
  const existingContactsSnap = await getDocs(collection(db, 'whatsapp_contacts'));
  if (existingContactsSnap.empty) {
    const parishReqsSnap = await getDocs(collection(db, 'parish_requests'));
    for (const d of parishReqsSnap.docs) {
      const pr = d.data();
      const digits = String(pr.requesterPhone || '').replace(/\D/g, '');
      if (digits && pr.requesterName) {
        await setDoc(
          doc(db, 'whatsapp_contacts', digits),
          {
            phone: digits,
            name: pr.requesterName,
            recentRequests: [`${pr.type}: ${pr.details || pr.preferredDate || ''}`.slice(0, 100)],
            updatedAt: nowIso
          },
          { merge: true }
        );
      }
    }
  }

  // 5. Base collection check for system_requests (keep real incomplete summary if empty)
  const sysReqSnap = await getDocs(collection(db, 'system_requests'));
  const serversSnap = await getDocs(collection(db, 'servers'));
  if (sysReqSnap.empty) {
    const missingBySector = {};
    serversSnap.forEach((d) => {
      const sv = d.data();
      const digits = String(sv.phone || '').replace(/\D/g, '');
      if (digits.length < 10) {
        const sec = sv.sector || 'coroinhas';
        missingBySector[sec] = (missingBySector[sec] || 0) + 1;
      }
    });

    for (const sec of SECTOR_BASES) {
      const count = missingBySector[sec.id] || 0;
      if (count > 0) {
        const reqId = `req_base_phone_${sec.id}`;
        await setDoc(doc(db, 'system_requests', reqId), {
          id: reqId,
          sector: sec.id,
          title: `Completar celular/WhatsApp de ${count} membro(s)`,
          description: `O Chatbot e o sistema de trocas precisam do número de celular cadastrado em Perfis para enviar mensagens.`,
          status: 'open',
          autoGenerated: true,
          createdAt: nowIso
        });
      }
    }
  }

  return true;
}

