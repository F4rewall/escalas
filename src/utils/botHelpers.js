import { getSectorConfig } from './sectorConfig';

export const getDefaultBotConfig = (sectorId = 'coroinhas') => {
  const sectorCfg = getSectorConfig(sectorId);

  return {
    sector: sectorId,
    enabled: false,
    proactiveRemindersEnabled: true,
    notifyAllMembers: false,
    hoursBeforeSwapCheck: 12,
    reportCodeMode: 'at_time', // 'at_time' | '30_before' | '60_after' | 'morning_of_day'
    reportCodeOffsetMinutes: 0,
    notifyAdminPhone: '',
    siteUrl: typeof window !== 'undefined' ? window.location.origin : '',
    geminiApiKey: '',
    confessionScheduleInfo: 'Atendimento de confissões mediante agendamento com a secretaria paroquial ou antes das celebrações.',
    dizimoInfo: 'Para se tornar dizimista, atualizar seu cadastro ou solicitar a chave PIX do Dízimo, deixe seu nome e telefone que a Pastoral do Dízimo entrará em contato.',
    doacoesInfo: 'Recebemos doações de alimentos não perecíveis, itens para a pastoral social e ofertas pela secretaria paroquial.',
    webhookUrl: '',
    webhookToken: '',
    memberReminderTemplate:
      `Paz de Cristo, {membro}! 🙏\n\n` +
      `Passando para lembrar da sua escala no setor de {setor}:\n\n` +
      `📍 Local: {capela}\n` +
      `📅 Data: {data}\n` +
      `⏰ Horário: {horario}\n` +
      `👤 Responsável: {comandante}\n\n` +
      `Caso precise trocar com alguém, avise o responsável com antecedência. Deus abençoe!`,
    swapMessageTemplate:
      `Paz de Cristo, {comandante}! 🙏\n\n` +
      `Você está escalado(a) como {cargoPrincipal} no setor de {setor}:\n\n` +
      `📍 Local: {capela}\n` +
      `📅 Data: {data}\n` +
      `⏰ Horário: {horario}\n\n` +
      `👥 Equipe escalada:\n{equipe}\n\n` +
      `Você trocou com alguém ou houve alguma substituição na equipe?\n` +
      `• Se estiver tudo certo, responda: NÃO\n` +
      `• Se houve troca, responda: SIM e diga quem trocou com quem.`,
    codeMessageTemplate:
      `Paz de Cristo, {comandante}! ⛪\n\n` +
      `Chegou o momento da celebração em {capela} ({data} às {horario}) pelo setor de {setor}.\n\n` +
      `🔑 Código para o relatório: {codigo}\n\n` +
      `Para fazer a chamada e enviar o relatório:\n` +
      `1. Acesse o site: {siteUrl}\n` +
      `2. Clique em "Enviar Relatório (Código)"\n` +
      `3. Informe o código {codigo}\n\n` +
      `Deus abençoe o seu serviço! ✨`
  };
};

export const formatWhatsAppDigits = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

export const buildWhatsAppWebLink = (phone, message) => {
  const digits = formatWhatsAppDigits(phone);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || '')}`;
};

export const formatScheduleTeamText = (schedule, servers, sectorCfg) => {
  const findName = (id) => servers.find((s) => s.id === id)?.name || 'Desconhecido';
  const lines = [];

  if (schedule?.mainCeremonialistId) {
    lines.push(`• ${sectorCfg.mainRoleTitle}: ${findName(schedule.mainCeremonialistId)}`);
  }
  if (Array.isArray(schedule?.ceremonialistIds) && schedule.ceremonialistIds.length > 0) {
    lines.push(
      `• ${sectorCfg.auxRoleLabel}: ${schedule.ceremonialistIds.map(findName).join(', ')}`
    );
  }
  if (Array.isArray(schedule?.serverIds) && schedule.serverIds.length > 0) {
    lines.push(
      `• ${sectorCfg.memberRoleLabel}: ${schedule.serverIds.map(findName).join(', ')}`
    );
  }

  return lines.length > 0 ? lines.join('\n') : 'Equipe em definição';
};

export const formatBotMessage = (template = '', vars = {}) => {
  let result = template;
  Object.entries(vars).forEach(([key, value]) => {
    const token = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(token, value ?? '');
  });
  return result.trim();
};

export const formatBrDate = (dateStr = '') => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const matchServersByPhone = (servers = [], rawPhone = '') => {
  const inputDigits = String(rawPhone || '').replace(/\D/g, '');
  if (!inputDigits) return [];

  return servers.filter((sv) => {
    const svDigits = String(sv.phone || '').replace(/\D/g, '');
    if (!svDigits) return false;
    if (inputDigits.length >= 8 && svDigits.length >= 8) {
      return svDigits.slice(-8) === inputDigits.slice(-8);
    }
    return svDigits === inputDigits || (inputDigits.length >= 3 && svDigits.endsWith(inputDigits));
  });
};

