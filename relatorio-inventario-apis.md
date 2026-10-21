# Inventário de comandos, APIs e dependências externas — Nazuna

> Auditoria realizada em 2026-10-21 sobre a cópia local do projeto.
> **Escopo:** `dados/src/index.js` (switch principal, 1660 rótulos de `case`), `dados/src/funcs/api/`,
> `dados/src/funcs/downloads/`, `dados/src/funcs/private/`, `dados/src/funcs/ferramentas/`,
> `dados/src/funcs/utils/`, `dados/src/funcs/logos/`, `dados/src/funcs/edits/`, `package.json`.
> **Método:** varredura de todos os `case '…':`, inventário de domínios externos por arquivo, e classificação
> de cada dependência (VexAPI, API de terceiros, scraping, biblioteca local, template local).

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
| `providers/local/ytDlpRunner.js` | **Camada compartilhada** de mídia via yt-dlp: validação de URL/host, execução segura (`spawn` sem shell), timeout/cancelamento, limite de tamanho, temp dir exclusivo por operação, validação de container, limpeza e erros por etapa. Usada por YouTube, TikTok, Instagram e Facebook |
| `providers/local/socialMedia.js` | **Provider social local** (TikTok, Instagram, Facebook) sobre o runner: hosts permitidos, limite por plataforma, buffer validado e mensagens por etapa |
| `providers/local/tiktokSearch.js` | **Provider de busca textual do TikTok**: valida a consulta, extrai resultados da página pública, normaliza (só TikTok), deduplica, limita, aplica timeout e reporta o bloqueio concreto quando a fonte local não entrega itens. A fonte legada (VexAPI) só é usada com chave configurada, e a origem é sempre devolvida e registrada em log |
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

### 2.3 TikTok — download migrado (local/yt-dlp) · busca local em organização, **bloqueio técnico concreto**

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!tiktok`, `!tiktokaudio`, `!tiktokvideo`, `!tiktoks`, `!tiktoksearch`, `!ttk`, `!tkk` (mesmo bloco) |
| 2. Responsável | `index.js` → `providers/local/socialMedia.js` (download) e `providers/local/tiktokSearch.js` (busca) |
| 3. Serviço/biblioteca | **yt-dlp local**; na busca, página pública do TikTok |
| 4. Depende da VexAPI? | **Download: não. Busca: só como fonte legada e apenas se o dono tiver configurado `site_vex` + `apikey_vex`** (nunca silencioso: a origem usada é devolvida e registrada em log) |
| 5. Usa a API própria? | Sim (`socialMedia.js` + `tiktokSearch.js` sobre `ytDlpRunner.js`) |
| 6. Autenticação | Nenhuma; sem cookies por padrão |
| 7. Estado/evidências | **Download: rede real OK** — `https://www.tiktok.com/@scout2015/video/6718335390845095173` → 2.004.627 B, `video/mp4`, título real, 4,8 s. **Busca: bloqueio comprovado** (ver abaixo) |
| 8. Migração possível | Download concluído. Busca: provider pronto e integrado; a fonte local retorna o bloqueio concreto (abaixo) e a fonte legada só entra com chave configurada |
| 9. Testes necessários | `test/api/social-media.test.js` (9) e `test/api/tiktok-search.test.js` (9) |
| 10. Prioridade/risco | **Alta (download) / Média (busca)** |

**Estado da busca textual do TikTok (NÃO é uma busca funcional hoje):**
- `!tiktoksearch`, `!ttk`, `!tkk` → `searchTikTok(...)` → hoje retornam **sem resultados** e o comando responde com a mensagem de indisponibilidade (abaixo).
- O provider está organizado e testado (9 testes): consulta vazia, normalização, dedupe/limite, extração da página, bloqueio, timeout, falha de rede, ausência de chamada à Vex sem chave e origem explícita quando a chave existe.
- **Nenhuma fonte pública legítima foi encontrada** (ver a lista acima). Se surgir uma, ela deve ser testada antes de ser integrada.
- A mensagem de indisponibilidade é mantida transparente e a VexAPI só entra **quando configurada explicitamente** pelo dono (com a origem registrada em log).

**Bloqueio técnico da busca textual do TikTok (verificado empiricamente em 2026-10-21):**
1. `yt-dlp` **não tem busca textual do TikTok**: `ytsearch` é o extrator do **YouTube** e devolve URLs `youtube.com` — usar isso seria devolver resultado de outra plataforma (proibido pela regra de validar a plataforma de cada resultado).
2. A página pública `https://www.tiktok.com/search?q=…` responde HTTP 200, mas é apenas um shell: o bloco `__UNIVERSAL_DATA_FOR_REHYDRATION__` **não contém os resultados**; eles chegam por uma requisição assinada (`msToken`/`X-Bogus`). Gerar essa assinatura é burlar controle anti-bot → não foi feito.
3. Endpoints públicos gratuitos que funcionavam (tikwm, tiklydown) hoje respondem **403 / challenge Cloudflare** ou estão fora do ar.
4. Conclusão: **não existe hoje uma fonte textual do TikTok publicly acessível, sem chave e sem contornar anti-bot.** O provider `tiktokSearch.js` está organizado (validação, extração do JSON da página, normalização, dedupe, limite, timeout, erros por etapa) e volta a funcionar sozinho se o TikTok voltar a embutir os resultados na página; enquanto isso, o comando responde com a mensagem de bloqueio e aponta as alternativas (link direto, que **funciona** pela API local, ou a fonte legada com chave configurada).

### 2.4 Facebook — provider local **validado em rede real**

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!fb`, `!fbdl`, `!facebookdl` (**os três caem no mesmo bloco** e chamam a mesma função `downloadSocialMedia('facebook', url)` testada; prefixo do bot = `!`) |
| 2. Responsável | `index.js` → `providers/local/socialMedia.js` (`downloadSocialMedia('facebook', url)`) |
| 3. Serviço/biblioteca | **yt-dlp local** (antes: `nayan-video-downloader`, terceiro) |
| 4. Depende da VexAPI? | Não |
| 6. Autenticação | Sem cookies; apenas conteúdo público |
| 7. Estado/evidências | **Rede real OK** — URL pública de exemplo da **documentação oficial da Meta**: `https://www.facebook.com/FacebookDevelopers/videos/10152454700553553/` → 4.331.930 B, `video/mp4`, tempo de download ≈ 4,1 s; **ffprobe**: container `mov,mp4,m4a` com duração **62,510425 s**; stream de vídeo `h264/High/yuv420p 1280×720`, **62,510425 s** (1499 frames, time_base 1/19184); stream de áudio `aac/LC 44.100 Hz`, **62,485011 s** (2692 frames, 1/44100) → container/vídeo/áudio consistentes (Δ 25 ms), **download completo**; **decodificação integral com ffmpeg sem nenhum erro**; boxes `ftyp → moov → free → mdat` (**faststart** ✓); temporário **removido** (`restosNoTemp: []`); erros: URL inválida → "Link do Facebook inválido."; host errado → "O link informado não é do Facebook."; vídeo inexistente → "O conteúdo do Facebook não pôde ser extraído (pode ser privado, removido ou exigir login)." |
| 8. Migração possível | Concluída (código + validação real). O comando aceita `facebook.com` e `fb.watch`, alinhado aos hosts do provider |
| 9. Testes necessários | `test/api/social-media.test.js` |
| 10. Prioridade/risco | Média. Risco: a maioria dos vídeos do Facebook exige login → erro claro (sem contorno) |

### 2.4b Instagram — provider local (limitação de cookies documentada)

| Campo | Conteúdo |
|---|---|
| 1. Comandos/aliases | `!igdl`, `!ig`, `!instavideo`, `!igstory` |
| 2. Responsável | `index.js` → `providers/local/socialMedia.js` (`downloadSocialMedia('instagram', url)`) |
| 4. Depende da VexAPI? | **Não** (antes usava `igdl.dl` → VexAPI) |
| 7. Estado/evidências | **Rede real: conteúdo público exige cookies** — o yt-dlp responde *"Instagram sent an empty media response… use --cookies-from-browser"* → o comando responde *"O Instagram exigiu autenticação (cookies) para este conteúdo; o provider local não usa cookies."* (limite específico, sem contornar autenticação) |
| 8. Migração possível | Feita; modalidades autenticadas (stories/privados) seguem indisponíveis — decisão deliberada |
| 10. Prioridade/risco | Média |


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

### 2.6 Outros comandos com VexAPI (mantidos, com motivo)

| Comando | Serviço | Motivo de manter |
|---|---|---|
| `!pinterest`, `!pin` | VexAPI (`/api/pesquisa/pinterest`) | Pinterest não é suportado pelo yt-dlp e o scraping direto é frágil (login/anti-bot) → sem substituto confiável |
| `!letra`, `!lyrics` | VexAPI | Não existe fonte local de letras |
| `!tts`, `!tss`, `!totext` | VexAPI | TTS local exigiria modelo de voz (dependência pesada) |
| `!edits` | VexAPI | Edição remota de imagem; `sharp` local resolve só parte dos casos |
| `!pornhub` e demais logos | VexAPI (`/api/logos/<tipo>`) | **Não é template local**: as marcas não existem no repositório (`dados/midias/` só tem `menu.jpg`). Implementação local exigiria incorporar os assets (licença) → mantido, sem inventar imagens |
| `!canvas` (bratvideo/welcome2), `!removebg`/`!upscale` | VexAPI | `canvas.dl`/`imagetools` usam `runBrat` (API própria) em parte das funções, mas `bratvideo`, `welcome2`, `removebg` e `upscale` ainda chamam a VexAPI → mantidos |


### 2.6 Logos (`!pornhub` e afins) — API externa da Vex

| Campo | Conteúdo |
|---|---|
| 1. Aliases | `!pornhub`, `!avengers`, `!deadpool`, `!marvel` (+ `!amongus`, `!mascotemetal`, `!firework`, `!summerbeach`, `!cloudsky`, `!techstyle`, `!watercolor`, `!ligatures`, `!graffitistyle`, `!frozen`, `!colorful`, `!balloon`, `!multicolor`, `!metal`, `!doubleexposure`, `!mascoteneon`, `!eraser`, `!america`, `!snow`, `!sunset`, `!halloween`, `!blood`, `!hallobat`, `!cemiterio`, `!ffavatar`, `!vintage3d`, `!hollywood`, `!glitch`, `!galaxy`, `!glossy`, `!dragonfire`, `!pubgavatar`, `!comics`) |
| 2. Responsável | `dados/src/funcs/logos/index.js` → `gerarLogo2({query, query2, type})` |
| 3. Serviço | **VexAPI**: `${site_vex}/api/logos/<tipo>?apikey=…&query=…` (a logo é **gerada no servidor**) |
| 4. Depende da VexAPI? | **Sim** |
| 5. Usa a API própria? | Não |
| 6. Autenticação | `apikey_vex` |
| 7. Estado | Formato e argumentos preservados (`!pornhub puro/talento` → `query`/`query2`). **Não é edição de template local**: as marcas não existem no repositório (`dados/midias/` contém apenas `menu.jpg`) |
| 8. Migração possível | Seria preciso incorporar os arquivos de marca (licença) ou um gerador local por template; `sharp` já está instalado, mas **faltam os assets**. Sem assets, não há implementação local confiável → manter na Vex e documentar |
| 9. Testes necessários | `test/api/logos.test.js` (a criar, com mock do endpoint) |
| 10. Prioridade/risco | Baixa (comando é Working na Vex; sem chave ele falha com mensagem clara) |

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
| **VexAPI (paga, desativada por padrão)** | `site_vex` + `apikey_vex` → TikTok, Pinterest, Instagram, Lyrics, TTS/ToText, Edits, Logos(`/pornhub`), canvas/imagetools (legado), YouTube legado (`funcs/downloads/youtube.js`) |
| **API externa de terceiros** | `api.fishfish.gg` (tradutor), `tenor.googleapis.com` (emojimix), `api.qrserver.com` (QR), `info.tweeload.site`/`pastebin.com` (Twitter), `api.vreden.my.id`/`spotisaver.net` (Spotify), `api.github.com` (update) |
| **Site externo / scraping** | `nayan-video-downloader.vercel.app` (SoundCloud auxiliar, Facebook), `soundcloud.com` + `api-v2.soundcloud.com` (SoundCloud nativo), `apkmodct.com`, `modrinth.com`, `hubsteam.com.br`, `drive.google.com`, `mediafire`, `*.sirv.com`, `dos.zone`/`cdn.dos.zone` (js-dos), `wttr.in` (clima) |
| **Provider local (API própria)** | YouTube (`yt-search` + watch page + `yt-dlp` + FFmpeg), SoundCloud (api-v2 nativo), brat (imagem local) |
| **Biblioteca local de mídia** | `sharp` (imagem/WebP), `node-webpmux` (sticker), `ffmpeg`/`fluent-ffmpeg` (áudio/vídeo), `cheerio`/`linkedom` (parsing HTML), `yt-search` (busca) |
| **Template/arquivo local** | DOOM (js-dos vendorizado), GBA (GBA.js vendorizado, falta `bios.bin`), AIRich, `dados/midias/menu.jpg`, `dados/src/funcs/json/*` |
| **Dependência desconhecida** | `linkedom`/`cheerio` usados em `funcs/edits` e `utils` para parse de HTML de terceiros (a confirmar por comando na auditoria detalhada) |

---

## 4. Matriz de migração (prioridade × risco)

| # | Alvo | Abordagem | Esforço | Risco | Prioridade |
|---|---|---|---|---|---|
| 1 | **SoundCloud `/play3`** | Provider local (api-v2) | feito | baixo | **Alta — resolvido** |
| 2 | **TikTok (download)** | Provider local via yt-dlp | feito | baixo | **Alta — resolvido** |
| 3 | **TikTok (busca textual)** | Provider local pronto, **fonte pública hoje bloqueada** (anti-bot) | feito (bloqueio documentado) | — | **Alta — bloqueio registrado** |
| 4 | **Instagram / Facebook (download)** | Provider local via yt-dlp | feito | médio (cookies no IG) | Média — feita e validada em rede real |
| 4 | **Twitter/X** | serviço gratuito já funcional | — | — | Mantido (legenda rica) |
| 5 | **Spotify** | hoje usa `api.vreden.my.id` + `spotisaver.net` | médio | médio | Média |
| 6 | **Logos (`/pornhub`)** | precisa dos assets de marca (licença) | alto | alto | Baixa — mantido |
| 7 | **Lyrics / TTS / ToText / Edits** | provider por capacidade; TTS local exigiria modelo | alto | alto | Baixa — mantido |
| 8 | **Pinterest** | scraping frágil | alto | alto | Baixa — mantido |
| 9 | **RPG/Pokémon, DOOM, GBA, brat, stickers** | já locais | — | — | **Não tocar** |

**Regra de migração adotada:** provider local quando existe ferramenta local (yt-dlp, sharp, webpmux);
API própria compartilhada quando a operação se encaixa na infraestrutura existente; provider específico quando
a plataforma tem regras próprias; serviço externo apenas quando necessário e documentado; processamento
100% local para templates. **Nenhuma migração exige reativar a Vex por padrão.**

---

## 5. Configuração e fallback

- Provider padrão da API do YouTube: `local` (`api/config.js`).
- `allowVexFallback`: **false** por padrão. A Vex só é acionada com `provider=auto` **e** `allowVexFallback=true`.
- Comandos legados baseados na Vex (TikTok, Pinterest, IG, Logos, Lyrics, TTS…) **exigem `site_vex` + `apikey_vex`**
  configurados pelo dono (`!apikey`); sem isso devolvem "Api-key não configurada" — falha explícita, nunca sucesso simulado.
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
| **Unitário/simulado** | `test/api/*` (youtube, youtube-commands, youtube-local-provider, youtube-ytdlp, youtube-baileys-media, soundcloud, social-media, media, policy, brat) + `test/scripts/*` (launcher, startup-flow, first-run, gba-lazy, configurator) | `npm test` → **184/184** |
| **Rede real (sem WhatsApp)** | YouTube (busca+download+ffprobe), SoundCloud (`searchDownload` → `.m4a` AAC 283,5 s), TikTok (2.004.627 B `video/mp4`), Facebook (4.331.930 B `h264/High/yuv420p 1280×720 62,51 s` + `aac/LC`, temporários removidos), Instagram (erro de cookies mapeado), TikTok search (bloqueio concreto), provider do YouTube via o pipeline real do Baileys (bytes idênticos ao arquivo) | OK |
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
