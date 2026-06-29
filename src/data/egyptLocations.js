// Hierarchical Egyptian governorates + districts in Arabic and English.
// Used by the LocationPicker component in the Marketing Brain.

export const EGYPT_LOCATIONS = {
  cairo: {
    en: 'Cairo', ar: 'القاهرة',
    districts: {
      nasr_city:        { en: 'Nasr City',          ar: 'مدينة نصر' },
      madinaty:         { en: 'Madinaty',            ar: 'مدينتي' },
      fifth_settlement: { en: 'Fifth Settlement',   ar: 'التجمع الخامس' },
      badr_city:        { en: 'Badr City',           ar: 'مدينة بدر' },
      heliopolis:       { en: 'Heliopolis',          ar: 'مصر الجديدة' },
      zamalek:          { en: 'Zamalek',             ar: 'الزمالك' },
      downtown:         { en: 'Downtown',            ar: 'وسط البلد' },
      mokattam:         { en: 'Mokattam',            ar: 'المقطم' },
      shubra:           { en: 'Shubra',              ar: 'شبرا' },
      ain_shams:        { en: 'Ain Shams',           ar: 'عين شمس' },
      new_cairo:        { en: 'New Cairo',           ar: 'القاهرة الجديدة' },
      shorouk:          { en: 'Al Shorouk City',     ar: 'مدينة الشروق' },
    },
  },
  alexandria: {
    en: 'Alexandria', ar: 'الإسكندرية',
    districts: {
      smouha:    { en: 'Smouha',    ar: 'سموحة' },
      gleem:     { en: 'Gleem',     ar: 'جليم' },
      sidi_gaber:{ en: 'Sidi Gaber',ar: 'سيدي جابر' },
      montaza:   { en: 'Montaza',   ar: 'المنتزه' },
      agami:     { en: 'Agami',     ar: 'العجمي' },
      miami:     { en: 'Miami',     ar: 'ميامي' },
      stanley:   { en: 'Stanley',   ar: 'ستانلي' },
      mandara:   { en: 'Mandara',   ar: 'المندرة' },
    },
  },
  giza: {
    en: 'Giza', ar: 'الجيزة',
    districts: {
      sixth_october: { en: '6th of October',  ar: 'السادس من أكتوبر' },
      sheikh_zayed:  { en: 'Sheikh Zayed',    ar: 'الشيخ زايد' },
      dokki:         { en: 'Dokki',           ar: 'الدقي' },
      mohandessin:   { en: 'Mohandessin',     ar: 'المهندسين' },
      haram:         { en: 'Haram',           ar: 'الهرم' },
      faisal:        { en: 'Faisal',          ar: 'فيصل' },
      smart_village: { en: 'Smart Village',   ar: 'القرية الذكية' },
    },
  },
  new_capital: {
    en: 'New Administrative Capital', ar: 'العاصمة الإدارية الجديدة',
    districts: {
      r1:                  { en: 'R1',                  ar: 'R1' },
      r2:                  { en: 'R2',                  ar: 'R2' },
      r3:                  { en: 'R3',                  ar: 'R3' },
      r7:                  { en: 'R7',                  ar: 'R7' },
      r8:                  { en: 'R8',                  ar: 'R8' },
      government_district: { en: 'Government District', ar: 'الحي الحكومي' },
      financial_district:  { en: 'Financial District',  ar: 'الحي المالي' },
    },
  },
  north_coast: {
    en: 'North Coast', ar: 'الساحل الشمالي',
    districts: {
      sahel:        { en: 'Sahel',        ar: 'الساحل' },
      marsa_matrouh:{ en: 'Marsa Matrouh',ar: 'مرسى مطروح' },
      alamein:      { en: 'Alamein',      ar: 'العلمين' },
      fouka:        { en: 'Fouka',        ar: 'فوكة' },
    },
  },
  red_sea: {
    en: 'Red Sea', ar: 'البحر الأحمر',
    districts: {
      hurghada:   { en: 'Hurghada',     ar: 'الغردقة' },
      el_gouna:   { en: 'El Gouna',     ar: 'الجونة' },
      sharm:      { en: 'Sharm El Sheikh', ar: 'شرم الشيخ' },
      ain_sokhna: { en: 'Ain Sokhna',   ar: 'العين السخنة' },
    },
  },
  mansoura: {
    en: 'Mansoura', ar: 'المنصورة',
    districts: {
      mansoura_city: { en: 'Mansoura City', ar: 'مدينة المنصورة' },
      talkha:        { en: 'Talkha',        ar: 'طلخا' },
      mit_ghamr:     { en: 'Mit Ghamr',     ar: 'ميت غمر' },
    },
  },
  tanta: {
    en: 'Tanta', ar: 'طنطا',
    districts: {
      tanta_city: { en: 'Tanta City',   ar: 'مدينة طنطا' },
      mahalla:    { en: 'El Mahalla',   ar: 'المحلة الكبرى' },
      kafr_zayat: { en: 'Kafr El-Zayat',ar: 'كفر الزيات' },
    },
  },
  zagazig: {
    en: 'Zagazig', ar: 'الزقازيق',
    districts: {
      zagazig_city: { en: 'Zagazig City', ar: 'مدينة الزقازيق' },
      belbeis:      { en: 'Belbeis',      ar: 'بلبيس' },
      abu_kabir:    { en: 'Abu Kabir',    ar: 'أبو كبير' },
    },
  },
  ismailia: {
    en: 'Ismailia', ar: 'الإسماعيلية',
    districts: {
      ismailia_city: { en: 'Ismailia City', ar: 'مدينة الإسماعيلية' },
      fayed:         { en: 'Fayed',         ar: 'فايد' },
      qantara:       { en: 'El Qantara',    ar: 'القنطرة' },
    },
  },
  suez: {
    en: 'Suez', ar: 'السويس',
    districts: {
      suez_city: { en: 'Suez City', ar: 'مدينة السويس' },
      attaka:    { en: 'Attaka',    ar: 'عتاقة' },
      faisal_suez:{ en: 'Faisal',  ar: 'فيصل' },
    },
  },
  port_said: {
    en: 'Port Said', ar: 'بورسعيد',
    districts: {
      port_said_city: { en: 'Port Said City', ar: 'مدينة بورسعيد' },
      port_fouad:     { en: 'Port Fouad',     ar: 'بورفؤاد' },
      arab_quarter:   { en: 'Arab Quarter',   ar: 'الحي العربي' },
    },
  },
  luxor: {
    en: 'Luxor', ar: 'الأقصر',
    districts: {
      luxor_city: { en: 'Luxor City', ar: 'مدينة الأقصر' },
      karnak:     { en: 'Karnak',     ar: 'الكرنك' },
      west_bank:  { en: 'West Bank',  ar: 'الضفة الغربية' },
    },
  },
  aswan: {
    en: 'Aswan', ar: 'أسوان',
    districts: {
      aswan_city: { en: 'Aswan City', ar: 'مدينة أسوان' },
      edfu:       { en: 'Edfu',       ar: 'إدفو' },
      kom_ombo:   { en: 'Kom Ombo',   ar: 'كوم أمبو' },
    },
  },
}

// Flat list of all district keys for "select all" comparisons
export function allDistrictKeys() {
  const keys = []
  for (const govKey of Object.keys(EGYPT_LOCATIONS)) {
    for (const distKey of Object.keys(EGYPT_LOCATIONS[govKey].districts)) {
      keys.push(`${govKey}::${distKey}`)
    }
  }
  return keys
}

// Given a selection set like Set(['cairo::nasr_city', 'giza::dokki']),
// return a flat label string for display in AI prompts
export function selectionToLabels(selection, lang = 'ar') {
  if (selection.size === 0) return lang === 'ar' ? 'جميع أنحاء مصر' : 'All of Egypt'
  return [...selection].map(key => {
    const [gov, dist] = key.split('::')
    const govData = EGYPT_LOCATIONS[gov]
    if (!govData) return key
    const distData = govData.districts[dist]
    return distData ? distData[lang] : key
  }).join(', ')
}
