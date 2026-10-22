# Changelog

Todas as mudanças relevantes do Nazuna.

## [10.2.1] - 2026-10-22

Atualização permanente com as correções encontradas nos testes reais do bot
(QR Code, processamento de mensagens e download de mídias sociais).

### Corrigido

- **O QR Code não iniciava (`Cannot read properties of undefined (reading 'split')`)**
  O launcher injetava as pastas do `yt-dlp`/FFmpeg no `PATH` do processo filho
  lendo `env.PATH` de uma cópia `{ ...process.env }`. No Windows a variável real
  é `Path` (minúsculo) e a cópia não normaliza a caixa, então `env.PATH` ficava
  `undefined` e o `.split()` estourava. Agora a chave real é localizada
  (`findEnvKey`) e reescrita na mesma chave; sem `PATH` no ambiente o launcher
  avisa com mensagem clara e sobe o bot mesmo assim.

- **Toda mensagem derrubava o bot (`Cannot read properties of undefined (reading 'length')`)**
  O `dados/src/config.json` estava vazio (`{}`), então `config.prefixo` era
  `undefined` e `groupPrefix.length` (em `index.js`) estourava em qualquer
  mensagem — inclusive `!menu`. A origem era o runner de testes, que criava um
  config vazio temporário. Agora:
  - `dados/src/utils/defaultConfig.js` centraliza os valores padrão e a
    normalização (`normalizeConfig`);
  - o launcher **completa** configs incompletos sem apagar o que o dono já
    configurou;
  - o `index.js` normaliza a config em memória (com aviso único por processo);
  - `dados/src/utils/messageFilters.js` resolve o prefixo
    (`resolveCommandPrefix`, nunca `undefined`) e filtra mensagens de sistema do
    WhatsApp (`shouldIgnoreSystemMessage`), preservando revogação
    (anti-delete), revisões e solicitações de entrada;
  - o runner de testes passa a salvar/restaurar o `config.json` original e usa
    uma configuração completa durante a execução.

- **`!tiktok` e `!instagram` quebravam ao enviar a mídia**
  (`Cannot read properties of undefined (reading 'toString')` em
  `baileys/lib/Utils/messages-media.js`) — os dois comandos montavam a mídia
  como `{ buffer }`, formato que o Baileys não aceita (ele aceita Buffer cru,
  `{ stream }` ou `{ url }`). Agora ambos usam
  `dados/src/funcs/downloads/socialMediaMessage.js` (`buildSocialMediaPayload`),
  que valida buffer/tamanho antes do envio e repassa tipo, MIME type, nome do
  arquivo e legenda.

- **`!facebook` perdia o nome do arquivo e fixava o tipo como vídeo**
  O comando lia `result.filename`, mas o adaptador devolve `fileName`; além
  disso, uma foto do Facebook seria enviada como vídeo. O comando passou a usar
  o mesmo helper (tipo/MIME/nome corretos), mantendo miniatura, legenda e o
  fallback para documento.

- **Detecção do `yt-dlp` e do FFmpeg** passou a procurar em várias raízes
  (`LOCALAPPDATA`, `USERPROFILE`, `HOME`, pasta do projeto, `node_modules/.bin`),
  e o launcher injeta essas pastas no `PATH` do bot — sem isso o provider local
  falhava e o bot caía na VexAPI (cota).

- **Mídias sociais preferem H.264** (cadeia `h264` → `avc1` → `best`): o TikTok
  servia HEVC, que o WhatsApp no iPhone não reproduz (vídeo preto).

### Adicionado

- `dados/src/utils/defaultConfig.js` — valores padrão e normalização do
  `config.json`.
- `dados/src/utils/messageFilters.js` — regras de prefixo e filtro de
  mensagens de sistema.
- `dados/src/funcs/downloads/socialMediaMessage.js` — conversão do resultado do
  adaptador para o payload aceito pelo Baileys.
- `test/config/`, `test/downloads/` — testes de regressão dos itens acima.

### Validação

- `npm test`: **232/232 passando** (era 202 antes desta rodada).
- Downloads reais conferidos: TikTok (1.151.644 B, H.264), Facebook
  (4.331.930 B, H.264) e SoundCloud, sem alterar nada em `node_modules`.
- Nenhuma alteração em `!play`, `!play2`, `!play3`, `!ytmp4` e `!tiktok`.
