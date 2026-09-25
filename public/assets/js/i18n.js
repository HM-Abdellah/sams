const DICTIONARY = {
  fr: {
    locked_accounts:'Comptes verrouillés',date:'Date',
    school_dashboard:'Tableau de bord de l’établissement',dashboard_as_of:'Situation du jour :',refresh:'Actualiser',attention:'À surveiller',teacher_status:'État des enseignants',recent:'Récent',branch_statistics:'Statistiques par branche',branch_statistics_desc:'Chaque branche reste séparée pour éviter de mélanger les filières.',class_statistics:'Statistiques par classe',class_statistics_desc:'Une ligne correspond à une classe précise dans l’année scolaire active.',attention_students:'Élèves à surveiller',absence_threshold:"Seuil d'absence :",recent_activity:'Activité récente',today_records:"Enregistrements aujourd’hui",presence_rate:'Taux de présence enregistré',records:'Enregistrements',present:'Présents',absent:'Absents',late:'Retards',excused:'Excusés',branch:'Branche',student_count:'Élèves',class_count:'Classes',class_name:'Classe',absence_count:'Absences',late_count:'Retards',no_alerts:'Aucun point à surveiller.',no_records_today:'Aucun enregistrement de présence aujourd’hui.',review:'À vérifier',student:'Élève',user:'Utilisateur',activity:'Action',entity:'Entité',school:'Établissement',
    logout: 'Déconnexion', teachers: 'Enseignants', administration: 'Administration',
    teacher_management: 'Gestion des enseignants',
    teacher_management_desc: 'Présence, identité professionnelle, matières et classes enseignées.',
    new_subject: '+ Matière', assign_teaching: '+ Affecter un enseignement',
    total_teachers: 'Enseignants', online: 'En ligne', not_verified: 'Non vérifiés', inactive: 'Inactifs',
    offline: 'Hors ligne', active: 'Actifs', all: 'Tous', all_subjects: 'Toutes les matières', all_classes: 'Toutes les classes',
    search_teacher: 'Rechercher un enseignant…', edit_teacher: 'Modifier l’enseignant',
    employee_id: 'Matricule', full_name: 'Nom complet', phone: 'Téléphone', account_active: 'Compte actif',
    yes: 'Oui', no: 'Non', cancel: 'Annuler', save: 'Enregistrer', assign: 'Affecter',
    teacher: 'Enseignant', subject: 'Matière', class: 'Classe', subject_code: 'Code',
    name_french: 'Nom français', name_arabic: 'Nom arabe', name_english: 'Nom anglais', create: 'Créer',
    verified: 'Vérifié', no_assignments: 'Aucune affectation pédagogique', no_teachers: 'Aucun enseignant ne correspond aux filtres.', subjects: 'Matières',
    classes: 'Classes', last_activity: 'Dernière activité', no_phone: 'Aucun téléphone enregistré',
    no_employee_id: 'Aucun matricule', manage: 'Gérer', remove: 'Retirer', duplicate_assignment: 'Cette affectation existe déjà.'
  },
  ar: {
    locked_accounts:'الحسابات المقفلة',date:'التاريخ',
    school_dashboard:'لوحة قيادة المؤسسة',dashboard_as_of:'وضع اليوم:',refresh:'تحديث',attention:'يحتاج إلى الانتباه',teacher_status:'حالة الأساتذة',recent:'حديثًا',branch_statistics:'الإحصائيات حسب الشعبة',branch_statistics_desc:'تبقى كل شعبة منفصلة حتى لا تختلط المسارات الدراسية.',class_statistics:'الإحصائيات حسب القسم',class_statistics_desc:'كل سطر يمثل قسمًا محددًا داخل السنة الدراسية النشطة.',attention_students:'تلاميذ يحتاجون إلى المتابعة',absence_threshold:'عتبة الغياب:',recent_activity:'النشاط الأخير',today_records:'تسجيلات الحضور اليوم',presence_rate:'نسبة الحضور المسجّلة',records:'التسجيلات',present:'حاضرون',absent:'غائبون',late:'متأخرون',excused:'معفون',branch:'الشعبة',student_count:'التلاميذ',class_count:'الأقسام',class_name:'القسم',absence_count:'الغيابات',late_count:'التأخرات',no_alerts:'لا توجد نقاط تحتاج إلى المتابعة.',no_records_today:'لا توجد تسجيلات حضور اليوم.',review:'يحتاج إلى التحقق',student:'التلميذ',user:'المستخدم',activity:'الإجراء',entity:'الكيان',school:'المؤسسة',
    logout: 'تسجيل الخروج', teachers: 'الأساتذة', administration: 'الإدارة',
    teacher_management: 'إدارة الأساتذة',
    teacher_management_desc: 'الحضور، الهوية المهنية، المواد والأقسام التي يدرّسها كل أستاذ.',
    new_subject: '+ مادة', assign_teaching: '+ إضافة تكليف تدريسي',
    total_teachers: 'الأساتذة', online: 'متصلون', not_verified: 'غير موثّقين', inactive: 'غير نشطين',
    offline: 'غير متصل', active: 'نشطون', all: 'الكل', all_subjects: 'جميع المواد', all_classes: 'جميع الأقسام',
    search_teacher: 'البحث عن أستاذ…', edit_teacher: 'تعديل الأستاذ',
    employee_id: 'الرقم المهني', full_name: 'الاسم الكامل', phone: 'الهاتف', account_active: 'الحساب نشط',
    yes: 'نعم', no: 'لا', cancel: 'إلغاء', save: 'حفظ', assign: 'إضافة',
    teacher: 'الأستاذ', subject: 'المادة', class: 'القسم', subject_code: 'الرمز',
    name_french: 'الاسم بالفرنسية', name_arabic: 'الاسم بالعربية', name_english: 'الاسم بالإنجليزية', create: 'إنشاء',
    verified: 'موثّق', no_assignments: 'لا توجد تكليفات تدريسية', no_teachers: 'لا يوجد أستاذ يطابق عوامل التصفية.', subjects: 'المواد',
    classes: 'الأقسام', last_activity: 'آخر نشاط', no_phone: 'لا يوجد رقم هاتف مسجل',
    no_employee_id: 'لا يوجد رقم مهني', manage: 'إدارة', remove: 'إزالة', duplicate_assignment: 'هذا التكليف موجود بالفعل.'
  },
  en: {
    locked_accounts:'Locked accounts',date:'Date',
    school_dashboard:'School dashboard',dashboard_as_of:'Today:',refresh:'Refresh',attention:'Needs attention',teacher_status:'Teacher status',recent:'Recent',branch_statistics:'Statistics by branch',branch_statistics_desc:'Each branch remains separate so study tracks are not mixed.',class_statistics:'Statistics by class',class_statistics_desc:'Each row represents one specific class in the active academic year.',attention_students:'Students to monitor',absence_threshold:'Absence threshold:',recent_activity:'Recent activity',today_records:'Attendance records today',presence_rate:'Recorded attendance rate',records:'Records',present:'Present',absent:'Absent',late:'Late',excused:'Excused',branch:'Branch',student_count:'Students',class_count:'Classes',class_name:'Class',absence_count:'Absences',late_count:'Late',no_alerts:'Nothing needs attention.',no_records_today:'No attendance records today.',review:'Review',student:'Student',user:'User',activity:'Action',entity:'Entity',school:'School',
    logout: 'Log out', teachers: 'Teachers', administration: 'Administration',
    teacher_management: 'Teacher management',
    teacher_management_desc: 'Presence, professional identity, subjects and classes taught.',
    new_subject: '+ Subject', assign_teaching: '+ Assign teaching',
    total_teachers: 'Teachers', online: 'Online', not_verified: 'Unverified', inactive: 'Inactive',
    offline: 'Offline', active: 'Active', all: 'All', all_subjects: 'All subjects', all_classes: 'All classes',
    search_teacher: 'Search for a teacher…', edit_teacher: 'Edit teacher',
    employee_id: 'Employee ID', full_name: 'Full name', phone: 'Phone', account_active: 'Account active',
    yes: 'Yes', no: 'No', cancel: 'Cancel', save: 'Save', assign: 'Assign',
    teacher: 'Teacher', subject: 'Subject', class: 'Class', subject_code: 'Code',
    name_french: 'French name', name_arabic: 'Arabic name', name_english: 'English name', create: 'Create',
    verified: 'Verified', no_assignments: 'No teaching assignments', no_teachers: 'No teacher matches the selected filters.', subjects: 'Subjects',
    classes: 'Classes', last_activity: 'Last activity', no_phone: 'No phone registered',
    no_employee_id: 'No employee ID', manage: 'Manage', remove: 'Remove', duplicate_assignment: 'This teaching assignment already exists.'
  }
};

let current = localStorage.getItem('sams-language') || 'fr';
if (!DICTIONARY[current]) current = 'fr';

export function t(key) {
  return DICTIONARY[current]?.[key] ?? DICTIONARY.fr[key] ?? key;
}

export function currentLanguage() {
  return current;
}

export function setLanguage(language) {
  if (!DICTIONARY[language]) return;
  current = language;
  localStorage.setItem('sams-language', language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (key) element.placeholder = t(key);
  });
  document.querySelectorAll('.language-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === current);
    button.setAttribute('aria-pressed', button.dataset.lang === current ? 'true' : 'false');
  });
  window.dispatchEvent(new CustomEvent('sams:language', { detail: { language: current } }));
}

export function initLanguage() {
  document.querySelectorAll('.language-btn').forEach((button) => {
    button.addEventListener('click', () => setLanguage(button.dataset.lang || 'fr'));
  });
  setLanguage(current);
}
