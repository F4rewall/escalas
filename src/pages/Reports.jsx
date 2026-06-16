import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { 
  FileText, 
  ShieldAlert, 
  TrendingUp, 
  AlertCircle, 
  Calendar, 
  User, 
  Activity,
  Award,
  BookOpen
} from 'lucide-react';

export default function Reports() {
  const { userRole, reports, schedules, chapels, servers, getServerStats } = useContext(AppContext);

  // 1. Role Guard
  if (userRole !== 'admin') {
    return (
      <div className="glass-panel" style={styles.accessDenied}>
        <ShieldAlert size={48} style={{ color: 'var(--color-absent)', marginBottom: '1.25rem' }} />
        <h3>Acesso Restrito</h3>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', maxWidth: '400px' }}>
          Esta página contém relatórios internos de coordenação e estatísticas confidenciais. Apenas administradores cadastrados têm acesso.
        </p>
      </div>
    );
  }

  // 2. Statistics Calculations
  const completedSchedulesCount = schedules.filter(s => s.status === 'completed').length;
  
  // Calculate attendance averages
  const serverStatsList = servers.map(s => {
    const stats = getServerStats(s.id);
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      active: s.active,
      ...stats
    };
  });

  // Category specific calculations
  const coroinhasStats = serverStatsList.filter(s => s.category === 'coroinha' && s.total > 0);
  const cerimoniariosStats = serverStatsList.filter(s => s.category === 'cerimoniario' && s.total > 0);

  const coroinhaAvgRate = coroinhasStats.length > 0
    ? Math.round(coroinhasStats.reduce((acc, curr) => acc + curr.rate, 0) / coroinhasStats.length)
    : 0;

  const cerimoniarioAvgRate = cerimoniariosStats.length > 0
    ? Math.round(cerimoniariosStats.reduce((acc, curr) => acc + curr.rate, 0) / cerimoniariosStats.length)
    : 0;

  // Find Top Attenders (Present at least 1 time, sorted by rate desc)
  const topAttenders = [...serverStatsList]
    .filter(s => s.total > 0 && s.rate >= 80)
    .sort((a, b) => b.rate - a.rate || b.present - a.present)
    .slice(0, 4);

  // Find Watchlist / Absentees (Present rate < 60% and total shifts > 0)
  const watchlist = [...serverStatsList]
    .filter(s => s.total > 0 && s.rate < 75)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 4);

  const getChapelName = (chapelId) => {
    const chapel = chapels.find(c => c.id === chapelId);
    return chapel ? chapel.name : 'Capela Excluída';
  };

  const getChapelNameBySchedule = (scheduleId) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    return schedule ? getChapelName(schedule.chapelId) : 'Missa Desconhecida';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">Central de Relatórios</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Visão detalhada do comportamento das escalas, frequências por categoria e diário de bordo dos coordenadores.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="reports-layout-grid">
        {/* Category breakdown bar chart */}
        <div className="glass-panel" style={styles.metricChartCard}>
          <h3 style={styles.chartTitle}><Activity size={18} /> Desempenho por Categoria</h3>
          
          <div style={styles.chartRow}>
            <div style={styles.chartBarLabel}>
              <span>Cerimoniários</span>
              <strong>{cerimoniarioAvgRate}% de Presença</strong>
            </div>
            <div style={styles.progressTrack}>
              <div style={styles.progressFill(cerimoniarioAvgRate, 'var(--cerimoniario-color)')}></div>
            </div>
          </div>

          <div style={styles.chartRow}>
            <div style={styles.chartBarLabel}>
              <span>Coroinhas</span>
              <strong>{coroinhaAvgRate}% de Presença</strong>
            </div>
            <div style={styles.progressTrack}>
              <div style={styles.progressFill(coroinhaAvgRate, 'var(--coroinha-color)')}></div>
            </div>
          </div>
        </div>

        {/* Quick totals info */}
        <div className="glass-panel" style={styles.metricSummaryCard}>
          <div style={styles.summaryBox}>
            <TrendingUp size={24} style={{ color: 'var(--primary-gold)' }} />
            <div>
              <span style={styles.summaryLabel}>Total de Missas Escaladas</span>
              <h2 style={styles.summaryVal}>{schedules.length}</h2>
            </div>
          </div>
          <div style={styles.summaryBox}>
            <Award size={24} style={{ color: '#10b981' }} />
            <div>
              <span style={styles.summaryLabel}>Escalas Concluídas</span>
              <h2 style={styles.summaryVal}>{completedSchedulesCount}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboards Grid */}
      <div className="reports-tables-grid">
        {/* Top Attenders */}
        <div className="glass-panel" style={styles.tableCard}>
          <h3 style={{...styles.chartTitle, color: '#10b981'}}>
            <Award size={18} /> Destaques de Assiduidade
          </h3>
          <div style={styles.tableList}>
            {topAttenders.length === 0 ? (
              <p style={styles.noDataText}>Dados insuficientes para gerar destaques.</p>
            ) : (
              topAttenders.map(s => (
                <div key={s.id} style={styles.tableRow}>
                  <div style={styles.tableUserCol}>
                    <div style={styles.miniAvatar(s.category === 'cerimoniario' ? 'var(--cerimoniario-color)' : 'var(--coroinha-color)')}>
                      {s.name[0]}
                    </div>
                    <div>
                      <span style={styles.rowName}>{s.name}</span>
                      <span style={styles.rowCategory}>{s.category === 'cerimoniario' ? 'Cerimoniário' : 'Coroinha'}</span>
                    </div>
                  </div>
                  <div style={styles.rowValueCol('#10b981')}>
                    <span>{s.rate}%</span>
                    <span style={styles.rowSubvalue}>{s.present} presenças</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Watchlist */}
        <div className="glass-panel" style={styles.tableCard}>
          <h3 style={{...styles.chartTitle, color: 'var(--color-absent)'}}>
            <AlertCircle size={18} /> Necessitam de Atenção
          </h3>
          <div style={styles.tableList}>
            {watchlist.length === 0 ? (
              <p style={styles.noDataText}>Nenhum coroinha/cerimoniário com presença crítica.</p>
            ) : (
              watchlist.map(s => (
                <div key={s.id} style={styles.tableRow}>
                  <div style={styles.tableUserCol}>
                    <div style={styles.miniAvatar('var(--color-absent)')}>
                      {s.name[0]}
                    </div>
                    <div>
                      <span style={styles.rowName}>{s.name}</span>
                      <span style={styles.rowCategory}>{s.category === 'cerimoniario' ? 'Cerimoniário' : 'Coroinha'}</span>
                    </div>
                  </div>
                  <div style={styles.rowValueCol('var(--color-absent)')}>
                    <span>{s.rate}%</span>
                    <span style={styles.rowSubvalue}>{s.absent} faltas</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Mass Coordinator logs (Diários dos Responsáveis) */}
      <div className="glass-panel" style={styles.logsSection}>
        <div style={styles.sectionTitleWrapper}>
          <BookOpen size={20} style={{ color: 'var(--primary-gold)' }} />
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>Diário do Altar - Relatórios dos Responsáveis</h3>
        </div>

        <div style={styles.reportsList}>
          {reports.length === 0 ? (
            <div style={styles.emptyLogs}>
              <FileText size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem' }} />
              <p>Nenhum relatório de missa enviado até o momento.</p>
            </div>
          ) : (
            reports.map((report, idx) => (
              <div key={report.scheduleId || idx} style={styles.reportItemCard}>
                <div style={styles.reportItemHeader}>
                  <div>
                    <h4 style={styles.reportChapel}>{getChapelNameBySchedule(report.scheduleId)}</h4>
                    <div style={styles.reportMeta}>
                      <Calendar size={12} />
                      <span>{formatDate(report.date)}</span>
                      <span style={{ margin: '0 0.25rem' }}>•</span>
                      <User size={12} />
                      <span>Responsável: <strong>{report.coordinatorName}</strong></span>
                    </div>
                  </div>
                  <div className="badge badge-present" style={styles.attendanceReportBadge}>
                    {report.attendanceSummary}
                  </div>
                </div>

                {report.dataHorario ? (
                  <div className="report-grid-details-responsive" style={styles.reportGridDetails}>
                    <div style={styles.reportField}>
                      <span style={styles.reportFieldLabel}>1. Data e Horário</span>
                      <p style={styles.reportFieldValue}>{report.dataHorario}</p>
                    </div>
                    <div style={styles.reportField}>
                      <span style={styles.reportFieldLabel}>2. Cerimoniário Principal</span>
                      <p style={styles.reportFieldValue}>{report.cerimoniarioPrincipal}</p>
                    </div>
                    <div style={styles.reportFieldFull}>
                      <span style={styles.reportFieldLabel}>3. Ausentes</span>
                      <p style={{
                        ...styles.reportFieldValue, 
                        color: report.ausentes && report.ausentes !== 'Ninguém faltou.' ? 'var(--color-absent)' : 'var(--color-text-secondary)',
                        whiteSpace: 'pre-line'
                      }}>
                        {report.ausentes}
                      </p>
                    </div>
                    <div style={styles.reportFieldFull}>
                      <span style={styles.reportFieldLabel}>4. Intercorrências</span>
                      <p style={styles.reportFieldValue}>{report.intercorrencias || 'Nenhuma.'}</p>
                    </div>
                    <div style={styles.reportFieldFull}>
                      <span style={styles.reportFieldLabel}>5. Situação dos Objetos Litúrgicos (velas, carvão, incenso, turíbulo)</span>
                      <p style={styles.reportFieldValue}>{report.situacaoObjetos || 'Tudo em ordem.'}</p>
                    </div>
                    <div style={styles.reportField}>
                      <span style={styles.reportFieldLabel}>6. Conferiu a guarda de todos os objetos litúrgicos?</span>
                      <p style={{
                        ...styles.reportFieldValue, 
                        color: report.conferiuGuarda === 'Sim' ? 'var(--color-present)' : (report.conferiuGuarda === 'Não' ? 'var(--color-absent)' : 'var(--gold-light)')
                      }}>{report.conferiuGuarda || 'Sim'}</p>
                    </div>
                    <div style={styles.reportFieldFull}>
                      <span style={styles.reportFieldLabel}>7. Algo mais a relatar?</span>
                      <p style={styles.reportFieldValue}>{report.algoMais || 'Nada a relatar.'}</p>
                    </div>
                    <div style={styles.reportFieldFull}>
                      <span style={styles.reportFieldLabel}>8. Algo a verificar com outras pastorais?</span>
                      <p style={styles.reportFieldValue}>{report.verificarOutrasPastorais || 'Não.'}</p>
                    </div>
                    <div style={{...styles.reportFieldFull, marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                      <span style={styles.reportFieldLabel}>9. Confirmação (Nome e Data)</span>
                      <p style={styles.reportFieldValueSignature}>✍️ {report.confirmacao}</p>
                    </div>
                  </div>
                ) : (
                  <div style={styles.reportContent}>
                    <p style={styles.reportText}>
                      "{report.summary}"
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  accessDenied: {
    padding: '4rem 2rem',
    textAlign: 'center',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '2rem auto',
    maxWidth: '600px',
  },
  metricsContainer: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  metricChartCard: {
    padding: '1.5rem',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  chartTitle: {
    fontSize: '1.1rem',
    color: 'var(--color-text-primary)',
    margin: '0 0 0.5rem 0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  chartRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  chartBarLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
  },
  progressTrack: {
    width: '100%',
    height: '12px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  progressFill: (percentage, color) => ({
    width: `${percentage}%`,
    height: '100%',
    backgroundColor: color,
    borderRadius: '6px',
    transition: 'width 1s ease-out',
    boxShadow: `0 0 10px ${color}50`,
  }),
  metricSummaryCard: {
    padding: '1.5rem',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '1.5rem',
  },
  summaryBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  summaryLabel: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    fontWeight: '600',
    display: 'block',
  },
  summaryVal: {
    fontSize: '1.5rem',
    color: 'var(--color-text-primary)',
    margin: 0,
    fontWeight: '700',
  },
  tablesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  tableCard: {
    padding: '1.5rem',
    backgroundColor: 'var(--bg-secondary)',
  },
  tableList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  tableRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    backgroundColor: 'rgba(0,0,0,0.15)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
  },
  tableUserCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  miniAvatar: (color) => ({
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: color + '20',
    color: color,
    border: `1px solid ${color}40`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '0.85rem',
  }),
  rowName: {
    display: 'block',
    fontSize: '0.9rem',
    color: 'var(--color-text-primary)',
    fontWeight: '600',
  },
  rowCategory: {
    display: 'block',
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
  },
  rowValueCol: (color) => ({
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    color: color,
    fontWeight: 'bold',
    fontSize: '1rem',
  }),
  rowSubvalue: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    fontWeight: 'normal',
  },
  noDataText: {
    fontSize: '0.85rem',
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: '1rem',
  },
  logsSection: {
    padding: '1.5rem',
    backgroundColor: 'var(--bg-secondary)',
  },
  sectionTitleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '1rem',
    marginBottom: '1.5rem',
  },
  reportsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  emptyLogs: {
    textAlign: 'center',
    padding: '2.5rem',
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem',
  },
  reportItemCard: {
    padding: '1.25rem',
    backgroundColor: 'rgba(0,0,0,0.15)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    transition: 'border-color var(--transition-fast)',
  },
  reportItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '0.75rem',
  },
  reportChapel: {
    fontSize: '1.05rem',
    color: 'var(--color-text-primary)',
    margin: '0 0 0.25rem 0',
  },
  reportMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    flexWrap: 'wrap',
  },
  attendanceReportBadge: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.6rem',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--color-text-secondary)',
  },
  reportContent: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.03)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
  },
  reportText: {
    fontSize: '0.88rem',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.5',
    fontStyle: 'italic',
    margin: 0,
  },
  reportGridDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    backgroundColor: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.03)',
    borderRadius: '8px',
    padding: '1rem',
    marginTop: '0.75rem',
  },
  reportField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  reportFieldFull: {
    gridColumn: '1 / span 2',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  reportFieldLabel: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--primary-gold)',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  reportFieldValue: {
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: '1.4',
  },
  reportFieldValueSignature: {
    fontSize: '0.9rem',
    color: 'var(--color-text-primary)',
    fontWeight: '600',
    fontStyle: 'italic',
    margin: 0,
  }
};

// Styles completed
