# İnteraktiv Siyər Xəritəsi

Həzrət Məhəmmədin (s.ə.s.) həyatının Məkkədə doğumundan (təxm. 570) Mədinədə vəfatına (632) qədər interaktiv zaman xətti və xəritəsi.

- **Aşağıdakı zaman xəttini sürüşdürün** (və ya çarxı fırladın, ← / → düymələrindən, ya da oynat düyməsindən istifadə edin) — xəritə ardınca gəlir: hadisə ikonları görünür, səfər yolları çəkilir, kamera hadisənin baş verdiyi yerə yaxınlaşır.
- İslam hər bölgəyə çatdıqca **açıq yaşıl ton** Ərəbistan boyunca (və erkən sığınacaq üçün Həbəşistanda) yayılır.
- Xəritədəki və ya zaman xəttindəki istənilən hadisəyə klikləyin. `#hijra` kimi linklər birbaşa hadisəni açır.

Sadə HTML/CSS/JS-dir, işə salmaq üçün build tələb olunmur.

## Lokal işə salmaq

```bash
python3 -m http.server 8000   # sonra http://localhost:8000 ünvanını açın
```

## Zaman xəttinə əlavə etmək

Bütün məzmun [`js/data.js`](js/data.js) faylındadır:

| Nə | Harada |
| --- | --- |
| Hadisələr (başlıq, tarix, mətn, yer, kateqoriya, könüllü səfər yolu) | `SEERAH.events` |
| Yerlərin koordinatları | `SEERAH.places` |
| Yaşıl tonlanan bölgələr və görünmə vaxtı | `SEERAH.regions` |
| Xəritə yazıları | `SEERAH.labels` |

`START` və `END` ilk və son hadisədən götürülür, ona görə zaman xəttini sonradan genişləndirmək üçün hadisələri (və bölgələri) ardıcıllıqla əlavə etmək kifayətdir. Hadisələr xəritənin hüdudlarından kənara çıxarsa, `SEERAH.PROJ` dəyərlərini və `tools/build-land.mjs` faylının başındakı uyğun sabitləri dəyişib baza xəritəsini yenidən yaradın:

```bash
npm install
npm run build:map   # js/land.js faylını Natural Earth (world-atlas) məlumatlarından yenidən yaradır
```

## Yayımlama

GitHub Pages `main` budağından (kök qovluq) yayımlanır, yəni `main`-ə hər push saytı yeniləyir.

## Dəqiqlik haqqında

Hicrətdən əvvəlki tarixlər təxminidir və alimlər bir sıra tarixlərdə fərqli fikirdədirlər; bölgə tonları və səfər yolları qəsdən sadə illüstrasiyadır, dəqiq sərhəd deyil. Düzəliş üçün zəhmət olmasa issue açın.
