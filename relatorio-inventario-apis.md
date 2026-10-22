# Inventário de comandos, APIs e dependências externas — Nazuna

> Auditoria iniciada em 2026-10-21 e atualizada em 2026-10-22 sobre a cópia local do projeto.
> **Escopo:** `dados/src/index.js` (switch principal, 1660 rótulos de `case`), `dados/src/funcs/api/`,
> `dados/src/funcs/downloads/`, `dados/src/funcs/private/`, `dados/src/funcs/ferramentas/`,
> `dados/src/funcs/utils/`, `dados/src/funcs/logos/`, `dados/src/funcs/edits/`, `dados/src/menus/`, `package.json`.
> **Método:** varredura de todos os `case '…':`, inventário de domínios externos por arquivo, e classificação
> de cada dependência (VexAPI, API de terceiros, scraping, biblioteca local, template local).

---

## 0. Correções aplicadas (rodadas de validação com rede real)

| Sintoma | Causa comprovada | Correção |
|---|---|---|
| `"Limite de uso da API atingido"` na busca/vídeo do YouTube | A mensagem só existe no provider **VexAPI** (`providers/vex/youtube.js`). O provider local falhava antes porque o processo do bot não encontrava o `yt-dlp` (o PATH do processo filho não tinha as pastas do WinGet) e, sem o provider local, sobrava a API externa, que tem cota | `ytDlpRunner.findBinary` agora procura em várias raízes (`LOCALAPPDATA`, `USERPROFILE`, `HOME`, `os.homedir()`, `bin/` do projeto, `node_modules/.bin`) e o launcher injeta as pastas do `yt-dlp`/FFmpeg no `PATH` do processo filho |
| Fallback da VexAPI silencioso (usuário não sabia que a cota externa foi usada) | O fallback não era sinalizado na resposta | `features/youtube.js` marca a mensagem com `[fallback VexAPI]` e registra `[youtube:busca]`/`[youtube:midia] provider=… falhou …; usando …`; o launcher mostra `🎬 YouTube: provider=… fallbackVex=…` e avisa `Fallback da VexAPI ATIVO` |
| Vídeo do TikTok chegando com tela preta / duração `0:00` no iPhone (Web e Android reproduzem) | O TikTok serve **HEVC (h265)**; o WhatsApp no iOS não reproduz HEVC. Não era AV1 nem problema do WhatsApp | `socialMedia.js` passa a preferir H.264 em cadeia de seletores: `b[vcodec^=h264]` → `b[vcodec^=avc1]` → `best` (o `yt-dlp` não aceita OR entre filtros e o TikTok nomeia o codec `h264`, YouTube/Instagram usam `avc1`) |
| `yt-dlp` "não encontrado" em alguns ambientes | A busca dependia só de `LOCALAPPDATA` | Detecção multi-raiz (ver acima) + teste de regressão |
| `TypeError: Cannot read properties of undefined (reading 'toString')` ao enviar o vídeo do `!tiktok` **ou do `!instagram`** | Os dois comandos montavam a mídia como `{ buffer }`, mas o Baileys (`getStream`) só aceita **Buffer cru**, `{ stream }` ou `{ url }` — com `{ buffer }` ele caía em `item.url.toString()` e estourava | `dados/src/funcs/downloads/socialMediaMessage.js` (`buildSocialMediaPayload`) traduz o retorno do adaptador para o formato aceito pelo Baileys, validando buffer/tamanho antes do envio; `!tiktok` e `!instagram` enviam o Buffer cru e mantêm `{ url }` para o resultado da busca |
| `!facebook` perdia o nome do arquivo e fixava o tipo como vídeo | O comando lia `result.filename`, mas o adaptador devolve `fileName` (o nome chegava vazio e o Baileys usava `file`); o tipo era fixado em `video`, então uma foto do Facebook seria enviada como vídeo | O `!facebook` passa a usar `buildSocialMediaPayload` (tipo real, MIME e nome corretos), mantendo miniatura, legenda e o fallback para documento |
| `!facebook` em link de **foto** (`photo.php?fbid=…`) terminava em `ERROR: Unsupported URL` | O `yt-dlp` **não tem extrator de fotos do Facebook**: só vídeos (`facebook`, `facebook:reel`, `FacebookPluginsVideo`…). O link caía no extrator genérico | Novo `providers/local/facebookPhoto.js`: classifica `photo.php?fbid` como foto, lê `og:image`/`og:video` da página pública e baixa a imagem validada (magic bytes, host `fbcdn.net`/`facebook.com`, limite 32 MB). `downloadSocialMedia` resolve a foto **antes** de exigir o `yt-dlp`; `!facebook` e o autodownload usam `buildSocialMediaPayload` e enviam o tipo real (imagem/vídeo). Páginas com login devolvem mensagem específica; nunca enviam a capa como se fosse o vídeo |
| `!pinterest` tratava **todo** pin como imagem e dependia da VexAPI até para link | O wrapper `downloads/pinterest.js` chamava `verificarAPI()` antes de tudo e enviava `urls[0]` como imagem, inclusive em pin de vídeo; o `yt-dlp` local suporta o vídeo, e a imagem está nos metadados públicos | Novo `providers/local/pinterest.js`: vídeo via `yt-dlp` (H.264 + áudio, com fallback de seletores) e imagem via `og:image`/`originals` (mesmo hash). O wrapper é **100% local**, sem `verificarAPI`, sem `site_vex`/`apikey_vex` e sem fallback Vex. `!pinterest` e o autodownload enviam pelo tipo real |
| Busca textual do TikTok/Pinterest sem chave e dependente da VexAPI | A busca do TikTok era shell assinada; a do Pinterest (desktop) não trazia resultados; o código ainda aceitava fallback Vex e recomendava a chave | `tiktokSearch.js` usa a página pública **móvel** `/discover/<termo>` (cards SSR) e não chama fallback externo; `pinterestSearch.js` usa a página móvel de busca (`__PWS_INITIAL_PROPS__`/`BaseSearchResource`), exige sinal de relevância (`rankedGuides`/vertical) para não devolver pins genéricos e não pede chave. Nenhuma chamada à Vex nesses fluxos |
| Logos podiam enviar JSON/HTML de erro como se fosse imagem | `funcs/logos/index.js` fazia `requestJSON` e `requestBuffer` na mesma URL sem checar status, `Content-Type` ou assinatura; resposta 200 de erro virava `image` no Baileys | `requestJSON`/`requestBuffer` agora checam HTTP, têm timeout e o Buffer é validado por magic bytes (JPEG/PNG/WebP/GIF). Resposta inválida/vazia vira mensagem clara; dependências injetáveis permitem testar sem rede |
| `TypeError: Cannot read properties of undefined (reading 'length')` em `index.js` ao processar qualquer mensagem (inclusive `!menu`) | `dados/src/config.json` estava vazio (`{}`), então `config.prefixo` era `undefined` → `groupPrefix` (`groupData.customPrefix \|\| prefixo`) ficava `undefined` → `groupPrefix.length` estourava em `index.js:2203`. A origem do `{}` foi o runner de testes, que criava um config vazio temporário | `dados/src/utils/defaultConfig.js` (defaults + `normalizeConfig`) é usado pelo launcher (que agora **completa** configs incompletos sem apagar o que o usuário configurou) e pelo `index.js` (normalização em memória); `dados/src/utils/messageFilters.js` resolve o prefixo (`resolveCommandPrefix`, nunca `undefined`) e filtra mensagens de sistema (`shouldIgnoreSystemMessage`, mantendo revogação/anti-delete, revisões e stubs); o runner de testes agora salva/restaura o config original e usa uma config completa |
| QR Code falha com `Cannot read properties of undefined (reading 'split')` | O launcher injetava as pastas do `yt-dlp`/FFmpeg no PATH do processo filho lendo `env.PATH` de uma cópia `{ ...process.env }`. No Windows a variável real é `Path` (minúsculo) e a cópia não normaliza a caixa: `env.PATH` ficava `undefined` e o `.split()` estourava | `findEnvKey(env, 'PATH')` localiza a chave real (qualquer caixa) e a reescreve na mesma chave; sem PATH no ambiente o launcher avisa com mensagem clara e sobe o bot sem as ferramentas |

**Validação em rede real:** TikTok `https://vt.tiktok.com/ZSgySj4EL/` → `h264/yuv420p` + `aac`
(1.151.644 B; antes, com HEVC, eram 2.193.071 B); Facebook (vídeo público
`https://www.facebook.com/FacebookDevelopers/videos/10152454700553553/`) → 4.331.930 B, `video/mp4`,
`h264/High/yuv420p` 1280×720 + `aac/LC`; YouTube → `avc1` + `aac`; SoundCloud (`nativo-v2`) → `.m4a` AAC/LC.
Nesta rodada: Pinterest imagem `…/pin/206743439137437195/` → 1.198.962 B `image/png` 736×; Pinterest vídeo
`…/pin/450148925278476311/` → 2.251.913 B `video/mp4` (seletor `avc1` + áudio). Facebook **foto** pública:
a página não expõe `og:image` sem login; o comando agora responde com a mensagem específica de conteúdo
removido/restrito, **não** mais `Unsupported URL` (o download real de foto não foi validado por exigir autenticação).

**Nova rodada de busca local (2026-10-22, sem chave):** Pinterest `flores` → 24 pins reais; a primeira imagem
`https://i.pinimg.com/originals/…` respondeu HTTP 200, 101.769 B, assinatura JPEG (`ffd8ffe0`). TikTok `baralho`
→ 4 vídeos reais pela página de descoberta; o primeiro (`…/@brenocosta.oficial/video/7582991505946610962`) foi
baixado pelo provider local → 5.897.298 B, `video/mp4`, título real. Nenhuma chamada à VexAPI; nenhum resultado
foi simulado.

---

## 1. Estado da API própria (`dados/src/funcs/api/`)

| Arquivo | Papel |
|---|---|
| `index.js` | Fachada: `run(feature, input, options)` → `youtube.search`, `youtube.audio`, `youtube.video`, `brat` |
| `config.js` | Configuração (provider padrão `local`, `allowVexFallback` **false**, timeouts, limites, `ytDlpPath`, `ffmpegPath`) |
| `policy.js` | Normalização de provider, cadeia de fallback (`resolveYoutubeProviderChain`), `shouldFallback` |
| `errors.js` | `ApiError` + `ErrorCodes` + `isRecoverable` (define o que pode cair no fallback) |
| `http.js` | Cliente HTTP (axios) com timeout, limite de bytes e mapeamento de status |
| `media.js` | Download temporário com limite de bytes, redirects, `.part`, limpeza e `createMediaSource` |
| `cache.js` / `limiter.js` | Cache TTL e limitador de concorrência |
| `features/youtube.js` | Orquestração: busca → preparação → download → mídia pronta para o Baileys |
| `features/brat.js` | Provider local de "brat" (geração de imagem) |
| `providers/local/youtube.js` | Provider **local**: extração direta da watch page + `yt-dlp` quando necessário |
| `providers/local/ytdlp.js` | **Mecanismo local opcional**: binário `yt-dlp` (áudio/vídeo), remux `faststart`, validação de duração |
| `providers/local/ytDlpRunner.js` | **Camada compartilhada** de mídia via yt-dlp: validação de URL/host, execução segura (`spawn` sem shell), timeout/cancelamento, limite de tamanho, temp dir exclusivo por operação, validação de container, limpeza e erros por etapa. Usada por YouTube, TikTok, Instagram, Facebook e Pinterest |
| `providers/local/socialMedia.js` | **Provider social local** (TikTok, Instagram, Facebook) sobre o runner: hosts permitidos, limite por plataforma, buffer validado e mensagens por etapa. Para Facebook, classifica o link e resolve **fotos** (`photo.php?fbid`) por metadados públicos antes de exigir o binário |
| `providers/local/facebookPhoto.js` | **Provider de fotos do Facebook**: classifica `photo.php?fbid` (foto) × `photo.php?v`/`/reel/`/`/watch/` (vídeo), extrai `og:image`/`og:video`, valida hosts de mídia, tamanho e assinatura da imagem. Sem cookies/login; reporta `login_required`/`extract_failed` com mensagem específica |
| `providers/local/pinterest.js` | **Provider local de pins do Pinterest**: vídeo via yt-dlp (H.264 + áudio, cadeia de seletores), imagem via `og:image` e `originals` (mesmo hash), resolução de `pin.it`, limite de tamanho e erro `video_unavailable` para nunca enviar a capa como vídeo |
| `providers/local/pinterestSearch.js` | **Provider local de busca textual do Pinterest**: consulta a página pública móvel, extrai `__PWS_INITIAL_PROPS__`/`BaseSearchResource`, exige sinal de relevância para não devolver pins genéricos, prefere `originals`, deduplica, limita, aplica timeout e devolve limitação honesta sem chave |
| `providers/local/tiktokSearch.js` | **Provider de busca textual do TikTok**: consulta `/discover/<termo>` com UA móvel, extrai cards SSR (`data-e2e="video-item"`), normaliza (só TikTok), deduplica, limita, aplica timeout e devolve limitação honesta quando não há cards. Não usa VexAPI, `config` nem fallback |
| `providers/local/brat.js` | Provider local de imagens (sem rede) |
| `providers/vex/youtube.js` | Provider **VexAPI** (legado, kept como fallback explícito) |
| `providers/vex.js` | Verificação de chave da VexAPI (`checkVexKey`) |

**Regras vigentes:** provider padrão = `local`; `allowVexFallback` = `false`; a Vex só é usada com
`auto` + `allowVexFallback=true` explícito (nunca fallback silencioso); a busca do YouTube **não** depende
da Vex.

---

## 2. Inventário de comandos de mídia e serviços externos

Legenda da coluna **Classe**: `API externa` · `site externo/scraping` · `provider local` ·
`biblioteca local` · `template local` · `dependência desconhecida`.

### 2.1 YouTube — migrado para a API própria

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!play`, `!ytmp3`, `!play2` (áudio); `!playvid`, `!ytmp4` (vídeo); autodownload por link no grupo |
| 2. Responsável | `dados/src/funcs/downloads/youtubeCommands.js` → `dados/src/funcs/api/features/youtube.js` → `providers/local/youtube.js` (+ `providers/local/ytdlp.js`) |
| 3. Serviço/biblioteca | API interna: `yt-search` (busca) + extração direta da watch page + `yt-dlp` (binário local) + FFmpeg (remux/miniatura) |
| 4. Depende da VexAPI? | **Não** (a Vex existe como provider legado `auto` + `allowVexFallback`) |
| 5. Usa a API própria? | **Sim**, integralmente |
| 6. Autenticação | `yt-dlp` local (sem chave); Vex só se habilitada (`site_vex` + `apikey_vex`) |
| 7. Estado/evidências | `!play` **confirmado no WhatsApp real** (áudio recebido). `!play2`/`!ytmp4`/`!ytmp3`/`!playvid`: busca+download+montagem de mídia **reais**, envio local validado pelo pipeline real do Baileys; envio ao vivo apenas de `!play2`/`!ytmp4` (ver seção 6) |
| 8. Migração possível | **Já migrado**; falta apenas revalidar o envio no iOS |
| 9. Testes necessários | `test/api/youtube.test.js`, `youtube-commands.test.js`, `youtube-local-provider.test.js`, `youtube-ytdlp.test.js`, `youtube-baileys-media.test.js` (existem e passam) |
| 10. Prioridade/risco | Baixa. Risco residual: **vídeo no iOS ainda não confirmado** |

### 2.2 SoundCloud — migrado nesta etapa

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!play3`, `!playsoundcloud` (busca+áudio); `!soundclouddl`, `!soundcloud` (download por link) |
| 2. Responsável | `dados/src/funcs/downloads/soundcloud.js` (usado por `index.js` via `funcs/exports.js`) |
| 3. Serviço/biblioteca | **api-v2 do SoundCloud** (nativo): `client_id` extraído dos bundles do site → `/search/tracks` → `/resolve?url=` → `media.transcodings` → CDN. Fallback: `nayan-video-downloader.vercel.app` (só busca) |
| 4. Depende da VexAPI? | Não |
| 5. Usa a API própria? | Provider **local** (SoundCloud) próprio, fora do `api/` do YouTube |
| 6. Autenticação | Nenhuma (client_id público do web); **sem cookies, sem token, sem cabeçalho de autorização** |
| 7. Estado/evidências | Rede real: `!play3 billie jean` → faixa "Michael Jackson - Billie Jean" (DJ FLUX) → `.m4a` 3.458.234 B, `audio/mp4`, AAC/LC 283,5 s, thumbnail válido. Envio pelo Baileys ainda **não** confirmado no WhatsApp real |
| 8. Migração possível | Feita (resolução nativa substitui o serviço terceiro que devolvia `download_url: null`) |
| 9. Testes necessários | `test/api/soundcloud.test.js` (10 testes: busca nativa, progressivo, HLS→m4a, permalink ausente, faixa sem stream, áudio vazio/inválido, `download_url` nulo **nunca** vira "Invalid URL", provider/etapa no resultado) |
| 10. Prioridade/risco | **Alta** (corrigido). Risco: o `client_id` é obtido por scraping do site — pode mudar; o fallback de busca cobre |

### 2.3 TikTok — download local e busca parcial pela página de descoberta, sem Vex

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!tiktok`, `!tiktokaudio`, `!tiktokvideo`, `!tiktoks`, `!tiktoksearch`, `!ttk`, `!tkk` (mesmo bloco) |
| 2. Responsável | `index.js` → `providers/local/socialMedia.js` (download) e `providers/local/tiktokSearch.js` (busca) |
| 3. Serviço/biblioteca | **yt-dlp local**; busca em `https://www.tiktok.com/discover/<termo>` (página pública, UA móvel) |
| 4. Depende da VexAPI? | **Não** — nem download, nem busca; não há fallback Vex |
| 5. Usa a API própria? | Sim (`socialMedia.js` + `tiktokSearch.js` sobre `ytDlpRunner.js`) |
| 6. Autenticação | Nenhuma; sem cookies |
| 7. Estado/evidências | **Download: rede real OK** — `https://www.tiktok.com/@scout2015/video/6718335390845095173` → 2.004.627 B, `video/mp4`, título real, 4,8 s. **Busca: parcial e real** — `baralho` → 4 vídeos; primeiro baixado pelo provider local → 5.897.298 B, `video/mp4`, título real |
| 8. Migração possível | Concluída para download e para a busca por descoberta; a busca completa (rota `/search`) continua indisponível sem assinatura |
| 9. Testes | `test/api/social-media.test.js` (9), `test/api/tiktok-search.test.js` (10) e `test/integration/search-network.test.js` (gated) |
| 10. Prioridade/risco | **Alta (download) / Média (busca)**. Risco: a página de descoberta só existe para parte dos termos e pode mudar |

**Estado da busca textual do TikTok (parcial, sem chave):**
- `!tiktoksearch`, `!ttk`, `!tkk` → `searchTikTok(...)` → `https://www.tiktok.com/discover/<termo>` com UA móvel. Quando a página existe, extrai os cards SSR (`data-e2e="video-item"`), autor, id e título, normaliza e deduplica.
- **Limitação:** é a página de **descoberta por palavra-chave**, não a busca completa. Termos sem página de descoberta (testados: `cachorro`, `gato`, `love`) redirecionam para `/search` e recebem a mensagem honesta de indisponibilidade; nenhum resultado genérico é inventado.
- A rota oficial `/search?q=…` continua sendo um shell cujos resultados chegam por requisição assinada (`msToken`/`X-Bogus`); a assinatura **não** foi gerada/contornada. `yt-dlp tiktok:tag` está marcado como quebrado e não é usado.
- `yt-dlp` **não tem busca textual do TikTok**: `ytsearch` é o extrator do **YouTube** e devolve URLs `youtube.com`; não é usado.
- A mensagem de indisponibilidade não menciona Vex/api-key e orienta enviar um link direto (que funciona pela API local).
- Integração real (2026-10-22): `baralho` → 4 vídeos; `searchTikTok` retornou `fonte: 'local'`, e o primeiro resultado foi baixado sem chave.

### 2.4 Facebook — provider local **validado em rede real**

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!fb`, `!fbdl`, `!facebookdl` (**os três caem no mesmo bloco** e chamam a mesma função `downloadSocialMedia('facebook', url)` testada; prefixo do bot = `!`) |
| 2. Responsável | `index.js` → `providers/local/socialMedia.js` (`downloadSocialMedia('facebook', url)`); fotos → `providers/local/facebookPhoto.js` |
| 3. Serviço/biblioteca | **yt-dlp local** para vídeos + **metadados públicos** (`og:image`) para fotos (antes: `nayan-video-downloader`, terceiro) |
| 4. Depende da VexAPI? | Não |
| 6. Autenticação | Sem cookies; apenas conteúdo público |
| 7. Estado/evidências | **Rede real OK** — URL pública de exemplo da **documentação oficial da Meta**: `https://www.facebook.com/FacebookDevelopers/videos/10152454700553553/` → 4.331.930 B, `video/mp4`, tempo de download ≈ 4,1 s; **ffprobe**: container `mov,mp4,m4a` com duração **62,510425 s**; stream de vídeo `h264/High/yuv420p 1280×720`, **62,510425 s** (1499 frames, time_base 1/19184); stream de áudio `aac/LC 44.100 Hz`, **62,485011 s** (2692 frames, 1/44100) → container/vídeo/áudio consistentes (Δ 25 ms), **download completo**; **decodificação integral com ffmpeg sem nenhum erro**; boxes `ftyp → moov → free → mdat` (**faststart** ✓); temporário **removido** (`restosNoTemp: []`); erros: URL inválida → "Link do Facebook inválido."; host errado → "O link informado não é do Facebook."; vídeo inexistente → "O conteúdo do Facebook não pôde ser extraído (pode ser privado, removido ou exigir login)." **Fotos:** `photo.php?fbid=…` → o `yt-dlp` responde `Unsupported URL` (não tem extrator de foto); o provider local lê a página pública. A URL de teste `photo.php?fbid=122103691322525821&set=…&type=3` não expôs `og:image` (página restrita/removida) e devolveu a mensagem clara *"Não foi possível obter a foto pública do Facebook (o link pode ter sido removido ou exigir login)."*; **não** houve `Unsupported URL` nem envio de capa. Quando a foto é pública e tem `og:image`, o Buffer é validado e enviado como imagem. **Risco assumido: a maioria das fotos exige login e não é baixada (sem cookies/contorno).** |
| 8. Migração possível | Concluída (vídeo validado em rede real; foto implementada e testada com HTML público simulado; foto real depende de a página expor `og:image`) |
| 9. Testes necessários | `test/api/social-media.test.js` + `test/api/facebook-photo.test.js` (9: classificação, `og:image`, login, imagem inválida, `og:video`, foto sem yt-dlp, vídeo legado) |
| 10. Prioridade/risco | Média. Riscos: a maioria das fotos/vídeos exige login → mensagem clara (sem contorno); layout do Facebook pode mudar |

### 2.4b Instagram — provider local (limitação de cookies documentada)

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!igdl`, `!ig`, `!instavideo`, `!igstory` |
| 2. Responsável | `index.js` → `providers/local/socialMedia.js` (`downloadSocialMedia('instagram', url)`) |
| 4. Depende da VexAPI? | **Não** (antes usava `igdl.dl` → VexAPI) |
| 7. Estado/evidências | **Rede real: conteúdo público exige cookies** — o yt-dlp responde *"Instagram sent an empty media response… use --cookies-from-browser"* → o comando responde *"O Instagram exigiu autenticação (cookies) para este conteúdo; o provider local não usa cookies."* (limite específico, sem contornar autenticação) |
| 8. Migração possível | Feita; modalidades autenticadas (stories/privados) seguem indisponíveis — decisão deliberada |
| 10. Prioridade/risco | Média |


### 2.4c Pinterest — pin e busca textual locais, sem Vex

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!pinterest`, `!pin` (link de pin); busca textual no mesmo comando quando não é link |
| 2. Responsável | `index.js` → `dados/src/funcs/downloads/pinterest.js` → `providers/local/pinterest.js` (pin) e `providers/local/pinterestSearch.js` (busca) |
| 3. Serviço/biblioteca | **Provider local**: `yt-dlp` para vídeo, página pública do pin para imagem (`og:image`/`originals`) e página pública móvel de busca (`__PWS_INITIAL_PROPS__`/`BaseSearchResource`) |
| 4. Depende da VexAPI? | **Não** — pin e busca são locais; o wrapper não importa `verificarAPI`/`carregarConfigLocal` e não lê `site_vex`/`apikey_vex` |
| 5. Usa a API própria? | Sim para pin e busca (providers locais) |
| 6. Autenticação | Nenhuma; sem cookies/login; usa UA móvel na busca pública |
| 7. Estado/evidências | **Rede real OK** — imagem `https://www.pinterest.com/pin/206743439137437195/` → 1.198.962 B, `image/png`, original 736× (via `originals`), título real; vídeo `https://www.pinterest.com/pin/450148925278476311/` → 2.251.913 B, `video/mp4`, `avc1`+áudio, seletor `bv*[vcodec^=avc1]+ba/...`, título real. **Busca real:** `flores` → 24 pins; primeira imagem HTTP 200, 101.769 B, JPEG (`ffd8ffe0`). Termo inexistente → nenhum pin, mensagem honesta |
| 8. Migração possível | Concluída. A busca usa a variante móvel pública e exige sinal de relevância (`rankedGuides`/vertical) para não devolver pins genéricos; termo sem confirmação recebe limitação |
| 9. Testes | `test/api/pinterest-local.test.js` (8), `test/api/pinterest-search.test.js` (7) e `test/integration/search-network.test.js` (gated) |
| 10. Prioridade/risco | Baixa/Média. Riscos: layout/SSR do Pinterest e formatos do `yt-dlp`; a validação de host/`originals` evita imagem errada e o sinal de relevância evita resultado genérico |

### 2.5 Twitter/X — mantido externo (gratuito, já funcional)

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!twitterdl`, `!twt`, `!x`, `!xdl` |
| 2. Responsável | `dados/src/funcs/utils/twitter.js` (`getInfo`) via `info.tweeload.site` + `pastebin.com` |
| 3. Serviço | API gratuita de terceiros (tweeload) |
| 4. Depende da VexAPI? | **Não** (nunca dependeu) |
| 5. Usa a API própria? | Não |
| 6. Autenticação | Nenhuma |
| 7. Estado | Funciona; a legenda rica (autor, likes, retweets) vem desse serviço |
| 8. Migração possível | O yt-dlp também baixa do X, mas **perde a legenda completa** (likes/retweets) → optou-se por **manter** para não degradar a resposta pública |
| 9. Testes necessários | `test/api/twitter.test.js` (a criar) |
| 10. Prioridade/risco | Baixa (já é gratuito) |

### 2.6a Outros comandos com VexAPI (mantidos, com motivo)

| Comando | Serviço | Motivo de manter |
|---|---|---|
| `!letra`, `!lyrics` | VexAPI | Não existe fonte local de letras |
| `!tts`, `!tss`, `!totext` | VexAPI | TTS local exigiria modelo de voz (dependência pesada) |
| `!edits` | VexAPI | Edição remota de imagem; `sharp` local resolve só parte dos casos |
| `!pornhub` e demais logos | VexAPI (`/api/logos/<tipo>`) | **Não é template local**: as marcas não existem no repositório (`dados/midias/` só tem `menu.jpg`). Implementação local exigiria incorporar os assets (licença) → mantido, sem inventar imagens |
| `!canvas` (bratvideo/welcome2), `!removebg`/`!upscale` | VexAPI | `canvas.dl`/`imagetools` usam `runBrat` (API própria) em parte das funções, mas `bratvideo`, `welcome2`, `removebg` e `upscale` ainda chamam a VexAPI → mantidos |


### 2.6b Logos (`!pornhub` e afins) — API externa da Vex, resposta validada

| Campo | Conteúdo |
|---|---|
| 1. Aliases | `!pornhub`, `!avengers`, `!deadpool`, `!marvel` (+ `!amongus`, `!royal`, `!mascotemetal`, `!firework`, `!summerbeach`, `!cloudsky`, `!techstyle`, `!watercolor`, `!ligatures`, `!graffitistyle`, `!frozen`, `!colorful`, `!balloon`, `!multicolor`, `!metal`, `!doubleexposure`, `!mascoteneon`, `!eraser`, `!america`, `!snow`, `!sunset`, `!halloween`, `!blood`, `!hallobat`, `!cemiterio`, `!ffavatar`, `!vintage3d`, `!hollywood`, `!glitch`, `!galaxy`, `!glossy`, `!dragonfire`, `!pubgavatar`, `!comics`) — **38 no total** (34 de 1 texto + 4 de 2 textos) |
| 2. Responsável | `dados/src/funcs/logos/index.js` → `gerarLogo({query,type})` (1 txt) / `gerarLogo2({query,query2,type})` (2 txt); menu em `dados/src/menus/menulogo.js`; roteador em `index.js` (`//COMANDOS DE LOGOS`) |
| 3. Serviço | **VexAPI**: `${site_vex}/api/logos/<tipo>?apikey=…&query=…` (1 txt) e `${site_vex}/api/duallogos/<tipo>?apikey=…&query=…&text2=…` (2 txt); a logo é **gerada no servidor** |
| 4. Depende da VexAPI? | **Sim** |
| 5. Usa a API própria? | Não (a validação do Buffer é local) |
| 6. Autenticação | `apikey_vex` |
| 7. Estado | 38 comandos roteados e cobertos por teste de menu; formato/argumentos preservados (`!pornhub puro/talento` → `query`/`query2`). **Correção defensiva:** resposta JSON/HTML de erro (mesmo HTTP 200) ou Buffer vazio agora falha com mensagem clara; só JPEG/PNG/WebP/GIF válidos são enviados. **Não validado em rede real** porque o ambiente não tem `apikey_vex`; sem chave a Vex responde com a mensagem de configuração (mantida). **Não é edição de template local**: as marcas não existem no repositório (`dados/midias/` contém apenas `menu.jpg`) |
| 8. Migração possível | Seria preciso incorporar os arquivos de marca (licença) ou um gerador local por template; `sharp` já está instalado, mas **faltam os assets**. Sem assets, não há implementação local confiável → manter na Vex e documentar |
| 9. Testes necessários | `test/api/logos.test.js` (8: assinaturas, 1txt/2txt, erro JSON, resposta não-imagem/vazia, chave ausente, cache) + `test/menus/menulogo.test.js` (cobertura dos 38 comandos) — ambos existem e passam |
| 10. Prioridade/risco | Baixa (comando depende da Vex; sem chave falha com mensagem clara). Risco residual: formato real da resposta da Vex não confirmado nesta rodada |

### 2.7 Processamento local de mídia (sem serviço externo)

| Comando | Responsável | Classe | Observação |
|---|---|---|---|
| `!brat`, `!bratvid` | `api/features/brat.js` + `providers/local/brat.js` | **provider local** | Migrado; sem rede |
| `!canvas` | `funcs/downloads/canvas.js` | provider local (usa `runBrat`) | Migrado internamente; mantém `verificarAPI` legado |
| `!removebg`/`!rmbg`/`!sb`/`!sfundo`, `!upscale` | `funcs/utils/imagetools.js` | provider local (`runBrat`) + `verificarAPI` legado | Migrado internamente |
| `!sticker`, `!st`, `!stk`, `!st2`… | `funcs/utils/sticker.js` | biblioteca local (`node-webpmux`, `sharp`) + `raw.githubusercontent.com` | Sem Vex |
| `!toimg`, `!togif` | `index.js` | biblioteca local (`sharp`) | Sem Vex |
| `!totext`/`!transcrever`, `!tts`/`!tss` | `funcs/ferramentas/totext.js`, `tts.js` | **VexAPI** (`/api/…`) | Não migrado |
| `!edits` | `funcs/edits/index.js` | **VexAPI** | Não migrado |
| `!doon` | `funcs/private/doomRichHtml.js` + `vendor/jsdos` | **template local** + CDN do js-dos | Emulador em JS local; funciona |
| `!gbatest` | `funcs/private/gba/gbaTestHtml.js` | **template local** (vendor GBA.js) | Falta `resources/bios.bin` (asset licenciado) — lazy loading para não derrubar o boot |
| `!richtest`, `!airichprobe`, `!airichsizetest` | `funcs/private/airich/*` | **template local** | Sem rede |
| `!emojimix` | `funcs/utils/emojimix.js` | API externa (`tenor.googleapis.com`) | Sem Vex |

### 2.8 Utilidades e outros serviços

| Comando | Serviço | Classe |
|---|---|---|
| `!qrcode` | `api.qrserver.com` | API externa |
| `!update`/`!atualizar`, `!atualizarbot` | `api.github.com` + `git` | site externo |
| `!gerarnick`/`!nick` | local | biblioteca local |
| `!encurtalink`/`!tinyurl` | local (link shortening próprio) | local |
| `!scanlink`/`!urlscan`, `!verificarurl`/`!checkurl` | local (parse de URL) | local |
| `!clima`/`!tempo`/`!weather` | local (wttr.in via `utils/httpClient`) | site externo |
| `!tradutor`/`!translator` | `api.fishfish.gg` | API externa |
| `!horamundial`/`!worldtime` | local (Intl) | biblioteca local |
| `!gdrive`/`!drive`/`!gd` | `drive.google.com` (scraping) | site externo |
| `!mediafire`/`!mf` | `mediafire` (scraping) | site externo |
| `!twitterdl`/`!twt`/`!xdl` | `info.tweeload.site`, `pastebin.com` | API externa |
| `!apkmod` | `apkmodct.com` | site externo |
| `!mcplugins` | `modrinth.com` | API externa |
| `!freefire`-relacionados | `hubsteam.com.br` | site externo |
| `!hutao`/placas | `*.sirv.com` | imagens remotas |

### 2.9 Sistema RPG/Pokémon (local)

≈ **1600 subcomandos** (`rpg*`, `loja*`, `missao*`, `clan*`, `pet*`, `dungeon*`, `ranking*`, `gemas*`, `autorev`, `ban*`, `enquete`, `bemvindo`, …). Todos usam `dados/src/utils/database.js` (SQLite/JSON local em `dados/database/`), **sem serviço externo**. `/doon` (DOOM) e `/gbatest` (GBA) são os módulos de mídia do sistema e foram preservados.

---

## 3. Classificação resumida das dependências

| Classe | Domínios/mecanismos |
|---|---|
| **VexAPI (paga, desativada por padrão)** | `site_vex` + `apikey_vex` → Lyrics, TTS/ToText, Edits, Logos (38 comandos), canvas/imagetools (legado), YouTube legado (`funcs/downloads/youtube.js`). **TikTok e Pinterest não estão mais aqui** |
| **API externa de terceiros** | `api.fishfish.gg` (tradutor), `tenor.googleapis.com` (emojimix), `api.qrserver.com` (QR), `info.tweeload.site`/`pastebin.com` (Twitter), `api.vreden.my.id`/`spotisaver.net` (Spotify), `api.github.com` (update) |
| **Site externo / scraping** | `nayan-video-downloader.vercel.app` (SoundCloud auxiliar), `soundcloud.com` + `api-v2.soundcloud.com` (SoundCloud nativo), `pinterest.com`/`i.pinimg.com` (pin e busca móvel), `tiktok.com` (descoberta por palavra-chave), `apkmodct.com`, `modrinth.com`, `hubsteam.com.br`, `drive.google.com`, `mediafire`, `*.sirv.com`, `dos.zone`/`cdn.dos.zone` (js-dos), `wttr.in` (clima) |
| **Provider local (API própria)** | YouTube (`yt-search` + watch page + `yt-dlp` + FFmpeg), SoundCloud (api-v2 nativo), brat (imagem local), TikTok/Instagram/Facebook (yt-dlp), Facebook fotos (`og:image`), Pinterest pins (yt-dlp + `og:image`/`originals`), busca Pinterest (`BaseSearchResource`), busca TikTok (`/discover`) |
| **Biblioteca local de mídia** | `sharp` (imagem/WebP), `node-webpmux` (sticker), `ffmpeg`/`fluent-ffmpeg` (áudio/vídeo), `cheerio`/`linkedom` (parsing HTML), `yt-search` (busca) |
| **Template/arquivo local** | DOOM (js-dos vendorizado), GBA (GBA.js vendorizado, falta `bios.bin`), AIRich, `dados/midias/menu.jpg`, `dados/src/funcs/json/*` |
| **Dependência desconhecida** | `linkedom`/`cheerio` usados em `funcs/edits` e `utils` para parse de HTML de terceiros (a confirmar por comando na auditoria detalhada) |

---

## 4. Matriz de migração (prioridade × risco)

| # | Alvo | Abordagem | Esforço | Risco | Prioridade |
|---|---|---|---|---|---|
| 1 | **SoundCloud `/play3`** | Provider local (api-v2) | feito | baixo | **Alta — resolvido** |
| 2 | **TikTok (download)** | Provider local via yt-dlp | feito | baixo | **Alta — resolvido** |
| 3 | **TikTok (busca textual)** | Provider local via `/discover/<termo>` (SSR móvel), sem chave; busca completa continua indisponível | feito (busca parcial validada) | médio (só parte dos termos) | **Alta — resolvida parcialmente** |
| 4 | **Instagram / Facebook (download)** | Provider local via yt-dlp; Facebook fotos via `og:image` | feito | médio (cookies no IG; fotos do FB geralmente exigem login) | Média — feita e validada em rede real (vídeo); fotos com limitação documentada |
| 4b | **Twitter/X** | serviço gratuito já funcional | — | — | Mantido (legenda rica) |
| 5 | **Spotify** | hoje usa `api.vreden.my.id` + `spotisaver.net` | médio | médio | Média |
| 6 | **Logos (`/pornhub`)** | precisa dos assets de marca (licença); resposta agora validada localmente | alto | alto | Baixa — mantido |
| 7 | **Lyrics / TTS / ToText / Edits** | provider por capacidade; TTS local exigiria modelo | alto | alto | Baixa — mantido |
| 8 | **Pinterest (pin)** | Provider local: yt-dlp (vídeo) + `og:image`/`originals` (imagem) | feito | baixo | Média — resolvido e validado em rede real |
| 8b | **Pinterest (busca textual)** | Página pública móvel (`BaseSearchResource`) com sinal de relevância | feito | baixo/médio (SSR pode mudar) | Média — resolvida e validada em rede real |
| 9 | **RPG/Pokémon, DOOM, GBA, brat, stickers** | já locais | — | — | **Não tocar** |

**Regra de migração adotada:** provider local quando existe ferramenta local (yt-dlp, sharp, webpmux);
API própria compartilhada quando a operação se encaixa na infraestrutura existente; provider específico quando
a plataforma tem regras próprias; serviço externo apenas quando necessário e documentado; processamento
100% local para templates. **Nenhuma migração exige reativar a Vex por padrão.**

---

## 5. Configuração e fallback

- Provider padrão da API do YouTube: `local` (`api/config.js`).
- `allowVexFallback`: **false** por padrão. A Vex só é acionada com `provider=auto` **e** `allowVexFallback=true`.
- Comandos legados baseados na Vex (Logos, Lyrics, TTS…) **exigem `site_vex` + `apikey_vex`** configurados pelo
  dono (`!apikey`); sem isso devolvem "Api-key não configurada" — falha explícita, nunca sucesso simulado.
- **Links de pin do Pinterest** (`/pin/…`, `pin.it/…`), **downloads de TikTok/Instagram/Facebook** e as **buscas
  textuais de TikTok/Pinterest** funcionam sem Vex; não há fallback automático para a chave nesses fluxos.
- Logos: o próprio bot valida a assinatura da imagem antes de enviar; sem chave, o comando não chama a API e
  devolve a mensagem de configuração.
- Nenhuma chave/token/cookie é registrado em log nesta auditoria (apenas host/rota sem query string).

---

## 6. Estado do problema de vídeo no iPhone (em aberto, sem correção especulativa)

- Sintoma: `!playvid` → tela preta e `0:00` no iPhone; funciona em Web/PC e Android.
- Evidência **local** (arquivo real gerado pelo comando, `ffprobe`): `h264/Main/yuv420p` 640×480 295,83 s + `aac/LC` 44,1 kHz,
  `brands=isomiso2avc1mp41`, 17.808.105 B, `moov` antes de `mdat` (faststart ✓), bytes enviados = bytes em disco (sha256 idêntico).
- Correções já aplicadas: seletor do yt-dlp restrito a `avc1`+`m4a`, remux `-c copy -movflags +faststart`, validação de
  duração, e FFmpeg no `PATH` do processo (miniatura do Baileys).
- **Não há comprovação de compatibilidade com iOS** — só o aparelho fecha essa questão.
- Observação relevante: o Baileys gera a miniatura de vídeo chamando `ffmpeg` **do PATH**; sem ele o vídeo é enviado sem
  miniatura, o que é candidato plausível para a capa preta no iOS. O launcher agora injeta o FFmpeg detectado no PATH.
- Próximo passo obrigatório: reiniciar o bot (código novo) e repetir `!playvid billie jean` no iPhone; se persistir,
  capturar o log `[youtube:envio]` (com `NAZUNA_DEBUG_MEDIA=1` o `ffprobe` completo vai para o log) e o comportamento do
  cliente iOS antes de qualquer nova alteração.

---

## 7. Classificação dos testes (o que é simulação, rede e WhatsApp real)

| Tipo | Onde | Resultado |
|---|---|---|
| **Unitário/simulado** | `test/api/*` (youtube, youtube-commands, youtube-local-provider, youtube-ytdlp, youtube-baileys-media, soundcloud, social-media, media, policy, brat, **facebook-photo, pinterest-local, pinterest-search, tiktok-search, logos**) + `test/menus/menulogo.test.js` + `test/scripts/*` (launcher, startup-flow, first-run, gba-lazy, configurator) | `test/run-tests.mjs` → **270 testes: 267 passaram, 3 de rede pulados** |
| **Rede real (sem WhatsApp)** | YouTube (busca+download+ffprobe), SoundCloud (`searchDownload` → `.m4a` AAC 283,5 s), TikTok (2.004.627 B `video/mp4`), Facebook vídeo (4.331.930 B `h264/High/yuv420p 1280×720 62,51 s` + `aac/LC`, temporários removidos), **Pinterest imagem (1.198.962 B `image/png`, `originals`)**, **Pinterest vídeo (2.251.913 B `video/mp4`, `avc1`+áudio)**, Instagram (erro de cookies mapeado), Facebook foto (página sem `og:image` → mensagem clara, sem `Unsupported URL`), **busca Pinterest `flores` → 24 pins; imagem 101.769 B JPEG**, **busca TikTok `baralho` → 4 vídeos; primeiro 5.897.298 B `video/mp4`**, provider do YouTube via o pipeline real do Baileys (bytes idênticos ao arquivo) | OK |
| **Integração de busca (gated)** | `NAZUNA_NETWORK_TESTS=1 node --test test/integration/search-network.test.js` | **3/3** (Pinterest real, Pinterest sem resultados genéricos, TikTok real) |
| **WhatsApp real** | `!play` (áudio) confirmado pelo dono; `!play2`/`!ytmp4` (áudio e vídeo) enviados com keys `3EB063EC9400F6B46E62A9` e `3EB08AC97BF41E9F9C9459` | OK — **reenvio pendente** após as correções de TikTok/IG/FB (reiniciar o bot) |

## 8. Pendências técnicas conhecidas

1. `bios.bin` do GBA.js não está no repositório (asset licenciado) → `/gbatest` exige que o dono o coloque em
   `dados/src/funcs/private/gba/vendor/gbajs/resources/`; o bot **inicia** sem ele (lazy loading) ✓.
2. `client_id` do SoundCloud é obtido por scraping do site → pode mudar; o fallback de busca cobre, o de download usa o
   serviço auxiliar (hoje devolve `download_url: null` → o comando reporta a etapa com clareza).
3. `dados/src/funcs/downloads/youtube.js` (Vex legado) continua no repositório como fallback explícito — remover
   somente depois de validar o substituto no WhatsApp real.
4. Comandos da Vex dependem de chave do dono: sem ela falham de forma explícita (não há substituto local confiável
   para logos, TTS e lyrics sem novos assets/dependências).
5. **Fotos do Facebook**: a maioria exige login e o provider não usa cookies (decisão deliberada). Fotos públicas com
   `og:image` são suportadas; as demais recebem mensagem específica. Não há contorno de autenticação.
6. **Buscas textuais de Pinterest/TikTok**: Pinterest usa a página pública móvel e exige sinal de relevância; TikTok
   usa `/discover/<termo>` e só cobre os termos que têm página de descoberta. A busca completa do TikTok e qualquer
   rota que exija assinatura/anti-bot continuam fora do escopo; não há fallback Vex nem resultado simulado.
7. **Logos (38 comandos)**: a validação local da resposta e a cobertura do menu estão testadas, mas a geração real
   não foi validada nesta rodada porque o ambiente não tem `apikey_vex`. A resposta real da Vex pode ser JSON com URL
   ou imagem direta; o código só aceita imagem com assinatura válida (nunca envia JSON/HTML).
