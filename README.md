# ScaleWalk — WebXR Hand Locomotion

Quest 3 Browser ve masaüstü tarayıcıları için statik, el kontrollü bir mimari keşif demosu. HTML, CSS ve JavaScript ES modules kullanır; Node.js sunucusu veya build adımı gerekmez. Three.js ve MediaPipe, sürümü sabitlenmiş CDN adreslerinden yüklenir.

## Çalıştırma

GitHub Pages’te depoyu **Settings → Pages** bölümünden `main` dalı ve `/ (root)` kaynağıyla yayınlayın. `index.html` kökte olduğundan proje URL’si alt dizinde olsa da göreceli uygulama yolları çalışır. HTTPS bağlantısını açın.

Yerel dosyayı `file://` ile açmak yerine HTTPS destekli statik önizleme ortamında sunun. Kamera erişimi güvenli bağlam gerektirir; `localhost` da güvenli bağlam kabul edilir.

### Quest 3

1. Quest 3 Browser’da yayımlanmış HTTPS bağlantısını açın.
2. Quest ayarlarında hand tracking’i etkinleştirin; uygulama kumanda girdisi istemez.
3. **Enter VR** düğmesine basıp tarayıcının isteğini kabul edin.
4. Başparmak + işaret parmağını yaklaştırıp tutarak ileri yürüyün. Başparmak + serçe sağa, başparmak + yüzük sola döndürür. Pinch bırakıldığında hareket durur.
5. VR’dan çıkınca oturum kapanışı masaüstü önizlemesine döner.

Bu proje gerçek bir Quest 3 üzerinde çalıştırılarak doğrulanmadı. `hand-tracking` opsiyoneldir; tarayıcı özelliği sağlamazsa durum paneli bildirir. `local-floor` yoksa `local` referans alanı denenir. Tarayıcı ve cihaz WebXR desteklemelidir.

### Masaüstü

1. **Start Camera** düğmesine basarak kamera iznini verin.
2. Elinizi görüntü üzerindeki kutuya alın. Landmark çizgileri ve hareket durumu canlı güncellenir.
3. İki el desteklenir. Kamera reddedilirse hata görünür. **Stop Camera** kamera izini kapatır.
4. 3D görünümde sürükleyerek bakış yönünü değiştirin; **Reset Position** başlangıç görünümüne döndürür.

MediaPipe modeli ilk açılışta CDN’den yüklenir. Kamera görüntüsü tarayıcıda işlenir.

## Kontroller

| Jest | Eylem |
| --- | --- |
| Başparmak + işaret parmağı pinch | Başın baktığı yatay yönde ileri hareket |
| Başparmak + serçe pinch | Dünya Y ekseninde sağa dönüş |
| Başparmak + yüzük pinch | Dünya Y ekseninde sola dönüş |
| El yok veya pinch yok | Hemen dur |

Pinch oranı, parmak uçları mesafesinin bilek ile orta parmak MCP eklemi arasındaki mesafeye oranıdır. Basma eşiği `0.34`, bırakma eşiği `0.48`; bu histerezis sınırda titreşmeyi azaltır. Birden fazla pinch olursa öncelik ileri, sağa, sola şeklindedir. El kadrajdan çıkınca jest sıfırlanır.

## 1:70 ölçek yöntemi

Modelin yerel birimi metre kabul edilir; mimari ölçüler tam boy ölçülerin `1/70` ile çarpılmış halidir. Örnek: gerçek 7 m oda sahnede `7 / 70 = 0.10` birim olur. Referans kişi boyu `1.70 / 70 = 0.02429`, göz yüksekliği `1.60 / 70 = 0.02286` sahne birimidir.

WebXR kafa pozu metre cinsinden alınır ve ham pose verisi değiştirilmez. Kamera `tracked-player-rig` parent grubunun altındadır; VR açılırken rig `1/70` ölçeğine alınır. Runtime’ın doğal baş dönüşü ve fiziksel hareketi korunur, standing/crouching hareketleri sabit bir göz yüksekliğine zorlanmaz. `local-floor` tercih edilir, yoksa `local` kullanılır.

Desktop kamerası model birimlerinde, ölçeklenmiş göz yüksekliğinde başlar. Hareket hızı iki modda aynı sahne ölçeğine karşılık gelir: XR’da rig’in ön-ölçek koordinatında hareket parent ölçeğiyle küçülür; desktop delta’sı doğrudan `1/70` ile küçültülür. Yürüme yönü kameranın yatay dünya yönünden alınır.

Kaynak tam boy `.glb`/`.gltf` dosyasını `?model=assets/models/atrium.glb` parametresiyle açabilirsiniz. Model loader `architecture` grubuna ekler ve `1/70` ile ölçekler.

## Dosya yapısı

```text
webxr-quest3/
├── index.html
├── css/style.css
├── js/
│   ├── main.js
│   ├── xr-manager.js
│   ├── hand-tracking.js
│   ├── gestures.js
│   ├── locomotion.js
│   ├── desktop-hands.js
│   └── architecture-loader.js
├── assets/models/
└── tests/
```

## Jest kontrolleri

`tests/gestures.test.html` sayfası eşik histerezisini, jest önceliğini, el kaybını ve landmark eşlemelerini bağımlılıksız biçimde çalıştırır.

## Sınırlar

CDN erişimi ve tarayıcı izinleri gerekir. WebXR ve kamera izni kullanıcı butonuna basınca istenir. Bu proje gerçek Quest 3 cihazında test edilmiş gibi sunulmaz; cihaz, tarayıcı ve CDN erişimiyle ayrıca denenmelidir.
