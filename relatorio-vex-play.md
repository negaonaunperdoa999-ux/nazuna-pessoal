# Auditoria da Vex API e plano de migração

**Foco:** `/play` e aliases  
**Data:** 2026-10-20  
**Base:** branch `main`, HEAD `0a5c3b0`  
**Natureza:** auditoria e planejamento; nenhum arquivo de produção foi alterado.

## 1. Sumário executivo

- A integração Vex tem **20 endpoints**: 19 funcionais + `/api/verificarkey`.
- Os endpoints estão distribuídos em **11 módulos** e no validador central `dados/src/funcs/API.js`.
- O `/play` é o fluxo de maior impacto: concentra áudio/vídeo, maior volume de bytes, maior tempo de resposta e os principais riscos de memória e indisponibilidade.
- A Etapa 1 da API própria já foi implementada e está **não commitada**. Ela atende somente `brat`; o provedor padrão continua `vex`.
- Recomendação: manter as assinaturas atuais dos comandos, criar adaptadores por funcionalidade e migrar primeiro o `/play` com limite de tamanho, timeout, streaming/arquivo temporário e testes com mocks.
- Não migrar tudo de uma vez. TTS, transcrição, remoção de fundo, upscale, logos e edits têm dependências e custos diferentes; devem ficar para fases posteriores.

## 2. Escopo e método

- Auditoria read-only do código atual.
- Nenhuma chamada real à Vex, WhatsApp ou serviços externos.
- Nenhum boot de bot, instalação de dependência, commit ou push.
- Foco em contratos, fluxo de dados, memória, tratamento de erro, cache, autenticação e pontos de migração.
- Estado Git no início da auditoria:
  - `M dados/src/funcs/downloads/canvas.js`
  - `M dados/src/index.js`
  - `?? dados/src/funcs/api/`
  - `?? test/`

## 3. Inventário de dependências Vex

| Funcionalidade | Comandos/gatilhos | Módulo | Endpoint(s) | Entrega ao WhatsApp | Cache |
|---|---|---|---|---|---|
| YouTube áudio | `play`, `ytmp3`, `play2` | `downloads/youtube.js` | `/api/pesquisa/youtube`, `/api/downloads/youtubemp3` | Buffer de áudio; fallback para documento | Não |
| YouTube vídeo | `playvid`, `ytmp4` | `downloads/youtube.js` | `/api/pesquisa/youtube`, `/api/downloads/youtubemp4` | Buffer de vídeo; fallback para documento | Não |
| TikTok | `tiktok`, `tiktokaudio`, `tiktokvideo`, `tiktoks`, `tiktoksearch`, `ttk`, `tkk` | `downloads/tiktok.js` | `/api/pesquisa/tiktok`, `/api/downloads/tiktok` | URL remota | Sim, 1h/1000 entradas |
| Instagram | `instagram`, `igdl`, `ig`, `instavideo`, `igstory` | `downloads/igdl.js` | `/api/downloads/instagram` | URL remota, todos os itens | Sim, 1h/1000 |
| Pinterest | `pinterest`, `pin` | `downloads/pinterest.js` | `/api/pesquisa/pinterest`, `/api/pesquisas/pinterest` | URL remota, até 3 imagens | Sim, 30min/1000 |
| Letras | `letra`, `lyrics` | `downloads/lyrics.js` | `/api/pesquisa/letra` | Texto e, opcionalmente, imagem remota | Não |
| Brat estático | `brat` | `downloads/canvas.js` | `/api/canvas/brat` via nova camada | Buffer local ou URL Vex | Sim, na nova camada |
| Brat animado | `bratvid`, `bratvideo` | `downloads/canvas.js` | `/api/canvas/bratvideo` | URL remota | Sim, 30min/1000 |
| Welcome card | evento de entrada no grupo, quando `photoType === 'api'` | `downloads/canvas.js` | `/api/canvas/welcome2` | URL remota | Não |
| Remover fundo | `removebg`, `rmbg`, `sbg`, `sfundo` | `utils/imagetools.js` | `/api/ferramentas/removebg` | URL remota ou sticker | Sim, 30min/1000 |
| Upscale | `upscale` | `utils/imagetools.js` | `/api/ferramentas/upscale` | URL remota | Sim, 30min/1000 |
| TTS | `tts`, `tss` | `ferramentas/tts.js` | `/api/ias/tts` | Buffer de áudio | Não |
| Transcrição | `totext`, `transcrever`; auto-transcrição | `ferramentas/totext.js` | `/api/ias/transcrever` | Texto | Sim, 1h/1000 |
| Logos simples | 34 comandos | `logos/index.js` | `/api/logos/:type` | Buffer de imagem | Sim, 1h/1000 |
| Logos duplos | `pornhub`, `avengers`, `deadpool`, `marvel` | `logos/index.js` | `/api/duallogos/:type` | Buffer de imagem | Sim, 1h/1000 |
| Edits | `wojakreaction`, `blackwhite`, `jornal`, `cinema`, `desfoque`, `camera` | `edits/index.js` | `/api/edits/:type` | Buffer de imagem | Sim, 1h/1000 |
| Chave | `apikey`, `setkey` | `index.js` + `API.js` | `/api/verificarkey` | Texto/restart | Não |
| Auto-download | links automáticos no grupo | `index.js` | YouTube/TikTok/Instagram/Pinterest | Áudio, vídeo ou URL | Herda o módulo |

### Fora do escopo Vex

- `play3`/`playsoundcloud`: SoundCloud.
- `spotify`: Spotify.
- `facebook`, `kwai`, `gdrive`, `mediafire`, `twitter`: integrações próprias/externas.
- `case 'play'` em `index.js:30114`: subcomando do jogo UNO, não é o `/play` de mídia.

### Observações de semântica

- `tiktokaudio` não faz áudio: todos os aliases TikTok executam o mesmo bloco e enviam `datinha.type || 'video'`.
- `igstory` não trata story: executa o mesmo download de post do Instagram.
- `tiktok.search()` escolhe um resultado aleatório e já chama `dl()` internamente. A busca faz, portanto, dois endpoints e pode retornar vídeos diferentes para a mesma consulta.
- Pinterest usa `/api/pesquisa/pinterest` na busca e `/api/pesquisas/pinterest` no download. A diferença singular/plural deve ser preservada ou normalizada conscientemente.
- `letra` espera `data.results.resultados`; `brat` e `bratvid` recebem parâmetros separados por `|`.
- A validação de chave é feita antes de praticamente cada operação e, em alguns módulos, mais de uma vez.

## 4. Auditoria detalhada do `/play`

### 4.1 Comandos e blocos

- `play`, `ytmp3`: `index.js:18988-19130`.
- `play2`: `index.js:19247-19382`.
- `playvid`, `ytmp4`: `index.js:19550-19645`.
- Implementação: `downloads/youtube.js:42-160`.

### 4.2 Fluxo com URL

`/play` e `/play2`:

1. Verificam apenas `q.includes('youtube.com')` ou `q.includes('youtu.be')`.
2. Não validam protocolo, host exato, ID do vídeo ou tamanho.
3. Chamam `youtube.mp3(videoUrl, 128)`.
4. `youtube.mp3` ignora o segundo argumento; a assinatura real é `mp3(url)`.
5. A API retorna `resposta.dlurl`; o módulo baixa o arquivo inteiro para um `Buffer`.
6. O bot envia `audio: buffer`, `mimetype: 'audio/mpeg'`.
7. Em erro de envio contendo `ENOSPC` ou `size`, reenvia como documento.
8. Não há mensagem com título, duração, thumbnail ou checagem de 30 minutos.

`/playvid`/`/ytmp4`:

1. Mesma detecção frágil por `includes`.
2. Chama `youtube.mp4(videoUrl, 360)`; o segundo argumento também é ignorado.
3. Baixa o MP4 inteiro para memória.
4. Envia `video: buffer`, `fileName`, `mimetype: 'video/mp4'`.
5. Em erro de tamanho, reenvia como documento.
6. Não há checagem de duração, metadados ou limite de tamanho.

### 4.3 Fluxo por busca

`/play`:

1. Envia mensagem “Pesquisando…”.
2. Chama `youtube.search(q)`.
3. Usa **somente o primeiro resultado**; não existe seleção interativa.
4. Bloqueia vídeos com mais de 1800 segundos.
5. Envia thumbnail e legenda com título, autor, duração, views, data e descrição.
6. Chama `youtube.mp3` e envia o áudio.

Problemas encontrados nesse fluxo:

- `youtube.search()` retorna `author` como string (`video.author?.name`), mas o comando acessa `videoInfo.data.author.name`, exibindo `undefined`.
- `playvid` acessa `videoInfo.data.author.name`, `views.toLocaleString()` e `description.slice()` sem proteção; resposta incompleta pode gerar exceção.
- `play2` faz a busca e a checagem de duração, mas não envia metadados; é praticamente uma cópia do `/play` sem a mensagem informativa.
- A checagem de duração existe apenas na busca de `/play` e `/play2`; não existe no caminho com URL nem no `/playvid`.
- Não há cache de busca, então consultas repetidas gastam API e tempo.
- O fluxo de `/playvid` tem um erro de encadeamento: se `youtube.search()` retornar `ok: false`, o primeiro `.then()` responde e retorna; o segundo `.then()` ainda recebe `undefined`, acessa `dlRes.ok` e cai no `.catch()`, podendo gerar mensagem duplicada.
- O caminho direto ignora metadados que a própria resposta de download já fornece (`title`, `thumbnail`).

### 4.4 Camada de download

`youtube.js`:

- `request()` usa `https.get`, sem timeout, sem limite de resposta e sem checar status HTTP.
- `downloadFile()` segue redirecionamentos sem limite, sem timeout, sem `Content-Length` e sem limite de bytes.
- O arquivo inteiro fica em `Buffer.concat(chunks)`.
- `mp3()` e `mp4()` retornam `filename` sanitizado com `/[^\w\s]/gi`, removendo acentos.
- O segundo parâmetro de qualidade/bits é aceito nas chamadas, mas não existe na função.

Consequências:

- Um áudio/vídeo grande pode consumir memória do processo e derrubar o bot.
- Uma API lenta pode travar a operação indefinidamente.
- Um redirecionamento malicioso ou infinito não é interrompido.
- O fallback para documento só ocorre depois de o buffer já estar inteiro na memória.
- O arquivo remoto pode expirar entre a resposta da API e o download; não há retry controlado.

## 5. Problemas transversais

### 5.1 Autenticação e configuração

- `API.js:70` monta `/api/verificarkey?apikey=...` por GET.
- A chave trafega na query string em todos os endpoints.
- `verificarAPI()` usa `fetch` sem timeout nem `AbortSignal`.
- HTML é tratado como sucesso (`text.startsWith('<!DOCTYPE')`), o que pode mascarar erro de proxy/página de bloqueio.
- Respostas de erro não têm contrato uniforme.
- A chave é lida de `dados/src/config.json`; a config local não tem `site_vex`/`apikey_vex`, então os comandos Vex falham na validação até configuração.
- O comando `apikey`/`setkey` grava a chave e reinicia o bot.

### 5.2 Chamadas e limites

- Não existe timeout global nem retry padronizado.
- Não existe limite de concorrência por funcionalidade.
- Caches antigos são `Map` com poda simples por quantidade, sem limite de bytes.
- Caches não consideram usuário/grupo, mas isso é aceitável para conteúdo público.
- Vários módulos fazem validação de chave repetida:
  - `tiktok.search()` valida e chama `dl()`, que valida novamente.
  - `logos.gerarLogo()` faz JSON, valida, e baixa a mesma URL novamente.
  - `edits.geraredit()` valida duas vezes.
  - `removeBg()` valida, baixa para “validar” e o `index.js` baixa outra vez.
- Não há telemetria de latência, taxa de erro, cache hit ou uso por comando.

### 5.3 Mídia e memória

- `/play`, `/playvid`, auto-download de YouTube, Facebook, Spotify e SoundCloud mantêm o arquivo inteiro em memória.
- TikTok, Instagram, Pinterest, Lyrics, removebg, upscale, bratvid e welcome enviam URL remota ao Baileys; o download acontece fora do controle do bot.
- TTS envia buffer sem limite.
- O fallback `ENOSPC`/`size` é reativo, não preventivo.
- Não há limpeza de buffers, arquivos temporários ou cancelamento quando o envio falha.

### 5.4 Segurança e privacidade

- `utils/upload.js` contém **token do GitHub hardcoded** (não reproduzir o valor). Isso deve ser tratado como segredo comprometido e rotacionado antes de qualquer publicação.
- O upload envia mídia do usuário para um repositório GitHub de terceiros; depois a Vex recebe a URL pública.
- `removebg` registra no console a URL completa, incluindo a API key, e também imprime headers/status.
- `imagetools.upscale()` retorna `download`, mas `index.js:25429` lê `upscaleResult.result?.download`; o resultado é `undefined` e o envio tende a falhar.
- `logos` pode cachear HTML de erro como se fosse imagem.
- `edits` pode cachear resposta HTTP inválida como buffer.
- URLs de mídia controladas pela Vex são enviadas diretamente ao Baileys, sem validação de host/tipo/tamanho.
- Se a migração local passar a buscar URLs fornecidas pelo usuário, será necessário validar protocolo/host para evitar SSRF.

### 5.5 Qualidade de código e manutenção

- Blocos enormes duplicados no `index.js` (`play` e `play2` são quase idênticos).
- Tratamento de erro inconsistente: `reply`, `sendMessage`, `throw`, retorno string e `msg` convivem no mesmo fluxo.
- Alguns `catch` engolem a causa original.
- Não há testes de contrato para os módulos Vex existentes.

## 6. Arquitetura de migração recomendada

### 6.1 Princípio

Manter os comandos e aliases atuais intactos e mover a implementação para uma camada interna com contrato estável. O `index.js` não deve conhecer detalhes de provedor.

```text
comando (/play)
   -> feature youtube (contrato interno)
      -> provider próprio (API/backend ou extrator local)
      -> provider Vex (fallback legado)
      -> cache / limiter / timeout / limite de bytes
   -> envio WhatsApp (áudio/vídeo/documento)
```

### 6.2 Contratos internos

Para busca:

```js
{
  ok: true,
  data: {
    videoId,
    url,
    title,
    description,
    thumbnail,
    seconds,
    timestamp,
    views,
    ago,
    author
  }
}
```

Para mídia:

```js
{
  ok: true,
  media: {
    type: 'audio' | 'video' | 'image',
    mime,
    filename,
    size,
    buffer,          // apenas até o limite configurado
    tempFilePath,    // para arquivos acima do limite de memória
    cleanup
  },
  meta: { title, thumbnail, duration }
}
```

- Erros devem usar `ApiError`/`ErrorCodes` da camada já criada.
- `INPUT_INVALID`, `CONFIG_MISSING`, `AUTH_INVALID` não devem acionar fallback.
- `TIMEOUT`, `NETWORK`, `UPSTREAM`, `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED` e `DEPENDENCY_MISSING` podem acionar fallback, conforme a política existente.

### 6.3 Componentes a criar

- `funcs/api/features/youtube.js`: `search`, `getAudio`, `getVideo`.
- `funcs/api/features/social.js`: TikTok, Instagram, Pinterest.
- `funcs/api/features/images.js`: bratvid, welcome, removebg, upscale, logos, edits.
- `funcs/api/features/speech.js`: TTS e transcrição.
- `funcs/api/providers/vex/*`: adaptadores por funcionalidade.
- `funcs/api/providers/local/*`: extratores/renderizadores locais.
- `funcs/api/media.js`: download com timeout, `Content-Length`, limite de bytes, redirecionamentos limitados e escrita em arquivo temporário.
- `funcs/api/observability.js`: métricas por feature/provider, sem logar chave ou URL sensível.

### 6.4 Opções para YouTube

**Opção A — serviço próprio de download (recomendada para produção)**

- Backend normaliza busca e entrega áudio/vídeo por stream ou arquivo temporário.
- O bot não precisa lidar com mudanças do YouTube, assinatura, cookies ou binário.
- Permite limite de tamanho, timeout e fila no servidor.
- Custo: mais um serviço para operar.

**Opção B — extração local**

- `yt-search` já está no `package.json` e pode resolver a busca sem Vex.
- O download exige `yt-dlp`/`ffmpeg` ou uma biblioteca de extração.
- `ffmpeg` e `yt-dlp` não estão disponíveis no PATH atual.
- `yt-search` sozinho não resolve download de mídia.
- Custo: dependência de binário, manutenção e maior chance de bloqueio por IP.

Recomendação: definir o contrato primeiro; usar backend próprio para mídia e `yt-search` local apenas como fallback de busca, se necessário.

## 7. Fases de migração

| Fase | Escopo | Resultado | Prioridade |
|---|---|---|---|
| 0 | Baseline, métricas, remoção de logs de segredo, correções críticas isoladas | Diagnóstico confiável e segredo fora do código | Alta |
| 1 | Camada interna + `brat` | Já implementado; default ainda Vex | Concluída |
| 2 | `/play`, `ytmp3`, `play2`, `playvid`, `ytmp4` | YouTube independente da Vex, com limites e streaming | Alta |
| 3 | TikTok, Instagram, Pinterest | Downloads sociais normalizados e com limite | Média |
| 4 | removebg, upscale, edits, logos | Fim do upload público obrigatório e correção de contratos | Média |
| 5 | bratvid, welcome, TTS, transcrição, letras | Migração por viabilidade e custo | Média/baixa |
| 6 | Remoção de `site_vex`, `apikey_vex` e `API.js` | Descomissionamento da Vex | Baixa |

### Fase 0 — antes de migrar

- Rotacionar o token GitHub exposto.
- Remover logs de URL/chave.
- Corrigir o contrato de `upscale` e o encadeamento de `/playvid` quando esses arquivos forem tocados.
- Adicionar contadores de chamadas, latência, erros e bytes por feature.
- Congelar o inventário de aliases e mensagens para não quebrar usuários.

### Fase 2 — `/play`

Ordem de implementação:

1. Criar `features/youtube.js` com busca e download.
2. Preservar a assinatura pública dos módulos atuais para reduzir o diff no `index.js`.
3. Unificar `/play` e `/play2` em uma única implementação; manter ambos os nomes.
4. Usar metadados também no caminho com URL.
5. Aplicar checagem de duração em todos os caminhos, não só na busca.
6. Validar URL com `new URL`, host permitido e ID extraído; não usar `includes`.
7. Baixar com `Content-Length`, timeout, limite de redirecionamentos e limite de bytes.
8. Para áudio/vídeo até o limite, manter buffer; acima, usar arquivo temporário e limpar após envio.
9. Em `PAYLOAD_TOO_LARGE`, avisar o usuário antes de baixar o restante.
10. Manter fallback para documento quando o envio de áudio/vídeo falhar por tamanho.
11. Cachear apenas metadados de busca, nunca o arquivo de mídia.
12. Adicionar flag `NAZUNA_YOUTUBE_PROVIDER`/config com `local|vex|auto`, default `vex` durante a transição.

Limites iniciais sugeridos (configuráveis):

- áudio: 32 MB;
- vídeo 360p: 64 MB;
- busca: 15 s;
- download: 120 s;
- concorrência: 2 downloads simultâneos, fila 20;
- redirecionamentos: 3.

### Fase 3 — redes sociais

- TikTok: separar de fato `tiktokaudio` de `tiktokvideo`; decidir se a busca mantém seleção aleatória ou passa a usar o primeiro resultado.
- Instagram: limitar quantidade de itens e validar tipo/mime; `igstory` deve ter comportamento próprio ou ser removido do menu.
- Pinterest: unificar a diferença `/pesquisa` vs `/pesquisas`; continuar enviando no máximo 3 imagens.
- Preferir download controlado a enviar URL remota, principalmente para Links que expiram.

### Fase 4 — ferramentas de imagem

- Remover a dependência de upload público no GitHub.
- Enviar mídia ao backend próprio por multipart ou base64, ou processar localmente.
- Corrigir `upscale` antes de qualquer migração: o `index.js` espera `result.download`, mas o módulo retorna `download`.
- `removebg` não deve baixar a imagem duas vezes.
- `logos` não deve fazer duas requisições para a mesma URL.
- `edits` não deve validar a chave duas vezes.
- `bratvid`/welcome podem continuar na Vex até existir renderizador local viável; não bloquear o `/play` por causa deles.

### Fase 5 — fala e texto

- TTS: preferir serviço próprio ou engine local; limitar caracteres e tamanho do áudio.
- Transcrição: o fluxo atual depende de upload público + Vex; é o mais sensível à privacidade.
- Letras: pode usar provedor alternativo mais simples, com texto e imagem opcionais.

### Fase 6 — descomissionamento

- Manter `vex` como fallback até as métricas mostrarem uso zero.
- Remover `apikey`/`setkey` e as chaves de config somente após migração completa.
- Remover `API.js` por último.

## 8. Critérios de aceite do `/play` migrado

- Todos os aliases atuais continuam funcionando: `play`, `ytmp3`, `play2`, `playvid`, `ytmp4`.
- URL e busca produzem o mesmo tipo de mensagem e fallback de documento.
- Nenhum download acima do limite fica inteiro em memória.
- Timeout e cancelamento funcionam.
- API indisponível gera mensagem amigável, sem stack trace.
- Chave e segredo não aparecem em logs.
- Busca não é repetida desnecessariamente.
- Metadados aparecem corretamente, inclusive autor.
- Nenhuma chamada real à Vex em testes automatizados.
- Testes unitários para parsing, normalização, limite, timeout, cache, fallback e erros.
- Teste manual no WhatsApp: URL válida, busca, vídeo > 30 min, arquivo grande, URL inválida, API fora do ar, áudio e vídeo.

## 9. Decisões pendentes

1. A “API própria” já tem backend e contrato definidos, ou será construída junto com a migração?
2. O download de YouTube será feito por serviço próprio, `yt-dlp` local ou outra biblioteca?
3. O limite de bytes deve ser fixo ou configurável por grupo/plano?
4. `tiktok.search` deve manter seleção aleatória ou usar o primeiro resultado?
5. `tiktokaudio` e `igstory` devem ganhar comportamento próprio ou ser aliases documentados?
6. O token GitHub exposto já foi rotacionado?
7. A migração pode remover o upload público de mídia do usuário ou precisa manter compatibilidade temporária?

## 10. Referências de código

- `dados/src/index.js:1293-1537`: auto-download.
- `dados/src/index.js:18988-19130`: `/play` e `/ytmp3`.
- `dados/src/index.js:19247-19382`: `/play2`.
- `dados/src/index.js:19550-19645`: `/playvid` e `/ytmp4`.
- `dados/src/index.js:19646-19675`: letras.
- `dados/src/index.js:19677-19721`: TikTok.
- `dados/src/index.js:19799-19844`: Instagram.
- `dados/src/index.js:20137-20262`: brat e bratvid.
- `dados/src/index.js:22410-22441`: apikey.
- `dados/src/index.js:23684-23788`: logos.
- `dados/src/index.js:23792-23839`: edits.
- `dados/src/index.js:25197-25436`: totext, TTS, removebg e upscale.
- `dados/src/funcs/API.js:7-133`: validação da chave.
- `dados/src/funcs/downloads/youtube.js:25-156`: download e contratos YouTube.
- `dados/src/funcs/downloads/tiktok.js:49-169`: busca e download TikTok.
- `dados/src/funcs/downloads/pinterest.js:46-136`: busca e download Pinterest.
- `dados/src/funcs/downloads/igdl.js:56-126`: Instagram.
- `dados/src/funcs/downloads/lyrics.js:30-94`: letras.
- `dados/src/funcs/utils/imagetools.js:39-185`: removebg/upscale.
- `dados/src/funcs/logos/index.js:56-131`: logos.
- `dados/src/funcs/edits/index.js:57-95`: edits.
- `dados/src/funcs/ferramentas/tts.js:11-115`: TTS.
- `dados/src/funcs/ferramentas/totext.js:57-131`: transcrição.
- `dados/src/funcs/utils/upload.js:4-16`, `43`, `312-368`: token e upload.
- `dados/src/funcs/api/`: camada nova da Etapa 1.
- `test/api/`: 33 testes da Etapa 1.

## 11. Estado da Etapa 1

- Fachada, erros, política, HTTP client, limiter, cache limitado e providers `vex`/local de `brat` foram implementados.
- `brat` estático já usa a nova camada; os demais comandos continuam na Vex.
- Default permanece `vex`.
- `sharp` está instalado localmente, mas não declarado no `package.json`.
- Testes: 33 passando com `node --test "test/api/*.test.js"`.
- Nenhum commit ou push foi feito.
