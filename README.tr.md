# Yejian (页间)

[简体中文](README.zh-CN.md) | [हिंदी](README.hi.md) | [Português](README.pt.md) | [Indonesian](README.id.md) | [English](README.md) | **Türkçe**

[Proje sitesi](https://itcwc.github.io/yejian-reader/?lang=tr) · [Son sürüm](https://github.com/itcwc/yejian-reader/releases/latest)

Yejian, kitaplığınızı cihazınızda saklayan ücretsiz ve açık kaynaklı bir okuyucudur. Hesap açmadan çevrimdışı okuyabilir, kitapları ve okuma ilerlemesini kendi WebDAV sunucunuzla eşitleyebilirsiniz.

## Ekran görüntüleri

Android uygulamasını ilk açtığınızda dilinizi seçin. Daha sonra **Ayarlar → Uygulama dili** bölümünden değiştirebilirsiniz.

<p align="center">
  <img src="docs/screenshots/tr/library.webp" width="30%" alt="Kitaplık">
  <img src="docs/screenshots/tr/reader.webp" width="30%" alt="Okuma menüsü">
  <img src="docs/screenshots/tr/settings.webp" width="30%" alt="Ayarlar">
</p>

## Özellikler

- EPUB, PDF, TXT, Markdown, RTF, FB2, HTML, DOCX ve CBZ/CBT dosyalarını doğrudan açın.
- Sayfa çevirerek veya sürekli kaydırarak okuyun. Yazı tipini, boyutunu, satır aralığını ve metin genişliğini ayarlayın.
- Kâğıt, gece veya açık yeşil temayı seçin. Okuyucu kitapta kaldığınız yeri saklar.
- Kitapları, kapakları ve okuma ilerlemesini yerel olarak yedekleyin ya da WebDAV ile eşitleyin.

## İndirme ve kurulum

[Son sürüm](https://github.com/itcwc/yejian-reader/releases/latest) sayfasından cihazınıza uygun dosyayı indirin.

- **Windows** — 64 bit `.exe` yükleyicisi. Kurulum başlamadan önce Türkçe dahil altı dilden birini seçin.
- **Android** — Android 7.0 ve üzeri için imzalı `.apk`. Kurulum ekranı telefonun sistem dilini kullanır.

Hata ayıklama APK’sından geçiyorsanız eski uygulamada **Ayarlar → Kitaplık ve okuma ilerlemesi yedeği → Dışa aktar** (设置 → 书库与进度备份 → 导出备份) seçeneğini açın. `.yejianbackup` dosyasını İndirilenler klasörüne veya buluta kaydedin. Eski uygulamayı kaldırın, yeni APK’yı kurun ve aynı panelden yedeği içe aktarın. Uygulama tercihlerini ve WebDAV’ı yeniden yapılandırın. [Geçiş adımları](.github/release-notes/v0.1.21.md)

## Web sürümünü çalıştırma

[Yejian’ı tarayıcıda açın](https://itcwc.github.io/yejian-reader/app/?lang=tr) veya Node.js 18 ya da üzeriyle depo kök dizininde şu komutları çalıştırın:

```bash
npm install
npm run dev
```

`http://localhost:5180` adresini açın. Üretim derlemesini oluşturmak ve yerel olarak önizlemek için:

```bash
npm run build
npm run preview
```

### Web sürümünü yayımlama

`npm run build` komutundan sonra `dist/` içeriğini statik web barındırma hizmetinize yükleyin. Bu depodaki [GitHub Pages iş akışı](.github/workflows/pages.yml) tanıtım sitesini ve web okuyucusunu birlikte yayımlar. Tarayıcıda WebDAV eşitlemesi için sunucuda CORS’a izin verin veya aynı kökende bir ters vekil kullanın. `npm run dev` ve `npm run preview`, yerel `/__dav` vekilini içerir.

### Windows x64 paketleme

```bash
npm run pc
npm run build:pc
```

İlk komut uygulamayı Electron ile açar. İkinci komut x64 yükleyicisini `release/` dizinine oluşturur. Kurulumda Electron indirilmediyse `npm rebuild electron` komutunu çalıştırın.

### Android paketleme

```bash
npm run build:android
```

Bu komut web sürümünü derler ve dosyaları iki Android projesine kopyalar. Kendi paketinizi oluşturmak için `android-uniapp` projesini HBuilderX’e aktarın ve uygulama adını, paket kimliğini ve imzasını ayarlayın. [Sürüm iş akışı](.github/workflows/release.yml), Android SDK ve Gradle ile `android-webview` projesinden imzalı APK üretir.

### WebDAV

**Eşitle** sayfasına sunucu adresini, kullanıcı adını, uygulama parolasını ve cihaz adını girin. Eşitlemeden önce bağlantıyı test edin. Meta veriler ve ilerlemeyle birlikte kitap dosyalarını da aktarmak için dosya eşitlemesini açın. Tarayıcı erişimi için WebDAV sunucusu `PROPFIND`, `MKCOL` ve `PUT` yöntemlerine izin vermelidir.

## Lisans

Bazı biçimler dönüştürme gerektirir ve DRM korumalı dosyalar desteklenmez. Ayrıntılar için [İngilizce belgelere](README.md) bakın.

[MIT lisansı](LICENSE) · [Sorun bildirin](https://github.com/itcwc/yejian-reader/issues)
