'use strict';
/* ================= BKM Door – saha uygulaması ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const trDate = s => s ? s.split('-').reverse().join('.') : '';
const CUR = { TL: '₺', USD: '$', EUR: '€' };
const money = (v, c = 'TL') => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0) + ' ' + (CUR[c] || c);
const n2 = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(v || 0);

/* ---------------- IndexedDB ---------------- */
const STORES = ['olculer', 'teklifler', 'servisler', 'notlar', 'modeller', 'musteriler'];
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('bkmdoor', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv', { keyPath: 'k' }); STORES.forEach(s => d.createObjectStore(s, { keyPath: 'id' })); };
      r.onsuccess = () => { DB.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(s, m, fn) { return new Promise((res, rej) => { const t = DB.db.transaction(s, m); const st = t.objectStore(s); const q = fn(st); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); },
  all(s) { return DB.tx(s, 'readonly', st => st.getAll()); },
  get(s, id) { return DB.tx(s, 'readonly', st => st.get(id)); },
  put(s, o) { return DB.tx(s, 'readwrite', st => st.put(o)); },
  del(s, id) { return DB.tx(s, 'readwrite', st => st.delete(id)); },
  clear(s) { return DB.tx(s, 'readwrite', st => st.clear()); }
};

/* ---------------- Ayarlar ---------------- */
const DEF = {
  k: 'ayar',
  unvan: 'BKM Door Otomatik Kapı Sistemleri',
  yetkili: 'Bilal Bekem',
  adres: 'İvedik OSB Mah. Melih Gökçek Bulvarı No:17/195\nYenimahalle / ANKARA',
  tel: '0537 290 69 92',
  eposta: 'info@bkmdoor.com',
  web: 'www.bkmdoor.com',
  vd: 'İvedik',
  vkn: '12484262324',
  iban: '',
  banka: '',
  logo: null, kase: null,
  kdv: 20,
  para: 'TL',
  gecerlilik: 15,
  teklifSart: 'Fiyatlarımıza KDV dahil değildir.\nTeslim süresi sipariş onayından itibaren 10-15 iş günüdür.\nSiparişte %50 peşinat, kalan tutar montaj sonrası tahsil edilir.\nÜrünlerimiz 2 yıl garantilidir.\nElektrik tesisatı ve inşai işler (kırım, sıva, boya) müşteriye aittir.',
  servisSart: 'Garanti kapsamında olmayan servisler ücretlidir.\nFiyatlarımıza KDV dahil değildir.',
  hizmetler: 'Garaj Kapıları · Endüstriyel Kapılar · Hızlı PVC Kapılar · Yükleme Sistemleri · Bahçe Kapıları · Otomatik Bariyer Sistemleri · Otomatik Kepenk Sistemleri · Fotoselli Kayar Kapılar · Pencere Panjurları · Alüminyum Doğrama',
  teklifNo: 2347, servisNo: 9, olcuNo: 1, kkOran: 4, ver: 2,
  hatirlatSaat: '08:30',
  seeded: false
};
let S = { ...DEF };
async function loadS() { const s = await DB.get('kv', 'ayar'); S = { ...DEF, ...(s || {}) }; }
async function saveS() { await DB.put('kv', S); }

/* ---------------- Ürün formları ---------------- */
const RENK = ['RAL 7016 Antrasit', 'RAL 9016 Beyaz', 'RAL 9002', 'RAL 9006 Gri', 'Galvaniz', 'Ahşap desen'];
const BR_MODEL = { BFT: ['Giotto', 'Moovie'], Nice: ['Wide M', 'Wide S', 'Wide L', 'M-Bar'] };
const BH_MODEL = { BFT: ['BTB400', 'BTB600', 'Ares 1000', 'Ares 1500', 'Icaro Veloce 1000', 'Icaro Veloce 2000', 'Icaro 2000', 'Phobos B25 (90°)'], Nice: ['Run 600', 'Robus 600', 'Run 600 HS', 'Run 1000', 'Robus 1000', 'Robus 1500', 'Run 1500', 'Run 2000', 'Run 2500', 'Run 1500 HS'] };
const GEN = { k: 'gen', l: 'Genişlik', t: 'num', u: 'mm' }, YUK = { k: 'yuk', l: 'Yükseklik', t: 'num', u: 'mm' };
const FORMS = {
  kepenk: { ad: 'Kepenk', ico: '🏪', f: [GEN, YUK,
    { k: 'dikme', l: 'Dikme', t: 'combo', o: [] },
    { k: 'kutu', l: 'Kutu (mm)', t: 'combo', o: ['205', '250', '300', '350'] },
    { k: 'boydan', l: 'Boydan profil', t: 'bool' },
    { k: 'motor', l: 'Motor yönü', t: 'sel', o: ['Sağ', 'Sol'] },
    { k: 'kutuKapat', l: 'Kutu kapatma (ön-arka kapaklı)', t: 'bool' },
    { k: 'kumanda', l: 'Kumanda', t: 'cnt' },
    { k: 'fotosel', l: 'Emniyet fotoseli', t: 'bool' },
    { k: 'renk', l: 'Renk', t: 'combo', o: RENK }] },
  seksiyonel: { ad: 'Seksiyonel', ico: '🚪', f: [GEN, YUK,
    { k: 'yatak', l: 'Yataklama', t: 'sel', o: ['STD', 'HL', 'VL'] },
    { k: 'hl', l: 'HL/VL ölçüsü', t: 'num', u: 'mm', showIf: f => f.yatak === 'HL' || f.yatak === 'VL' },
    { k: 'korkasa', l: 'Kör kasa', t: 'bool' },
    { k: 'renk', l: 'Renk', t: 'combo', o: ['RAL 9002', 'RAL 9016', 'RAL 7016', 'Ahşap desen'] },
    { k: 'pencere', l: 'Pencere', t: 'cnt' },
    { k: 'personel', l: 'Personel kapısı', t: 'sel', o: ['Yok', 'Sağ', 'Sol', 'Orta'] },
    { k: 'fotosel', l: 'Emniyet fotoseli', t: 'bool' },
    { k: 'pnomatik', l: 'Pnömatik emniyet', t: 'bool' },
    { k: 'kumanda', l: 'Kumanda', t: 'cnt' }] },
  bariyer: { ad: 'Bariyer', ico: '🚧', f: [
    { k: 'marka', l: 'Marka', t: 'sel', o: ['BFT', 'Nice'] },
    { k: 'model', l: 'Model', t: 'sel', o: f => BR_MODEL[f.marka] || [], showIf: f => f.marka },
    { k: 'kol', l: 'Kol uzunluğu', t: 'num', u: 'mt' },
    { k: 'kumanda', l: 'Kumanda', t: 'cnt' },
    { k: 'perde', l: 'Bariyer perdesi', t: 'bool' }] },
  bahce: { ad: 'Bahçe kapısı', ico: '🏡', f: [
    { k: 'gramiyer', l: 'Gramiyer dişli', t: 'num', u: 'mt', showIf: f => !/Phobos/.test(f.model || '') },
    { k: 'marka', l: 'Marka', t: 'sel', o: ['BFT', 'Nice'] },
    { k: 'model', l: 'Motor modeli', t: 'sel', o: f => BH_MODEL[f.marka] || [], showIf: f => f.marka },
    { k: 'kumanda', l: 'Kumanda', t: 'cnt' }] },
  pvc: { ad: 'Hızlı PVC', ico: '⚡', f: [GEN, YUK,
    { k: 'tip', l: 'Tip', t: 'sel', o: ['Katlanır', 'Sarmal'] },
    { k: 'motor', l: 'Motor yönü', t: 'sel', o: ['Sağ', 'Sol'] },
    { k: 'branda', l: 'Branda rengi', t: 'combo', o: ['Beyaz', 'Gri', 'Mavi', 'Sarı', 'Turuncu', 'Kırmızı', 'Yeşil'] },
    { k: 'pencere', l: 'Göz hizası pencere', t: 'bool' },
    { k: 'kumandaVar', l: 'Kumanda', t: 'bool' },
    { k: 'kumanda', l: 'Kumanda adedi', t: 'cnt', showIf: f => f.kumandaVar }] },
  yangin: { ad: 'Yangın kapısı', ico: '🔥', f: [GEN, YUK,
    { k: 'kanat', l: 'Kanat', t: 'sel', o: ['Tek', 'Çift'] },
    { k: 'kasa', l: 'Kasa', t: 'sel', o: ['Yarım kasa', 'Tam kasa'] },
    { k: 'duvar', l: 'Duvar kalınlığı', t: 'num', u: 'cm' },
    { k: 'acilis', l: 'Açılış yönü', t: 'sel', o: ['Sağ', 'Sol'] },
    { k: 'dayanim', l: 'Dayanım', t: 'sel', o: ['60 dk', '90 dk', '120 dk'] },
    { k: 'belge', l: 'Belge', t: 'sel', o: ['Belgeli', 'Belgesiz'] },
    { k: 'menfez', l: 'Menfezli', t: 'bool' },
    { k: 'renk', l: 'Renk', t: 'combo', o: ['RAL 7016', 'RAL 9002', 'RAL 9016'] }] },
  fotoselli: { ad: 'Fotoselli kapı', ico: '🚶', f: [GEN, YUK,
    { k: 'kanat', l: 'Kanat', t: 'sel', o: ['Tek', 'Çift'] },
    { k: 'renk', l: 'Renk', t: 'combo', o: ['RAL 7016 Antrasit Gri', 'RAL 9016 Beyaz', 'Eloksal'] },
    { k: 'folyo', l: 'Cam antrasit folyo kaplı', t: 'bool' },
    { k: 'cip', l: 'Çip okuyucu cihaz', t: 'bool' },
    { k: 'cipAdet', l: 'Manyetik çip', t: 'cnt', showIf: f => f.cip },
    { k: 'sokum', l: 'Mevcut doğrama söküm', t: 'bool' }] },
  panjur: { ad: 'Panjur', ico: '🪟', f: [GEN, YUK,
    { k: 'renk', l: 'Renk', t: 'combo', o: ['RAL 7016 Antrasit Gri', 'RAL 9016 Beyaz'] },
    { k: 'kontrol', l: 'Kontrol', t: 'sel', o: ['Sıva üstü buton', 'Kumanda'] }] },
  zip: { ad: 'Zip perde', ico: '🎞', f: [GEN, YUK,
    { k: 'kumas', l: 'Kumaş rengi', t: 'combo', o: ['Antrasit Gri', 'Beyaz', 'Bej', 'Siyah'] },
    { k: 'kontrol', l: 'Kontrol', t: 'sel', o: ['Grup kumandalı', 'Tekli kumanda'] }] }
};
const KATS = { ...Object.fromEntries(Object.entries(FORMS).map(([k, v]) => [k, v.ad])), tamir: 'Tamir / Tadilat', aksesuar: 'Aksesuar / İşçilik' };
const opts = (fd, f) => typeof fd.o === 'function' ? fd.o(f) : fd.o;
const visible = (fd, f) => !fd.showIf || fd.showIf(f);

function ozet(tip, f, kisa) {
  const F = FORMS[tip]; if (!F) return '';
  const p = [];
  if (f.gen || f.yuk) p.push(`${f.gen || '?'} × ${f.yuk || '?'} mm`);
  F.f.forEach(fd => {
    if (fd.k === 'gen' || fd.k === 'yuk' || fd.k === 'kumandaVar' || !visible(fd, f)) return;
    const v = f[fd.k];
    if (fd.t === 'bool') { if (v) p.push(fd.l); }
    else if (fd.t === 'cnt') { if (num(v) > 0) p.push(`${fd.l}: ${v} adet`); }
    else if (fd.k === 'marka') { if (v && !kisa) p.push(v + (f.model ? ' ' + f.model : '')); }
    else if (fd.k === 'model') { }
    else if (v !== undefined && v !== '' && !(fd.k === 'personel' && v === 'Yok')) p.push(`${fd.l}: ${v}${fd.u ? ' ' + fd.u : ''}`);
  });
  return p.join(' · ');
}
const alan = f => (num(f.gen) && num(f.yuk)) ? num(f.gen) * num(f.yuk) / 1e6 : 0;

/* Teklifteki kırmızı ölçü satırı (senin formatın: "5000 x 5000 HL 2200mm") */
function olcuSatiri(tip, f) {
  if (!f || !(f.gen || f.yuk)) return '';
  let s = `${f.gen || '?'} x ${f.yuk || '?'} mm`;
  if (tip === 'seksiyonel' && f.yatak) s = `${f.gen} x ${f.yuk} ${f.yatak}${f.hl ? ' ' + f.hl + 'mm' : ''}`;
  if (tip === 'yangin' && f.kanat) s += ` ${f.kanat === 'Tek' ? 'TEK' : 'ÇİFT'} KANAT${f.menfez ? ' MENFEZLİ' : ''}`;
  if (tip === 'fotoselli' && f.kanat) s += ` ${f.kanat} Hareketli Kanat`;
  return s;
}
/* Ölçüdeki seçimlerden otomatik teknik satırlar */
function ekSatirlar(tip, f) {
  if (!f) return [];
  const L = [], n = k => num(f[k]);
  const kum = n('kumanda') > 0 ? (f.marka === 'Nice' ? `Nice Kumanda ${n('kumanda')} Adet` : `Mitto 2G Kumanda ${n('kumanda')} Adet`) : '';
  if (tip === 'kepenk') { if (f.kutuKapat) L.push('Ön Arka Kutulu , Kapaklı'); if (f.boydan) L.push('Boydan Profil'); if (f.dikme) L.push('Dikme: ' + f.dikme); if (f.kutu) L.push(`Kutu: ${f.kutu} mm`); if (f.motor) L.push(`Motor Yönü: ${f.motor}`); if (n('kumanda')) L.push(`${n('kumanda')} ad Kumanda`); if (f.fotosel) L.push('Emniyet Fotoseli'); }
  if (tip === 'seksiyonel') { if (f.fotosel) L.push('COMPACTO EMNİYET FOTOSELİ'); if (n('kumanda')) L.push(`MİTTO 2G KUMANDA ${n('kumanda')} ADET`); if (f.pnomatik) L.push('PNÖMATİK EMNİYET SİSTEMİ'); if (f.personel && f.personel !== 'Yok') L.push(`PERSONEL GEÇİŞ KAPISI (${f.personel.toLocaleUpperCase('tr')})`); if (n('pencere')) L.push(`${n('pencere')} ADET PENCERE`); if (f.korkasa) L.push('KÖR KASA MONTAJI'); }
  if (tip === 'bariyer') { if (kum) L.push(kum); if (n('kol')) L.push(`${f.kol}mt Bariyer Kolu`); if (f.perde) L.push('Bariyer Perdesi'); }
  if (tip === 'bahce') { if (kum) L.push(kum); if (n('gramiyer') && !/Phobos/.test(f.model || '')) L.push(`${f.gramiyer}mt Gramiyer Dişli`); }
  if (tip === 'pvc') { if (f.branda) L.push(`${f.branda} Renk ( Branda )`); if (f.pencere) L.push('Göz Hizası Şeffaf Cam'); if (f.motor) L.push(`Motor Yönü: ${f.motor}`); if (f.kumandaVar && n('kumanda')) L.push(`${n('kumanda')} Adet Kumanda`); }
  if (tip === 'yangin') { if (f.dayanim) L.push(`${parseInt(f.dayanim)} DK YANGINA DAYANIMLI`); if (f.kasa === 'Yarım kasa') L.push('YARIM KASA'); if (f.kasa === 'Tam kasa') L.push(`TAM KASA${f.duvar ? ' ' + f.duvar + ' CM' : ''}`); if (f.acilis) L.push(`AÇILIŞ YÖNÜ: ${f.acilis.toLocaleUpperCase('tr')}`); }
  if (tip === 'fotoselli') { if (f.folyo) L.push('Cam Antrasit Folyo Kaplı'); if (f.cip) L.push('Çip Okuyucu Cihaz'); if (f.cip && n('cipAdet')) L.push(`${n('cipAdet')} Adet Manyetik Chip`); if (f.sokum) L.push('Mevcut Doğrama Söküm'); }
  if (tip === 'panjur') { if (f.kontrol === 'Kumanda') L.push('Kumandalı'); }
  if (tip === 'zip') { if (f.kumas) L.push(`${f.kumas.toLocaleUpperCase('tr')} KUMAŞ`); if (f.kontrol) L.push(f.kontrol.toLocaleUpperCase('tr')); }
  return L;
}
/* Model teknik yazısını ölçü seçimlerine göre uyarlar (renk, belge, branda) */
function teknikSatirlar(l) {
  let L = String(l.teknik || '').split('\n').map(s => s.trim()).filter(Boolean);
  const f = l.f || {};
  if (f.renk) { const r = /RAL\s?\d{4}[^\n]*/i; let done = false; L = L.map(s => { if (!done && r.test(s) && /RAL/i.test(f.renk)) { done = true; return s.replace(/RAL\s?\d{4}( Antrasit Gri| Antrasit| Beyaz| Gri)?/i, f.renk.toLocaleUpperCase('tr') === f.renk ? f.renk : f.renk); } return s; }); if (!done) L.push(`${f.renk} Boyalı`); }
  if (f.belge === 'Belgesiz') L = L.filter(s => !/BELGEL/i.test(s));
  if (l.kat === 'pvc' && f.branda) L = L.filter(s => !/Renk \( Branda \)/i.test(s));
  return [...L, ...ekSatirlar(l.kat, f)];
}

/* ---------------- Model kütüphanesi (senin tekliflerinden) ---------------- */
function seedModels() {
  const L = [];
  const add = (kat, ad, konu, teknik, fiyat, para, resim, birim = 'Adet') => L.push({ id: uid(), kat, ad, konu, teknik: teknik.trim(), fiyat, para, resim: resim ? 'img/urun/' + resim + '.jpg' : '', birim });
  const SEKS = `PANEL KALINLIĞI 42mm\nSEKSİYONEL KAPI RAL 9002\n0,5MM ÖN VE ARKA SAC +2MM DESTEK SACI DONANIM : DOCO ( ALMANYA )\nYAY ÖMRÜ : 20.000 TUR ( POLONYA )\nKALİTE BELGELERİ : CE – TSE – İSO9001`;
  add('seksiyonel', 'Endüstriyel Seksiyonel Kapı', 'Endüstriyel Seksiyonel Kapı', SEKS + '\nFORCE MOTOR 380V\n380V KONTROL PANOSU', 3200, 'EUR', 'seksiyonel');
  add('seksiyonel', 'Garaj Tipi Seksiyonel Kapı', 'Garaj Tipi Seksiyonel Kapı', SEKS.replace('42mm', '40mm') + '\nİTALYAN BFT BOTTİCELLİ 24v MOTOR\nZİNCİR’Lİ ORTA KONSOL', 1450, 'EUR', 'garaj');
  add('kepenk', 'Çelik Sarmal Kepenk', 'Sarmal Çelik Kepenk', 'Galvaniz Çelik Lamel\nRedüktörlü Motor\nRal 7016 Boyalı\nManuel Açma Kolu', 32000, 'TL', 'kepenk');
  add('kepenk', 'Alüminyum Poliüretan Dolgulu Kepenk', 'Alüminyum Kepenk', 'Poliüretan Dolgulu Alüminyum Lamel\nBoru Motor\nRal 7016 Boyalı\nManuel Açma Kolu', '', 'TL', 'kepenk');
  add('panjur', 'Sarmal Poliüretan Dolgulu Panjur', 'Sarmal Poliüretan Dolgulu Panjur', 'Mosel Motorlu\nKutu Kapaklı Alüminyum Ral Boyalı\nDikme Alüminyum Ral Boyalı\nSıva Üstü Butonlu\n55’lik Lamel Ral 7016 Antrasit Gri', '', 'EUR', 'panjur');
  const BRS = 'Compacto Emniyet Fotoseli\n24v Bft Flaşör Lamba\nÇatal Sabit Ayak';
  add('bariyer', 'İtalyan BFT Giotto Bariyer', 'Kollu Otomatik Bariyer', BRS, 950, 'EUR', 'bariyer');
  add('bariyer', 'İtalyan BFT Moovie Bariyer', 'Kollu Otomatik Bariyer', BRS, '', 'EUR', 'bariyer');
  ['Wide M', 'Wide S', 'Wide L', 'M-Bar'].forEach(m => add('bariyer', `İtalyan Nice ${m} Bariyer`, 'Kollu Otomatik Bariyer', 'Emniyet Fotoseli\n24v Nice Flaşör Lamba\nÇatal Sabit Ayak', '', 'EUR', 'bariyer'));
  BH_MODEL.BFT.forEach(m => {
    if (/Phobos/.test(m)) add('bahce', 'İtalyan BFT Phobos B25 24v Motor', '90 Derece Bahçe Kapısı Motoru', 'Compacto Emniyet Fotoseli\n24v Bft Flaşör Lamba\nBFT Kontrol Panosu', '', 'EUR', 'phobos');
    else add('bahce', `İtalyan BFT ${m.replace(' ', '')} 24v Motor`, 'Bahçe Kapısı Motoru', 'Compacto Emniyet Fotoseli\n24v Bft Flaşör Lamba', /Ares 1000/.test(m) ? 26500 : '', 'TL', 'bahce');
  });
  BH_MODEL.Nice.forEach(m => add('bahce', `İtalyan Nice ${m} Motor`, 'Bahçe Kapısı Motoru', 'Emniyet Fotoseli\n24v Nice Flaşör Lamba', '', 'TL', 'bahce'));
  const PVC = 'Mehler(ALMAN) Marka Alev Yürümez Branda TEK Kat\nEmniyet Fotoseli\n380v Endüstriyel Hızlı Motor ve Kontrol Ünitesi\nSıva Üstü Kontrol Butonu';
  add('pvc', 'Katlanır Tip Hızlı Pvc Kapı', 'Katlanır Tip Hızlı PVC Kapı', PVC, 6750, 'EUR', 'pvc-katlanir');
  add('pvc', 'Sarmal Tip Hızlı Pvc Kapı', 'Sarmal Tip Hızlı PVC Kapı', PVC, '', 'EUR', 'pvc-sarmal');
  const YG = 'KASA KALINLIĞI 1.2mm\nKANAT KALINLIĞI 1mm\nİÇTEN PANİK BAR DIŞTAN KİLİTLİ KOL\nRAL 7016 BOYALI\nTSE CE EI30 EI90 EI120 BELGELİ';
  add('yangin', 'Yangına Dayanımlı Kapı – Tek Kanat', 'Yangına Dayanımlı Kapı', YG, 12600, 'TL', 'yangin-tek');
  add('yangin', 'Yangına Dayanımlı Kapı – Çift Kanat', 'Yangına Dayanımlı Kapı', YG, '', 'TL', 'yangin-cift');
  const FT = '24v DC Motor\nFonksiyonel Konum Anahtarı\nRal 7016 Antrasit Gri\nNokta Emniyet Fotoseli\nGiriş Çıkış Radar Hareket Sensörü\n4+4 Şeffaf Lamine Cam';
  add('fotoselli', 'Tek Kanat Fotoselli Kapı', 'Tek Kanat Fotoselli Kapı', FT, 33000, 'TL', 'fotoselli-tek');
  add('fotoselli', 'Çift Kanat Fotoselli Kapı', 'Çift Kanat Fotoselli Kapı', FT, 60000, 'TL', 'fotoselli-cift');
  add('zip', 'Zip Perde', 'Zip Perde', 'SOMFY MOTORLU\nKUTU DİKME ALÜMİNYUM\nRAL BOYALI\nFERMUARLI SİSTEM\nKUMAŞ COPACO ( BELÇİKA )', 415, 'EUR', 'zip');
  add('tamir', 'Beam Nokta Emniyet Fotoseli', 'Tamir Ve Tadilat', '', 8500, 'TL', 'tamir', 'Takım');
  add('tamir', 'Servis / Arıza Tespiti', 'Tamir Ve Tadilat', '', '', 'TL', 'tamir');
  add('aksesuar', 'Mitto 2G Kumanda', 'Aksesuar', '', '', 'TL', '');
  add('aksesuar', 'Compacto Emniyet Fotoseli', 'Aksesuar', '', '', 'TL', '');
  add('aksesuar', 'Gramiyer Dişli', 'Aksesuar', '', '', 'TL', '', 'Mt');
  add('aksesuar', '40x100x2mm Kör Kasa', 'Aksesuar', '', '', 'TL', '');
  add('aksesuar', 'Montaj ve İşçilik', 'Montaj', '', '', 'TL', '');
  return L;
}


/* ---------------- State ---------------- */
let D = null, DS = null;           // düzenlenen kayıt ve deposu
let MODELS = [];
let UI = {};                       // ekran içi durum (açık kartlar vb.)
let saveT = null;

function setPath(o, p, v) { const ks = p.split('.'); let c = o; for (let i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null) c[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; c = c[ks[i]]; } c[ks.at(-1)] = v; }
function getPath(o, p) { return p.split('.').reduce((c, k) => c == null ? c : c[k], o); }
function queueSave() { clearTimeout(saveT); saveT = setTimeout(saveNow, 350); }
async function saveNow() {
  clearTimeout(saveT); if (!D || !DS) return;
  D.upd = Date.now();
  await DB.put(DS, JSON.parse(JSON.stringify(D)));
  const m = D.musteri;
  if (m && m.ad && m.ad.trim()) {
    const all = await DB.all('musteriler');
    const ex = all.find(x => x.ad.trim().toLocaleLowerCase('tr') === m.ad.trim().toLocaleLowerCase('tr'));
    await DB.put('musteriler', { ...(ex || { id: uid() }), ad: m.ad.trim(), yetkili: m.yetkili || ex?.yetkili || '', tel: m.tel || ex?.tel || '', adres: m.adres || ex?.adres || '' });
  }
}

/* ---------------- UI yardımcıları ---------------- */
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 2200); }
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; document.body.style.overflow = 'hidden'; }
function closeSheet() { $('#sheet').hidden = true; $('#sheetBody').innerHTML = ''; document.body.style.overflow = ''; }
function busy(on, t = 'Hazırlanıyor…') { let b = $('.busy'); if (on) { if (!b) { b = document.createElement('div'); b.className = 'busy'; document.body.append(b); } b.textContent = t; } else b && b.remove(); }
const inp = (p, v, ph = '', extra = '') => `<input class="i" data-b="${p}" value="${esc(v)}" placeholder="${esc(ph)}" ${extra}>`;
const field = (l, html) => `<label class="f"><span>${l}</span>${html}</label>`;
const tog = (l, p, v, r = 1) => `<div class="tog"><span>${l}</span><label class="sw"><input type="checkbox" data-b="${p}" ${v ? 'checked' : ''} ${r ? 'data-r="1"' : ''}><i></i></label></div>`;
const stepper = (p, v) => `<div class="step"><button data-a="inc" data-p="${p}" data-d="-1">−</button><input data-b="${p}" inputmode="numeric" value="${esc(v ?? 0)}"><button data-a="inc" data-p="${p}" data-d="1">+</button></div>`;
const chips = (p, v, o) => `<div class="chips">${o.map(x => `<button class="chip ${v === x ? 'on' : ''}" data-a="set" data-p="${p}" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;

function renderFields(tip, f, base) {
  const F = FORMS[tip]; let h = ''; let pair = [];
  const flush = () => { if (pair.length) { h += `<div class="g2">${pair.join('')}</div>`; pair = []; } };
  F.f.forEach(fd => {
    if (!visible(fd, f)) return;
    const p = `${base}.${fd.k}`, v = f[fd.k];
    if (fd.t === 'num') { pair.push(field(`${fd.l} (${fd.u})`, inp(p, v, '0', 'inputmode="decimal"'))); if (pair.length === 2) flush(); return; }
    flush();
    if (fd.t === 'bool') h += tog(fd.l, p, v);
    else if (fd.t === 'cnt') h += `<div class="tog"><span>${fd.l}</span>${stepper(p, v)}</div>`;
    else if (fd.t === 'sel') h += field(fd.l, chips(p, v, opts(fd, f)));
    else if (fd.t === 'combo') h += field(fd.l, (fd.o.length ? chips(p, v, fd.o) + '<div style="height:7px"></div>' : '') + inp(p, v, fd.o.length ? 'veya yazın' : 'Ölçü / tip'));
  });
  flush();
  return h;
}

function musteriBlock(m, opt = {}) {
  m = m || {};
  return `<div class="card">
    <div class="row" style="margin-bottom:8px"><b class="grow">${opt.title || 'Müşteri'}</b><button class="btn ghost" style="min-height:36px;padding:6px 12px" data-a="pickMusteri">Kayıtlılardan seç</button></div>
    ${field(opt.adL || 'Firma / Müşteri adı', inp('musteri.ad', m.ad, 'Örn. Şahinler Sitesi', 'list="mlist" autocomplete="off"'))}
    ${opt.yetkili ? field(opt.yetkiliL || 'Yetkili adı', inp('musteri.yetkili', m.yetkili, opt.yetkiliPh || '')) : ''}
    ${field('Telefon', inp('musteri.tel', m.tel, '05xx xxx xx xx', 'inputmode="tel"'))}
    ${field('Adres', `<textarea class="i" data-b="musteri.adres" style="min-height:60px">${esc(m.adres)}</textarea>`)}
    ${opt.bilgi ? field('Firma bilgileri (VD / VKN vb.)', inp('musteri.bilgi', m.bilgi)) : ''}
  </div>`;
}

/* ================= Ekranlar ================= */
const V = {};

V.home = async () => {
  const [notlar, tek, ser, olc] = await Promise.all([DB.all('notlar'), DB.all('teklifler'), DB.all('servisler'), DB.all('olculer')]);
  const td = today();
  const bug = notlar.filter(n => aktifNot(n, td)).sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
  setBadge(bug.length);
  const ay = td.slice(0, 7);
  const ayT = tek.filter(t => (t.tarih || '').startsWith(ay));
  const onay = ayT.filter(t => t.durum === 'Onaylandı');
  const sum = a => a.reduce((s, t) => s + (t.para === 'TL' || !t.para ? hesap(t).genel : 0), 0);
  const son = [...tek.map(x => ({ ...x, _t: 'teklif' })), ...ser.map(x => ({ ...x, _t: 'servis' })), ...olc.map(x => ({ ...x, _t: 'olcu' }))].sort((a, b) => (b.upd || 0) - (a.upd || 0)).slice(0, 6);
  const gun = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `<div class="hero"><div class="d">${gun}</div><h3>Merhaba Bilal Bey 👋</h3><div class="d" style="margin-top:6px">${bug.length ? `Bugün bakman gereken <b style="color:#fbbf24">${bug.length} not</b> var.` : 'Bugün için bekleyen not yok.'}</div></div>
  <div class="quick">
    <button data-a="yeni" data-s="olculer"><i>📏</i>Yeni ölçü</button>
    <button data-a="yeni" data-s="teklifler"><i>📄</i>Yeni teklif</button>
    <button data-a="yeni" data-s="servisler"><i>🔧</i>Servis formu</button>
  </div>
  <h2>Bugünün notları</h2>
  ${bug.length ? bug.map(noteRow).join('') : `<div class="li" data-a="go" data-h="notlar"><div class="ico">✎</div><div class="grow mut">Not eklemek için dokun</div></div>`}
  <h2>Bu ay</h2>
  <div class="stat"><div><span class="mut sm">Teklif (${ayT.length})</span><b>${money(sum(ayT))}</b></div><div><span class="mut sm">Onaylanan (${onay.length})</span><b style="color:var(--grn)">${money(sum(onay))}</b></div></div>
  <h2>Son işlemler</h2>
  ${son.length ? son.map(x => x._t === 'teklif' ? teklifRow(x) : x._t === 'servis' ? servisRow(x) : olcuRow(x)).join('') : '<div class="empty">Henüz kayıt yok.</div>'}`;
};

/* ---------- Ölçü ---------- */
const olcuRow = o => `<div class="li" data-a="go" data-h="olcu/${o.id}"><div class="ico">📏</div><div class="grow"><b>${esc(o.musteri?.ad || 'İsimsiz ölçü')}</b><span class="mut sm">${trDate(o.tarih)} · ${(o.items || []).map(i => FORMS[i.tip]?.ad).join(', ') || 'ürün yok'}</span></div><span class="mut">›</span></div>`;
V.olculer = async () => {
  const L = (await DB.all('olculer')).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '') || (b.upd || 0) - (a.upd || 0));
  return searchBox() + (L.length ? L.map(olcuRow).join('') : '<div class="empty">Henüz ölçü yok.<br>Sağ alttaki + ile başla.</div>') + `<button class="fab" data-a="yeni" data-s="olculer">+</button>`;
};
V.olcu = async id => {
  await edit('olculer', id); const o = D;
  return `${musteriBlock(o.musteri)}
  <div class="card">${field('Ölçü tarihi', inp('tarih', o.tarih, '', 'type="date"'))}</div>
  <h2>Ürünler (${o.items.length})</h2>
  ${o.items.map((it, i) => itemCard(it, i, 'items')).join('')}
  <div class="card"><b>Ürün ekle</b><div class="chips" style="margin-top:10px">${Object.entries(FORMS).map(([k, v]) => `<button class="chip" data-a="addItem" data-t="${k}">${v.ico} ${v.ad}</button>`).join('')}</div></div>
  <div class="card">${field('Genel not', `<textarea class="i" data-b="not">${esc(o.not)}</textarea>`)}</div>
  <button class="btn acc full" data-a="olcuTeklif">📄 Bu ölçüden teklif hazırla</button>
  <div class="btns"><button class="btn ghost" data-a="olcuPaylas">Ölçü listesini paylaş</button><button class="btn red" data-a="sil">Ölçüyü sil</button></div>`;
};
function itemCard(it, i, arr) {
  const F = FORMS[it.tip]; const open = UI.open?.[it.id] ?? true;
  return `<div class="item"><div class="hd" data-a="toggle" data-id="${it.id}"><span style="font-size:20px">${F.ico}</span><b>${i + 1}. ${F.ad}${num(it.adet) > 1 ? ` × ${it.adet}` : ''}</b><span class="mut">${open ? '▾' : '▸'}</span></div>
  ${open ? `<div style="margin-top:12px">${renderFields(it.tip, it.f, `${arr}.${i}.f`)}
    <div class="tog"><span>Adet</span>${stepper(`${arr}.${i}.adet`, it.adet)}</div>
    ${field('Not', inp(`${arr}.${i}.not`, it.not, 'Bu ürünle ilgili not'))}
    <div class="row"><label class="btn ghost grow" style="min-height:42px">📷 Fotoğraf<input type="file" accept="image/*" data-photo="${arr}.${i}.foto" hidden></label><button class="btn red" style="min-height:42px" data-a="delItem" data-i="${i}">Sil</button></div>
    ${(it.foto || []).length ? `<div class="photos">${it.foto.map((p, k) => `<img src="${p}" data-a="delFoto" data-p="${arr}.${i}.foto" data-k="${k}">`).join('')}</div><div class="mut sm">Silmek için fotoğrafa dokun</div>` : ''}
  </div>` : `<div class="mut sm" style="margin-top:6px">${esc(ozet(it.tip, it.f) || 'Ölçü girilmedi')}</div>`}</div>`;
}

/* ---------- Teklif ---------- */
const BIRIM = ['Adet', 'Takım', 'Mt', 'm²', 'Set'];
function satirMiktar(l) {
  const a = num(l.adet) || 0;
  if (l.birim === 'm²') { const ar = alan(l.f || {}) || num(l.m2); return ar ? Math.round(ar * a * 100) / 100 : a; }
  return a;
}
const gruplar = t => t.secenekli ? (t.gruplar && t.gruplar.length ? t.gruplar : ['Seçenek 1']) : [null];
const grupKalem = (t, g) => (t.kalemler || []).filter(l => !t.secenekli || (num(l.grup) || 0) === g);
function hesapG(t, kal) {
  const ara = kal.reduce((s, l) => s + satirMiktar(l) * num(l.fiyat), 0);
  const isk = 0;
  const mat = ara; const r = 0.20;
  let kdv = 0, genel = mat;
  if (t.kdvMod === 'ekle') { kdv = mat * r; genel = mat + kdv; }
  else if (t.kdvMod === 'dahil') { kdv = mat - mat / (1 + r); }
  return { ara, isk, mat, kdv, genel };
}
function hesap(t) {
  if (t.tip === 'yazi') return { ara: 0, isk: 0, mat: 0, kdv: 0, genel: num(t.yaziTutar) };
  if (!t.secenekli) return hesapG(t, t.kalemler || []);
  const hs = gruplar(t).map((g, i) => hesapG(t, grupKalem(t, i))); return hs.reduce((a, b) => b.genel > a.genel ? b : a, hs[0]);
}
const DUR = { 'Taslak': '', 'Gönderildi': 'b', 'Onaylandı': 'g', 'Reddedildi': 'r' };
const teklifRow = t => `<div class="li" data-a="go" data-h="teklif/${t.id}"><div class="ico">${t.tip === 'yazi' ? '✉️' : '📄'}</div><div class="grow"><b>${esc(t.musteri?.ad || 'İsimsiz teklif')}</b><span class="mut sm">${esc(t.no)} · ${trDate(t.tarih)} <span class="tag ${DUR[t.durum] || ''}">${t.durum || 'Taslak'}</span>${t.secenekli ? ' <span class="tag b">seçenekli</span>' : ''}</span></div><span class="amt">${t.secenekli ? '<span class="mut sm">en çok </span>' : ''}${money(hesap(t).genel, t.para)}</span></div>`;
V.teklifler = async () => {
  const L = (await DB.all('teklifler')).sort((a, b) => (b.no || '').localeCompare(a.no || ''));
  return searchBox() + (L.length ? L.map(teklifRow).join('') : '<div class="empty">Henüz teklif yok.</div>') + `<button class="fab" data-a="yeni" data-s="teklifler">+</button>`;
};

/* --- Şartlar (senin teklif maddelerin) --- */
const SAYI = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'], ONLAR = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
const sayiYazi = n => { n = Math.round(num(n)); if (n <= 0 || n > 99) return String(n); return [ONLAR[Math.floor(n / 10)], SAYI[n % 10]].filter(Boolean).join(' '); };
const SART_DEF = { odeme: '%75', kk: true, teslim: 15, montajYeri: 'Ankara', nakliye: 'dahil', garanti: 'standart', gecerlilik: '', ek: '' };
const GARANTI = {
  standart: '1 YIL süreyle imalat ve montaj hatalarına karşı servis garantili ve 2 YIL süreyle fabrikasyon hatalarına karşı garantilidir. Yedek parça temini 10 YIL süreyle BkmDoor garantisiyle sağlanır. Kullanım hatalarından kaynaklanan arızalar garanti kapsamı dışındadır.',
  '2yil': 'Ürünümüz imalat ve montaj hatalarına karşı 2 (iki) yıl garantilidir. Kullanım hatalarından kaynaklanan arızalar garanti kapsamı dışındadır.',
  '6ay': 'Ürün, 6 AY imalat ve montaj hatalarına karşı servis garantilidir. Kullanım hatalarından kaynaklanan arızalar garanti kapsamı dışındadır.',
  '3ay': 'Ürün, 3 AY imalat ve montaj hatalarına karşı servis garantilidir. Kullanım hatalarından kaynaklanan arızalar garanti kapsamı dışındadır.'
};
const GAR_AD = { standart: '1+2 yıl, 10 yıl parça', '2yil': '2 yıl', '6ay': '6 ay', '3ay': '3 ay (tamir)' };
function sartBolumleri(t) {
  const s = { ...SART_DEF, ...(t.sart || {}) }; const B = [];
  const od = s.odeme === 'fatura' ? 'Faturaya istinaden ödeme tutarı iş tesliminde havale yoluyla ödenecektir.' : s.odeme === '%100' ? 'Siparişle birlikte bedelin tamamı peşin olarak ödenecektir.' : `Siparişle birlikte bedelin ${s.odeme}’${s.odeme === '%50' ? 'si' : 'i'} peşin, kalan tutar ise iş tesliminde havale yoluyla ödenecektir.`;
  const odP = [od]; if (s.kk) odP.push(`Kredi Kartı Tek Çekim Banka Komisyon Bedeli % ${String(S.kkOran || 4).replace('.', ',')}${String(S.kkOran || 4).includes(',') || String(S.kkOran || 4).includes('.') ? '' : ',0'} Hesaplanacaktır.`);
  if (t.para && t.para !== 'TL') odP.push({ red: 'Döviz cinsinden verilen teklifler onaylandığı takdirde, fatura kesim tarihinde Türkiye Cumhuriyet Merkez Bankası (TCMB) döviz satış kuru esas alınacaktır.' });
  B.push(['Ödeme;', odP]);
  if (num(s.teslim)) B.push(['Teslim Süresi;', [`Net ölçülerin alınmasından itibaren ${num(s.teslim)} (${sayiYazi(s.teslim)}) iş günü içinde teslimat yapılacaktır.`]]);
  const nk = { dahil: 'Nakliye ve montaj dahildir.', montajHaric: 'Nakliye dahil, montaj hariçtir.', haric: 'Nakliye ve montaj hariçtir.' }[s.nakliye];
  B.push(['Nakliye ve Montaj Koşulları:', [{ red: `Montaj Yeri ; ${s.montajYeri || 'Ankara'}` }, { red: nk }, 'Körkasa, elektrik tesisatı, makaslı platform ve vinç temini işverene aittir.', { red: 'Montaj sırasında oluşabilecek alçı, sıva, boya vb. tadilat işleri firmamız sorumluluğunda değildir. Tarafımıza ait DEĞİLDİR.' }]]);
  B.push(['Garanti;', [GARANTI[s.garanti] || GARANTI.standart]]);
  const yur = ['Teklifimizin kabul edilmesi durumunda, bir nüshasının \'KABUL EDİLMİŞTİR\' kaşesiyle ve imzalanarak tarafımıza gönderilmesi ve ödemenin yapılması halinde teklif yürürlüğe girer.'];
  const onOdeme = { '%50': 'bedelin %50’si', '%75': 'bedelin %75’i', '%100': 'bedelin tamamı' }[s.odeme];
  if (onOdeme) yur.push(`Siparişinizin imalat planlamasına alınması, ön ödemenin (${onOdeme}) hesabımıza ulaşmasıyla birlikte başlatılmaktadır.`);
  if (num(s.gecerlilik)) yur.push(`Teklifimiz ${num(s.gecerlilik)} (${sayiYazi(s.gecerlilik)}) iş günü geçerlidir.`);
  B.push(['Teklifin Yürürlüğe Girmesi;', yur]);
  if (s.ek && s.ek.trim()) B.push(['Notlar;', s.ek.trim().split('\n')]);
  return B;
}
const sc = (p, v, o, lab) => `<div class="chips">${o.map((x, i) => `<button class="chip ${String(v) === String(x) ? 'on' : ''}" data-a="setx" data-p="${p}" data-v="${esc(x)}">${esc(lab ? lab[i] : x)}</button>`).join('')}</div>`;

V.teklif = async id => {
  await edit('teklifler', id); const t = D; t.sart = { ...SART_DEF, ...(t.sart || {}) };
  const ust = `<div class="card"><div class="row"><b class="grow" style="font-size:18px">No ${esc(t.no)}</b>${t.olcuId ? '<span class="tag b">ölçüden</span>' : ''}</div>
    <div style="margin-top:10px">${chips('durum', t.durum, Object.keys(DUR))}</div>
    <div style="margin-top:10px">${sc('tip', t.tip || 'urun', ['urun', 'yazi'], ['📄 Ürün teklifi', '✉️ Antetli yazı'])}</div></div>
  ${musteriBlock(t.musteri, { yetkili: true, adL: 'Firma adı', yetkiliL: 'Sayın… (hitap)', yetkiliPh: 'Örn. Ayşegül Hanım / Ergin Bey' })}`;
  const alt = `<div class="card">${tog('Kaşe-imza koy', 'kase', t.kase, 1)}</div>
  <button class="btn acc full" data-a="pdf" data-k="teklif">📤 PDF hazırla / WhatsApp</button>
  <div class="btns"><button class="btn ghost" data-a="kopya">Kopyala</button><button class="btn red" data-a="sil">Sil</button></div>`;
  if (t.tip === 'yazi') return ust + `<div class="card">${field('Tarih', inp('tarih', t.tarih, '', 'type="date"'))}
    ${field('Başlık', inp('yaziBaslik', t.yaziBaslik, 'Örn. Onarım fiyat teklifi 2025'))}
    ${field('Metin', `<textarea class="i" data-b="yaziMetin" style="min-height:260px" placeholder="Yazının metni… Paragraflar arasında boş satır bırak.">${esc(t.yaziMetin)}</textarea>`)}
    ${field('Tutar (listede görünür, isteğe bağlı)', inp('yaziTutar', t.yaziTutar, '0', 'inputmode="decimal"'))}
    ${tog('Alta “Fiyatlarımıza KDV dahil değildir” yaz', 'yaziKdvNot', t.yaziKdvNot, 0)}</div>` + alt;
  const G = gruplar(t);
  return ust + `<div class="card"><div class="g2">${field('Tarih', inp('tarih', t.tarih, '', 'type="date"'))}${field('Para birimi', `<select class="i" data-b="para" data-r="1">${['TL', 'EUR', 'USD'].map(x => `<option ${t.para === x ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}</div>
    ${field('Teklif konusu (giriş cümlesinde geçer)', inp('konu', t.konu, 'Örn. Endüstriyel Seksiyonel Kapı'))}
    ${tog('Seçenekli teklif (alternatifler, ayrı toplamlar)', 'secenekli', t.secenekli)}
    ${t.secenekli ? G.map((g, i) => `<div class="row" style="margin-bottom:8px"><span class="tag b">${i + 1}</span>${inp(`gruplar.${i}`, g, `Seçenek ${i + 1} adı (örn. BFT ile)`)}${G.length > 1 ? `<button class="x" data-a="grupSil" data-i="${i}">✕</button>` : ''}</div>`).join('') + `<button class="btn ghost full" data-a="grupEkle">+ Yeni seçenek (son seçeneği kopyala)</button>` : ''}</div>
  ${G.map((g, gi) => `<h2>${t.secenekli ? `Seçenek ${gi + 1}${g ? ' – ' + esc(g) : ''}` : 'Kalemler'} (${grupKalem(t, gi).length})</h2>
    ${(t.kalemler || []).map((l, i) => (!t.secenekli || (num(l.grup) || 0) === gi) ? kalemCard(l, i, t) : '').join('')}
    <div class="btns" style="margin-top:0"><button class="btn ghost" data-a="kalemEkle" data-g="${gi}">+ Ürün ekle</button><button class="btn ghost" data-a="olcudenAktar" data-g="${gi}">📏 Ölçüden aktar</button></div>
    ${t.secenekli ? `<div class="card" style="margin-top:8px">${totsHTML(t, hesapG(t, grupKalem(t, gi)))}</div>` : ''}`).join('')}
  <div class="card" style="margin-top:12px">
    <div class="tog"><span>KDV %20 ekle</span><label class="sw"><input type="checkbox" data-a="kdvTog" ${t.kdvMod === 'ekle' ? 'checked' : ''}><i></i></label></div>
    ${t.secenekli ? '' : `<div id="tots">${totsHTML(t, hesap(t))}</div>`}</div>
  <h2>Şartlar</h2>
  <div class="card">
    <div class="row" style="margin-bottom:10px"><span class="mut sm grow">Hazır şablon:</span><button class="chip" data-a="sartSablon" data-v="urun">Ürün</button><button class="chip" data-a="sartSablon" data-v="tamir">Tamir</button></div>
    ${field('Ödeme', sc('sart.odeme', t.sart.odeme, ['%50', '%75', '%100', 'fatura'], ['%50 peşin', '%75 peşin', 'Tamamı peşin', 'Faturaya istinaden']))}
    ${tog('Kredi kartı komisyon maddesi', 'sart.kk', t.sart.kk, 0)}
    ${field('Teslim süresi (iş günü)', sc('sart.teslim', t.sart.teslim, [3, 7, 15, 20, 25, 30]) + '<div style="height:7px"></div>' + inp('sart.teslim', t.sart.teslim, 'gün', 'inputmode="numeric"'))}
    ${field('Montaj yeri', inp('sart.montajYeri', t.sart.montajYeri, 'Ankara'))}
    ${field('Nakliye ve montaj', sc('sart.nakliye', t.sart.nakliye, ['dahil', 'montajHaric', 'haric'], ['İkisi de dahil', 'Montaj hariç', 'İkisi de hariç']))}
    ${field('Garanti', sc('sart.garanti', t.sart.garanti, Object.keys(GARANTI), Object.values(GAR_AD)))}
    ${field('Teklif geçerliliği', sc('sart.gecerlilik', t.sart.gecerlilik, ['', 7, 15, 30], ['Yazma', '7 gün', '15 gün', '30 gün']))}
    ${field('Ek not (isteğe bağlı)', `<textarea class="i" data-b="sart.ek" style="min-height:60px">${esc(t.sart.ek)}</textarea>`)}
    ${t.para !== 'TL' ? '<div class="mut sm">Döviz kuru (TCMB) maddesi otomatik eklenir.</div>' : ''}
  </div>` + alt;
};
function totsHTML(t, h) {
  const c = t.para;
  return `<div class="tot"><span>Toplam</span><b>${money(h.ara, c)}</b></div>
  ${h.isk ? `<div class="tot"><span>İskonto %${n2(num(t.iskonto))}</span><b>−${money(h.isk, c)}</b></div><div class="tot"><span>Ara toplam</span><b>${money(h.mat, c)}</b></div>` : ''}
  ${t.kdvMod === 'ekle' ? `<div class="tot"><span>KDV %20</span><b>${money(h.kdv, c)}</b></div>` : ''}
  <div class="tot big"><span>G. Toplam</span><span>${money(h.genel, c)}</span></div>
  ${t.kdvMod === 'dahil' ? `<div class="mut sm" style="text-align:right">KDV dahildir (${money(h.kdv, c)})</div>` : ''}`;
}
const modelOf = l => MODELS.find(m => m.id === l.modelId);
const resimOf = l => l.resimYok ? '' : (l.resim || modelOf(l)?.resim || '');
function kalemCard(l, i, t) {
  const open = UI.open?.[l.id] ?? false; const p = `kalemler.${i}`;
  const ms = MODELS.filter(m => m.kat === l.kat);
  const q = satirMiktar(l); const tut = q * num(l.fiyat);
  const os = olcuSatiri(l.kat, l.f); const img = resimOf(l);
  return `<div class="item"><div class="hd" data-a="toggle" data-id="${l.id}">${img ? `<img src="${img}" style="width:44px;height:44px;object-fit:contain;background:#fff;border-radius:8px;border:1px solid var(--line)">` : `<span style="font-size:22px;width:44px;text-align:center">${FORMS[l.kat]?.ico || '➕'}</span>`}
    <div class="grow" style="min-width:0"><b style="display:block">${esc(l.ad || 'Kalem')}</b>${os ? `<span class="sm" style="color:#c0392b;font-weight:700">${esc(os)}</span>` : ''}</div><span class="mut">${open ? '▾' : '▸'}</span></div>
  <div class="row mut sm" style="margin-top:6px"><span class="grow">${n2(q)} ${esc(l.birim || 'Adet')} × ${money(num(l.fiyat), t.para)}</span><b style="color:var(--ink)" class="kt" data-i="${i}">${money(tut, t.para)}</b></div>
  ${open ? `<div style="margin-top:12px">
    ${t.secenekli && gruplar(t).length > 1 ? field('Hangi seçenek?', sc(`${p}.grup`, num(l.grup) || 0, gruplar(t).map((g, k) => k), gruplar(t).map((g, k) => `${k + 1}${g ? ' – ' + g : ''}`))) : ''}
    ${ms.length ? field('Model', `<select class="i" data-b="${p}.modelId" data-r="1" data-model="${i}"><option value="">— seç —</option>${ms.map(m => `<option value="${m.id}" ${m.id === l.modelId ? 'selected' : ''}>${esc(m.ad)}${num(m.fiyat) ? ' · ' + money(num(m.fiyat), m.para) : ''}</option>`).join('')}</select>`) : ''}
    ${field('Ürün adı (kalın satır)', inp(`${p}.ad`, l.ad))}
    ${field('Teknik özellikler (her satır ayrı)', `<textarea class="i" data-b="${p}.teknik" style="min-height:120px">${esc(l.teknik)}</textarea>`)}
    ${l.f && FORMS[l.kat] ? `<div class="card" style="background:#f7f9fb;box-shadow:none"><b class="sm">Ölçü ve seçimler</b><div class="mut sm">Seçtiklerin teklife satır olarak otomatik eklenir.</div><div style="margin-top:8px">${renderFields(l.kat, l.f, `${p}.f`)}</div>
      ${ekSatirlar(l.kat, l.f).length ? `<div class="sm" style="margin-top:4px;color:var(--navy2)">Eklenecek: ${esc(ekSatirlar(l.kat, l.f).join(' · '))}</div>` : ''}</div>` : ''}
    <div class="g2">${field('Miktar', inp(`${p}.adet`, l.adet, '1', 'inputmode="decimal"'))}${field('Birim', `<select class="i" data-b="${p}.birim" data-r="1">${BIRIM.map(b => `<option ${l.birim === b ? 'selected' : ''}>${b}</option>`).join('')}</select>`)}</div>
    ${l.birim === 'm²' && !alan(l.f || {}) ? field('m² (adet başı)', inp(`${p}.m2`, l.m2, '0', 'inputmode="decimal"')) : ''}
    ${field(`Net birim fiyat (${CUR[t.para]}${l.birim === 'm²' ? ' / m²' : ''})`, inp(`${p}.fiyat`, l.fiyat, '0', 'inputmode="decimal"'))}
    ${img || modelOf(l)?.resim ? tog('Ürün resmini göster', `${p}.resimGoster`, !l.resimYok, 1).replace(`data-b="${p}.resimGoster"`, `data-a="resimTog" data-i="${i}"`) : ''}
    <div class="row"><button class="btn ghost grow" data-a="kalemYukari" data-i="${i}">↑</button><button class="btn ghost grow" data-a="kalemKopya" data-i="${i}">Kopyala</button><button class="btn red grow" data-a="kalemSil" data-i="${i}">Sil</button></div>
  </div>` : ''}</div>`;
}
function yeniKalem(kat, f, adet = 1, grup = 0) {
  let m = null;
  if (f && f.marka && f.model) { const key = (f.marka + f.model).toLowerCase().replace(/[\s°()]/g, ''); m = MODELS.find(x => x.kat === kat && x.ad.toLowerCase().replace(/[\s°()–-]/g, '').includes(key.replace(/90$/, ''))); }
  if (!m && f && f.kanat) m = MODELS.find(x => x.kat === kat && x.ad.includes(f.kanat === 'Çift' ? 'Çift' : 'Tek'));
  if (!m && f && f.tip) m = MODELS.find(x => x.kat === kat && x.ad.startsWith(f.tip));
  if (!m) m = MODELS.find(x => x.kat === kat);
  return { id: uid(), kat, f: f || null, modelId: m?.id || '', ad: m?.ad || KATS[kat], konu: m?.konu || '', teknik: m?.teknik || '', birim: m?.birim || 'Adet', fiyat: m?.fiyat ?? '', para: m?.para || 'TL', adet, m2: '', grup };
}
function kalemlerEklendi(t, yeni) {
  if (!(t.kalemler || []).length && yeni[0]?.para) t.para = yeni[0].para;
  if (!t.konu && yeni[0]?.konu) t.konu = yeni[0].konu;
  t.kalemler.push(...yeni);
  const fark = yeni.filter(l => num(l.fiyat) && l.para && l.para !== t.para);
  if (fark.length) toast(`Dikkat: ${fark.length} kalemin model fiyatı ${fark[0].para}, teklif ${t.para}. Fiyatı kontrol et.`);
}


/* ---------- Servis ---------- */
const servisRow = s => `<div class="li" data-a="go" data-h="servis/${s.id}"><div class="ico">🔧</div><div class="grow"><b>${esc(s.musteri?.ad || 'İsimsiz servis')}</b><span class="mut sm">No ${esc(s.no)} · ${trDate(s.tarih)} · ${esc((s.tur || []).join(', ') || '')}</span></div><span class="amt">${money(servisHesap(s).genel)}</span></div>`;
function servisHesap(s) {
  const top = (s.malzeme || []).reduce((t, m) => t + num(m.adet) * num(m.fiyat), 0);
  const kdv = s.kdvEkle ? top * 0.20 : 0;
  return { top, kdv, genel: top + kdv };
}
V.servisler = async () => {
  const L = (await DB.all('servisler')).sort((a, b) => (b.no || '').localeCompare(a.no || ''));
  return searchBox() + (L.length ? L.map(servisRow).join('') : '<div class="empty">Henüz servis formu yok.</div>') + `<button class="fab" data-a="yeni" data-s="servisler">+</button>`;
};
V.servis = async id => {
  await edit('servisler', id); const s = D; const h = servisHesap(s);
  const tur = s.tur || [];
  return `<div class="card"><div class="row"><b class="grow" style="font-size:18px">Servis No ${esc(s.no)}</b></div>
    <div class="chips" style="margin-top:10px">${['Servis', 'Montaj', 'Periyodik Bakım'].map(x => `<button class="chip ${tur.includes(x) ? 'on' : ''}" data-a="turTog" data-v="${x}">${tur.includes(x) ? '☑' : '☐'} ${x}</button>`).join('')}</div></div>
  ${musteriBlock(s.musteri, { yetkili: true, bilgi: true, adL: 'Firma adı' })}
  <div class="card">${field('Tarih', inp('tarih', s.tarih, '', 'type="date"'))}
    <div class="g2">${field('Garanti başlangıç', inp('garBas', s.garBas, '', 'type="date"'))}${field('Garanti bitiş', inp('garBit', s.garBit, '', 'type="date"'))}</div>
    ${field('Kapı tipi', chips('kapi', s.kapi, ['Kepenk', 'Seksiyonel', 'Bariyer', 'Bahçe kapısı', 'Hızlı PVC', 'Yangın kapısı', 'Fotoselli kapı']) + '<div style="height:7px"></div>' + inp('kapi', s.kapi, 'veya yazın'))}
    ${field('Yapılan işlemler', `<textarea class="i" data-b="yapilan" style="min-height:110px" placeholder="Örn. Fotoselli kapının arızası giderilerek çalışır şekilde teslim edildi.">${esc(s.yapilan)}</textarea>`)}
  </div>
  <h2>Malzemeler</h2>
  <div class="card">${(s.malzeme || []).map((m, i) => `<div class="item" style="padding:10px">
      <div class="row">${inp(`malzeme.${i}.ad`, m.ad, 'Malzeme adı', 'list="malist"')}<button class="x" data-a="malSil" data-i="${i}">✕</button></div>
      <div class="g3" style="margin-top:8px">${inp(`malzeme.${i}.adet`, m.adet, 'Adet', 'inputmode="decimal"')}${inp(`malzeme.${i}.fiyat`, m.fiyat, 'Birim ₺', 'inputmode="decimal"')}<div class="mt" data-i="${i}" style="align-self:center;text-align:right;font-weight:700">${money(num(m.adet) * num(m.fiyat))}</div></div></div>`).join('')}
    <button class="btn ghost full" data-a="malEkle">+ Malzeme / işçilik ekle</button>
    <div style="margin-top:12px">${tog('KDV %20 ekle', 'kdvEkle', s.kdvEkle)}</div>
    <div id="tots">${servisTots(s, h)}</div></div>
  <h2>Teslim</h2>
  <div class="card">${field('Teslim alan (ad soyad)', inp('teslimAlan', s.teslimAlan, 'Müşteri yetkilisi'))}
    <div class="row" style="margin-bottom:6px"><b class="grow sm">Teslim alan imzası</b><button class="btn ghost" style="min-height:34px;padding:4px 12px" data-a="imzaSil">Temizle</button></div>
    <canvas class="sig" id="sig"></canvas><div class="mut sm" style="margin-top:4px">Müşteri parmağıyla buraya imza atar.</div>
    <div style="height:10px"></div>
    ${field('Teslim eden', inp('teslimEden', s.teslimEden, S.unvan))}
    ${tog('Kaşe-imza koy (teslim eden)', 'kase', s.kase, 1)}
  </div>
  <button class="btn acc full" data-a="pdf" data-k="servis">📤 PDF hazırla / WhatsApp</button>
  <div class="btns"><button class="btn ghost" data-a="kopya">Kopyala</button><button class="btn red" data-a="sil">Sil</button></div>`;
};
const servisTots = (s, h) => `<div class="tot"><span>Toplam</span><b>${money(h.top)}</b></div>${s.kdvEkle ? `<div class="tot"><span>KDV %20</span><b>${money(h.kdv)}</b></div>` : ''}<div class="tot big"><span>G. Toplam</span><span>${money(h.genel)}</span></div>`;

function initSig() {
  const c = $('#sig'); if (!c) return;
  const r = window.devicePixelRatio || 1; const w = c.clientWidth, h = c.clientHeight;
  c.width = w * r; c.height = h * r; const x = c.getContext('2d'); x.scale(r, r);
  x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#0b2a6b';
  if (D.imza) { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, w, h); im.src = D.imza; }
  let dn = false, lx, ly;
  const pos = e => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  c.onpointerdown = e => { dn = true; c.setPointerCapture(e.pointerId); [lx, ly] = pos(e); x.beginPath(); x.arc(lx, ly, 1, 0, 7); x.fillStyle = '#0b2a6b'; x.fill(); };
  c.onpointermove = e => { if (!dn) return; const [nx, ny] = pos(e); x.beginPath(); x.moveTo(lx, ly); x.lineTo(nx, ny); x.stroke(); lx = nx; ly = ny; };
  c.onpointerup = c.onpointercancel = () => { if (!dn) return; dn = false; D.imza = c.toDataURL('image/png'); queueSave(); };
}

/* ---------- Notlar ---------- */
function aktifNot(n, td) { if (n.tekrar) return n.doneOn !== td; if (n.done) return false; return !n.tarih || n.tarih <= td; }
function noteDone(n, td) { return n.tekrar ? n.doneOn === td : !!n.done; }
const noteRow = n => { const td = today(); const d = noteDone(n, td); return `<div class="note ${d ? 'done' : ''}"><button class="ck" data-a="notTik" data-id="${n.id}"></button><div class="grow" data-a="notDuz" data-id="${n.id}"><div class="tx">${esc(n.metin)}</div><div class="mut sm">${n.tekrar ? '🔁 Her gün' : n.tarih ? (n.tarih < td && !d ? '<span style="color:var(--red)">⚠ ' + trDate(n.tarih) + '</span>' : '📅 ' + trDate(n.tarih)) : ''}${n.saat ? ' · ' + n.saat : ''}</div></div></div>`; };
V.notlar = async () => {
  const L = await DB.all('notlar'); const td = today();
  const ak = L.filter(n => aktifNot(n, td)).sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
  const ile = L.filter(n => !n.tekrar && !n.done && n.tarih > td).sort((a, b) => a.tarih.localeCompare(b.tarih));
  const bit = L.filter(n => noteDone(n, td)).sort((a, b) => (b.upd || 0) - (a.upd || 0)).slice(0, 30);
  return `<div class="card"><textarea class="i" id="yeniNot" placeholder="Yeni not… (örn. Yarın Şahinler Sitesi’ne fotosel götür)" style="min-height:70px"></textarea>
    <div class="row" style="margin-top:8px"><input type="date" class="i" id="yeniNotT" style="flex:1"><label class="chip" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="yeniNotR"> Her gün</label></div>
    <button class="btn full" style="margin-top:8px" data-a="notEkle">Not ekle</button></div>
  <h2>Yapılacaklar (${ak.length})</h2>${ak.map(noteRow).join('') || '<div class="empty">Hepsi tamam 👍</div>'}
  ${ile.length ? `<h2>İleri tarihli</h2>${ile.map(noteRow).join('')}` : ''}
  ${bit.length ? `<h2>Tamamlanan</h2>${bit.map(noteRow).join('')}` : ''}
  <div class="card" style="margin-top:16px"><b>📅 Her sabah hatırlatma</b><div class="mut sm" style="margin:4px 0 10px">iPhone takvimine her gün ${esc(S.hatirlatSaat)}'da bildirim kurar. Bildirime dokununca uygulama açılır.</div><button class="btn ghost full" data-a="ics">Takvime günlük hatırlatma ekle</button></div>`;
};

/* ---------- Ayarlar ---------- */
V.ayarlar = async () => {
  const b = (k, l, ph = '', x = '') => field(l, `<input class="i" data-s="${k}" value="${esc(S[k])}" placeholder="${ph}" ${x}>`);
  const ta = (k, l) => field(l, `<textarea class="i" data-s="${k}">${esc(S[k])}</textarea>`);
  return `<h2>Firma</h2><div class="card">${b('unvan', 'Firma ünvanı')}${b('yetkili', 'Yetkili')}${ta('adres', 'Adres')}<div class="g2">${b('tel', 'Telefon', '', 'inputmode="tel"')}${b('eposta', 'E-posta', '', 'type="email"')}</div>${b('web', 'Web')}<div class="g2">${b('vd', 'Vergi dairesi')}${b('vkn', 'Vergi / TC no', '', 'inputmode="numeric"')}</div>${b('banka', 'Banka')}${b('iban', 'IBAN', 'TR..')}${ta('hizmetler', 'Hizmetler (PDF başlığında)')}</div>
  <h2>Logo ve kaşe</h2><div class="card">
    <div class="imgbox" style="margin-bottom:12px"><img src="${S.logo || 'img/logo.png'}"><div class="grow"><b>Logo</b><br><label class="btn ghost" style="min-height:38px;margin-top:6px">Değiştir<input type="file" accept="image/*" data-img="logo" hidden></label></div></div>
    <div class="imgbox">${S.kase ? `<img src="${S.kase}">` : '<div class="ico" style="width:70px;height:60px">—</div>'}<div class="grow"><b>Kaşe + imza</b>${S.kase ? '' : ' <span class="tag r">yüklenmedi</span>'}<div class="mut sm">Beyaz kâğıda bas, imzala, yakından fotoğrafını çek. Beyaz arka plan otomatik temizlenir.</div><label class="btn ghost" style="min-height:38px;margin-top:6px">Fotoğraf yükle<input type="file" accept="image/*" data-img="kase" hidden></label></div></div></div>
  <h2>Teklif</h2><div class="card"><div class="g2">${b('teklifNo', 'Sıradaki no', '', 'inputmode="numeric"')}</div>${b('kkOran', 'Kredi kartı komisyon %', '', 'inputmode="decimal"')}</div>
  <h2>Servis formu</h2><div class="card">${b('servisNo', 'Sıradaki servis no', '', 'inputmode="numeric"')}${ta('servisSart', 'Form alt notu')}</div>
  <h2>Hatırlatma</h2><div class="card">${b('hatirlatSaat', 'Her gün saat', '', 'type="time"')}</div>
  <h2>Kütüphane</h2>
  <div class="li" data-a="go" data-h="modeller"><div class="ico">📦</div><div class="grow"><b>Ürün modelleri ve fiyatlar</b><span class="mut sm">${MODELS.length} model · teknik yazılar</span></div><span class="mut">›</span></div>
  <div class="li" data-a="go" data-h="musteriler"><div class="ico">👥</div><div class="grow"><b>Müşteriler</b></div><span class="mut">›</span></div>
  <h2>Güvenlik</h2><div class="card"><div class="mut sm" style="margin-bottom:8px">Uygulama açılışta ve 10 dakika kullanılmayınca şifre ister.</div><div class="row"><input class="i" id="yeniPin" type="password" inputmode="numeric" placeholder="Yeni şifre (en az 4 rakam)"><button class="btn" data-a="pinDegis">Değiştir</button></div></div>
  <h2>Yedek</h2><div class="card"><div class="mut sm" style="margin-bottom:10px">Tüm veriler bu telefonda durur. Ayda bir yedek alıp WhatsApp'ta kendine veya iCloud Drive'a kaydet.</div>
    <div class="btns" style="margin-top:0"><button class="btn" data-a="yedekAl">Yedek al</button><label class="btn ghost">Yedeği yükle<input type="file" accept=".json,application/json" id="yedekYukle" hidden></label></div></div>
  <div class="mut sm" style="text-align:center;margin-top:20px">BKM Door saha uygulaması · v1.0</div>`;
};
V.modeller = async () => {
  const k = UI.mkat || 'kepenk';
  const L = MODELS.filter(m => m.kat === k);
  return `<div class="tabsx">${Object.entries(KATS).map(([x, a]) => `<button class="chip ${x === k ? 'on' : ''}" data-a="mkat" data-v="${x}">${a}</button>`).join('')}</div>
  <div class="mut sm" style="margin:0 4px 10px">Teklife eklenince resim, model adı, teknik yazı ve fiyat otomatik gelir. Ölçüde seçtiğin renk, kumanda, fotosel vb. satır olarak eklenir.</div>
  ${L.map(m => `<div class="li" data-a="modelDuz" data-id="${m.id}">${m.resim ? `<img src="${m.resim}" style="width:48px;height:48px;object-fit:contain;flex:none">` : ''}<div class="grow"><b>${esc(m.ad)}</b><div class="prev">${esc(m.teknik)}</div></div><span class="amt">${num(m.fiyat) ? money(num(m.fiyat), m.para) + '<span class="mut sm"> / ' + esc(m.birim || 'Adet') + '</span>' : '<span class="tag">fiyat yok</span>'}</span></div>`).join('')}
  <button class="btn full" data-a="modelDuz" data-id="">+ Yeni model</button>`;
};
function modelForm(m) {
  return `<h2 style="margin-top:0">${m.id ? 'Modeli düzenle' : 'Yeni model'}</h2>
  ${field('Kategori', `<select class="i" id="m_kat">${Object.entries(KATS).map(([k, a]) => `<option value="${k}" ${m.kat === k ? 'selected' : ''}>${a}</option>`).join('')}</select>`)}
  ${field('Model adı (teklifte kalın satır)', `<input class="i" id="m_ad" value="${esc(m.ad)}">`)}
  ${field('Teklif konusu (giriş cümlesi)', `<input class="i" id="m_konu" value="${esc(m.konu)}" placeholder="Örn. Endüstriyel Seksiyonel Kapı">`)}
  <div class="imgbox" style="margin-bottom:12px"><img id="m_img" src="${m.resim || ''}" style="${m.resim ? '' : 'display:none'}"><label class="btn ghost" style="min-height:40px">Ürün resmi seç<input type="file" accept="image/*" id="m_file" hidden></label>${m.resim ? '<button class="btn red" style="min-height:40px" data-a="mResimSil">Kaldır</button>' : ''}</div>
  ${field('Teknik özellik yazısı', `<textarea class="i" id="m_tek" style="min-height:150px">${esc(m.teknik)}</textarea>`)}
  <div class="g3">${field('Fiyat', `<input class="i" id="m_fiy" inputmode="decimal" value="${esc(m.fiyat)}">`)}${field('Birim', `<select class="i" id="m_bir">${BIRIM.map(b => `<option ${m.birim === b ? 'selected' : ''}>${b}</option>`).join('')}</select>`)}${field('Para', `<select class="i" id="m_par">${['TL', 'USD', 'EUR'].map(b => `<option ${m.para === b ? 'selected' : ''}>${b}</option>`).join('')}</select>`)}</div>
  <button class="btn full" data-a="modelKaydet" data-id="${m.id || ''}">Kaydet</button>
  ${m.id ? `<button class="btn red full" style="margin-top:8px" data-a="modelSil" data-id="${m.id}">Modeli sil</button>` : ''}`;
}
V.musteriler = async () => {
  const L = (await DB.all('musteriler')).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  return searchBox() + (L.length ? L.map(m => `<div class="li"><div class="ico">👤</div><div class="grow"><b>${esc(m.ad)}</b><span class="mut sm">${esc([m.yetkili, m.tel].filter(Boolean).join(' · '))}</span></div>${m.tel ? `<a class="btn ghost" style="min-height:38px;padding:6px 12px" href="tel:${esc(m.tel.replace(/\s/g, ''))}">Ara</a>` : ''}<button class="x" data-a="musSil" data-id="${m.id}">✕</button></div>`).join('') : '<div class="empty">Müşteri, teklif veya servis kaydı yaptıkça burada birikir.</div>');
};
const searchBox = () => `<input class="i search" id="ara" placeholder="Ara…" value="${esc(UI.q || '')}">`;

/* ---------------- Kayıt açma / yeni ---------------- */
async function edit(store, id) {
  if (D && DS === store && D.id === id) return;
  await saveNow();
  D = await DB.get(store, id); DS = store;
  if (!D) { D = null; throw new Error('Kayıt bulunamadı'); }
  UI.open = {};
}
async function yeni(store, extra = {}) {
  await saveNow();
  let o;
  const y = today().slice(0, 4);
  if (store === 'olculer') o = { tarih: today(), musteri: {}, items: [], not: '' };
  if (store === 'teklifler') { o = { tip: 'urun', no: String(S.teklifNo).padStart(6, '0'), tarih: today(), musteri: {}, konu: '', kalemler: [], durum: 'Taslak', para: 'TL', iskonto: '', kdvOran: S.kdv, kdvMod: 'ekle', secenekli: false, gruplar: [''], sart: { ...SART_DEF }, kase: true }; S.teklifNo = num(S.teklifNo) + 1; await saveS(); }
  if (store === 'servisler') { o = { no: String(S.servisNo).padStart(6, '0'), tarih: today(), musteri: {}, tur: ['Servis'], kapi: '', yapilan: '', malzeme: [{ ad: '', adet: 1, fiyat: '' }], kdvEkle: false, kdvOran: S.kdv, teslimAlan: '', teslimEden: S.unvan, kase: true, imza: '' }; S.servisNo = num(S.servisNo) + 1; await saveS(); }
  o = { id: uid(), upd: Date.now(), ...o, ...extra };
  await DB.put(store, o);
  D = o; DS = store; UI.open = {};
  const map = { olculer: 'olcu', teklifler: 'teklif', servisler: 'servis' };
  location.hash = map[store] + '/' + o.id;
  return o;
}

/* ---------------- Router ---------------- */
const TITLES = { home: 'BKM Door', olculer: 'Ölçüler', olcu: 'Ölçü', teklifler: 'Teklifler', teklif: 'Teklif', servisler: 'Servis Formları', servis: 'Servis Formu', notlar: 'Notlar', ayarlar: 'Ayarlar', modeller: 'Ürün Modelleri', musteriler: 'Müşteriler' };
const PARENT = { olcu: 'olculer', teklif: 'teklifler', servis: 'servisler', modeller: 'ayarlar', musteriler: 'ayarlar' };
let rendering = false;
async function render(keepScroll) {
  if (!kilitAcik) return;
  const [r, id] = (location.hash.slice(1) || 'home').split('/');
  const sy = window.scrollY;
  if (!PARENT[r] && r !== 'ayarlar') { await saveNow(); }
  if (['home', 'olculer', 'teklifler', 'servisler', 'notlar', 'ayarlar', 'modeller', 'musteriler'].includes(r)) { D = null; DS = null; }
  $('#title').textContent = TITLES[r] || 'BKM Door';
  $('#back').hidden = !PARENT[r] && r !== 'ayarlar';
  const tab = { olcu: 'olculer', teklif: 'teklifler', servis: 'servisler' }[r] || r;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
  let html;
  try { html = await (V[r] || V.home)(id); } catch (e) { console.error(e); html = `<div class="empty">Kayıt bulunamadı.</div>`; }
  const mlist = (await DB.all('musteriler')).map(m => `<option value="${esc(m.ad)}">`).join('');
  $('#view').innerHTML = html + `<datalist id="mlist">${mlist}</datalist><datalist id="malist">${['Servis bedeli', 'İşçilik', 'Fotosel', 'Kumanda', 'Motor', 'Kontrol kartı', 'Yay', 'Halat', 'Akü', 'Limit switch', 'Kumanda kopyalama', 'Yol ücreti'].map(x => `<option value="${x}">`).join('')}</datalist>`;
  if (r === 'servis') initSig();
  const ara = $('#ara'); if (ara) { ara.oninput = () => { UI.q = ara.value; filterList(); }; filterList(); }
  window.scrollTo(0, keepScroll ? sy : 0);
}
function filterList() { const q = (UI.q || '').toLocaleLowerCase('tr').trim(); $$('#view .li').forEach(e => e.style.display = !q || e.textContent.toLocaleLowerCase('tr').includes(q) ? '' : 'none'); }
window.addEventListener('hashchange', () => { closeSheet(); render(); });

/* ---------------- Olaylar ---------------- */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.s !== undefined && el.dataset.s) { S[el.dataset.s] = el.value; clearTimeout(saveT); saveT = setTimeout(saveS, 400); return; }
  const p = el.dataset.b; if (!p || !D) return;
  const v = el.type === 'checkbox' ? el.checked : el.value;
  setPath(D, p, v);
  if (el.dataset.model !== undefined) { const i = +el.dataset.model; const m = MODELS.find(x => x.id === v); if (m) { Object.assign(D.kalemler[i], { ad: m.ad, teknik: m.teknik, birim: m.birim, fiyat: m.fiyat, para: m.para, konu: m.konu }); if (m.para !== D.para && num(m.fiyat)) toast(`Model fiyatı ${m.para}, teklif ${D.para}`); } }
  queueSave();
  if (el.dataset.r || el.type === 'checkbox' || el.tagName === 'SELECT') render(true); else live();
});
function live() {
  if (DS === 'teklifler') { $('#tots') && ($('#tots').innerHTML = totsHTML(D, hesap(D))); $$('.kt').forEach(e => { const l = D.kalemler[+e.dataset.i]; e.textContent = money(satirMiktar(l) * num(l.fiyat), D.para); }); }
  if (DS === 'servisler') { $('#tots') && ($('#tots').innerHTML = servisTots(D, servisHesap(D))); $$('.mt[data-i]').forEach(e => { const m = D.malzeme[+e.dataset.i]; e.textContent = money(num(m.adet) * num(m.fiyat)); }); }
}
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.photo) { const f = el.files[0]; if (!f) return; const u = await imgToData(f, 1280, 'image/jpeg', .72); const arr = getPath(D, el.dataset.photo) || []; arr.push(u); setPath(D, el.dataset.photo, arr); queueSave(); render(true); }
  if (el.dataset.img) { const f = el.files[0]; if (!f) return; busy(true, 'İşleniyor…'); let u = await imgToData(f, 900, 'image/png'); if (el.dataset.img === 'kase') u = await beyazTemizle(u); S[el.dataset.img] = u; await saveS(); busy(false); toast('Kaydedildi'); render(true); }
  if (el.id === 'm_file') { const f = el.files[0]; if (!f) return; const u = await imgToData(f, 600, 'image/jpeg', .85); const im = $('#m_img'); im.src = u; im.style.display = ''; }
  if (el.id === 'yedekYukle') { const f = el.files[0]; if (!f) return; yedekYukle(f); }
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a],[data-go]'); if (!el) return;
  if (el.dataset.go) { location.hash = el.dataset.go; return; }
  const a = el.dataset.a; const f = A[a]; if (!f) return;
  if (el.tagName === 'BUTTON') e.preventDefault();
  try { await f(el, e); } catch (err) { console.error(err); busy(false); toast('Hata: ' + err.message); }
});
$('#back').onclick = () => { const [r] = location.hash.slice(1).split('/'); location.hash = PARENT[r] || 'home'; };
$('#gear').onclick = () => location.hash = 'ayarlar';
$('.sh-bg').onclick = closeSheet;

const A = {
  go: el => location.hash = el.dataset.h,
  yeni: el => yeni(el.dataset.s),
  set: el => { setPath(D, el.dataset.p, getPath(D, el.dataset.p) === el.dataset.v && !/durum|para|kdvMod/.test(el.dataset.p) ? '' : el.dataset.v); queueSave(); render(true); },
  inc: el => { const v = Math.max(0, num(getPath(D, el.dataset.p)) + num(el.dataset.d)); setPath(D, el.dataset.p, v); queueSave(); render(true); },
  toggle: el => { UI.open = UI.open || {}; const id = el.dataset.id; const cur = UI.open[id] ?? (DS === 'olculer'); UI.open[id] = !cur; render(true); },
  addItem: el => { const it = { id: uid(), tip: el.dataset.t, f: {}, adet: 1, not: '', foto: [] }; if (el.dataset.t === 'pvc') it.f.kumandaVar = true; D.items.forEach(x => UI.open[x.id] = false); D.items.push(it); UI.open[it.id] = true; queueSave(); render(true); setTimeout(() => $$('.item').at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); },
  delItem: el => { if (!confirm('Bu ürün silinsin mi?')) return; D.items.splice(+el.dataset.i, 1); queueSave(); render(true); },
  delFoto: el => { if (!confirm('Fotoğraf silinsin mi?')) return; getPath(D, el.dataset.p).splice(+el.dataset.k, 1); queueSave(); render(true); },
  sil: async () => { if (!confirm('Bu kayıt kalıcı olarak silinsin mi?')) return; const s = DS; await DB.del(s, D.id); D = null; DS = null; location.hash = s; toast('Silindi'); },
  kopya: async () => { await saveNow(); const c = JSON.parse(JSON.stringify(D)); delete c.id; const s = DS; if (s === 'teklifler') { delete c.no; c.durum = 'Taslak'; } if (s === 'servisler') { delete c.no; c.imza = ''; } c.tarih = today(); const y = await yeni(s); Object.assign(D, c, { id: y.id, no: y.no }); await saveNow(); render(); toast('Kopya oluşturuldu'); },
  pickMusteri: async () => { const L = (await DB.all('musteriler')).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')); openSheet(`<h2 style="margin-top:0">Müşteri seç</h2><input class="i search" placeholder="Ara…" oninput="$$('#sheetBody .li').forEach(e=>e.style.display=e.textContent.toLocaleLowerCase('tr').includes(this.value.toLocaleLowerCase('tr'))?'':'none')">${L.map(m => `<div class="li" data-a="musSec" data-id="${m.id}"><div class="grow"><b>${esc(m.ad)}</b><span class="mut sm">${esc([m.yetkili, m.tel].filter(Boolean).join(' · '))}</span></div></div>`).join('') || '<div class="empty">Kayıtlı müşteri yok.</div>'}`); },
  musSec: async el => { const m = await DB.get('musteriler', el.dataset.id); D.musteri = { ...D.musteri, ad: m.ad, yetkili: m.yetkili, tel: m.tel, adres: m.adres }; queueSave(); closeSheet(); render(true); },
  musSil: async el => { if (!confirm('Müşteri listeden silinsin mi? (Teklif ve formlar silinmez)')) return; await DB.del('musteriler', el.dataset.id); render(true); },
  // teklif
  olcuTeklif: async () => { await saveNow(); const o = D; await yeni('teklifler', { musteri: { ...o.musteri }, olcuId: o.id }); kalemlerEklendi(D, olcuKalemleri(o, 0)); UI.open = {}; await saveNow(); render(); toast('Ölçüler teklife aktarıldı'); },
  olcudenAktar: async el => { UI.grup = num(el.dataset.g); const L = (await DB.all('olculer')).filter(o => o.items?.length).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '')); openSheet(`<h2 style="margin-top:0">Hangi ölçüden?</h2>${L.map(o => `<div class="li" data-a="aktar" data-id="${o.id}"><div class="ico">📏</div><div class="grow"><b>${esc(o.musteri?.ad || 'İsimsiz')}</b><span class="mut sm">${trDate(o.tarih)} · ${o.items.length} ürün</span></div></div>`).join('') || '<div class="empty">Ölçü kaydı yok.</div>'}`); },
  aktar: async el => { const o = await DB.get('olculer', el.dataset.id); kalemlerEklendi(D, olcuKalemleri(o, UI.grup || 0)); D.olcuId = o.id; if (!D.musteri?.ad) D.musteri = { ...o.musteri }; queueSave(); closeSheet(); render(true); toast(o.items.length + ' ürün eklendi'); },
  kalemEkle: el => (UI.grup = num(el.dataset.g), openSheet(`<h2 style="margin-top:0">Ne eklenecek?</h2>${Object.entries(KATS).map(([k, a]) => `<div class="li" data-a="kalemKat" data-k="${k}"><div class="ico">${FORMS[k]?.ico || '➕'}</div><div class="grow"><b>${a}</b></div><span class="mut">›</span></div>`).join('')}`)),
  kalemKat: el => { const k = el.dataset.k; const l = yeniKalem(k, FORMS[k] ? {} : null, 1, UI.grup || 0); kalemlerEklendi(D, [l]); UI.open[l.id] = true; queueSave(); closeSheet(); render(true); setTimeout(() => $$('.item').at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); },
  kalemKopya: el => { const i = +el.dataset.i; const c = JSON.parse(JSON.stringify(D.kalemler[i])); c.id = uid(); D.kalemler.splice(i + 1, 0, c); UI.open[c.id] = true; queueSave(); render(true); },
  resimTog: el => { const l = D.kalemler[+el.dataset.i]; l.resimYok = !l.resimYok; queueSave(); render(true); },
  setx: el => { const p = el.dataset.p; let v = el.dataset.v; if (/teslim|gecerlilik|grup$/.test(p) && v !== '') v = num(v); setPath(D, p, v); if (p === 'tip' && v === 'yazi' && !D.yaziMetin) { D.yaziKdvNot = true; } queueSave(); render(true); },
  grupEkle: () => { D.gruplar = gruplar(D).slice(); const son = D.gruplar.length - 1; D.gruplar.push(''); const yeni = D.kalemler.filter(l => (num(l.grup) || 0) === son).map(l => ({ ...JSON.parse(JSON.stringify(l)), id: uid(), grup: son + 1 })); D.kalemler.push(...yeni); queueSave(); render(true); toast(`Seçenek ${son + 2} oluşturuldu – modeli/fiyatı değiştir`); },
  grupSil: el => { const i = +el.dataset.i; if (!confirm(`Seçenek ${i + 1} ve kalemleri silinsin mi?`)) return; D.kalemler = D.kalemler.filter(l => (num(l.grup) || 0) !== i).map(l => ({ ...l, grup: (num(l.grup) || 0) > i ? num(l.grup) - 1 : num(l.grup) || 0 })); D.gruplar.splice(i, 1); queueSave(); render(true); },
  sartSablon: el => { D.sart = el.dataset.v === 'tamir' ? { ...SART_DEF, odeme: 'fatura', teslim: 3, garanti: '3ay' } : { ...SART_DEF }; queueSave(); render(true); toast('Şartlar güncellendi'); },
  kalemSil: el => { if (!confirm('Kalem silinsin mi?')) return; D.kalemler.splice(+el.dataset.i, 1); queueSave(); render(true); },
  kalemYukari: el => { const i = +el.dataset.i; if (i < 1) return; const k = D.kalemler; [k[i - 1], k[i]] = [k[i], k[i - 1]]; queueSave(); render(true); },
  // servis
  turTog: el => { const v = el.dataset.v; D.tur = D.tur || []; D.tur = D.tur.includes(v) ? D.tur.filter(x => x !== v) : [...D.tur, v]; queueSave(); render(true); },
  malEkle: () => { D.malzeme = D.malzeme || []; D.malzeme.push({ ad: '', adet: 1, fiyat: '' }); queueSave(); render(true); },
  malSil: el => { D.malzeme.splice(+el.dataset.i, 1); queueSave(); render(true); },
  imzaSil: () => { D.imza = ''; queueSave(); const c = $('#sig'); c.getContext('2d').clearRect(0, 0, c.width, c.height); },
  // pdf
  pdf: async el => { await saveNow(); const k = el.dataset.k; busy(true, 'PDF hazırlanıyor…'); const html = k === 'teklif' ? teklifPDF(D) : servisPDF(D); const ad = (k === 'teklif' ? 'Teklif-' : 'Servis-') + D.no + '-' + (D.musteri?.ad || '').replace(/[^\wğüşıöçĞÜŞİÖÇ]+/g, '_').slice(0, 30) + '.pdf'; const blob = await makePDF(html, k === 'teklif' ? undefined : null); busy(false); paylasSheet(blob, ad, k); if (k === 'teklif' && (!D.durum || D.durum === 'Taslak')) { D.durum = 'Gönderildi'; queueSave(); } },
  share: async () => { const { blob, ad } = UI.pdf; const file = new File([blob], ad, { type: 'application/pdf' }); if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: ad }); } catch (e) { if (e.name !== 'AbortError') toast('Paylaşılamadı'); } } else A.indir(); },
  indir: () => { const { blob, ad } = UI.pdf; const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = ad; a.target = '_blank'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); },
  waMesaj: () => { const m = D?.musteri || {}; const t = UI.pdf.k === 'teklif' ? `Merhaba ${m.yetkili || m.ad || ''}, ${D.no} numaralı fiyat teklifimizi bilgilerinize sunarız. Toplam: ${money(hesap(D).genel, D.para)}. Sorunuz olursa buradayım.\nBKM Door – ${S.tel}` : `Merhaba ${m.yetkili || m.ad || ''}, ${trDate(D.tarih)} tarihli servis formunuz ekte. İyi çalışmalar dileriz.\nBKM Door – ${S.tel}`; location.href = `https://wa.me/${waNo(m.tel)}?text=${encodeURIComponent(t)}`; },
  // notlar
  notEkle: async () => { const t = $('#yeniNot').value.trim(); if (!t) return toast('Not yazın'); await DB.put('notlar', { id: uid(), metin: t, tarih: $('#yeniNotT').value || '', tekrar: $('#yeniNotR').checked, done: false, upd: Date.now() }); toast('Not eklendi'); render(true); },
  notTik: async el => { const n = await DB.get('notlar', el.dataset.id); const td = today(); if (n.tekrar) n.doneOn = n.doneOn === td ? '' : td; else n.done = !n.done; n.upd = Date.now(); await DB.put('notlar', n); render(true); },
  notDuz: async el => { const n = await DB.get('notlar', el.dataset.id); openSheet(`<h2 style="margin-top:0">Notu düzenle</h2><textarea class="i" id="nd_t" style="min-height:110px">${esc(n.metin)}</textarea><div class="g2" style="margin-top:8px"><input type="date" class="i" id="nd_d" value="${esc(n.tarih)}"><input type="time" class="i" id="nd_s" value="${esc(n.saat || '')}"></div><label class="tog"><span>Her gün tekrar</span><span class="sw"><input type="checkbox" id="nd_r" ${n.tekrar ? 'checked' : ''}><i></i></span></label><button class="btn full" data-a="notKaydet" data-id="${n.id}">Kaydet</button><div class="btns"><button class="btn ghost" data-a="notTakvim" data-id="${n.id}">📅 Takvime ekle</button><button class="btn red" data-a="notSil" data-id="${n.id}">Sil</button></div>`); },
  notKaydet: async el => { const n = await DB.get('notlar', el.dataset.id); Object.assign(n, { metin: $('#nd_t').value, tarih: $('#nd_d').value, saat: $('#nd_s').value, tekrar: $('#nd_r').checked, upd: Date.now() }); await DB.put('notlar', n); closeSheet(); render(true); },
  notSil: async el => { await DB.del('notlar', el.dataset.id); closeSheet(); render(true); },
  notTakvim: async el => { await A.notKaydet(el); const n = await DB.get('notlar', el.dataset.id); icsIndir(n.metin, n.tarih || today(), n.saat || S.hatirlatSaat, n.tekrar); },
  ics: () => icsIndir('BKM Door – Günün notlarına bak', today(), S.hatirlatSaat, true, true),
  // modeller
  mkat: el => { UI.mkat = el.dataset.v; render(true); },
  modelDuz: el => { const m = MODELS.find(x => x.id === el.dataset.id) || { kat: UI.mkat || 'kepenk', ad: '', teknik: '', fiyat: '', birim: 'adet', para: 'TL' }; openSheet(modelForm(m)); },
  modelKaydet: async el => { const id = el.dataset.id; const m = MODELS.find(x => x.id === id) || { id: uid(), auto: '' }; Object.assign(m, { kat: $('#m_kat').value, ad: $('#m_ad').value.trim(), konu: $('#m_konu').value.trim(), resim: $('#m_img').style.display === 'none' ? '' : $('#m_img').getAttribute('src'), teknik: $('#m_tek').value, fiyat: $('#m_fiy').value, birim: $('#m_bir').value, para: $('#m_par').value }); if (!m.ad) return toast('Model adı yazın'); await DB.put('modeller', m); MODELS = await DB.all('modeller'); closeSheet(); render(true); toast('Kaydedildi'); },
  kdvTog: el => { D.kdvMod = el.checked ? 'ekle' : 'yok'; queueSave(); render(true); },
  pinDegis: async () => { const v = $('#yeniPin').value.trim(); if (!/^\d{4,12}$/.test(v)) return toast('En az 4 rakam gir'); S.pinHash = await sha(v); await saveS(); $('#yeniPin').value = ''; toast('Şifre değişti'); },
  mResimSil: () => { $('#m_img').style.display = 'none'; $('#m_img').src = ''; },
  modelSil: async el => { if (!confirm('Model silinsin mi?')) return; await DB.del('modeller', el.dataset.id); MODELS = await DB.all('modeller'); closeSheet(); render(true); },
  // yedek
  yedekAl: async () => { const o = { app: 'bkmdoor', v: 1, tarih: new Date().toISOString(), ayar: S }; for (const s of STORES) o[s] = await DB.all(s); const blob = new Blob([JSON.stringify(o)], { type: 'application/json' }); const ad = `bkmdoor-yedek-${today()}.json`; const file = new File([blob], ad, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: ad }); } catch (e) { } } else { UI.pdf = { blob, ad }; A.indir(); } },
  olcuPaylas: async () => { await saveNow(); const o = D; const t = `ÖLÇÜ – ${o.musteri?.ad || ''} (${trDate(o.tarih)})\n` + o.items.map((it, i) => `${i + 1}) ${FORMS[it.tip].ad}${num(it.adet) > 1 ? ' ×' + it.adet : ''}: ${ozet(it.tip, it.f)}${it.not ? ' – ' + it.not : ''}`).join('\n') + (o.not ? '\nNot: ' + o.not : ''); if (navigator.share) { try { await navigator.share({ text: t }); } catch (e) { } } else { await navigator.clipboard.writeText(t); toast('Kopyalandı'); } }
};
function olcuKalemleri(o, grup = 0) {
  return (o.items || []).map(it => { const l = yeniKalem(it.tip, JSON.parse(JSON.stringify(it.f || {})), num(it.adet) || 1, grup); if (it.not) l.teknik = (l.teknik ? l.teknik + '\n' : '') + it.not; return l; });
}
const waNo = t => { let d = String(t || '').replace(/\D/g, ''); if (d.startsWith('0')) d = d.slice(1); if (d.length === 10) d = '90' + d; return d; };
function paylasSheet(blob, ad, k) {
  UI.pdf = { blob, ad, k };
  const tel = D?.musteri?.tel;
  openSheet(`<h2 style="margin-top:0">PDF hazır ✅</h2><div class="mut sm" style="margin-bottom:12px">${esc(ad)} · ${(blob.size / 1024).toFixed(0)} KB</div>
  <button class="btn wa full" data-a="share">📤 Paylaş (WhatsApp, Mail…)</button>
  <div class="mut sm" style="margin:6px 2px 12px">Açılan menüden WhatsApp'ı seç, sonra müşteriyi seç.</div>
  <button class="btn ghost full" data-a="indir">👁 PDF'i aç / kaydet</button>
  ${tel ? `<button class="btn ghost full" style="margin-top:8px" data-a="waMesaj">💬 ${esc(tel)} numarasına WhatsApp mesajı yaz</button>` : ''}`);
}

/* ---------------- PDF şablonları ---------------- */
const PDF_HEAD = () => `<div class="phd"><img src="${S.logo || 'img/logo.png'}"></div>`;
const PDF_FOOT = () => `<div class="pft"><div><b>Adres :</b><br>${esc(S.adres).replace(/\n/g, '<br>')}<br>☎ ${esc(S.tel)}<br>✉ ${esc(S.eposta)}${S.web ? ' · ' + esc(S.web) : ''}</div><img src="img/sertifika.jpg"></div>`;
function pdfHead(baslik, sag) {
  return `<div class="ph pb"><div><img src="${S.logo || 'img/logo.png'}"><div style="font-size:9.5px;color:#555;max-width:330px;margin-top:6px;line-height:1.4">${esc(S.hizmetler)}</div></div>
  <div class="fi"><b>${esc(S.yetkili)}</b><br>${esc(S.adres).replace(/\n/g, '<br>')}<br>Tel: ${esc(S.tel)}<br>${esc(S.web)} · ${esc(S.eposta)}<br>${S.vd ? esc(S.vd) + ' V.D. : ' : ''}${esc(S.vkn)}</div></div>
  <div class="tt pb"><h1>${baslik}</h1><div class="m">${sag}</div></div>`;
}
const imzaBlok = kase => `<div class="tsig pb"><div><b>${esc(S.unvan.replace(/^BKM Door/i, 'Bkm Door'))}</b><br><b>${esc(S.yetkili)}</b>${kase && S.kase ? `<div class="ks"><img src="${S.kase}"></div>` : '<div style="height:70px"></div>'}</div><div><b>KABUL EDİLMİŞTİR</b></div></div>`;
function teklifPDF(t) {
  const m = t.musteri || {}, c = t.para;
  const top = `<div class="trow pb"><div class="red b">${esc(m.ad || '')}${m.ad ? '.' : ''}</div><div class="tm">Tarih &nbsp;: ${trDate(t.tarih)}<br>Teklif No : ${esc(t.no)}</div></div>`;
  if (t.tip === 'yazi') {
    return `<div class="tw">${top.replace('red b', 'b')}
      ${m.adres ? `<div class="pb ctr b" style="margin-top:8px">${esc(m.adres).replace(/\n/g, '<br>')}</div>` : ''}
      ${t.yaziBaslik ? `<h3 class="pb">${esc(t.yaziBaslik)}</h3>` : ''}
      ${String(t.yaziMetin || '').split(/\n\s*\n/).map(p => `<p class="pb yz">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('')}
      ${t.yaziKdvNot ? '<p class="pb b">NOT. Fiyatlarımıza K.D.V dahil değildir.</p>' : ''}
      <p class="pb">Saygılarımızla,</p>${imzaBlok(t.kase).replace('<div><b>KABUL EDİLMİŞTİR</b></div>', '<div></div>')}</div>`;
  }
  const hitap = m.yetkili ? `Sayın ${esc(m.yetkili)} ;` : 'Sayın Yetkili ;';
  const tablo = (kal, baslik) => {
    const h = hesapG(t, kal); let no = 0;
    return `${baslik ? `<div class="sec pb">${baslik}</div>` : ''}
    <table class="tt2"><thead><tr><th style="width:30px">NO</th><th style="width:150px">ÜRÜN RESMİ</th><th>ÜRÜN TANIMI</th><th style="width:62px">MİKTAR</th><th style="width:96px">NET BİRİM<br>FİYAT</th><th style="width:100px">NET TUTAR</th></tr></thead><tbody>
    ${kal.map(l => { const q = satirMiktar(l); const os = olcuSatiri(l.kat, l.f); const img = resimOf(l); const ts = teknikSatirlar(l); no++;
      return `<tr class="pb"><td class="c">${no}</td><td class="c">${img ? `<img src="${img}">` : ''}</td><td class="c tn">${os ? `<div class="red b">${esc(os)}</div>` : ''}${l.ad ? `<div class="b">${esc(l.ad)}</div>` : ''}${ts.map(x => `<div>${esc(x)}</div>`).join('')}</td><td class="c">${n2(q)} ${esc(l.birim || 'Adet')}</td><td class="r">${money(num(l.fiyat), c)}</td><td class="r b">${money(q * num(l.fiyat), c)}</td></tr>`; }).join('')}
    </tbody></table>
    <table class="tot2 pb"><tr><td>Toplam</td><td>${money(h.ara, c)}</td></tr>
    ${t.kdvMod === 'ekle' ? `<tr><td>KDV %20</td><td>${money(h.kdv, c)}</td></tr>` : t.kdvMod === 'dahil' ? `<tr><td>KDV (dahil)</td><td>${money(h.kdv, c)}</td></tr>` : ''}
    <tr class="g"><td>G. Toplam</td><td>${money(h.genel, c)}</td></tr></table>`;
  };
  const G = gruplar(t);
  const govde = t.secenekli ? G.map((g, i) => tablo(grupKalem(t, i), `SEÇENEK ${i + 1}${g ? ' – ' + esc(g) : ''}`)).join('') : tablo(t.kalemler || []);
  const sart = sartBolumleri(t).map(([b, ps], i) => `<div class="sb pb"><div class="sh">1.${i + 1} &nbsp;${esc(b)}</div>${ps.map(p => typeof p === 'object' ? `<div class="red">${esc(p.red)}</div>` : `<div>${esc(p)}</div>`).join('')}</div>`).join('');
  return `<div class="tw">${top}
    <div class="pb hit">${hitap}</div>
    <p class="pb ctr">Projenizde kullanılmak üzere firmamızdan talep etmiş olduğunuz ${esc(t.konu || (t.kalemler?.[0]?.konu) || 'ürünler')} ile ilgili fiyat teklifimiz tarafınıza sunulmuştur.</p>
    <p class="pb ctr" style="margin-top:6px">Teklifimizin uygun bulunacağını ümit eder, çalışmalarınızda başarılar dileriz.</p>
    <h3 class="pb">FİYAT TEKLİFİ</h3>
    ${t.secenekli ? `<p class="pb ctr" style="margin:-4px 0 10px;font-size:11.5px">Aşağıda ${G.length} farklı seçenek sunulmuştur. Tercih ettiğiniz seçeneği belirtmeniz yeterlidir.</p>` : ''}
    ${govde}<div class="sp20"></div>${sart}${imzaBlok(t.kase)}</div>`;
}
function servisPDF(s) {
  const h = servisHesap(s); const m = s.musteri || {}; const tur = s.tur || [];
  const cb = x => `<span><span style="display:inline-block;width:13px;height:13px;border:1.5px solid #0f2740;margin-right:5px;vertical-align:-2px;text-align:center;line-height:11px;font-size:11px;font-weight:900">${tur.includes(x) ? '✕' : ''}</span>${x}</span>`;
  const rows = (s.malzeme || []).filter(x => x.ad || num(x.fiyat));
  return `<div class="pdf">${pdfHead('SERVİS – İŞ BİTİRME FORMU', `<b style="font-size:18px;color:#c0392b">${esc(s.no)}</b><br><b>Tarih:</b> ${trDate(s.tarih)}`)}
  <div class="kv pb"><div>Firma adı</div><div>${esc(m.ad)}</div><div>Yetkili adı</div><div>${esc(m.yetkili)}${m.tel ? ' · ' + esc(m.tel) : ''}</div><div>Adres</div><div>${esc(m.adres).replace(/\n/g, '<br>')}</div><div>Firma bilgileri</div><div>${esc(m.bilgi)}</div></div>
  <div class="pb" style="display:flex;gap:28px;margin:4px 0 12px;font-weight:700;color:#0f2740">${cb('Servis')}${cb('Montaj')}${cb('Periyodik Bakım')}</div>
  <div class="kv pb"><div>Garanti başlangıç</div><div>${trDate(s.garBas)}</div><div>Garanti bitiş</div><div>${trDate(s.garBit)}</div><div>Kapı tipi</div><div>${esc(s.kapi)}</div><div>Yapılan işlemler</div><div style="white-space:pre-wrap;min-height:60px">${esc(s.yapilan)}</div></div>
  <table><thead><tr><th>Malzeme adı</th><th class="n" style="width:70px">Adet</th><th class="n" style="width:120px">Birim fiyat</th><th class="n" style="width:130px">Toplam fiyat</th></tr></thead><tbody>
  ${rows.map(x => `<tr class="pb"><td>${esc(x.ad)}</td><td class="n">${n2(num(x.adet))}</td><td class="n">${money(num(x.fiyat))}</td><td class="n"><b>${money(num(x.adet) * num(x.fiyat))}</b></td></tr>`).join('') || '<tr><td colspan="4" style="color:#999">—</td></tr>'}
  </tbody></table>
  <div class="pb" style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-top:10px"><div class="terms" style="margin:0;border:0;padding:0;flex:1;font-weight:700">${esc(s.kdvEkle ? (S.servisSart || '').replace(/.*KDV dahil değildir\.?\n?/i, '') : S.servisSart)}</div>
  <div class="tots" style="margin-top:0"><div><span>Toplam</span><b>${money(h.top)}</b></div><div><span>KDV${s.kdvEkle ? ' %20' : ''}</span><b>${s.kdvEkle ? money(h.kdv) : '—'}</b></div><div class="g"><span>G. TOPLAM</span><span>${money(h.genel)}</span></div></div></div>
  <div class="pb" style="margin-top:22px;font-weight:700;text-align:center;font-size:12px;color:#0f2740">MALZEMELERİ EKSİKSİZ VE ÇALIŞIR DURUMDA TESLİM ALDIM</div>
  <div class="sigs pb" style="margin-top:10px"><div><div class="sp">${s.imza ? `<img src="${s.imza}">` : ''}</div><b>TESLİM ALAN</b><br>${esc(s.teslimAlan)}</div><div><div class="sp" style="font-size:14px">${trDate(s.tarih)}</div><b>TARİH</b></div><div><div class="sp">${s.kase && S.kase ? `<img src="${S.kase}">` : ''}</div><b>TESLİM EDEN</b><br>${esc(!s.teslimEden || s.teslimEden === S.yetkili ? S.unvan : s.teslimEden)}</div></div></div>`;
}

/* ---------------- PDF motoru (her sayfada başlık + alt bilgi) ---------------- */
const loadJS = src => new Promise((res, rej) => { if ($(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Kütüphane yüklenemedi')); document.head.append(s); });
const imgsReady = el => Promise.all($$('img', el).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
async function makePDF(html, head = PDF_HEAD(), foot = PDF_FOOT()) {
  await Promise.all([loadJS('vendor/html2canvas.min.js'), loadJS('vendor/jspdf.umd.min.js')]);
  const PH = 1123, sc = 2, opt = { scale: sc, backgroundColor: '#fff', useCORS: true, logging: false, windowWidth: 900 };
  const root = $('#pdfroot');
  root.innerHTML = `<div class="pgw" id="pH">${head || '<div style="height:36px"></div>'}</div><div class="pgw" id="pF">${foot || '<div style="height:30px"></div>'}</div><div class="pgw" id="pC">${html}</div>`;
  const hE = $('#pH'), fE = $('#pF'), doc = $('#pC');
  await imgsReady(root);
  const HH = Math.ceil(hE.getBoundingClientRect().height), FH = Math.ceil(fE.getBoundingClientRect().height);
  const CH = PH - HH - FH, M = 6, base = () => doc.getBoundingClientRect().top;
  for (const el of $$('.pb', doc)) {
    const b = el.getBoundingClientRect(); const top = b.top - base(), bot = b.bottom - base();
    const pg = Math.floor(top / CH); const lim = (pg + 1) * CH - M;
    if (bot > lim && b.height < CH - 2 * M) {
      const push = (pg + 1) * CH + M - top;
      if (el.tagName === 'TR') { const tr = document.createElement('tr'); tr.className = 'gap'; tr.innerHTML = `<td colspan="9" style="height:${push}px;padding:0;border:0;background:#fff"></td>`; el.before(tr); }
      else { const sp = document.createElement('div'); sp.style.height = push + 'px'; el.before(sp); }
    }
  }
  const H = doc.getBoundingClientRect().height; const pages = Math.max(1, Math.ceil((H - 4) / CH)); doc.style.height = pages * CH + 'px';
  const [ch, cf, cc] = [await html2canvas(hE, opt), await html2canvas(fE, opt), await html2canvas(doc, opt)];
  const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (let p = 0; p < pages; p++) {
    const c = document.createElement('canvas'); c.width = cc.width; c.height = PH * sc;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(ch, 0, 0);
    x.drawImage(cc, 0, p * CH * sc, cc.width, CH * sc, 0, HH * sc, cc.width, CH * sc);
    x.drawImage(cf, 0, (PH - FH) * sc);
    if (p) pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg', .9), 'JPEG', 0, 0, 210, 297);
    if (pages > 1) { pdf.setFontSize(8); pdf.setTextColor(140); pdf.text(`${p + 1} / ${pages}`, 200, 293, { align: 'right' }); }
  }
  root.innerHTML = '';
  return pdf.output('blob');
}


/* ---------------- Görsel yardımcıları ---------------- */
function imgToData(file, max, type = 'image/jpeg', q = .85) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL(type, q)); }; im.onerror = rej; im.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); });
}
function beyazTemizle(u) {
  return new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
    // arka plan parlaklığını tahmin et (kenarlar)
    let bg = 0, n = 0; for (let i = 0; i < c.width; i += 4) { for (const y of [0, c.height - 1]) { const k = (y * c.width + i) * 4; bg += Math.min(p[k], p[k + 1], p[k + 2]); n++; } } bg = bg / n;
    const hi = Math.min(250, bg - 8), lo = hi - 70;
    for (let i = 0; i < p.length; i += 4) { const m = Math.min(p[i], p[i + 1], p[i + 2]); if (m >= hi) p[i + 3] = 0; else if (m > lo) p[i + 3] = Math.round(255 * (hi - m) / (hi - lo)); }
    x.putImageData(d, 0, 0); res(c.toDataURL('image/png')); }; im.src = u; });
}

/* ---------------- Takvim (.ics) ---------------- */
function icsIndir(baslik, tarih, saat, gunluk, genel) {
  const [hh, mm] = (saat || '08:30').split(':').map(Number);
  const d = new Date(tarih + 'T00:00:00+03:00'); d.setUTCHours(hh - 3, mm, 0, 0);
  const f = x => x.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const url = location.origin + location.pathname + '#notlar';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BKM Door//TR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${genel ? 'bkm-gunluk' : uid()}@bkmdoor.com`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(d)}`, 'DURATION:PT15M', gunluk ? 'RRULE:FREQ=DAILY' : '', `SUMMARY:${baslik.replace(/\n/g, ' ').slice(0, 120)}`, `DESCRIPTION:${(genel ? 'Uygulamayı aç: ' : baslik.replace(/\n/g, '\\n') + '\\n\\n') + url}`, `URL:${url}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${baslik.slice(0, 80)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'hatirlatma.ics'; document.body.append(a); a.click(); a.remove();
  toast('Açılan ekranda “Ekle”ye bas');
}
function setBadge(n) { try { if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (e) { } }

/* ---------------- Yedek yükle ---------------- */
async function yedekYukle(file) {
  try {
    const o = JSON.parse(await file.text()); if (o.app !== 'bkmdoor') throw new Error('Bu dosya BKM Door yedeği değil');
    if (!confirm(`${o.tarih?.slice(0, 10)} tarihli yedek yüklensin mi? Telefondaki mevcut verilerin yerine geçer.`)) return;
    for (const s of STORES) { await DB.clear(s); for (const x of o[s] || []) await DB.put(s, x); }
    S = { ...DEF, ...o.ayar }; await saveS(); MODELS = await DB.all('modeller'); toast('Yedek yüklendi'); location.hash = 'home'; render();
  } catch (e) { toast('Hata: ' + e.message); }
}

/* ---------------- Kilit ---------------- */
const KILIT = '8dc946479dcfd1bdc8abe0340f1cc457cfde2cfab18d6efef8fb929e22bf4222';
const sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bkmdoor:' + t)))].map(b => b.toString(16).padStart(2, '0')).join('');
let kilitAcik = false, gizlendi = 0;
function kilitGoster() {
  kilitAcik = false;
  let k = $('#kilit'); if (!k) { k = document.createElement('div'); k.id = 'kilit'; document.body.append(k); }
  k.innerHTML = `<div class="kb"><img src="img/logo.png"><div class="mut" style="margin:14px 0 10px">Şifreni gir</div><input id="pin" class="i" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" style="text-align:center;font-size:26px;letter-spacing:8px"><button class="btn full" id="pinOk" style="margin-top:10px">Aç</button><div id="pinErr" class="sm" style="color:var(--red);height:20px;margin-top:8px"></div></div>`;
  const dene = async () => { const v = $('#pin').value.trim(); if (!v) return; const h = await sha(v); if (h === (S.pinHash || KILIT)) { kilitAcik = true; k.remove(); try { sessionStorage.setItem('bkmAcik', '1'); } catch (e) { } render(); } else { $('#pinErr').textContent = 'Şifre yanlış'; $('#pin').value = ''; } };
  $('#pinOk').onclick = dene; $('#pin').onkeydown = e => { if (e.key === 'Enter') dene(); };
  setTimeout(() => $('#pin')?.focus(), 200);
}

/* ---------------- Başlat ---------------- */
(async () => {
  await DB.open(); await loadS();
  if (!S.seeded || num(S.ver) < 2) { await DB.clear('modeller'); for (const m of seedModels()) await DB.put('modeller', m); S.seeded = true; S.ver = 2; if (num(S.teklifNo) < 2347) S.teklifNo = 2347; await saveS(); }
  MODELS = await DB.all('modeller');
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveNow(); gizlendi = Date.now(); return; } if (kilitAcik && gizlendi && Date.now() - gizlendi > 10 * 60 * 1000) { try { sessionStorage.removeItem('bkmAcik'); } catch (e) { } kilitGoster(); return; } if (kilitAcik && (location.hash.slice(1) || 'home') === 'home') render(true); });
  let ok = false; try { ok = sessionStorage.getItem('bkmAcik') === '1'; } catch (e) { }
  if (ok) { kilitAcik = true; render(); } else kilitGoster();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
})();
