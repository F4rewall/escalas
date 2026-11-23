import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { SECTORS, getSectorConfig, getItemSector } from '../utils/sectorConfig';
import {
  getDefaultBotConfig,
  formatBotMessage,
  formatScheduleTeamText,
  formatBrDate,
  buildWhatsAppWebLink
} from '../utils/botHelpers';
import {
  Bot,
  MessageSquare,
  KeyRound,
  Save,
  Send,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Clock,
  Phone,
  RefreshCw,
  ExternalLink,
  Terminal,
  ShieldAlert,
  ArrowLeftRight,
  Users
} from 'lucide-react';

export default function ChatbotConfig() {
  const {
    userRole,
    botConfigs,
    botLogs,
    botStatus,
    parishRequests,
    swapRequests,
    resolveParishRequest,
    deleteParishRequest,
    getBotConfig,
    saveBotConfig,
    queueBotMessage,
    resolveBotSwapAlert,
    schedules: allSchedules,
    servers: allServers,
    chapels
  } = useContext(AppContext);

  const [scheduleSectorFilter, setScheduleSectorFilter] = useState('all');
  const [formConfig, setFormConfig] = useState(() => getDefaultBotConfig('global'));
  const [savedNotice, setSavedNotice] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [sendingKey, setSendingKey] = useState('');

  useEffect(() => {
    setFormConfig(getBotConfig('global'));
  }, [botConfigs]);

  if (userRole !== 'chat') {
    return (
      <div className="glass-panel" style={styles.accessDenied}>
        <ShieldAlert size={48} style={{ color: 'var(--color-absent)', marginBottom: '1rem' }} />
        <h3>Acesso Exclusivo do Usuário "chat"</h3>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
          A configuração geral do Chatbot é gerenciada exclusivamente pelo usuário <strong>chat</strong>. Cada coordenador de setor gerencia apenas as escalas e perfis do seu setor.
        </p>
      </div>
    );
  }

  const upcomingAllSchedules = allSchedules
    .filter((sc) => sc.status === 'scheduled')
    .sort((a, b) => new Date(a.date || '') - new Date(b.date || ''));

  const displayedSchedules = upcomingAllSchedules.filter((sc) => {
    if (scheduleSectorFilter === 'all') return true;
    return getItemSector(sc) === scheduleSectorFilter;
  });

  // Check if Node bot heartbeat is fresh (< 3 minutes old)
  const isBotHeartbeatFresh = (() => {
    if (!botStatus?.connected || !botStatus?.lastHeartbeat) return false;
    const diffMs = Date.now() - new Date(botStatus.lastHeartbeat).getTime();
    return diffMs < 3 * 60 * 1000;
  })();

  const hasFreshQrCode = (() => {
    if (isBotHeartbeatFresh || !botStatus?.qrDataUrl || !botStatus?.lastHeartbeat) return false;
    const diffMs = Date.now() - new Date(botStatus.lastHeartbeat).getTime();
    return diffMs < 2 * 60 * 1000;
  })();

  const getServer = (id) => allServers.find((s) => s.id === id);
  const getChapel = (id) => chapels.find((c) => c.id === id);

  // Sample vars for live previews
  const sampleSchedule = displayedSchedules[0] || upcomingAllSchedules[0];
  const sampleSectorId = sampleSchedule ? getItemSector(sampleSchedule) : 'coroinhas';
  const sampleSectorCfg = getSectorConfig(sampleSectorId);
  const sampleSectorServers = allServers.filter((sv) => getItemSector(sv) === sampleSectorId);
  const samplePrincipal = sampleSchedule?.mainCeremonialistId
    ? getServer(sampleSchedule.mainCeremonialistId)
    : null;

  const sampleVars = {
    comandante: samplePrincipal?.name || 'João Silva',
    membro: 'Maria Clara',
    cargoPrincipal: sampleSectorCfg.mainRoleTitle,
    setor: sampleSectorCfg.name,
    capela: (sampleSchedule && getChapel(sampleSchedule.chapelId)?.name) || 'Matriz Santo Antônio',
    data: sampleSchedule ? formatBrDate(sampleSchedule.date) : '29/11/2026',
    horario: sampleSchedule?.time || '19:00',
    codigo: sampleSchedule?.code || '4829',
    siteUrl: formConfig.siteUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
    equipe: sampleSchedule
      ? formatScheduleTeamText(sampleSchedule, sampleSectorServers, sampleSectorCfg)
      : `• ${sampleSectorCfg.mainRoleTitle}: João Silva\n• ${sampleSectorCfg.memberRoleLabel}: Maria, Pedro`
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const defaults = getDefaultBotConfig('global');
    const cleanPayload = {
      ...formConfig,
      proactiveRemindersEnabled: true,
      swapMessageTemplate: defaults.swapMessageTemplate,
      codeMessageTemplate: defaults.codeMessageTemplate,
      memberReminderTemplate: defaults.memberReminderTemplate
    };
    const ok = await saveBotConfig('global', cleanPayload);
    if (ok) {
      setSavedNotice('Configuração Geral do Chatbot salva! Ela funciona automaticamente para Coroinhas, Música, Liturgia e MECE.');
      setTimeout(() => setSavedNotice(''), 4500);
    } else {
      alert('Erro ao salvar configurações no banco de dados.');
    }
  };

  const handleToggleEnabled = async () => {
    const nextConfig = {
      ...formConfig,
      enabled: !formConfig.enabled,
      proactiveRemindersEnabled: true
    };
    setFormConfig(nextConfig);
    await saveBotConfig('global', nextConfig);
  };

  const handlePhoneMask = (val, setter) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = '';
    if (digits.length === 0) formatted = '';
    else if (digits.length <= 2) formatted = `(${digits}`;
    else if (digits.length <= 6) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    else if (digits.length <= 10) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    else formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    setter(formatted);
  };

  const buildScheduleMessage = (sc, type) => {
    const scSectorId = getItemSector(sc);
    const scSectorCfg = getSectorConfig(scSectorId);
    const scSectorServers = allServers.filter((sv) => getItemSector(sv) === scSectorId);
    const principal = getServer(sc.mainCeremonialistId);
    const chapel = getChapel(sc.chapelId);

    const vars = {
      comandante: principal?.name || 'Responsável',
      cargoPrincipal: scSectorCfg.mainRoleTitle,
      setor: scSectorCfg.name,
      capela: chapel?.name || 'Capela',
      data: formatBrDate(sc.date),
      horario: sc.time || '',
      codigo: sc.code || '',
      siteUrl: formConfig.siteUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
      equipe: formatScheduleTeamText(sc, scSectorServers, scSectorCfg)
    };
    const template = type === 'swap_check' ? formConfig.swapMessageTemplate : formConfig.codeMessageTemplate;
    return {
      principal,
      chapel,
      scSectorCfg,
      scSectorId,
      text: formatBotMessage(template, vars)
    };
  };

  const handleDispatchForSchedule = async (sc, type) => {
    const { principal, chapel, scSectorCfg, scSectorId, text } = buildScheduleMessage(sc, type);
    if (!principal) {
      alert(`Defina um ${scSectorCfg.mainRoleTitle} nesta escala antes de enviar pelo bot.`);
      return;
    }
    if (!principal.phone || principal.phone.replace(/\D/g, '').length < 10) {
      alert(`${principal.name} não possui celular/WhatsApp cadastrado.`);
      return;
    }

    const key = `${sc.id}_${type}`;
    setSendingKey(key);
    const res = await queueBotMessage({
      sector: scSectorId,
      scheduleId: sc.id,
      type,
      targetPhone: principal.phone,
      targetName: principal.name,
      message: text,
      scheduleSummary: `[${scSectorCfg.name}] ${chapel?.name || 'Capela'} • ${formatBrDate(sc.date)} ${sc.time || ''}`
    });
    setSendingKey('');

    if (res.ok) {
      alert(
        isBotHeartbeatFresh
          ? `Mensagem enfileirada! O Chatbot enviará para ${principal.name} (${principal.phone}) em instantes.`
          : `Mensagem salva na fila do Chatbot para ${principal.name}. Conecte o bot via QR Code para disparar.`
      );
    } else {
      alert('Falha ao registrar mensagem na fila do bot.');
    }
  };

  const handleSendTest = async () => {
    const clean = testPhone.replace(/\D/g, '');
    if (clean.length < 10) {
      alert('Digite um número de WhatsApp válido com DDD para o teste.');
      return;
    }
    setSendingKey('test');
    const previewMsg = formatBotMessage(formConfig.swapMessageTemplate, sampleVars);
    const res = await queueBotMessage({
      sector: 'global',
      scheduleId: '',
      type: 'test',
      targetPhone: testPhone,
      targetName: 'Teste Chat',
      message: `[TESTE DO BOT • GERAL]\n\n${previewMsg}`,
      scheduleSummary: 'Teste manual (Geral)'
    });
    setSendingKey('');
    if (res.ok) {
      alert('Teste enviado para a fila do Chatbot! Se o bot estiver conectado, a mensagem chegará em instantes.');
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Central do Chatbot (Usuário: chat)</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Configure aqui o funcionamento geral do Chatbot de WhatsApp para <strong>todos os setores</strong> (Coroinhas, Música, Liturgia e MECE), adaptando automaticamente conforme a escala de cada um.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleEnabled}
          className={`btn ${formConfig.enabled ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            background: formConfig.enabled ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
            color: formConfig.enabled ? '#fff' : undefined
          }}
        >
          <Bot size={16} />
          {formConfig.enabled ? 'Bot Geral Ativo (Todos Setores)' : 'Ativar Bot Geral (Todos Setores)'}
        </button>
      </div>

      {savedNotice && (
        <div style={styles.successBanner}>
          <CheckCircle2 size={18} />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Connection Status + QR Code */}
      <div className="glass-panel" style={{ ...styles.card, marginBottom: '1.5rem' }}>
        <div style={styles.statusRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={styles.statusIconBox(isBotHeartbeatFresh)}>
              {isBotHeartbeatFresh ? <Wifi size={22} /> : <WifiOff size={22} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                Status do Robô WhatsApp:{' '}
                <span style={{ color: isBotHeartbeatFresh ? 'var(--color-present)' : 'var(--gold-light)' }}>
                  {isBotHeartbeatFresh ? 'Conectado e Operando' : 'Aguardando Conexão Node.js'}
                </span>
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                {isBotHeartbeatFresh
                  ? `Conectado no número ${botStatus.phone || 'WhatsApp da Paróquia'}. O envio automático para todas as escalas ativas está operando normalmente.`
                  : 'Inicie o robô Node.js (pasta chatbot/) e escaneie o QR Code para conectar o WhatsApp da Paróquia.'}
              </p>
            </div>
          </div>
        </div>

        <div style={styles.terminalGuide}>
          {hasFreshQrCode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ backgroundColor: '#fff', padding: '0.5rem', borderRadius: '10px', flexShrink: 0 }}>
                <img
                  src={botStatus.qrDataUrl}
                  alt="QR Code WhatsApp Chatbot"
                  style={{ width: '180px', height: '180px', display: 'block' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ color: 'var(--primary-gold)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                  📱 Escaneie este QR Code com o WhatsApp
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  Abra o WhatsApp no celular da Paróquia/Pastoral → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong> e aponte a câmera para o código ao lado.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary-gold)', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                <Terminal size={14} /> Como ligar o Chatbot WhatsApp (primeira vez):
              </div>
              <code style={styles.codeBlock}>
                cd chatbot &amp;&amp; npm install &amp;&amp; npm start
              </code>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '0.35rem' }}>
                Ao rodar, aparecerá um QR Code aqui no painel e no terminal para você conectar o WhatsApp.
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main Config Form */}
      <form onSubmit={handleSave}>
        <div className="reports-tables-grid" style={{ marginBottom: '1.5rem' }}>
          {/* MOMENT 1: SWAP QUESTION (TIMING ONLY) */}
          <div className="glass-panel" style={styles.card}>
            <div style={styles.cardHeaderRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowLeftRight size={18} style={{ color: 'var(--primary-gold)' }} />
                <h3 style={styles.cardTitle}>1º Momento: Pergunta de Troca</h3>
              </div>
              <span className="badge badge-scheduled">Pré-celebração</span>
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Enviar quantas horas antes da celebração?</label>
              <select
                className="form-control"
                value={formConfig.hoursBeforeSwapCheck}
                onChange={(e) => setFormConfig({ ...formConfig, hoursBeforeSwapCheck: Number(e.target.value) })}
              >
                <option value={2}>2 horas antes da missa</option>
                <option value={4}>4 horas antes da missa</option>
                <option value={6}>6 horas antes da missa</option>
                <option value={12}>12 horas antes da missa (Recomendado)</option>
                <option value={24}>24 horas antes (1 dia antes)</option>
                <option value={48}>48 horas antes (2 dias antes)</option>
              </select>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
              O Chatbot envia automaticamente <strong>1 única vez</strong> para o WhatsApp do Comandante Principal da escala perguntando se houve troca (com capela, data, horário e equipe já preenchidos).
            </p>
          </div>

          {/* MOMENT 2: REPORT CODE (TIMING ONLY) */}
          <div className="glass-panel" style={styles.card}>
            <div style={styles.cardHeaderRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={18} style={{ color: '#10b981' }} />
                <h3 style={styles.cardTitle}>2º Momento: Envio do Código</h3>
              </div>
              <span className="badge badge-present">Dia da Missa</span>
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Quando enviar o código de 4 dígitos do relatório?</label>
              <select
                className="form-control"
                value={formConfig.reportCodeMode}
                onChange={(e) => {
                  const mode = e.target.value;
                  const offsetMap = {
                    morning_of_day: 0,
                    '30_before': -30,
                    at_time: 0,
                    '60_after': 60
                  };
                  setFormConfig({
                    ...formConfig,
                    reportCodeMode: mode,
                    reportCodeOffsetMinutes: offsetMap[mode] ?? 0
                  });
                }}
              >
                <option value="morning_of_day">No dia da celebração às 07:00</option>
                <option value="30_before">30 minutos antes do início da missa</option>
                <option value="at_time">Exatamente no horário da missa</option>
                <option value="60_after">1 hora após o início (ao final da missa)</option>
              </select>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
              O Chatbot envia automaticamente <strong>1 única vez</strong> o código de 4 dígitos gerado no sistema para o Comandante Principal fazer a chamada e o relatório.
            </p>
          </div>
        </div>

        {/* Optional Member Reminder & Additional Settings */}
        <div className="glass-panel" style={{ ...styles.card, marginBottom: '1.5rem' }}>
          <h3 style={{ ...styles.cardTitle, marginBottom: '1rem' }}>
            <MessageSquare size={18} style={{ color: 'var(--primary-gold)' }} /> Lembretes Gerais &amp; Integração
          </h3>

          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(14, 165, 233, 0.08)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            marginBottom: '1.25rem'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', margin: 0, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              <input
                type="checkbox"
                checked={Boolean(formConfig.notifyAllMembers)}
                onChange={(e) => setFormConfig({ ...formConfig, notifyAllMembers: e.target.checked })}
              />
              <Users size={16} style={{ color: '#38bdf8' }} />
              Enviar também lembrete automático para os demais membros escalados
            </label>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: '0.35rem 0 0 1.6rem' }}>
              Quando marcado, cada pessoa escalada recebe o lembrete automático da própria escala no mesmo horário do 1º momento (sem receber o código do relatório).
            </p>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>WhatsApp Geral de Coordenação (para alertas de troca)</label>
              <input
                type="tel"
                className="form-control"
                placeholder="Ex: (63) 99999-9999"
                value={formConfig.notifyAdminPhone || ''}
                onChange={(e) =>
                  handlePhoneMask(e.target.value, (val) =>
                    setFormConfig((prev) => ({ ...prev, notifyAdminPhone: val }))
                  )
                }
              />
              <span style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
                Se algum comandante responder que houve troca, o bot encaminha uma cópia para este número.
              </span>
            </div>

            <div className="form-group">
              <label>Link do Site (enviado junto com o código do relatório)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex: https://escalas-santo-antonio.vercel.app"
                value={formConfig.siteUrl || ''}
                onChange={(e) => setFormConfig({ ...formConfig, siteUrl: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Webhook Externo (Opcional — Evolution API / n8n / Z-API)</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://seu-n8n-ou-api.com/webhook/escala"
                value={formConfig.webhookUrl || ''}
                onChange={(e) => setFormConfig({ ...formConfig, webhookUrl: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Token de Autorização do Webhook (Opcional)</label>
              <input
                type="password"
                className="form-control"
                placeholder="Bearer Token ou API Key..."
                value={formConfig.webhookToken || ''}
                onChange={(e) => setFormConfig({ ...formConfig, webhookToken: e.target.value })}
              />
            </div>
          </div>

          {/* Assistente Católico (Gemini) & Atendimentos Paroquiais */}
          <div style={{
            padding: '1rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(217, 119, 6, 0.06)',
            border: '1px solid var(--border-color)',
            marginBottom: '1rem'
          }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.92rem', color: 'var(--primary-gold)' }}>
              Modelo Conversacional (Assistente Virtual da Paróquia Santo Antônio)
            </h4>

            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', margin: 0, color: 'var(--color-text-primary)' }}>
                <input
                  type="checkbox"
                  checked={Boolean(formConfig.proactiveRemindersEnabled)}
                  onChange={(e) => setFormConfig({ ...formConfig, proactiveRemindersEnabled: e.target.checked })}
                />
                Ativar disparo automático antes das missas (perguntar trocas e mandar código sozinho)
              </label>
              <span style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                Se desmarcado, o bot funciona somente em modo menu quando alguém entrar em contato (sem enviar avisos automáticos antes da missa). Mesmo ligado, envia apenas 1 vez por escala.
              </span>
            </div>

            <div className="form-group">
              <label>Chave API do Gemini (Opcional — para conversar livremente sobre fé católica igual ao Assistente)</label>
              <input
                type="password"
                className="form-control"
                placeholder="AIzaSy... (Google AI Studio)"
                value={formConfig.geminiApiKey || ''}
                onChange={(e) => setFormConfig({ ...formConfig, geminiApiKey: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Horários / Info de Confissões</label>
                <input
                  type="text"
                  className="form-control"
                  value={formConfig.confessionScheduleInfo || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, confessionScheduleInfo: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Informações de Dízimos</label>
                <input
                  type="text"
                  className="form-control"
                  value={formConfig.dizimoInfo || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, dizimoInfo: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Informações de Doações</label>
              <input
                type="text"
                className="form-control"
                value={formConfig.doacoesInfo || ''}
                onChange={(e) => setFormConfig({ ...formConfig, doacoesInfo: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="tel"
                className="form-control"
                placeholder="Número para teste: (63) 99999-9999"
                style={{ width: '240px' }}
                value={testPhone}
                onChange={(e) => handlePhoneMask(e.target.value, setTestPhone)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={sendingKey === 'test'}
                onClick={handleSendTest}
              >
                <Send size={14} /> {sendingKey === 'test' ? 'Enviando...' : 'Testar Bot'}
              </button>
            </div>

            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Salvar Configuração Geral
            </button>
          </div>
        </div>
      </form>

      {/* Upcoming Schedules Across All Sectors */}
      <div className="glass-panel" style={{ ...styles.card, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={styles.cardTitle}>
              <Clock size={18} style={{ color: 'var(--primary-gold)' }} /> Próximas Escalas &amp; Disparos (Todos os Setores)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              Acompanhe e dispare mensagens de troca ou código conforme a escala de cada setor.
            </p>
          </div>

          <select
            className="form-control"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', width: 'auto' }}
            value={scheduleSectorFilter}
            onChange={(e) => setScheduleSectorFilter(e.target.value)}
          >
            <option value="all">Todos os Setores ({upcomingAllSchedules.length})</option>
            {Object.values(SECTORS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {displayedSchedules.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
            Nenhuma escala agendada encontrada neste filtro.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {displayedSchedules.map((sc) => {
              const scSectorId = getItemSector(sc);
              const scSectorCfg = getSectorConfig(scSectorId);
              const chapel = getChapel(sc.chapelId);
              const principal = getServer(sc.mainCeremonialistId);
              const hasValidPhone = principal?.phone && principal.phone.replace(/\D/g, '').length >= 10;
              const swapMsg = buildScheduleMessage(sc, 'swap_check').text;
              const codeMsg = buildScheduleMessage(sc, 'report_code').text;

              return (
                <div key={sc.id} style={styles.scheduleDispatchRow}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.68rem',
                          backgroundColor: `${scSectorCfg.accentColor}20`,
                          color: scSectorCfg.accentColor,
                          border: `1px solid ${scSectorCfg.accentColor}40`
                        }}
                      >
                        {scSectorCfg.name}
                      </span>
                      <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>
                        {chapel?.name || 'Capela'}
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--primary-gold)', fontWeight: 600 }}>
                        {formatBrDate(sc.date)} • {sc.time}
                      </span>
                      <span className="badge badge-scheduled" style={{ fontSize: '0.68rem' }}>
                        Código: {sc.code}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>
                        <strong>{scSectorCfg.mainRoleTitle}:</strong>{' '}
                        {principal ? principal.name : 'Não definido'}
                      </span>
                      {principal && (
                        hasValidPhone ? (
                          <span style={{ color: 'var(--color-present)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Phone size={12} /> {principal.phone}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-absent)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertTriangle size={12} /> Sem celular cadastrado
                          </span>
                        )
                      )}
                    </div>

                    {/* Bot Status Pills */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      <span className={`badge ${sc.botSwapCheckSentAt ? 'badge-present' : 'badge-scheduled'}`} style={{ fontSize: '0.68rem' }}>
                        {sc.botSwapCheckSentAt ? '1º Pergunta Troca: Enviada' : '1º Pergunta Troca: Aguardando'}
                      </span>
                      <span className={`badge ${sc.botCodeSentAt ? 'badge-present' : 'badge-scheduled'}`} style={{ fontSize: '0.68rem' }}>
                        {sc.botCodeSentAt ? '2º Código: Enviado' : '2º Código: Aguardando'}
                      </span>
                      {sc.botSwapStatus === 'confirmed' && (
                        <span className="badge badge-present" style={{ fontSize: '0.68rem' }}>
                          Sem Trocas Confirmado
                        </span>
                      )}
                      {sc.botSwapStatus === 'swap_reported' && (
                        <span className="badge badge-absent" style={{ fontSize: '0.68rem' }}>
                          Troca Informada pelo Bot!
                        </span>
                      )}
                    </div>

                    {sc.botSwapReply && (
                      <div style={styles.swapAlertBox}>
                        <div>
                          <strong>Resposta do Comandante no WhatsApp:</strong> "{sc.botSwapReply}"
                        </div>
                        {sc.botSwapStatus === 'swap_reported' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                            onClick={() => resolveBotSwapAlert(sc.id)}
                          >
                            Marcar Resolvido
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.76rem' }}
                      disabled={!hasValidPhone || sendingKey === `${sc.id}_swap_check`}
                      onClick={() => handleDispatchForSchedule(sc, 'swap_check')}
                      title="Enviar pelo Bot a pergunta de troca"
                    >
                      <ArrowLeftRight size={13} /> Enviar Pergunta Troca
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.76rem' }}
                      disabled={!hasValidPhone || sendingKey === `${sc.id}_report_code`}
                      onClick={() => handleDispatchForSchedule(sc, 'report_code')}
                      title="Enviar pelo Bot o código do relatório"
                    >
                      <KeyRound size={13} /> Enviar Código ({sc.code})
                    </button>

                    {hasValidPhone && (
                      <>
                        <a
                          href={buildWhatsAppWebLink(principal.phone, swapMsg)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.65rem', fontSize: '0.74rem', textDecoration: 'none' }}
                          title="Abrir pergunta de troca direto no seu WhatsApp Web"
                        >
                          <ExternalLink size={12} /> Zap Troca
                        </a>
                        <a
                          href={buildWhatsAppWebLink(principal.phone, codeMsg)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.65rem', fontSize: '0.74rem', textDecoration: 'none' }}
                          title="Abrir código do relatório direto no seu WhatsApp Web"
                        >
                          <ExternalLink size={12} /> Zap Código
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Parish Requests (Confessions, Baptisms, Spiritual Direction, Meetings, Tithing, Donations) & Swaps */}
      <div className="reports-tables-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={styles.card}>
          <h3 style={{ ...styles.cardTitle, marginBottom: '1rem' }}>
            <MessageSquare size={18} style={{ color: 'var(--primary-gold)' }} /> Atendimentos Solicitados no Chat ({parishRequests.filter(r => r.status !== 'resolved').length})
          </h3>
          {parishRequests.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.84rem', textAlign: 'center', padding: '1rem' }}>
              Nenhuma solicitação de confissão, direção espiritual, batismo, reunião, dízimo ou doação ainda.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '280px', overflowY: 'auto' }}>
              {parishRequests.map((pr) => (
                <div key={pr.id} style={{ ...styles.logItem, opacity: pr.status === 'resolved' ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-scheduled" style={{ fontSize: '0.66rem', textTransform: 'uppercase' }}>
                      {pr.type}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      {pr.createdAt ? new Date(pr.createdAt).toLocaleString('pt-BR') : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
                    {pr.requesterName} • {pr.requesterPhone || 'Sem telefone'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>
                    {pr.details || pr.preferredDate}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem' }}>
                    {pr.status !== 'resolved' && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                        onClick={() => resolveParishRequest(pr.id)}
                      >
                        Marcar Atendido
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                      onClick={() => deleteParishRequest(pr.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel" style={styles.card}>
          <h3 style={{ ...styles.cardTitle, marginBottom: '1rem' }}>
            <ArrowLeftRight size={18} style={{ color: '#10b981' }} /> Trocas via Bot / WhatsApp ({swapRequests.length})
          </h3>
          {swapRequests.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.84rem', textAlign: 'center', padding: '1rem' }}>
              Nenhuma solicitação de troca registrada pelo bot até o momento.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '280px', overflowY: 'auto' }}>
              {swapRequests.map((sw) => (
                <div key={sw.id} style={styles.logItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className={`badge ${sw.status === 'accepted' ? 'badge-present' : 'badge-scheduled'}`} style={{ fontSize: '0.66rem' }}>
                      {sw.status === 'accepted' ? `Aceita por ${sw.acceptedByName}` : `Aguardando (${sw.code})`}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      {sw.chapelName} • {formatBrDate(sw.scheduleDate)} {sw.scheduleTime}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '0.25rem' }}>
                    Solicitante: {sw.requesterName}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>
                    Motivo: "{sw.reason}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Bot Logs */}
      <div className="glass-panel" style={styles.card}>
        <h3 style={{ ...styles.cardTitle, marginBottom: '1rem' }}>
          <RefreshCw size={18} style={{ color: 'var(--primary-gold)' }} /> Histórico de Mensagens e Respostas (Geral)
        </h3>
        {botLogs.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
            Nenhuma mensagem disparada ou recebida pelo Chatbot ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '320px', overflowY: 'auto' }}>
            {botLogs.slice(0, 30).map((log) => (
              <div key={log.id} style={styles.logItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className={`badge ${log.direction === 'inbound' ? 'badge-justified' : 'badge-present'}`} style={{ fontSize: '0.65rem' }}>
                      {log.direction === 'inbound' ? 'Resposta Recebida' : 'Enviada'}
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                      {log.targetName || log.targetPhone}
                    </strong>
                    {log.scheduleSummary && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        • {log.scheduleSummary}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : ''} • {log.status || 'ok'}
                  </span>
                </div>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {log.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  accessDenied: {
    padding: '4rem 2rem',
    textAlign: 'center',
    backgroundColor: 'var(--bg-secondary)',
    maxWidth: '500px',
    margin: '2rem auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  card: {
    padding: '1.5rem',
    backgroundColor: 'var(--bg-secondary)'
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    gap: '0.5rem',
    flexWrap: 'wrap'
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.1rem',
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.85rem 1.15rem',
    borderRadius: '10px',
    backgroundColor: 'var(--color-present-bg)',
    border: '1px solid rgba(16, 185, 129, 0.35)',
    color: 'var(--color-present)',
    marginBottom: '1.25rem',
    fontWeight: 600,
    fontSize: '0.9rem'
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  statusIconBox: (online) => ({
    padding: '0.75rem',
    borderRadius: '12px',
    backgroundColor: online ? 'rgba(16, 185, 129, 0.15)' : 'rgba(217, 119, 6, 0.12)',
    color: online ? 'var(--color-present)' : 'var(--primary-gold)',
    border: `1px solid ${online ? 'rgba(16, 185, 129, 0.3)' : 'rgba(217, 119, 6, 0.3)'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }),
  terminalGuide: {
    marginTop: '1rem',
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid var(--border-color)'
  },
  codeBlock: {
    display: 'inline-block',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    color: 'var(--color-text-primary)',
    fontFamily: 'monospace',
    fontSize: '0.82rem'
  },
  varChipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    marginBottom: '0.45rem'
  },
  varChip: {
    background: 'rgba(217, 119, 6, 0.12)',
    border: '1px solid rgba(217, 119, 6, 0.3)',
    color: 'var(--gold-light)',
    borderRadius: '6px',
    padding: '0.2rem 0.45rem',
    fontSize: '0.72rem',
    cursor: 'pointer',
    fontWeight: 600
  },
  previewBox: {
    marginTop: '0.75rem',
    padding: '0.85rem',
    borderRadius: '10px',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    border: '1px solid rgba(16, 185, 129, 0.25)'
  },
  previewLabel: {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#34d399',
    marginBottom: '0.4rem'
  },
  previewText: {
    margin: 0,
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.45'
  },
  scheduleDispatchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    padding: '1rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    border: '1px solid var(--border-color)'
  },
  swapAlertBox: {
    marginTop: '0.6rem',
    padding: '0.6rem 0.85rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    fontSize: '0.8rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap'
  },
  logItem: {
    padding: '0.75rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  }
};
