const keys = [
  'features', 'download', 'title', 'intro', 'install', 'source', 'paper', 'night',
  'featuresTitle', 'formatsTitle', 'formats', 'appearanceTitle', 'appearance', 'syncTitle', 'sync',
  'downloadTitle', 'android', 'androidLink', 'windows', 'windowsLink', 'license', 'feedback',
  'brand', 'navigationLabel', 'languageLabel', 'paperAlt', 'nightAlt', 'pageTitle',
]

const translations = {
  'zh-CN': [
    '功能', '下载', '你的书，在自己的书架。',
    '页间是一款开源的本地阅读器。在 Windows 和 Android 上阅读 EPUB、PDF、TXT 等格式，可用自己的 WebDAV 空间同步书籍和阅读进度。',
    '下载安装', '查看源码', '白纸', '夜读', '按你的习惯阅读',
    '打开手边的书', '直接打开 EPUB、PDF、TXT、Markdown、DOCX 和 CBZ 漫画等常见格式，离线也能阅读。',
    '调出舒服的排版', '可选白纸、护眼和夜读主题，自由调整字号、行距和版心宽度，也可以在翻页和连续滚动间切换。',
    '换台设备接着读', '阅读位置保存在本机。配置 WebDAV 后可以跨设备同步，也可以导出书籍、封面和进度的本地备份。',
    '下载页间', 'Android 7.0 及以上。首次从调试版迁移到正式签名版前，请先导出书库备份。',
    '获取安卓安装包与迁移说明', '适用于 64 位 Windows，可在开始安装前选择语言。', '获取 Windows x64 安装包',
    '页间阅读 · MIT 开源', '反馈问题', '页间阅读', '主导航', '语言', '页间阅读器的白纸主题', '页间阅读器的夜读主题', '页间阅读 · 开源本地阅读器',
  ],
  hi: [
    'सुविधाएँ', 'डाउनलोड', 'आपकी किताबें। आपकी अपनी लाइब्रेरी।',
    'येजियान Windows और Android के लिए एक ओपन-सोर्स रीडर है। EPUB, PDF, TXT और अन्य फ़ॉर्मैट स्थानीय रूप से पढ़ें और अपने WebDAV सर्वर से किताबें और प्रगति सिंक करें।',
    'येजियान डाउनलोड करें', 'सोर्स कोड देखें', 'पेपर', 'नाइट', 'अपने तरीके से पढ़ें',
    'अपनी किताबें खोलें', 'EPUB, PDF, TXT, Markdown, DOCX और CBZ कॉमिक्स सीधे खोलें। ऑफ़लाइन भी पढ़ें।',
    'आराम से पढ़ें', 'पेपर, हल्का हरा या नाइट थीम चुनें। फ़ॉन्ट का आकार, लाइन स्पेसिंग और टेक्स्ट की चौड़ाई बदलें। पन्ने पलटें या लगातार स्क्रॉल करें।',
    'दूसरे डिवाइस पर पढ़ना जारी रखें', 'पढ़ने की जगह डिवाइस पर सेव होती है। WebDAV से डिवाइसों के बीच सिंक करें या किताबों, कवर और प्रगति का स्थानीय बैकअप निर्यात करें।',
    'येजियान डाउनलोड करें', 'Android 7.0 या बाद का संस्करण। डीबग बिल्ड से हस्ताक्षरित रिलीज़ पर जाने से पहले लाइब्रेरी का बैकअप निर्यात करें।',
    'Android APK और माइग्रेशन निर्देश', '64-बिट Windows के लिए इंस्टॉलर। इंस्टॉलेशन से पहले भाषा चुनें।', 'Windows x64 इंस्टॉलर डाउनलोड करें',
    'येजियान रीडर · MIT लाइसेंस', 'समस्या की रिपोर्ट करें', 'येजियान रीडर', 'मुख्य नेविगेशन', 'भाषा', 'पेपर थीम में येजियान रीडर', 'नाइट थीम में येजियान रीडर', 'येजियान रीडर · ओपन-सोर्स रीडर',
  ],
  pt: [
    'Funcionalidades', 'Transferir', 'Os seus livros na sua própria estante.',
    'O Yejian é um leitor de código aberto que funciona localmente no Windows e no Android. Leia EPUB, PDF, TXT e outros formatos e sincronize livros e progresso através do seu servidor WebDAV.',
    'Obter o Yejian', 'Ver código-fonte', 'Papel', 'Noturno', 'Leia à sua maneira',
    'Abra os seus livros', 'Abra diretamente EPUB, PDF, TXT, Markdown, DOCX e banda desenhada em CBZ. Continue a ler offline.',
    'Ajuste a leitura ao seu gosto', 'Escolha entre papel, verde suave e modo noturno. Ajuste o tamanho de letra, o espaçamento e a largura do texto. Leia página a página ou com deslocamento contínuo.',
    'Continue noutro dispositivo', 'A posição de leitura é guardada localmente. Use o WebDAV para sincronizar dispositivos ou exporte uma cópia de segurança dos livros, capas e progresso.',
    'Transferir o Yejian', 'Android 7.0 ou posterior. Exporte uma cópia de segurança antes de migrar da versão de depuração para a versão assinada.',
    'Obter o APK e as instruções de migração', 'Instalador para Windows de 64 bits. Escolha o idioma antes de instalar.', 'Obter o instalador Windows x64',
    'Yejian Reader · Licença MIT', 'Comunicar um problema', 'Yejian Reader', 'Navegação principal', 'Idioma', 'Yejian Reader com o tema papel', 'Yejian Reader com o tema noturno', 'Yejian Reader · Leitor local de código aberto',
  ],
  id: [
    'Fitur', 'Unduh', 'Buku Anda. Rak Anda sendiri.',
    'Yejian adalah aplikasi baca bersumber terbuka untuk Windows dan Android yang mengutamakan penyimpanan lokal. Baca EPUB, PDF, TXT, dan lainnya, lalu sinkronkan buku dan progres lewat server WebDAV Anda sendiri.',
    'Unduh Yejian', 'Lihat kode sumber', 'Kertas', 'Malam', 'Baca sesuai kebiasaan Anda',
    'Buka buku Anda', 'Buka langsung EPUB, PDF, TXT, Markdown, DOCX, dan komik CBZ. Tetap baca saat luring.',
    'Sesuaikan tampilan baca', 'Pilih tema kertas, hijau lembut, atau malam. Atur ukuran huruf, spasi baris, dan lebar teks. Baca per halaman atau gulir terus-menerus.',
    'Lanjutkan di perangkat lain', 'Posisi baca disimpan di perangkat. Gunakan WebDAV untuk sinkronisasi, atau ekspor cadangan lokal buku, sampul, dan progres.',
    'Unduh Yejian', 'Android 7.0 atau lebih baru. Ekspor cadangan pustaka sebelum beralih dari versi debug ke rilis bertanda tangan.',
    'Unduh APK dan baca panduan migrasi', 'Pemasang untuk Windows 64-bit. Pilih bahasa sebelum memasang.', 'Unduh pemasang Windows x64',
    'Yejian Reader · Lisensi MIT', 'Laporkan masalah', 'Yejian Reader', 'Navigasi utama', 'Bahasa', 'Yejian Reader dengan tema kertas', 'Yejian Reader dengan tema malam', 'Yejian Reader · Aplikasi baca lokal bersumber terbuka',
  ],
  tr: [
    'Özellikler', 'İndir', 'Kitaplarınız kendi kitaplığınızda.',
    'Yejian, Windows ve Android için açık kaynaklı, yerel öncelikli bir okuyucudur. EPUB, PDF, TXT ve diğer biçimleri okuyun. Kitaplarınızı ve okuma ilerlemenizi kendi WebDAV sunucunuzla eşitleyin.',
    'Yejian’ı indir', 'Kaynak kodunu görüntüle', 'Kâğıt', 'Gece', 'Dilediğiniz gibi okuyun',
    'Kitaplarınızı açın', 'EPUB, PDF, TXT, Markdown, DOCX ve CBZ çizgi romanlarını doğrudan açın. Çevrimdışı okumaya devam edin.',
    'Okuma görünümünü ayarlayın', 'Kâğıt, açık yeşil veya gece temasını seçin. Yazı boyutunu, satır aralığını ve metin genişliğini ayarlayın. Sayfa çevirerek veya kaydırarak okuyun.',
    'Başka cihazda kaldığınız yerden devam edin', 'Okuma konumunuz cihazda saklanır. WebDAV ile cihazlar arasında eşitleyin veya kitapları, kapakları ve ilerlemeyi yerel olarak yedekleyin.',
    'Yejian’ı indir', 'Android 7.0 ve üzeri. Hata ayıklama sürümünden imzalı sürüme geçmeden önce kitaplığınızı yedekleyin.',
    'Android APK’sı ve geçiş kılavuzu', '64 bit Windows için yükleyici. Kurulumdan önce dilinizi seçin.', 'Windows x64 yükleyicisini indir',
    'Yejian Reader · MIT lisansı', 'Sorun bildir', 'Yejian Reader', 'Ana gezinme', 'Dil', 'Kâğıt temasında Yejian Reader', 'Gece temasında Yejian Reader', 'Yejian Reader · Açık kaynaklı yerel okuyucu',
  ],
}

const mainNavigation = document.querySelector('.nav nav')
const languageNavigation = document.querySelector('.languages')
const homeLink = document.querySelector('[data-home]')
const preview = document.querySelector('#reader-preview')
const themeButtons = document.querySelectorAll('.switcher button')
const language = new URLSearchParams(location.search).get('lang')
const strings = Object.hasOwn(translations, language) ? translations[language] : null
const copy = strings ? Object.fromEntries(keys.map((key, index) => [key, strings[index]])) : null

if (copy) {
  document.documentElement.lang = language
  document.title = copy.pageTitle
  document.querySelector('meta[name="description"]').content = copy.intro
  mainNavigation.setAttribute('aria-label', copy.navigationLabel)
  languageNavigation.setAttribute('aria-label', copy.languageLabel)
  homeLink.textContent = copy.brand
  homeLink.href = '?lang=' + encodeURIComponent(language)
  for (const element of document.querySelectorAll('[data-copy]')) {
    element.textContent = copy[element.dataset.copy]
  }
  for (const link of languageNavigation.querySelectorAll('a')) {
    if (link.lang === language) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
}

const alt = {
  paper: copy?.paperAlt ?? 'Yejian Reader in the paper theme',
  night: copy?.nightAlt ?? 'Yejian Reader in the night theme',
}
preview.alt = alt.paper
for (const button of themeButtons) {
  button.addEventListener('click', () => {
    preview.src = 'screenshots/' + button.dataset.image
    preview.alt = alt[button.dataset.theme]
    for (const option of themeButtons) option.setAttribute('aria-pressed', String(option === button))
  })
}
