const keys = [
  'features', 'download', 'title', 'source', 'paper', 'night',
  'featuresTitle', 'formatsTitle', 'formats', 'appearanceTitle', 'appearance', 'syncTitle',
  'downloadTitle', 'android', 'androidLink', 'windows', 'windowsLink', 'license', 'feedback',
  'brand', 'navigationLabel', 'languageLabel', 'pageTitle',
  'otherProjects', 'chineseOnly',
]

const translations = {
  'zh-CN': [
    '功能', '下载', '你的书，在自己的书架。',
    '查看源码', '白纸', '夜读', '按你的习惯阅读',
    '打开手边的书', '直接打开 EPUB、PDF、TXT、Markdown、DOCX 和 CBZ 漫画等常见格式，离线也能阅读。',
    '调出舒服的排版', '可选白纸、护眼和夜读主题，自由调整字号、行距和版心宽度，也可以在翻页和连续滚动间切换。',
    '换台设备接着读',
    '下载页间', 'Android 7.0 及以上。首次从调试版迁移到正式签名版前，请先导出书库备份。',
    '获取安卓安装包与迁移说明', '适用于 64 位 Windows，可在开始安装前选择语言。', '获取 Windows x64 安装包',
    '页间阅读 · MIT 开源', '反馈问题', '页间阅读', '主导航', '语言', '页间阅读 · 开源本地阅读器',
    '我还在做其他开源产品', '（仅中文）',
  ],
  hi: [
    'सुविधाएँ', 'डाउनलोड', 'आपकी किताबें। आपकी अपनी लाइब्रेरी।',
    'सोर्स कोड देखें', 'पेपर', 'नाइट', 'अपने तरीके से पढ़ें',
    'अपनी किताबें खोलें', 'EPUB, PDF, TXT, Markdown, DOCX और CBZ कॉमिक्स सीधे खोलें। ऑफ़लाइन भी पढ़ें।',
    'आराम से पढ़ें', 'पेपर, हल्का हरा या नाइट थीम चुनें। फ़ॉन्ट का आकार, लाइन स्पेसिंग और टेक्स्ट की चौड़ाई बदलें। पन्ने पलटें या लगातार स्क्रॉल करें।',
    'दूसरे डिवाइस पर पढ़ना जारी रखें',
    'येजियान डाउनलोड करें', 'Android 7.0 या बाद का संस्करण। डीबग बिल्ड से हस्ताक्षरित रिलीज़ पर जाने से पहले लाइब्रेरी का बैकअप निर्यात करें।',
    'Android APK और माइग्रेशन निर्देश', '64-बिट Windows के लिए इंस्टॉलर। इंस्टॉलेशन से पहले भाषा चुनें।', 'Windows x64 इंस्टॉलर डाउनलोड करें',
    'येजियान रीडर · MIT लाइसेंस', 'समस्या की रिपोर्ट करें', 'येजियान रीडर', 'मुख्य नेविगेशन', 'भाषा', 'येजियान रीडर · ओपन-सोर्स रीडर',
    'मैं दूसरे ओपन-सोर्स प्रोजेक्ट्स पर भी काम करता हूँ', '(केवल चीनी में)',
  ],
  pt: [
    'Funcionalidades', 'Transferir', 'Os seus livros na sua própria estante.',
    'Ver código-fonte', 'Papel', 'Noturno', 'Leia à sua maneira',
    'Abra os seus livros', 'Abra diretamente EPUB, PDF, TXT, Markdown, DOCX e banda desenhada em CBZ. Continue a ler offline.',
    'Ajuste a leitura ao seu gosto', 'Escolha entre papel, verde suave e modo noturno. Ajuste o tamanho de letra, o espaçamento e a largura do texto. Leia página a página ou com deslocamento contínuo.',
    'Continue noutro dispositivo',
    'Transferir o Yejian', 'Android 7.0 ou posterior. Exporte uma cópia de segurança antes de migrar da versão de depuração para a versão assinada.',
    'Obter o APK e as instruções de migração', 'Instalador para Windows de 64 bits. Escolha o idioma antes de instalar.', 'Obter o instalador Windows x64',
    'Yejian Reader · Licença MIT', 'Comunicar um problema', 'Yejian Reader', 'Navegação principal', 'Idioma', 'Yejian Reader · Leitor local de código aberto',
    'Também trabalho noutros projetos de código aberto', '(apenas em chinês)',
  ],
  id: [
    'Fitur', 'Unduh', 'Buku Anda. Rak Anda sendiri.',
    'Lihat kode sumber', 'Kertas', 'Malam', 'Baca sesuai kebiasaan Anda',
    'Buka buku Anda', 'Buka langsung EPUB, PDF, TXT, Markdown, DOCX, dan komik CBZ. Tetap baca saat luring.',
    'Sesuaikan tampilan baca', 'Pilih tema kertas, hijau lembut, atau malam. Atur ukuran huruf, spasi baris, dan lebar teks. Baca per halaman atau gulir terus-menerus.',
    'Lanjutkan di perangkat lain',
    'Unduh Yejian', 'Android 7.0 atau lebih baru. Ekspor cadangan pustaka sebelum beralih dari versi debug ke rilis bertanda tangan.',
    'Unduh APK dan baca panduan migrasi', 'Pemasang untuk Windows 64-bit. Pilih bahasa sebelum memasang.', 'Unduh pemasang Windows x64',
    'Yejian Reader · Lisensi MIT', 'Laporkan masalah', 'Yejian Reader', 'Navigasi utama', 'Bahasa', 'Yejian Reader · Aplikasi baca lokal bersumber terbuka',
    'Saya juga mengerjakan proyek sumber terbuka lainnya', '(hanya dalam bahasa Mandarin)',
  ],
  tr: [
    'Özellikler', 'İndir', 'Kitaplarınız kendi kitaplığınızda.',
    'Kaynak kodunu görüntüle', 'Kâğıt', 'Gece', 'Dilediğiniz gibi okuyun',
    'Kitaplarınızı açın', 'EPUB, PDF, TXT, Markdown, DOCX ve CBZ çizgi romanlarını doğrudan açın. Çevrimdışı okumaya devam edin.',
    'Okuma görünümünü ayarlayın', 'Kâğıt, açık yeşil veya gece temasını seçin. Yazı boyutunu, satır aralığını ve metin genişliğini ayarlayın. Sayfa çevirerek veya kaydırarak okuyun.',
    'Başka cihazda kaldığınız yerden devam edin',
    'Yejian’ı indir', 'Android 7.0 ve üzeri. Hata ayıklama sürümünden imzalı sürüme geçmeden önce kitaplığınızı yedekleyin.',
    'Android APK’sı ve geçiş kılavuzu', '64 bit Windows için yükleyici. Kurulumdan önce dilinizi seçin.', 'Windows x64 yükleyicisini indir',
    'Yejian Reader · MIT lisansı', 'Sorun bildir', 'Yejian Reader', 'Ana gezinme', 'Dil', 'Yejian Reader · Açık kaynaklı yerel okuyucu',
    'Başka açık kaynak projeler üzerinde de çalışıyorum', '(yalnızca Çince)',
  ],
}

const landingKeys = [
  'positioning', 'intro', 'openReader', 'explore', 'noAccount', 'localStorage', 'openSource',
  'previewTitle', 'libraryTab', 'readerTab', 'settingsTab', 'green', 'themeLabel', 'viewImage',
  'desktop', 'mobile', 'settingsDetail', 'sync', 'syncGuide', 'dataTitle', 'dataDetail',
  'syncDetail', 'releases', 'webNote', 'testDetail', 'testBuilds',
]

const landingTranslations = {
  'zh-CN': [
    '本地阅读器', '页间是一款开源阅读器，用来读你自己的电子书、PDF 和漫画。在浏览器打开一本书，或下载安装，随时接着读。', '打开网页版', '看看页间怎么用', '无需登录', '书架与进度本地保存', '开源',
    '看看页间的界面', '书架', '阅读', '设置', '护眼', '网站主题', '查看大图',
    '桌面书架', '手机网页版书架', '在设置中切换界面语言和阅读外观。', '配置自己的 WebDAV 空间，在多台设备间同步书籍和阅读进度。', 'WebDAV 配置指南', '书和进度都保存在本机', '书籍与阅读进度保存在本机。清除浏览器数据或换浏览器前，可以先导出书库备份。',
    '同步是可选的，需要你自己的 WebDAV 服务。网页版同步要求服务端允许跨域请求，或通过同源代理访问。', '所有版本', '直接在浏览器打开自己的书，iPhone 和 iPad 也可以使用。', '提供 Apple Silicon 和 Intel 版 Mac 的测试安装包，以及 Linux x64 的 AppImage 和 .deb 测试包。', '获取桌面测试版',
  ],
  hi: [
    'स्थानीय रीडर', 'येजियान अपनी ई-बुक, PDF और कॉमिक्स पढ़ने के लिए एक ओपन-सोर्स रीडर है। ब्राउज़र में किताब खोलें या ऐप इंस्टॉल करें और वहीं से पढ़ें जहाँ छोड़ा था।', 'वेब रीडर खोलें', 'येजियान का इंटरफ़ेस देखें', 'खाते की ज़रूरत नहीं', 'लाइब्रेरी और प्रगति डिवाइस पर', 'ओपन सोर्स',
    'येजियान की एक झलक', 'लाइब्रेरी', 'रीडर', 'सेटिंग्स', 'हल्का हरा', 'साइट की थीम', 'पूरे आकार में देखें',
    'डेस्कटॉप लाइब्रेरी', 'मोबाइल वेब लाइब्रेरी', 'सेटिंग्स में इंटरफ़ेस की भाषा और रीडर का रूप बदलें।', 'किताबें और पढ़ने की प्रगति डिवाइसों के बीच सिंक करने के लिए अपना WebDAV सर्वर सेट करें।', 'WebDAV सेटअप गाइड', 'आपकी लाइब्रेरी आपके डिवाइस पर रहती है', 'किताबें और पढ़ने की प्रगति डिवाइस पर रहती हैं। ब्राउज़र का डेटा मिटाने या ब्राउज़र बदलने से पहले लाइब्रेरी का बैकअप निर्यात करें।',
    'सिंक वैकल्पिक है और इसके लिए अपना WebDAV सर्वर चाहिए। ब्राउज़र से सिंक के लिए सर्वर पर क्रॉस-ओरिजिन अनुरोधों की अनुमति या समान-ओरिजिन प्रॉक्सी चाहिए।', 'सभी रिलीज़', 'iPhone और iPad सहित किसी भी समर्थित डिवाइस के ब्राउज़र में अपनी किताबें खोलें।', 'Apple Silicon और Intel Mac के लिए टेस्ट बिल्ड उपलब्ध हैं। Linux x64 के लिए AppImage और .deb उपलब्ध हैं।', 'डेस्कटॉप टेस्ट बिल्ड डाउनलोड करें',
  ],
  pt: [
    'Leitor local', 'O Yejian é um leitor de código aberto para os seus livros digitais, PDFs e banda desenhada. Abra um livro no navegador ou instale a aplicação e continue de onde ficou.', 'Abrir o leitor web', 'Ver o Yejian em ação', 'Sem conta', 'Biblioteca e progresso locais', 'Código aberto',
    'Conheça o Yejian', 'Biblioteca', 'Leitor', 'Definições', 'Verde suave', 'Tema do site', 'Ver em tamanho real',
    'Biblioteca no computador', 'Biblioteca web no telemóvel', 'Escolha o idioma da interface e ajuste a aparência do leitor nas definições.', 'Configure o seu servidor WebDAV para sincronizar livros e progresso de leitura entre dispositivos.', 'Guia de configuração do WebDAV', 'A biblioteca fica no seu dispositivo', 'Os livros e o progresso ficam guardados no dispositivo. Exporte uma cópia de segurança antes de apagar os dados do navegador ou mudar de navegador.',
    'A sincronização é opcional e requer um servidor WebDAV próprio. No navegador, o servidor tem de permitir pedidos entre origens ou estar disponível através de um proxy da mesma origem.', 'Todas as versões', 'Abra os seus livros diretamente no navegador, também no iPhone e no iPad.', 'Estão disponíveis versões de teste para Mac com Apple Silicon ou Intel e pacotes AppImage e .deb para Linux x64.', 'Obter as versões de teste',
  ],
  id: [
    'Pembaca lokal', 'Yejian adalah aplikasi sumber terbuka untuk membaca buku digital, PDF, dan komik milik Anda. Buka buku di browser atau instal aplikasinya, lalu lanjutkan dari halaman terakhir.', 'Buka pembaca web', 'Lihat tampilan Yejian', 'Tanpa akun', 'Pustaka dan progres lokal', 'Sumber terbuka',
    'Lihat isi Yejian', 'Pustaka', 'Pembaca', 'Pengaturan', 'Hijau lembut', 'Tema situs', 'Lihat ukuran penuh',
    'Pustaka desktop', 'Pustaka web seluler', 'Pilih bahasa antarmuka dan atur tampilan pembaca di Pengaturan.', 'Siapkan penyimpanan WebDAV sendiri untuk menyinkronkan buku dan progres antarperangkat.', 'Panduan konfigurasi WebDAV', 'Pustaka tersimpan di perangkat Anda', 'Buku dan progres tersimpan di perangkat. Ekspor cadangan pustaka sebelum menghapus data browser atau beralih ke browser lain.',
    'Sinkronisasi bersifat opsional dan memerlukan server WebDAV Anda sendiri. Sinkronisasi browser memerlukan izin permintaan lintas origin atau proxy dengan origin yang sama.', 'Semua rilis', 'Buka buku langsung di browser, termasuk di iPhone dan iPad.', 'Versi uji tersedia untuk Mac Apple Silicon dan Intel, serta paket AppImage dan .deb untuk Linux x64.', 'Unduh versi uji desktop',
  ],
  tr: [
    'Yerel kitap okuyucu', 'Yejian, kendi e-kitaplarınız, PDF’leriniz ve çizgi romanlarınız için açık kaynaklı bir okuyucudur. Kitabı tarayıcıda açın veya uygulamayı kurup kaldığınız yerden devam edin.', 'Web okuyucuyu aç', 'Yejian’ın arayüzünü görün', 'Hesap gerekmez', 'Kitaplık ve ilerleme cihazda', 'Açık kaynak',
    'Yejian’a yakından bakın', 'Kitaplık', 'Okuyucu', 'Ayarlar', 'Açık yeşil', 'Site teması', 'Tam boyutta görüntüle',
    'Masaüstü kitaplığı', 'Mobil web kitaplığı', 'Ayarlar’dan arayüz dilini seçin ve okuyucunun görünümünü ayarlayın.', 'Kitapları ve okuma ilerlemesini cihazlar arasında eşitlemek için kendi WebDAV sunucunuzu kurun.', 'WebDAV kurulum kılavuzu', 'Kitaplığınız cihazınızda kalır', 'Kitaplar ve okuma ilerlemesi cihazda saklanır. Tarayıcı verilerini silmeden veya tarayıcı değiştirmeden önce kitaplığınızı yedekleyin.',
    'Eşitleme isteğe bağlıdır ve kendi WebDAV sunucunuzu gerektirir. Tarayıcıda eşitleme için sunucu farklı kaynaklardan gelen isteklere izin vermeli veya aynı kaynaklı bir proxy kullanılmalıdır.', 'Tüm sürümler', 'Kitaplarınızı iPhone ve iPad dahil, doğrudan tarayıcıda açın.', 'Apple Silicon ve Intel Mac’ler için test sürümleri, Linux x64 için AppImage ve .deb paketleri bulunur.', 'Masaüstü test sürümlerini indir',
  ],
}

const starCopy = {
  'zh-CN': ['如果页间对你有帮助，欢迎点个 Star，让更多读者发现它。', '在 GitHub 点 Star'],
  hi: ['येजियान पसंद आया? GitHub पर स्टार दें ताकि और पाठक इसे खोज सकें।', 'GitHub पर स्टार दें'],
  pt: ['Gosta do Yejian? Uma estrela ajuda mais leitores a descobrir o projeto.', 'Dar uma estrela no GitHub'],
  id: ['Suka Yejian? Beri bintang agar lebih banyak pembaca menemukan proyek ini.', 'Beri bintang di GitHub'],
  tr: ['Yejian’ı beğendiniz mi? Bir yıldız, daha fazla okurun projeyi keşfetmesine yardımcı olur.', 'GitHub’da yıldız ver'],
}

const params = new URLSearchParams(location.search)
const requestedLanguage = params.get('lang')
const language = Object.hasOwn(translations, requestedLanguage) ? requestedLanguage : 'en'
const translatedPage = language !== 'en'
const languageNavigation = document.querySelector('.languages')
const languageLinks = languageNavigation.querySelectorAll('a')
const themeButtons = document.querySelectorAll('[data-theme-choice]')
const themeColor = document.querySelector('meta[name="theme-color"]')
const tabs = [...document.querySelectorAll('[role="tab"]')]
const colors = { paper: '#f2efe6', green: '#dbe8d4', night: '#101311' }
const copy = Object.fromEntries([...document.querySelectorAll('[data-copy]')].map(element => [element.dataset.copy, element.textContent]))

if (translatedPage) {
  keys.forEach((key, index) => { copy[key] = translations[language][index] })
  landingKeys.forEach((key, index) => { copy[key] = landingTranslations[language][index] })
  const [starNote, starAction] = starCopy[language]
  Object.assign(copy, { starNote, starAction })
  document.documentElement.lang = language
  document.title = copy.pageTitle
  document.querySelector('meta[name="description"]').content = copy.intro
  document.querySelector('.main-nav').setAttribute('aria-label', copy.navigationLabel)
  languageNavigation.setAttribute('aria-label', copy.languageLabel)
  document.querySelector('[data-theme-picker]').setAttribute('aria-label', copy.themeLabel)
  for (const element of document.querySelectorAll('[data-copy]')) element.textContent = copy[element.dataset.copy]
  for (const link of languageLinks) {
    if (link.lang === language) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}

function applyTheme(preference) {
  const theme = preference ?? 'paper'
  document.documentElement.dataset.theme = theme
  themeColor.content = colors[theme]
  for (const link of document.querySelectorAll('[data-preview]')) {
    const view = link.dataset.preview
    const isBookshelf = view === 'desktop' || view === 'mobile'
    const filename = isBookshelf ? `home-${view}-${theme}` : view
    const path = `./screenshots/${language}/${filename}.webp`
    const image = link.querySelector('img')
    link.href = path
    image.src = path
    image.alt = isBookshelf ? `${copy[view]} · ${copy[theme]}` : copy[`${view}Tab`]
  }
  const query = new URLSearchParams({ lang: language })
  if (preference) query.set('theme', preference)
  for (const link of document.querySelectorAll('[data-reader-link]')) link.href = './app/?' + query
  document.querySelector('[data-home]').href = '?' + query
  for (const link of languageLinks) {
    const linkQuery = new URLSearchParams(query)
    linkQuery.set('lang', link.lang)
    link.href = '?' + linkQuery
  }
  for (const button of themeButtons) button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme))
}

function selectTab(selectedTab, focus = false) {
  for (const tab of tabs) {
    const active = tab === selectedTab
    tab.setAttribute('aria-selected', String(active))
    tab.tabIndex = active ? 0 : -1
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active
  }
  if (focus) selectedTab.focus({ preventScroll: true })
}

const requestedTheme = params.get('theme')
applyTheme(Object.hasOwn(colors, requestedTheme) ? requestedTheme : null)
for (const button of themeButtons) {
  button.addEventListener('click', () => {
    const theme = button.dataset.themeChoice
    params.set('theme', theme)
    history.replaceState(history.state, '', '?' + params + location.hash)
    applyTheme(theme)
  })
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTab(tab))
  tab.addEventListener('keydown', event => {
    const targets = { ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 }
    if (!Object.hasOwn(targets, event.key)) return
    event.preventDefault()
    selectTab(tabs[targets[event.key]], true)
  })
}
for (const link of document.querySelectorAll('[data-preview-jump]')) {
  link.addEventListener('click', () => selectTab(tabs.find(tab => tab.dataset.tab === link.dataset.previewJump), true))
}
document.querySelector('[data-preview-controls]').hidden = false
