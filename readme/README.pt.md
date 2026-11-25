# Yejian (页间)

[简体中文](README.zh-CN.md) | [हिंदी](README.hi.md) | **Português** | [Indonesian](README.id.md) | [English](../README.md) | [Türkçe](README.tr.md)

[Site do projeto](https://itcwc.github.io/yejian-reader/?lang=pt) · [Versão mais recente](https://github.com/itcwc/yejian-reader/releases/latest)

O Yejian é um leitor gratuito e de código aberto que guarda a biblioteca no dispositivo. Pode ler offline sem criar conta e sincronizar livros e progresso através do seu próprio servidor WebDAV.

## Capturas de ecrã

Ao abrir a aplicação Android pela primeira vez, escolha o idioma. Para o alterar mais tarde, abra **Definições → Idioma da aplicação**.

<p align="center">
  <img src="../site/screenshots/pt/home-desktop-paper.webp" width="70%" alt="Biblioteca no computador">
  <img src="../site/screenshots/pt/home-mobile-paper.webp" width="25%" alt="Biblioteca web no telemóvel">
</p>

## Funcionalidades

- Abra diretamente EPUB, PDF, TXT, Markdown, RTF, FB2, HTML, DOCX e CBZ/CBT.
- Leia página a página ou com deslocamento contínuo. Ajuste o tipo e o tamanho de letra, o espaçamento entre linhas e a largura do texto.
- Escolha entre os temas papel, noturno ou verde suave. O leitor guarda a sua posição no livro.
- Exporte uma cópia local dos livros, capas e progresso ou sincronize via WebDAV.

## Formatos suportados

| Categoria | Abertura direta | Conversão necessária |
| --- | --- | --- |
| Livros eletrónicos | EPUB, PDF, FB2 | MOBI, AZW, AZW3 → EPUB |
| Texto simples | TXT, Markdown, RTF | — |
| Web | HTML, HTM, XHTML, XML, MHTML, MHT | CHM → EPUB / HTML |
| Banda desenhada | CBZ, CBT | CBR, CB7 → CBZ |
| Documentos | DOCX | DOC, PPT, PPTX, XPS, OXPS, DjVu, DJV, OFD → PDF / DOCX |
| Académico | — | CAJ → PDF (instruções apresentadas durante a importação) |

Para converter ficheiros, pode utilizar Calibre, 7-Zip, DjVuLibre, CAJViewer ou WPS/Office. (Calibre (MOBI/AZW3/CHM), 7-Zip (CBR/CB7/CHM), DjVuLibre, CAJViewer, WPS/Office).

## Transferência e instalação

Na [versão mais recente](https://github.com/itcwc/yejian-reader/releases/latest), transfira o ficheiro correspondente ao seu dispositivo.

- **Windows** — instalador `.exe` de 64 bits. Selecione português ou outro dos seis idiomas antes de iniciar a instalação.
- **Android** — `.apk` assinado para Android 7.0 ou posterior. O instalador do sistema utiliza o idioma do telemóvel.

Ao migrar de um APK de depuração, abra **Definições → Cópia de segurança da biblioteca e do progresso → Exportar** (设置 → 书库与进度备份 → 导出备份) na aplicação antiga. Guarde o ficheiro `.yejianbackup` em Transferências ou na nuvem. Desinstale a aplicação antiga, instale o APK atual e importe o ficheiro no mesmo painel. Configure novamente as preferências e o WebDAV. [Instruções de migração](../.github/release-notes/v0.1.21.md)

### Atualizações na aplicação

As aplicações Windows e Android verificam atualizações ao iniciar. Transfira as atualizações disponíveis na aplicação. No Windows, reinicie para instalar. No Android, a aplicação verifica o SHA-256 do APK e abre o instalador do sistema.

## Executar a versão web

[Abra o Yejian no navegador](https://itcwc.github.io/yejian-reader/app/?lang=pt) ou, com Node.js 18 ou posterior, execute na raiz do repositório:

```bash
npm install
npm run dev
```

Abra `http://localhost:5180`. Para compilar para produção e verificar o resultado localmente:

```bash
npm run build
npm run preview
```

### Publicar a versão web

Depois de executar `npm run build`, envie o conteúdo de `dist/` para o seu alojamento estático. Neste repositório, o [fluxo de trabalho do GitHub Pages](../.github/workflows/pages.yml) publica o site e o leitor web em conjunto. Para sincronizar com WebDAV no navegador, configure CORS no servidor ou use um proxy inverso na mesma origem. `npm run dev` e `npm run preview` incluem o proxy local `/__dav`.

### Empacotar para Windows x64

```bash
npm run pc
npm run build:pc
```

O primeiro comando abre a aplicação no Electron. O segundo gera o instalador x64 em `release/`. Se a transferência do Electron tiver sido omitida durante a instalação, execute `npm rebuild electron`.

### Empacotar para Android

```bash
npm run build:android
```

Este comando compila a versão web e copia os ficheiros para os dois projetos Android. Para criar o seu próprio pacote, importe `android-uniapp` no HBuilderX e configure o nome, o ID do pacote e a assinatura. O [fluxo de publicação](../.github/workflows/release.yml) usa o Android SDK e o Gradle para gerar o APK assinado a partir de `android-webview`.

### WebDAV

Em **Sincronizar**, preencha o URL do servidor, o nome de utilizador, a palavra-passe da aplicação e o nome do dispositivo. Teste a ligação antes de sincronizar. Ative a sincronização de ficheiros para transferir os livros juntamente com os metadados e o progresso. Para acesso no navegador, o servidor WebDAV deve permitir `PROPFIND`, `MKCOL` e `PUT`.

Estrutura no servidor: `yejian/books.json`, `yejian/progress.json`, `yejian/books/<id>.<ext>`.

### Exemplo de WebDAV no Nginx

Para alojar o WebDAV no seu servidor Nginx, use este exemplo.

```nginx
location ^~ /dav/ {
    alias /www/wwwroot/your-site/dav/;
    dav_methods PUT DELETE MKCOL COPY MOVE;
    dav_ext_methods PROPFIND OPTIONS;
    create_full_put_path on;
    dav_access user:rw group:rw all:r;
    client_max_body_size 0;
}
```

Mantenha a barra final em ambos os caminhos. `PROPFIND` precisa de `nginx-dav-ext-module`. Dê permissões de escrita no diretório ao utilizador do Nginx. O exemplo configura o armazenamento WebDAV. Se o leitor web estiver noutra origem, configure também o CORS.

## Transferir a biblioteca e o progresso offline

No dispositivo antigo, abra **Definições → Cópia da biblioteca e do progresso → Exportar**. Copie o ficheiro `.yejianbackup` para o novo dispositivo e importe-o no mesmo painel. A cópia inclui os livros originais, as capas e a posição de leitura. A importação adiciona os livros em falta e conserva a posição mais recente de cada livro.

## Atalhos de teclado

| Tecla | Ação |
| --- | --- |
| `←` / `→` / `↑` / `↓` | Página anterior ou seguinte (deslocamento no modo contínuo) |
| `PageUp` / `PageDown` / `Space` | Mudar de página |
| `T` | Mostrar ou ocultar o índice |
| `S` | Mostrar ou ocultar as definições de tipografia |
| `Esc` | Fechar painéis |

## Estrutura do projeto

`src` contém a interface web e os leitores. `electron` contém a aplicação de computador. `android-webview` gera o APK oficial e `android-uniapp` destina-se ao HBuilderX. Os dados ficam no IndexedDB. A sincronização WebDAV transfere primeiro os livros em falta e depois combina as posições de leitura mais recentes.

## Limitações

Alguns formatos precisam de conversão. Exporte CAJ como PDF no CAJViewer. PDFs e ficheiros de banda desenhada grandes podem demorar a abrir pela primeira vez. EPUB e PDF protegidos por DRM não são suportados.

## Contribuir

São bem-vindos relatórios de problemas e pedidos de integração. Execute `npm run build` e indique os passos para reproduzir o problema e o formato do ficheiro.

## Licença

[Licença MIT](../LICENSE) · [Comunicar um problema](https://github.com/itcwc/yejian-reader/issues)
