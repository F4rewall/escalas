# Chatbot WhatsApp • Escalas Paroquiais Santo Antônio

Este bot conecta diretamente o **Firebase Firestore** do site ao **WhatsApp** usando `@whiskeysockets/baileys`.

## Como funciona (2 momentos)
1. **Pergunta de Troca (Pré-Missa)**: Horas antes da celebração (configurável no painel **Chatbot** do site), o bot envia mensagem para o celular do **Comandante Principal** (`Cerimoniário Principal`, `Responsável Musical`, `Coordenador` ou `Ministro Coordenador`) perguntando se houve alguma troca na equipe.
   - Se ele responder **NÃO**, o bot confirma na escala.
   - Se ele responder **SIM** ou informar quem trocou com quem, o bot registra a resposta na escala, mostra alerta no painel e encaminha ao WhatsApp do coordenador do setor (se configurado).
2. **Código do Relatório (Dia da Missa)**: No horário configurado (no início da missa, 30 min antes, 1h após ou às 07h do dia), o bot envia o **código de 4 dígitos** da celebração para o Comandante Principal fazer a chamada e o relatório no site.

## Como ligar o Bot
1. Instale as dependências:
   ```bash
   cd chatbot
   npm install
   ```
2. Inicie o bot:
   ```bash
   npm start
   ```
3. Escaneie o **QR Code** que aparecerá no terminal com o WhatsApp da Paróquia/Pastoral (Aparelhos Conectados).
4. No painel Admin do site, acesse a aba **Chatbot** e ative o bot no setor desejado (`Coroinhas`, `Música`, `Liturgia` ou `MECE`).

