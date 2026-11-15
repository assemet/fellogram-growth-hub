import type { LegalContent } from "./types";

export const tr: LegalContent = {
  updated: "Son güncelleme",
  agreeStore: "Mağaza oluşturarak şunları kabul edersiniz:",
  privacy: {
    title: "Gizlilik Politikası",
    intro:
      "Fellogram, Telegram içinde çalışan bir sadakat uygulamasıdır. Bu politika neyi topladığımızı, neden topladığımızı, kimin görebildiğini ve nasıl silebileceğinizi açıklar. Bilerek kısa ve sade tuttuk.",
    sections: [
      {
        heading: "Ne topluyoruz",
        bullets: [
          "Uygulamayı açtığınızda Telegram'dan: Telegram kimliğiniz, adınız ve soyadınız, kullanıcı adınız, profil fotoğrafı bağlantınız ve diliniz.",
          "Etkinliğiniz: katıldığınız sadakat kartları, damgalar, kullandığınız ödüller ve teklifler, yaptığınız veya aldığınız davetler.",
          "Bildirimleri açarsanız: bu tercihiniz ve size gönderdiğimiz hatırlatmaların kaydı.",
          "Mağaza sahipleri ve kasiyerler için: mağaza adı, logo, sadakat programı, teklifler, ekip üyeleri ve oluşturduğunuz davetler.",
          "Cihazınızda: oturumunuz ve tercihleriniz (dil, görünüm, yazı boyutu, sesler) Telegram uygulamasının tarayıcı depolama alanında tutulur. Reklam çerezleri veya izleyiciler kullanmıyoruz.",
          "Teknik kayıtlar: barındırma ve veritabanı sağlayıcılarımız, hizmeti güvenli ve çalışır tutmak için standart sunucu kayıtları (IP adresi ve saat gibi) tutar.",
        ],
        paragraphs: [
          "Telefon numaranızı, e-posta adresinizi, konumunuzu, rehberinizi veya ödeme bilgilerinizi istemiyoruz. Kamera yalnızca tarama düğmesine dokunduğunuzda ve yalnızca QR kod okumak için kullanılır; görüntüler kaydedilmez veya yüklenmez.",
        ],
      },
      {
        heading: "Nasıl kullanıyoruz",
        bullets: [
          "Kartlarınızı, damgalarınızı, ödüllerinizi ve tekliflerinizi işletmek için.",
          "Kasiyerlerin sizi tanıyabilmesi için, kartınız olan mağazalara adınızı göstermek için.",
          "Kabul ettiğiniz hatırlatma ve ödül bildirimlerini göndermek için.",
          "Tek kullanımlık QR kodlar ve kullanım sınırları gibi yöntemlerle dolandırıcılığı ve kötüye kullanımı önlemek için.",
          "Hizmeti güvenli tutmak, hataları gidermek ve mesajlarınıza yanıt vermek için.",
        ],
        paragraphs: ["Verilerinizi satmıyoruz ve reklam için kullanmıyoruz."],
      },
      {
        heading: "Kimler görebilir",
        bullets: [
          "Kartınızın bulunduğu mağazalar adınızı, kullanıcı adınızı, damga bakiyenizi ve o mağazadaki etkinliğinizi görür. Diğer mağazalardaki etkinliğinizi görmezler.",
          "Mağaza sahibi ayrıca kasiyerlerinin yaptıklarını, örneğin verilen damgaları ve nasıl verildiğini görür.",
          "Diğer müşteriler verilerinizi göremez.",
          "Bizim adımıza veri işleyen hizmet sağlayıcılar: Supabase (veritabanı ve giriş), Vercel (barındırma) ve Telegram (platform ve bot mesajları); her biri kendi koşullarına tabidir.",
          "Yetkili makamlar, yalnızca yasa gerektirdiğinde.",
        ],
      },
      {
        heading: "Mağazalar da sorumludur",
        paragraphs: [
          "Her mağaza kendi sadakat programını nasıl yürüteceğine kendisi karar verir. Mağazalar yukarıdaki verileri kendi müşterileri için görebilir ve bunları yalnızca o programı yürütmek için kullanmalıdır. Bir mağazanın programıyla ilgili sorular için doğrudan mağazayla iletişime geçin.",
        ],
      },
      {
        heading: "Bildirimler",
        paragraphs: [
          "Mesajlar Telegram botumuzdan gelir ve yalnızca bildirimleri açtıysanız gönderilir. Bunları istediğiniz zaman Ayarlar'dan kapatabilirsiniz. Bir mağaza aynı müşteriye 14 günde en fazla bir hatırlatma gönderebilir.",
        ],
      },
      {
        heading: "Ne kadar saklıyoruz ve nasıl silinir",
        paragraphs: [
          "Hesabınız var olduğu sürece verilerinizi saklarız. İstediğiniz zaman kendiniz silebilirsiniz: Ayarlar → Verilerin → Hesabımı ve verilerimi sil. Bu işlem profilinizi, kartlarınızı, damgalarınızı, geçmişinizi, davetlerinizi ve bildirim kayıtlarınızı canlı sistemden hemen kaldırır ve geri alınamaz.",
          "Yalnızca bir mağazanın kartını kaldırırsanız, o mağaza geçmiş damga kaydını saklar; her şeyi silmek için hesabınızı silin. Bir mağaza sahibi mağazasını silerse, programı ve o mağazanın tüm kartları silinir.",
          "Veritabanı sağlayıcımızın tuttuğu yedekler normal döngüsünde üzerine yazılır ve ardından veriler kaybolur. Teknik kayıtlar sağlayıcılarımızda kısa süre tutulur.",
        ],
      },
      {
        heading: "Seçimleriniz ve haklarınız",
        paragraphs: [
          "Verilerinize erişmeyi, düzeltmeyi veya silmeyi isteyebilir ya da kullanımına itiraz edebilirsiniz. Silme uygulamada mevcuttur; diğer talepler için bizimle iletişime geçin. Yaşadığınız yere bağlı olarak GDPR veya benzeri yasalar size bu hakları verebilir ve bu talepleri herkes için aynı şekilde ele alırız.",
        ],
      },
      {
        heading: "Güvenlik",
        paragraphs: [
          "Bağlantılar şifrelidir. Erişim kuralları müşterilerin yalnızca kendi verilerini görmesini sağlar ve QR kodlar tek kullanımlık ve kısa ömürlüdür. Hiçbir sistem mükemmel derecede güvenli değildir, bu nedenle mutlak güvenlik vaat edemeyiz.",
        ],
      },
      {
        heading: "Diğer ülkeler",
        paragraphs: ["Sağlayıcılarımız verileri sizin ülkenizden başka ülkelerde işleyebilir."],
      },
      {
        heading: "Çocuklar",
        paragraphs: [
          "Fellogram, 13 yaşın altındaki veya Telegram'ın ya da yerel yasanızın gerektirdiği yaşın altındaki çocuklar için tasarlanmamıştır. İzinsiz olarak bir çocuğa ait veri tuttuğumuzu öğrenirsek sileriz.",
        ],
      },
      {
        heading: "Değişiklikler",
        paragraphs: ["Bu politikayı değiştirirsek yukarıdaki tarihi güncelleriz ve değişiklik önemliyse uygulama içinde size bildiririz."],
      },
    ],
    contact: {
      heading: "İletişim",
      withEmail: "Verilerinizle ilgili sorular veya talepler: {email}",
      withoutEmail: "Verilerinizle ilgili sorular veya talepler: uygulamadaki Yardım ve SSS sayfasını kullanın.",
    },
  },
  terms: {
    title: "Kullanım Koşulları",
    intro: "Bu koşullar, dijital sadakat kartları için Telegram uygulaması ve botu olan Fellogram'ı kullandığınızda geçerlidir. Kullanarak bunları kabul etmiş olursunuz. Kabul etmiyorsanız lütfen kullanmayın.",
    sections: [
      {
        heading: "Fellogram nedir",
        paragraphs: [
          "Fellogram, mağazaların Telegram içinde dijital sadakat kartları işletmesini sağlar. Ödülleri ve teklifleri Fellogram değil, mağazalar sunar ve kurallarını onlar belirler. Bir mağaza ile müşterileri arasında olanların tarafı değiliz.",
        ],
      },
      {
        heading: "Hesabınız",
        bullets: [
          "Telegram üzerinden giriş yaparsınız. Hesabınızda olanlardan siz sorumlusunuz, bu yüzden Telegram hesabınızı güvende tutun.",
          "Kişi başına bir hesap, doğru bilgilerle.",
          "Mağazalar bu koşulları işletmeleri adına kabul eder.",
        ],
      },
      {
        heading: "Müşteriler için",
        bullets: [
          "Damgalar ve ödüller her mağaza tarafından belirlenir ve nakit değeri yoktur.",
          "Bir mağaza programını veya tekliflerini değiştirebilir ya da sonlandırabilir; ödüller o mağazanın koşullarına tabidir.",
          "QR kodunuz kişiseldir ve kısa ömürlüdür. Hak etmediğiniz damgaları toplamak için kullanmayın.",
        ],
      },
      {
        heading: "Mağazalar ve çalışanları için",
        bullets: [
          "Programınızdan, tekliflerinizden, vaat ettiğiniz ödüllerden ve kasiyerlerinizin davranışından siz sorumlusunuz. Sunduğunuz ödüllerin sözünü tutun.",
          "Damgayı yalnızca gerçek alışveriş veya ziyaretler için verin. Orada olmayan kişilere damga vermeyin ve yalnızca güvendiğiniz kişileri davet edin.",
          "Müşteri verilerini yalnızca Gizlilik Politikası'nda açıklandığı gibi sadakat programınızı yürütmek için kullanın ve size uygulanan yasalara uyun.",
        ],
      },
      {
        heading: "Kabul edilebilir kullanım",
        lead: "Şunları yapmamayı kabul edersiniz:",
        bullets: [
          "Damgaları taklit etmek, yapay olarak biriktirmek veya alıp satmak; damga almak için QR kodları yeniden kullanmak ya da paylaşmak.",
          "Bot veya betik kullanmak, hizmetten veri kazımak, hizmeti kırmaya, aşırı yüklemeye veya tersine mühendisliğe tabi tutmaya çalışmak.",
          "Başkalarının verilerine erişmek veya birini taklit etmek.",
          "Mağaza adları veya teklifler gibi yasa dışı, saldırgan ya da yanıltıcı içerik yayımlamak.",
          "Hatırlatmaları spam için kullanmak.",
        ],
      },
      {
        heading: "Ücretli planlar",
        paragraphs: ["Fellogram şu anda ücretsizdir. Ücretli planlar getirirsek, herhangi bir ücret almadan önce size haber veririz ve devam etmemeyi seçebilirsiniz."],
      },
      {
        heading: "Erişilebilirlik ve değişiklikler",
        paragraphs: [
          "Hizmet olduğu gibi ve mevcut olduğu ölçüde sunulur. Özellikleri değiştirebilir, duraklatabilir veya kaldırabiliriz ve önemli değişiklikleri önceden bildirmeye çalışırız.",
        ],
      },
      {
        heading: "Askıya alma ve sona erdirme",
        paragraphs: [
          "Bu koşulları ihlal eden veya başkalarını riske atan hesapları ya da mağazaları askıya alabilir veya kaldırabiliriz. Hesabınızı istediğiniz zaman Ayarlar'dan silebilirsiniz; verileriniz bu durumda Gizlilik Politikası'nda açıklandığı gibi işlenir.",
        ],
      },
      {
        heading: "Sorumluluk",
        paragraphs: [
          "Yasanın izin verdiği ölçüde; dolaylı zararlardan, kâr kaybından veya veri kaybından ve mağazaların ya da müşterilerin yaptıklarından veya yapmadıklarından sorumlu değiliz. Size karşı toplam sorumluluğumuz, önceki 12 ayda bize ödediğiniz tutarla sınırlıdır ve bu şu anda sıfırdır. Burada hiçbir şey yasanın sınırlamaya izin vermediği hakları sınırlamaz.",
        ],
      },
      {
        heading: "Bu koşullardaki değişiklikler",
        paragraphs: ["Bu koşulları değiştirirsek yukarıdaki tarihi güncelleriz. Bir değişiklikten sonra Fellogram'ı kullanmaya devam etmeniz yeni koşulları kabul ettiğiniz anlamına gelir."],
      },
    ],
    contact: {
      heading: "İletişim",
      withEmail: "Bu koşullarla ilgili sorular: {email}",
      withoutEmail: "Bu koşullarla ilgili sorular: uygulamadaki Yardım ve SSS sayfasını kullanın.",
    },
  },
};
